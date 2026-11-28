import crypto from 'crypto';
import mongoose from 'mongoose';
import { PaymentTransaction, IPaymentTransactionDocument } from './payment.model';
import { Order } from '../orders/order.model';
import { Retailer } from '../retailers/retailer.model';
import { auditLogger } from '../audit/audit.service';
import { ENV } from '../../config/env';
import { ApiError } from '../../utils/api-error';
import { PaymentMethod, PaymentStatus, OrderStatus, UserRole } from '@necessity/shared';
import { orderNotificationService } from '../orders/order-notification.service';
import { logger } from '../../config/logger';

export class PaymentService {
  /**
   * Initializes a payment intent/order for an order.
   * If Razorpay credentials are configured, calls Razorpay Orders API.
   */
  async createPaymentOrder(
    orderId: string,
    currentUser: any,
    idempotencyKey?: string
  ): Promise<{
    transactionId: string;
    provider: string;
    providerOrderId?: string;
    amountPaise: number;
    currency: string;
    keyId?: string;
  }> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw ApiError.badRequest('Invalid order ID');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    // Role check
    if (currentUser.role === UserRole.RETAILER) {
      if (
        !currentUser.retailerProfileId ||
        order.retailerId.toString() !== currentUser.retailerProfileId.toString()
      ) {
        throw ApiError.forbidden('You do not have permission to pay for this order');
      }
    }

    if (
      order.paymentStatus === PaymentStatus.SUCCESSFUL ||
      order.paymentStatus === PaymentStatus.PAID
    ) {
      throw ApiError.badRequest('Order has already been paid');
    }

    // Idempotency check
    if (idempotencyKey) {
      const existingTx = await PaymentTransaction.findOne({ idempotencyKey });
      if (existingTx) {
        return {
          transactionId: existingTx.id,
          provider: existingTx.provider,
          providerOrderId: existingTx.providerOrderId,
          amountPaise: existingTx.amountPaise,
          currency: existingTx.currency,
          keyId: ENV.RAZORPAY_KEY_ID,
        };
      }
    }

    let providerOrderId: string | undefined;

    // Call Razorpay API if live gateway is selected and credentials configured
    const isMock = ENV.PAYMENT_PROVIDER === 'mock_gateway' || !ENV.RAZORPAY_KEY_ID || !ENV.RAZORPAY_KEY_SECRET;
    if (!isMock && ENV.RAZORPAY_KEY_ID && ENV.RAZORPAY_KEY_SECRET) {
      try {
        const authHeader = Buffer.from(
          `${ENV.RAZORPAY_KEY_ID}:${ENV.RAZORPAY_KEY_SECRET}`
        ).toString('base64');

        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: order.grandTotalPaise,
            currency: 'INR',
            receipt: order.orderNumber,
            notes: {
              retailerId: order.retailerId.toString(),
              orderId: order.id,
            },
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`Razorpay order creation returned ${response.status}: ${err}`);
        }

        const data = (await response.json()) as any;
        providerOrderId = data.id;
      } catch (err: any) {
        if (ENV.NODE_ENV === 'development') {
          // Gracefully fallback to simulated order ID in development
          providerOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        } else {
          throw ApiError.badRequest(`Payment provider communication failure: ${err.message}`);
        }
      }
    } else {
      // In development or mock mode
      providerOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    const tx = await PaymentTransaction.create({
      orderId: order._id,
      retailerId: order.retailerId,
      paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
      provider: 'razorpay',
      amountPaise: order.grandTotalPaise,
      currency: 'INR',
      status: PaymentStatus.INITIATED,
      providerOrderId,
      idempotencyKey,
    });

    await auditLogger.logAction({
      actorId: (currentUser.id || currentUser._id).toString(),
      action: 'PAYMENT_INITIATED',
      targetResource: 'PaymentTransaction',
      targetId: tx.id,
      details: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amountPaise: order.grandTotalPaise,
        providerOrderId,
      },
    });

    return {
      transactionId: tx.id,
      provider: 'razorpay',
      providerOrderId,
      amountPaise: order.grandTotalPaise,
      currency: 'INR',
      keyId: ENV.RAZORPAY_KEY_ID,
    };
  }

  /**
   * Validates Razorpay client signature using HMAC-SHA256 with server secret.
   * NEVER trust client without signature validation!
   */
  async verifyPaymentSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): Promise<{ success: boolean; transaction: IPaymentTransactionDocument }> {
    const { providerOrderId, providerPaymentId, signature } = input;

    const tx = await PaymentTransaction.findOne({ providerOrderId });
    if (!tx) {
      throw ApiError.notFound('Payment transaction record not found');
    }

    if (tx.status === PaymentStatus.SUCCESSFUL) {
      return { success: true, transaction: tx };
    }

    // Verify cryptographic signature if not mock mode
    const isMock = ENV.PAYMENT_PROVIDER === 'mock_gateway' || providerOrderId.startsWith('order_mock_') || providerOrderId.startsWith('order_sim_');
    if (!isMock && ENV.RAZORPAY_KEY_SECRET) {
      const generatedSignature = crypto
        .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
        .update(`${providerOrderId}|${providerPaymentId}`)
        .digest('hex');

      if (generatedSignature !== signature) {
        tx.status = PaymentStatus.FAILED;
        tx.failureReason = 'Cryptographic signature mismatch';
        await tx.save();

        if (tx.orderId) {
          try {
            await orderNotificationService.sendPaymentFailedNotification(tx.orderId.toString(), {
              amountPaise: tx.amountPaise,
              paymentMethod: 'Razorpay Gateway',
              referenceNumber: providerPaymentId || providerOrderId,
              reason: 'Payment signature verification failed or transaction interrupted',
            });
          } catch (notifyErr: any) {
            logger.error(`[PaymentService] Failed to send payment failure email: ${notifyErr.message}`);
          }
        }

        throw ApiError.badRequest('Invalid payment signature verification failed');
      }
    }

    // Mark transaction as successful
    tx.status = PaymentStatus.SUCCESSFUL;
    tx.providerPaymentId = providerPaymentId;
    tx.signature = signature;
    await tx.save();

    // Reconcile Order status
    const order = await Order.findById(tx.orderId);
    if (order) {
      order.paymentStatus = PaymentStatus.PAID;
      order.totalPaidPaise = tx.amountPaise;
      order.remainingBalancePaise = Math.max(0, order.grandTotalPaise - tx.amountPaise);
      if (order.status === OrderStatus.SUBMITTED || order.status === OrderStatus.PENDING) {
        order.status = OrderStatus.APPROVED;
      }
      const alreadyLogged = order.payments?.some(
        (p) => p.referenceNumber === providerPaymentId
      );
      if (!alreadyLogged) {
        order.payments.push({
          amountPaise: tx.amountPaise,
          paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
          referenceNumber: providerPaymentId,
          verifiedAt: new Date(),
          verifiedByName: 'Razorpay Payment Gateway',
          notes: `Instant gateway settlement (${providerOrderId})`,
        });
      }
      await order.save();

      // Dispatch Payment Success Email Notification
      try {
        await orderNotificationService.sendPaymentReceivedNotification(order.id, {
          amountPaidPaise: tx.amountPaise,
          totalPaidPaise: order.totalPaidPaise,
          remainingBalancePaise: order.remainingBalancePaise || 0,
          grandTotalPaise: order.grandTotalPaise,
          paymentMethod: 'Razorpay Gateway (Online)',
          referenceNumber: providerPaymentId,
          isPartial: (order.remainingBalancePaise || 0) > 0,
          notes: `Instant settlement verified for Order #${order.orderNumber}`,
        });
      } catch (notifyErr: any) {
        logger.error(`[PaymentService] Non-fatal notification failure on payment verify: ${notifyErr.message}`);
      }
    }

    await auditLogger.logAction({
      actorId: 'PAYMENT_GATEWAY',
      action: 'PAYMENT_VERIFIED',
      targetResource: 'PaymentTransaction',
      targetId: tx.id,
      details: {
        providerOrderId,
        providerPaymentId,
        amountPaise: tx.amountPaise,
      },
    });

    return { success: true, transaction: tx };
  }

  /**
   * Processes server-to-server webhook delivery from Razorpay.
   * Enforces webhook signature validation and idempotency against duplicate delivery.
   */
  async handleWebhook(rawBody: string, signature: string): Promise<{ received: boolean; action?: string }> {
    if (ENV.RAZORPAY_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', ENV.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        throw ApiError.forbidden('Webhook signature mismatch');
      }
    } else if (ENV.NODE_ENV === 'production') {
      throw ApiError.internal('Razorpay webhook secret is not configured in production');
    }

    const event = JSON.parse(rawBody);
    const eventId = event.event_id || event.id;

    // Check duplicate webhook delivery
    if (eventId) {
      const duplicate = await PaymentTransaction.findOne({ idempotencyKey: `webhook_${eventId}` });
      if (duplicate) {
        return { received: true, action: 'DUPLICATE_EVENT_IGNORED' };
      }
    }

    if (event.event === 'order.paid' || event.event === 'payment.captured') {
      const paymentEntity = event.payload?.payment?.entity;
      const providerOrderId = paymentEntity?.order_id;
      const providerPaymentId = paymentEntity?.id;

      if (providerOrderId) {
        const tx = await PaymentTransaction.findOne({ providerOrderId });
        if (tx && tx.status !== PaymentStatus.SUCCESSFUL) {
          tx.status = PaymentStatus.SUCCESSFUL;
          tx.providerPaymentId = providerPaymentId;
          tx.notes = `Captured via webhook event ${event.event}`;
          if (eventId && !tx.idempotencyKey) {
            tx.idempotencyKey = `webhook_${eventId}`;
          }
          await tx.save();

          const order = await Order.findById(tx.orderId);
          if (order) {
            order.paymentStatus = PaymentStatus.PAID;
            order.totalPaidPaise = tx.amountPaise;
            order.remainingBalancePaise = Math.max(0, order.grandTotalPaise - tx.amountPaise);
            if (order.status === OrderStatus.SUBMITTED || order.status === OrderStatus.PENDING) {
              order.status = OrderStatus.APPROVED;
            }
            const alreadyLogged = order.payments?.some(
              (p) => p.referenceNumber === providerPaymentId
            );
            if (!alreadyLogged) {
              order.payments.push({
                amountPaise: tx.amountPaise,
                paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
                referenceNumber: providerPaymentId,
                verifiedAt: new Date(),
                verifiedByName: 'Razorpay Webhook',
                notes: `Captured via webhook event ${event.event}`,
              });
            }
            await order.save();

            // Dispatch Payment Success Email Notification
            try {
              await orderNotificationService.sendPaymentReceivedNotification(order.id, {
                amountPaidPaise: tx.amountPaise,
                totalPaidPaise: order.totalPaidPaise,
                remainingBalancePaise: order.remainingBalancePaise || 0,
                grandTotalPaise: order.grandTotalPaise,
                paymentMethod: 'Razorpay Gateway (Online)',
                referenceNumber: providerPaymentId || 'N/A',
                isPartial: (order.remainingBalancePaise || 0) > 0,
                notes: `Captured via webhook event ${event.event}`,
              });
            } catch (notifyErr: any) {
              logger.error(`[PaymentService] Webhook notification failure: ${notifyErr.message}`);
            }
          }
        }
      }
    }

    if (event.event === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity;
      const providerOrderId = paymentEntity?.order_id;
      const failReason =
        paymentEntity?.error_description ||
        paymentEntity?.error_reason ||
        'Payment failed at gateway';
      if (providerOrderId) {
        const tx = await PaymentTransaction.findOne({ providerOrderId });
        if (tx && tx.status !== PaymentStatus.SUCCESSFUL) {
          tx.status = PaymentStatus.FAILED;
          tx.failureReason = failReason;
          await tx.save();

          if (tx.orderId) {
            try {
              await orderNotificationService.sendPaymentFailedNotification(tx.orderId.toString(), {
                amountPaise: tx.amountPaise,
                paymentMethod: 'Razorpay Gateway',
                referenceNumber: paymentEntity?.id || providerOrderId,
                reason: failReason,
              });
            } catch (notifyErr: any) {
              logger.error(`[PaymentService] Webhook failure email notification failed: ${notifyErr.message}`);
            }
          }
        }
      }
    }

    return { received: true, action: 'PROCESSED' };
  }

  /**
   * Records B2B Bank Transfer / NEFT / RTGS with UTR reference for manual or automated reconciliation.
   */
  async recordBankTransfer(
    orderId: string,
    utr: string,
    currentUser: any
  ): Promise<IPaymentTransactionDocument> {
    if (!utr || utr.trim().length < 6) {
      throw ApiError.badRequest('Valid bank UTR / reference number is required');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const tx = await PaymentTransaction.create({
      orderId: order._id,
      retailerId: order.retailerId,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      provider: 'bank_transfer',
      amountPaise: order.grandTotalPaise,
      currency: 'INR',
      status: PaymentStatus.PENDING,
      bankReferenceUtr: utr.trim(),
      notes: `Bank transfer submitted by ${currentUser.name || currentUser.phone}`,
    });

    await Order.findByIdAndUpdate(order._id, {
      paymentStatus: PaymentStatus.PENDING,
      internalNotes: `NEFT/RTGS UTR Reference: ${utr.trim()}`,
    });

    await auditLogger.logAction({
      actorId: (currentUser.id || currentUser._id).toString(),
      action: 'BANK_TRANSFER_SUBMITTED',
      targetResource: 'PaymentTransaction',
      targetId: tx.id,
      details: {
        orderId: order.id,
        utr: utr.trim(),
        amountPaise: order.grandTotalPaise,
      },
    });

    return tx;
  }

  /**
   * Retrieves all payments currently awaiting verification by finance admin.
   */
  async getPendingPayments(): Promise<any[]> {
    return PaymentTransaction.find({
      status: { $in: [PaymentStatus.PENDING, PaymentStatus.SUBMITTED_FOR_VERIFICATION] },
    })
      .sort({ createdAt: -1 })
      .populate('orderId', 'orderNumber grandTotalPaise status createdAt')
      .populate('retailerId', 'businessName contactPerson phone email')
      .lean();
  }

  /**
   * Approves and verifies a bank transfer or offline payment transaction.
   */
  async verifyPayment(
    transactionId: string,
    currentUser: any,
    notes?: string
  ): Promise<IPaymentTransactionDocument> {
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      throw ApiError.badRequest('Invalid transaction ID');
    }

    const tx = await PaymentTransaction.findById(transactionId);
    if (!tx) {
      throw ApiError.notFound('Payment transaction not found');
    }

    if (tx.status === PaymentStatus.SUCCESSFUL) {
      return tx;
    }

    tx.status = PaymentStatus.SUCCESSFUL;
    tx.verifiedByUserId = currentUser.id || currentUser._id;
    tx.verifiedAt = new Date();
    if (notes) tx.notes = notes;
    await tx.save();

    if (tx.orderId) {
      const order = await Order.findById(tx.orderId);
      if (order) {
        order.paymentStatus = PaymentStatus.PAID;
        order.totalPaidPaise = (order.totalPaidPaise || 0) + tx.amountPaise;
        order.remainingBalancePaise = Math.max(0, order.grandTotalPaise - order.totalPaidPaise);
        order.payments.push({
          amountPaise: tx.amountPaise,
          paymentMethod: tx.paymentMethod,
          referenceNumber: tx.bankReferenceUtr || tx.providerPaymentId || 'N/A',
          verifiedAt: new Date(),
          verifiedByName: currentUser.name || currentUser.email,
          notes: notes || 'Verified by accounts department',
        });
        await order.save();

        try {
          await orderNotificationService.sendPaymentReceivedNotification(order.id, {
            amountPaidPaise: tx.amountPaise,
            totalPaidPaise: order.totalPaidPaise,
            remainingBalancePaise: order.remainingBalancePaise || 0,
            grandTotalPaise: order.grandTotalPaise,
            paymentMethod: tx.paymentMethod?.replace(/_/g, ' ') || 'Bank Transfer',
            referenceNumber: tx.bankReferenceUtr || 'N/A',
            isPartial: (order.remainingBalancePaise || 0) > 0,
            notes,
          });
        } catch (notifyErr: any) {
          logger.error(`[PaymentService] Failed to send bank transfer payment verified email: ${notifyErr.message}`);
        }
      }
    }

    await auditLogger.logAction({
      actorId: (currentUser.id || currentUser._id).toString(),
      action: 'PAYMENT_VERIFIED',
      targetResource: 'PaymentTransaction',
      targetId: tx.id,
      details: {
        orderId: tx.orderId ? tx.orderId.toString() : undefined,
        amountPaise: tx.amountPaise,
        utr: tx.bankReferenceUtr,
        verifiedBy: currentUser.name || currentUser.email,
      },
    });

    return tx;
  }

  /**
   * Rejects an unverified payment transaction with reason.
   */
  async rejectPayment(
    transactionId: string,
    currentUser: any,
    reason: string
  ): Promise<IPaymentTransactionDocument> {
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      throw ApiError.badRequest('Invalid transaction ID');
    }

    const tx = await PaymentTransaction.findById(transactionId);
    if (!tx) {
      throw ApiError.notFound('Payment transaction not found');
    }

    tx.status = PaymentStatus.FAILED;
    tx.failureReason = reason || 'Rejected by finance administrator';
    await tx.save();

    if (tx.orderId) {
      const order = await Order.findByIdAndUpdate(
        tx.orderId,
        { paymentStatus: PaymentStatus.FAILED },
        { new: true }
      );
      if (order) {
        try {
          await orderNotificationService.sendPaymentFailedNotification(order.id, {
            amountPaise: tx.amountPaise,
            paymentMethod: tx.paymentMethod?.replace(/_/g, ' ') || 'Bank Transfer',
            referenceNumber: tx.bankReferenceUtr,
            reason: reason || 'Rejected by finance administrator',
          });
        } catch (notifyErr: any) {
          logger.error(`[PaymentService] Failed to send payment rejection email: ${notifyErr.message}`);
        }
      }
    }

    await auditLogger.logAction({
      actorId: (currentUser.id || currentUser._id).toString(),
      action: 'PAYMENT_REJECTED',
      targetResource: 'PaymentTransaction',
      targetId: tx.id,
      details: {
        orderId: tx.orderId ? tx.orderId.toString() : undefined,
        amountPaise: tx.amountPaise,
        reason,
      },
    });

    return tx;
  }

  /**
   * Issues a full or partial refund for a paid order via Razorpay API or marks offline refund.
   */
  async refundPayment(
    identifier: string,
    currentUser: any,
    reason?: string
  ): Promise<{ success: boolean; refundId?: string; transaction: IPaymentTransactionDocument }> {
    if (!mongoose.Types.ObjectId.isValid(identifier)) {
      throw ApiError.badRequest('Invalid ID specified for refund');
    }

    let order: any = null;
    let tx: any = null;

    // Check if identifier is an Order ID
    order = await Order.findById(identifier);
    if (order) {
      tx = await PaymentTransaction.findOne({
        orderId: order._id,
        status: PaymentStatus.SUCCESSFUL,
      }).sort({ createdAt: -1 });
    } else {
      // Check if identifier is a PaymentTransaction ID
      tx = await PaymentTransaction.findById(identifier);
      if (tx && tx.orderId) {
        order = await Order.findById(tx.orderId);
      }
    }

    if (!tx) {
      throw ApiError.badRequest('No successful payment transaction found to refund');
    }

    if (!order) {
      throw ApiError.notFound('Associated order not found for this refund transaction');
    }

    let refundId: string | undefined;

    // Call Razorpay Refunds API if live gateway transaction
    const isMock = ENV.PAYMENT_PROVIDER === 'mock_gateway' || !ENV.RAZORPAY_KEY_ID || !ENV.RAZORPAY_KEY_SECRET;
    if (
      !isMock &&
      tx.provider === 'razorpay' &&
      tx.providerPaymentId &&
      !tx.providerPaymentId.startsWith('pay_mock_') &&
      !tx.providerPaymentId.startsWith('pay_sim_')
    ) {
      try {
        const authHeader = Buffer.from(
          `${ENV.RAZORPAY_KEY_ID}:${ENV.RAZORPAY_KEY_SECRET}`
        ).toString('base64');

        const response = await fetch(
          `https://api.razorpay.com/v1/payments/${tx.providerPaymentId}/refund`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authHeader}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: tx.amountPaise,
              notes: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                reason: reason || 'Order cancelled by administration',
              },
            }),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Razorpay refund API error (${response.status}): ${errText}`);
        }

        const data = (await response.json()) as any;
        refundId = data.id;
      } catch (err: any) {
        logger.error(`[PaymentService] Razorpay refund error: ${err.message}`);
        throw ApiError.badRequest(`Payment gateway refund failure: ${err.message}`);
      }
    } else {
      // In development, mock, or offline mode
      refundId = `rfnd_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    // Update Transaction
    tx.status = PaymentStatus.REFUNDED;
    tx.refundId = refundId;
    tx.refundReason = reason || 'Order cancelled';
    tx.notes = `${tx.notes || ''} • Refunded via ${refundId}`.trim();
    await tx.save();

    // Update Order
    order.paymentStatus = PaymentStatus.REFUNDED;
    order.totalPaidPaise = 0;
    order.remainingBalancePaise = order.grandTotalPaise;
    await order.save();

    // Log Audit
    await auditLogger.logAction({
      actorId: (currentUser.id || currentUser._id).toString(),
      action: 'PAYMENT_REFUNDED',
      targetResource: 'PaymentTransaction',
      targetId: tx.id,
      details: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amountPaise: tx.amountPaise,
        refundId,
        reason,
        refundedBy: currentUser.name || currentUser.email,
      },
    });

    // Send Customer Email Notification
    try {
      await orderNotificationService.sendPaymentRefundedNotification(order.id, {
        amountRefundedPaise: tx.amountPaise,
        paymentMethod:
          tx.paymentMethod === PaymentMethod.PAYMENT_GATEWAY
            ? 'Razorpay Gateway'
            : tx.paymentMethod?.replace(/_/g, ' ') || 'Online Payment',
        refundId: refundId || 'N/A',
        reason: reason || order.cancellationReason || 'Order cancellation settlement',
      });
    } catch (notifyErr: any) {
      logger.error(
        `[PaymentService] Failed to send payment refund email notification: ${notifyErr.message}`
      );
    }

    return { success: true, refundId, transaction: tx };
  }
}

export const paymentService = new PaymentService();
