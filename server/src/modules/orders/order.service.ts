import mongoose from 'mongoose';
import { Order, IOrderDocument } from './order.model';
import { Product } from '../products/product.model';
import { Retailer } from '../retailers/retailer.model';
import { User } from '../users/user.model';
import { cartService } from './cart.service';
import { Coupon } from '../discounts/discount.model';
import { discountService } from '../discounts/discount.service';
import { auditLogger } from '../audit/audit.service';
import { orderNotificationService } from './order-notification.service';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/api-error';
import {
  UserRole,
  AccountStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  CreditStatus,
  formatPaiseToINR,
  isValidOrderStatusTransition,
  isRolePermittedForOrderTransition,
  isTerminalOrderStatus,
  isForwardOrderStatusTransition,
} from '@necessity/shared';

export interface CheckoutInput {
  retailerId?: string;
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  paymentMethod: PaymentMethod;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode: string;
  };
  couponCode?: string;
  customerNotes?: string;
  idempotencyKey?: string;
}

export interface RecordOrderPaymentInput {
  paymentMethod: PaymentMethod | string;
  referenceNumber: string;
  amountPaise?: number;
  notes?: string;
}

export class OrderService {
  async checkout(input: CheckoutInput, currentUser: any): Promise<IOrderDocument> {
    const {
      retailerId: requestedRetailerId,
      items,
      paymentMethod,
      deliveryAddress,
      customerNotes,
      idempotencyKey,
    } = input;

    // 1. Idempotency Check: prevent duplicate order submissions
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey });
      if (existingOrder) {
        return existingOrder;
      }
    }

    // 2. Resolve target Retailer
    let targetRetailerId: string;
    if (currentUser.role === UserRole.RETAILER) {
      if (!currentUser.retailerProfileId) {
        throw ApiError.forbidden('Retailer profile not found on user account');
      }
      targetRetailerId = currentUser.retailerProfileId.toString();
    } else {
      if (!requestedRetailerId) {
        throw ApiError.badRequest('Retailer ID is required when placing order on behalf');
      }
      targetRetailerId = requestedRetailerId;
    }

    const retailer = await Retailer.findById(targetRetailerId);
    if (!retailer) {
      throw ApiError.notFound('Retailer account not found');
    }

    const linkedUser = await User.findById(retailer.userId);
    if (!linkedUser || linkedUser.accountStatus !== AccountStatus.ACTIVE || retailer.isActive === false) {
      throw ApiError.forbidden('Retailer account is not active, pending approval, or disabled');
    }

    // 3. Salesman authorization check
    if (currentUser.role === UserRole.SALESMAN) {
      const assignedId = (retailer.assignedSalesmanId as any)?._id?.toString() ||
        retailer.assignedSalesmanId?.toString();
      const currentUserId = (currentUser.id || currentUser._id).toString();

      if (assignedId && assignedId !== currentUserId) {
        throw ApiError.forbidden(
          'You are not authorized to book orders for this retailer'
        );
      }
    }

    // 4. Server-Authoritative Cart Calculation
    const calculatedCart = await cartService.calculateCart({
      items,
      deliveryStateCode: deliveryAddress.stateCode,
      customerType: retailer.customerType,
      retailerId: retailer.id || (retailer as any)._id?.toString(),
      couponCode: input.couponCode,
    });

    const grandTotalPaise = calculatedCart.grandTotalPaise;

    // Track reserved resources for atomic compensating rollback
    const reservedStockItems: Array<{ productId: any; variantId?: any; quantity: number }> = [];
    let creditReservedPaise = 0;

    try {
      // 5. Credit Account Validation & Atomic Reservation
      if (paymentMethod === PaymentMethod.CREDIT_ACCOUNT) {
        if (retailer.creditStatus === CreditStatus.ON_HOLD) {
          throw ApiError.badRequest(
            `Retailer credit account is on hold: ${retailer.creditHoldReason || 'Contact accounts department'}`
          );
        }

        // Atomically ensure available credit is sufficient and reserve in one query
        const updatedRetailer = await Retailer.findOneAndUpdate(
          {
            _id: retailer._id,
            creditStatus: { $ne: CreditStatus.ON_HOLD },
            $expr: {
              $gte: [
                {
                  $subtract: [
                    { $subtract: ['$creditLimitPaise', '$outstandingReceivablesPaise'] },
                    '$activeReservationsPaise',
                  ],
                },
                grandTotalPaise,
              ],
            },
          },
          { $inc: { activeReservationsPaise: grandTotalPaise } },
          { new: true }
        );

        if (!updatedRetailer) {
          const currentAvail = retailer.calculateAvailableCreditPaise();
          const shortfall = grandTotalPaise - currentAvail;
          throw ApiError.badRequest(
            `Insufficient credit limit. Order total is ${formatPaiseToINR(
              grandTotalPaise
            )}, but available credit is ${formatPaiseToINR(
              currentAvail
            )} (shortfall of ${formatPaiseToINR(
              Math.max(0, shortfall)
            )}). Please use Bank Transfer or UPI.`
          );
        }

        creditReservedPaise = grandTotalPaise;
      }

      // 6. Atomically reserve inventory stock for each product & variant
      for (const item of calculatedCart.items) {
        if (item.variantId) {
          const updatedProduct = await Product.findOneAndUpdate(
            {
              _id: item.productId,
              isActive: true,
              'variants._id': item.variantId,
            },
            {
              $inc: {
                stockReserved: item.quantity,
                'variants.$.stockReserved': item.quantity,
              },
            },
            { new: true }
          );

          if (!updatedProduct) {
            throw ApiError.badRequest(
              `Stock became unavailable for variant '${item.variantNameSnapshot || item.skuSnapshot}' of '${item.productNameSnapshot}' during checkout. Please review cart.`
            );
          }

          reservedStockItems.push({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          });
        } else {
          const updatedProduct = await Product.findOneAndUpdate(
            {
              _id: item.productId,
              isActive: true,
              $expr: {
                $gte: [{ $subtract: ['$stockOnHand', '$stockReserved'] }, item.quantity],
              },
            },
            { $inc: { stockReserved: item.quantity } },
            { new: true }
          );

          if (!updatedProduct) {
            throw ApiError.badRequest(
              `Stock became unavailable for product ${item.productNameSnapshot} during checkout. Please review cart.`
            );
          }

          reservedStockItems.push({
            productId: item.productId,
            quantity: item.quantity,
          });
        }
      }

      // 7. Generate Sequential Order Number: ORD-YYYYMM-XXXX
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `ORD-${yearMonth}-${randomSuffix}`;

      // 8. Create Order Document
      const initialStatus = OrderStatus.PENDING;
      const initialPaymentStatus = PaymentStatus.UNPAID;

      const order = await Order.create({
        orderNumber,
        retailerId: retailer._id,
        retailerName: retailer.businessName,
        placedByUserId: currentUser.id || currentUser._id,
        placedByName: currentUser.name || currentUser.email || currentUser.phone,
        salesmanId:
          currentUser.role === UserRole.SALESMAN
            ? currentUser.id || currentUser._id
            : retailer.assignedSalesmanId,
        status: initialStatus,
        items: calculatedCart.items,
        subtotalPaise: calculatedCart.subtotalPaise,
        totalDiscountPaise: calculatedCart.totalDiscountPaise,
        totalProductDiscountPaise: calculatedCart.totalProductDiscountPaise,
        couponCode: calculatedCart.couponCode,
        couponDiscountPaise: calculatedCart.couponDiscountPaise,
        taxableAmountPaise: calculatedCart.taxableAmountPaise,
        totalCgstPaise: calculatedCart.totalCgstPaise,
        totalSgstPaise: calculatedCart.totalSgstPaise,
        totalIgstPaise: calculatedCart.totalIgstPaise,
        deliveryFeePaise: calculatedCart.deliveryFeePaise,
        grandTotalPaise,
        totalPaidPaise: 0,
        payments: [],
        statusHistory: [
          {
            previousStatus: 'none',
            newStatus: initialStatus,
            changedByUserId: currentUser.id || currentUser._id,
            changedByName: currentUser.name || currentUser.email || currentUser.phone || 'Customer',
            changedByRole: currentUser.role,
            reason: 'Order placed by customer',
            timestamp: new Date(),
          },
        ],
        paymentMethod,
        paymentStatus: initialPaymentStatus,
        creditReservationPaise: creditReservedPaise,
        deliveryAddress,
        customerNotes,
        idempotencyKey,
      });

      // 9. Atomic Coupon Redemption Record
      if (calculatedCart.couponCode && calculatedCart.couponDiscountPaise > 0) {
        const couponDoc = await Coupon.findOne({ code: calculatedCart.couponCode });
        if (couponDoc) {
          await discountService.recordCouponRedemption(
            couponDoc._id.toString(),
            retailer._id.toString(),
            retailer.businessName,
            order._id.toString(),
            order.orderNumber,
            calculatedCart.couponDiscountPaise
          );
        }
      }

      // 10. Audit Logging
      await auditLogger.logAction({
        actorId: (currentUser.id || currentUser._id).toString(),
        action: 'ORDER_CREATED',
        targetResource: 'Order',
        targetId: order.id,
        details: {
          orderNumber: order.orderNumber,
          retailerName: retailer.businessName,
          grandTotalPaise,
          paymentMethod,
          itemsCount: calculatedCart.items.length,
        },
      });

      // 11. Customer Email Notification (Order Placed - Pending)
      try {
        await orderNotificationService.sendOrderStatusNotification(order.id, OrderStatus.PENDING);
      } catch (notifyErr: any) {
        logger.error(
          `[OrderService] Non-fatal notification failure on checkout for order ${order.orderNumber}: ${notifyErr.message}`
        );
      }

      return order;
    } catch (err: any) {
      // COMPENSATING ROLLBACK: Never leave orphaned reservations
      for (const reserved of reservedStockItems) {
        if (reserved.variantId) {
          await Product.findOneAndUpdate(
            { _id: reserved.productId, 'variants._id': reserved.variantId },
            {
              $inc: {
                stockReserved: -reserved.quantity,
                'variants.$.stockReserved': -reserved.quantity,
              },
            }
          );
        } else {
          await Product.findByIdAndUpdate(reserved.productId, {
            $inc: { stockReserved: -reserved.quantity },
          });
        }
      }

      if (creditReservedPaise > 0) {
        await Retailer.findByIdAndUpdate(retailer._id, {
          $inc: { activeReservationsPaise: -creditReservedPaise },
        });
      }

      // Handle duplicate idempotency key race condition gracefully
      if (err.code === 11000 && idempotencyKey) {
        const existing = await Order.findOne({ idempotencyKey });
        if (existing) {
          return existing;
        }
      }

      throw err;
    }
  }

  async listOrders(query: any, currentUser: any) {
    const { status, search, retailerId, page = 1, limit = 20 } = query;
    const andConditions: any[] = [];

    // RBAC Isolation: Combine role constraints safely with search using $and
    if (currentUser.role === UserRole.RETAILER) {
      if (!currentUser.retailerProfileId) {
        return { items: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } };
      }
      andConditions.push({ retailerId: new mongoose.Types.ObjectId(currentUser.retailerProfileId) });
    } else if (currentUser.role === UserRole.SALESMAN) {
      const salesmanObjectId = new mongoose.Types.ObjectId(currentUser.id || currentUser._id);
      andConditions.push({
        $or: [
          { salesmanId: salesmanObjectId },
          { placedByUserId: salesmanObjectId },
        ],
      });
    } else if (retailerId && mongoose.Types.ObjectId.isValid(retailerId)) {
      andConditions.push({ retailerId: new mongoose.Types.ObjectId(retailerId) });
    }

    if (status && Object.values(OrderStatus).includes(status)) {
      andConditions.push({ status });
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      andConditions.push({
        $or: [
          { orderNumber: searchRegex },
          { retailerName: searchRegex },
        ],
      });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Order.find(filter)
        .populate('retailerId', 'businessName contactPerson phone email gstin')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return {
      items: items.map((o: any) => ({ ...o, id: o._id.toString() })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getOrderById(orderId: string, currentUser: any): Promise<IOrderDocument> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw ApiError.badRequest('Invalid order ID');
    }

    const order = await Order.findById(orderId).populate(
      'retailerId',
      'businessName contactPerson phone email gstin deliveryAddresses'
    );
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const orderRetailerId = (order.retailerId as any)?._id || order.retailerId;

    // Role-level checks
    if (currentUser.role === UserRole.RETAILER) {
      if (
        !currentUser.retailerProfileId ||
        orderRetailerId.toString() !== currentUser.retailerProfileId.toString()
      ) {
        throw ApiError.forbidden('You do not have permission to view this order');
      }
    } else if (currentUser.role === UserRole.SALESMAN) {
      const currentUserId = (currentUser.id || currentUser._id).toString();
      if (
        order.salesmanId?.toString() !== currentUserId &&
        order.placedByUserId.toString() !== currentUserId
      ) {
        throw ApiError.forbidden('You do not have permission to view this order');
      }
    }

    return order;
  }

  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    currentUser: any,
    reason?: string,
    details?: {
      dispatchDetails?: {
        dispatchedAt?: Date;
        courierName?: string;
        trackingNumber?: string;
        trackingUrl?: string;
        transportDetails?: string;
      };
      pickupDetails?: {
        pickedUpAt?: Date;
        pickupLocation?: string;
        collectedBy?: string;
        notes?: string;
      };
    }
  ): Promise<IOrderDocument> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw ApiError.badRequest('Invalid order ID');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const previousStatus = order.status;
    if (previousStatus === newStatus) {
      return order;
    }

    // 1. Terminal state check: orders in terminal states permit NO further updates
    if (isTerminalOrderStatus(previousStatus)) {
      throw ApiError.badRequest(
        `Order is in terminal status '${previousStatus}' and cannot undergo further status transitions.`
      );
    }

    // 2. Enforce forward-only status progression (prevent backward transitions)
    if (!isForwardOrderStatusTransition(previousStatus, newStatus)) {
      throw ApiError.badRequest(
        `Invalid status transition: backward status transitions are strictly prohibited. Cannot transition from '${previousStatus}' to '${newStatus}'.`
      );
    }

    // 3. Role authorization check for status transitions
    if (currentUser.role === UserRole.RETAILER && newStatus !== OrderStatus.CANCELLED) {
      throw ApiError.forbidden('Retailers can only cancel orders in pending review status');
    }

    if (!isRolePermittedForOrderTransition(currentUser.role, previousStatus, newStatus)) {
      throw ApiError.forbidden(
        `Role '${currentUser.role}' is not permitted to transition order from '${previousStatus}' to '${newStatus}'`
      );
    }

    // 2. Authoritative transition matrix check
    if (!isValidOrderStatusTransition(previousStatus, newStatus)) {
      throw ApiError.badRequest(
        `Invalid status transition from '${previousStatus}' to '${newStatus}'`
      );
    }

    // 3. Ownership checks for customer and sales roles
    const currentUserId = (currentUser.id || currentUser._id).toString();

    if (currentUser.role === UserRole.RETAILER) {
      if (
        !currentUser.retailerProfileId ||
        order.retailerId.toString() !== currentUser.retailerProfileId.toString()
      ) {
        throw ApiError.forbidden('You can only cancel your own orders');
      }
      if (previousStatus !== OrderStatus.SUBMITTED && previousStatus !== OrderStatus.PENDING) {
        throw ApiError.badRequest('Orders that have been approved or processed cannot be cancelled by retailer');
      }
    } else if (currentUser.role === UserRole.SALESMAN) {
      const isOwner =
        order.placedByUserId?.toString() === currentUserId ||
        order.salesmanId?.toString() === currentUserId;
      if (!isOwner) {
        throw ApiError.forbidden('You can only cancel orders you booked or are assigned to');
      }
      if (previousStatus !== OrderStatus.SUBMITTED && previousStatus !== OrderStatus.PENDING) {
        throw ApiError.badRequest('Orders already in processing or dispatch cannot be cancelled');
      }
    }

    // Release stock and credit reservations if CANCELLED or REJECTED
    if (newStatus === OrderStatus.CANCELLED || newStatus === OrderStatus.REJECTED) {
      // 1. Release reserved stock
      for (const item of order.items || []) {
        if (!item.productId) continue;
        if (item.variantId) {
          await Product.findOneAndUpdate(
            { _id: item.productId, 'variants._id': item.variantId },
            {
              $inc: {
                stockReserved: -item.quantity,
                'variants.$.stockReserved': -item.quantity,
              },
            }
          );
        } else {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stockReserved: -item.quantity },
          });
        }
      }

      // 2. Release credit reservation if applicable (atomic single release)
      if (order.creditReservationPaise && order.creditReservationPaise > 0 && order.retailerId) {
        await Retailer.findByIdAndUpdate(order.retailerId, {
          $inc: { activeReservationsPaise: -order.creditReservationPaise },
        });
        order.creditReservationPaise = 0;
      }

      order.cancellationReason = reason || `Cancelled by ${currentUser.name || currentUser.email}`;
    }

    // Finalize stock decrement and convert reservation to receivables upon DELIVERED or PICKED_UP
    if (newStatus === OrderStatus.DELIVERED || newStatus === OrderStatus.PICKED_UP) {
      for (const item of order.items || []) {
        if (!item.productId) continue;
        if (item.variantId) {
          await Product.findOneAndUpdate(
            { _id: item.productId, 'variants._id': item.variantId },
            {
              $inc: {
                stockOnHand: -item.quantity,
                stockReserved: -item.quantity,
                'variants.$.stockOnHand': -item.quantity,
                'variants.$.stockReserved': -item.quantity,
              },
            }
          );
        } else {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: {
              stockOnHand: -item.quantity,
              stockReserved: -item.quantity,
            },
          });
        }
      }

      if (order.creditReservationPaise && order.creditReservationPaise > 0 && order.retailerId) {
        // Shift active reservation to posted receivables
        await Retailer.findByIdAndUpdate(order.retailerId, {
          $inc: {
            activeReservationsPaise: -order.creditReservationPaise,
            outstandingReceivablesPaise: order.creditReservationPaise,
          },
        });
        order.creditReservationPaise = 0;
      }
      // Note: order.paymentStatus remains independent and is never auto-updated on delivery/pickup
    }

    // Attach dispatch / courier details if moving to DISPATCHED
    if (newStatus === OrderStatus.DISPATCHED) {
      order.dispatchDetails = {
        dispatchedAt: details?.dispatchDetails?.dispatchedAt || new Date(),
        courierName: details?.dispatchDetails?.courierName?.trim() || 'Standard Surface Transport',
        trackingNumber: details?.dispatchDetails?.trackingNumber?.trim() || undefined,
        trackingUrl: details?.dispatchDetails?.trackingUrl?.trim() || undefined,
        transportDetails: details?.dispatchDetails?.transportDetails?.trim() || undefined,
      };
    }

    // Attach pickup / collection details if moving to PICKED_UP or DELIVERED
    if (newStatus === OrderStatus.PICKED_UP || newStatus === OrderStatus.DELIVERED) {
      order.pickupDetails = {
        pickedUpAt: details?.pickupDetails?.pickedUpAt || new Date(),
        pickupLocation: details?.pickupDetails?.pickupLocation?.trim() || 'Necessity Central Warehouse - Mohali',
        collectedBy: details?.pickupDetails?.collectedBy?.trim() || (currentUser.name || 'Customer Representative'),
        notes: details?.pickupDetails?.notes?.trim() || undefined,
      };
    }

    // Maintain persistent status transition audit history
    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    order.statusHistory.push({
      previousStatus,
      newStatus,
      changedByUserId: mongoose.Types.ObjectId.isValid(currentUserId)
        ? (new mongoose.Types.ObjectId(currentUserId) as any)
        : undefined,
      changedByName: currentUser.name || currentUser.email || currentUser.phone || 'Admin',
      changedByRole: currentUser.role || 'admin',
      reason: reason?.trim() || (newStatus === OrderStatus.CANCELLED ? order.cancellationReason : undefined),
      timestamp: new Date(),
    });

    if (newStatus === OrderStatus.CANCELLED && !order.cancellationReason) {
      order.cancellationReason = reason?.trim() || `Cancelled by ${currentUser.name || 'Admin'}`;
    }

    order.status = newStatus;
    await order.save();

    await auditLogger.logAction({
      actorId: currentUserId,
      action: 'ORDER_STATUS_UPDATED',
      targetResource: 'Order',
      targetId: order.id,
      details: {
        orderNumber: order.orderNumber,
        previousStatus,
        newStatus,
        reason,
      },
    });

    // Send Customer Email Notification for Order Status transitions
    try {
      await orderNotificationService.sendOrderStatusNotification(order.id, newStatus, details);
    } catch (notifyErr: any) {
      logger.error(
        `[OrderService] Non-fatal notification failure on status update for order ${order.orderNumber} (${newStatus}): ${notifyErr.message}`
      );
    }

    return order;
  }

  async recordOrderPayment(
    orderId: string,
    input: RecordOrderPaymentInput,
    currentUser: any
  ): Promise<IOrderDocument> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw ApiError.badRequest('Invalid order ID');
    }

    const currentUserId = (currentUser.id || currentUser._id).toString();
    const authorizedRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTS_MANAGER];
    if (!authorizedRoles.includes(currentUser.role)) {
      throw ApiError.forbidden('Only Finance Admins and Super Admins can verify and record payments');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if (!input.referenceNumber || !input.referenceNumber.trim()) {
      throw ApiError.badRequest('Payment reference / UTR / Cheque number is required');
    }

    const currentPaidPaise = order.totalPaidPaise || 0;
    const remainingPaise = Math.max(0, order.grandTotalPaise - currentPaidPaise);

    if (remainingPaise <= 0) {
      throw ApiError.badRequest(
        `This order is already fully paid (Total: ${formatPaiseToINR(order.grandTotalPaise)})`
      );
    }

    let paymentAmountPaise = input.amountPaise !== undefined ? Math.round(Number(input.amountPaise)) : remainingPaise;

    if (paymentAmountPaise <= 0) {
      throw ApiError.badRequest('Payment amount must be greater than zero');
    }

    if (paymentAmountPaise > remainingPaise) {
      throw ApiError.badRequest(
        `Payment amount (${formatPaiseToINR(paymentAmountPaise)}) cannot exceed the remaining balance of ${formatPaiseToINR(remainingPaise)}`
      );
    }

    const previousPaymentStatus = order.paymentStatus;
    const previousPaidPaise = currentPaidPaise;
    const newTotalPaidPaise = currentPaidPaise + paymentAmountPaise;
    const isFullPayment = newTotalPaidPaise >= order.grandTotalPaise;

    // Create payment transaction record
    const paymentRecord = {
      amountPaise: paymentAmountPaise,
      paymentMethod: (input.paymentMethod as string) || (order.paymentMethod as string) || 'OFFLINE',
      referenceNumber: input.referenceNumber.trim(),
      notes: input.notes?.trim() || undefined,
      verifiedByUserId: new mongoose.Types.ObjectId(currentUserId),
      verifiedByName: currentUser.name || currentUser.email || 'Finance Admin',
      verifiedByRole: currentUser.role,
      verifiedAt: new Date(),
    };

    if (!order.payments) {
      order.payments = [];
    }
    order.payments.push(paymentRecord);

    order.totalPaidPaise = newTotalPaidPaise;
    order.paymentStatus = isFullPayment ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;
    if (input.paymentMethod) {
      order.paymentMethod = input.paymentMethod as any;
    }

    // Pro-rate or release credit reservation if order had one
    if (order.creditReservationPaise && order.creditReservationPaise > 0 && order.retailerId) {
      const creditToRelease = Math.min(order.creditReservationPaise, paymentAmountPaise);
      await Retailer.findByIdAndUpdate(order.retailerId, {
        $inc: { activeReservationsPaise: -creditToRelease },
      });
      order.creditReservationPaise -= creditToRelease;
    }

    const paymentNote = `[Verified Offline Payment: ${formatPaiseToINR(paymentAmountPaise)} via ${paymentRecord.paymentMethod} | Ref: ${paymentRecord.referenceNumber} | By: ${paymentRecord.verifiedByName} (${paymentRecord.verifiedByRole})${input.notes ? ` | Note: ${input.notes}` : ''}]`;
    order.internalNotes = order.internalNotes ? `${order.internalNotes}\n${paymentNote}` : paymentNote;

    await order.save();

    await auditLogger.logAction({
      actorId: currentUserId,
      action: 'ORDER_OFFLINE_PAYMENT_RECORDED',
      targetResource: 'Order',
      targetId: order.id,
      details: {
        orderNumber: order.orderNumber,
        previousPaymentStatus,
        newPaymentStatus: order.paymentStatus,
        previousPaidPaise,
        newTotalPaidPaise,
        remainingBalancePaise: Math.max(0, order.grandTotalPaise - newTotalPaidPaise),
        paymentMethod: paymentRecord.paymentMethod,
        referenceNumber: paymentRecord.referenceNumber,
        amountPaise: paymentAmountPaise,
        isFullPayment,
      },
    });

    // Customer Email Notification for Payment Received
    try {
      await orderNotificationService.sendPaymentReceivedNotification(order.id, {
        amountPaidPaise: paymentAmountPaise,
        totalPaidPaise: newTotalPaidPaise,
        remainingBalancePaise: Math.max(0, order.grandTotalPaise - newTotalPaidPaise),
        grandTotalPaise: order.grandTotalPaise,
        paymentMethod: paymentRecord.paymentMethod,
        referenceNumber: paymentRecord.referenceNumber,
        isPartial: !isFullPayment,
        notes: input.notes,
      });
    } catch (notifyErr: any) {
      logger.error(
        `[OrderService] Non-fatal notification failure on payment recording for order ${order.orderNumber}: ${notifyErr.message}`
      );
    }

    return order;
  }

  async updateOrderPaymentStatus(
    orderId: string,
    paymentStatus: string,
    currentUser: any
  ): Promise<IOrderDocument> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw ApiError.badRequest('Invalid order ID');
    }

    const order = await Order.findById(orderId).populate(
      'retailerId',
      'businessName contactPerson phone email gstin deliveryAddresses'
    );
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const normalizedStatus = (paymentStatus || '').toUpperCase();
    if (normalizedStatus === 'PAID' || normalizedStatus === 'SUCCESSFUL') {
      order.paymentStatus = PaymentStatus.SUCCESSFUL;
      order.totalPaidPaise = order.grandTotalPaise;
      order.remainingBalancePaise = 0;
      if (!order.payments || order.payments.length === 0) {
        order.payments = [
          {
            amountPaise: order.grandTotalPaise,
            paymentMethod: order.paymentMethod || PaymentMethod.UPI,
            referenceNumber: `UPI-TXN-${Date.now().toString().slice(-8)}`,
            verifiedByName: currentUser?.name || 'Admin',
            verifiedByRole: currentUser?.role || 'ADMIN',
            verifiedAt: new Date(),
            notes: 'Payment verified manually by admin',
          } as any,
        ];
      }
    } else {
      order.paymentStatus = PaymentStatus.PENDING;
      order.totalPaidPaise = 0;
      order.remainingBalancePaise = order.grandTotalPaise;
    }

    await order.save();
    return order;
  }
}

export const orderService = new OrderService();

