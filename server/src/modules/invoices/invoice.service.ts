import mongoose from 'mongoose';
import { Invoice, IInvoiceDocument } from './invoice.model';
import { Order } from '../orders/order.model';
import { Retailer } from '../retailers/retailer.model';
import { User } from '../users/user.model';
import { LedgerEntry } from '../credit/ledger.model';
import { PaymentTransaction } from '../payments/payment.model';
import { zohoService } from '../integrations/zoho/zoho.service';
import { InvoicePdfGenerator } from './pdf-generator.service';
import { auditLogger } from '../audit/audit.service';
import { ApiError } from '../../utils/api-error';
import { logger } from '../../config/logger';
import {
  InvoiceStatus,
  LedgerEntryType,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from '@necessity/shared';

export interface CreateDirectInvoiceInput {
  retailerId: string;
  items: Array<{
    productId?: string;
    sku: string;
    name: string;
    hsnCode?: string;
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
  }>;
  notes?: string;
  issueDate?: string;
}

export class InvoiceService {
  /**
   * Retrieves paginated invoices with optional filters and role scoping.
   * Also computes aggregate portfolio totals (total invoiced, paid, outstanding, overdue).
   */
  async listInvoices(query: any, currentUser: any) {
    const {
      search,
      status,
      retailerId,
      orderId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const andConditions: any[] = [];

    // Role-based scoping: Retailers only see their own invoices
    if (currentUser.role === UserRole.RETAILER) {
      if (!currentUser.retailerProfileId) {
        return {
          items: [],
          summary: {
            totalInvoicedPaise: 0,
            totalPaidPaise: 0,
            totalOutstandingPaise: 0,
            overdueCount: 0,
          },
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
        };
      }
      andConditions.push({
        retailerId: new mongoose.Types.ObjectId(currentUser.retailerProfileId),
      });
    } else if (retailerId && mongoose.Types.ObjectId.isValid(retailerId)) {
      andConditions.push({
        retailerId: new mongoose.Types.ObjectId(retailerId),
      });
    }

    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
      andConditions.push({
        orderId: new mongoose.Types.ObjectId(orderId),
      });
    }

    if (status && Object.values(InvoiceStatus).includes(status)) {
      andConditions.push({ status });
    }

    if (startDate || endDate) {
      const dateCond: any = {};
      if (startDate) dateCond.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        dateCond.$lte = eDate;
      }
      andConditions.push({ issueDate: dateCond });
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      andConditions.push({
        $or: [
          { invoiceNumber: regex },
          { orderNumber: regex },
          { retailerBusinessName: regex },
          { retailerGstin: regex },
        ],
      });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};
    const skip = (page - 1) * limit;

    // Check and update overdue status dynamically
    const now = new Date();
    await Invoice.updateMany(
      {
        status: { $in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
        dueDate: { $lt: now },
        outstandingAmountPaise: { $gt: 0 },
      },
      { $set: { status: InvoiceStatus.OVERDUE } }
    );

    const [items, total, summaryStats] = await Promise.all([
      Invoice.find(filter)
        .sort({ issueDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
      Invoice.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalInvoicedPaise: { $sum: '$totalPaise' },
            totalPaidPaise: { $sum: '$paidAmountPaise' },
            totalOutstandingPaise: { $sum: '$outstandingAmountPaise' },
            overdueCount: {
              $sum: {
                $cond: [{ $eq: ['$status', InvoiceStatus.OVERDUE] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const summary = summaryStats[0] || {
      totalInvoicedPaise: 0,
      totalPaidPaise: 0,
      totalOutstandingPaise: 0,
      overdueCount: 0,
    };

    return {
      items: items.map((inv: any) => ({
        ...inv,
        id: inv._id.toString(),
        retailerId: inv.retailerId.toString(),
        orderId: inv.orderId ? inv.orderId.toString() : undefined,
      })),
      summary,
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

  /**
   * Retrieves single invoice details with customer info, billing/shipping addresses,
   * line items, tax breakdown, and payment history.
   */
  async getInvoiceById(invoiceId: string, currentUser: any): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      throw ApiError.badRequest('Invalid invoice ID');
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    if (currentUser.role === UserRole.RETAILER) {
      if (
        !currentUser.retailerProfileId ||
        invoice.retailerId.toString() !== currentUser.retailerProfileId.toString()
      ) {
        throw ApiError.forbidden('You do not have permission to view this invoice');
      }
    }

    // Dynamic overdue check
    if (
      invoice.status !== InvoiceStatus.PAID &&
      invoice.status !== InvoiceStatus.CANCELLED &&
      invoice.outstandingAmountPaise > 0 &&
      new Date(invoice.dueDate) < new Date()
    ) {
      invoice.status = InvoiceStatus.OVERDUE;
      await invoice.save();
    }

    // Populate customer / retailer details
    let retailer: any = null;
    if (invoice.retailerId && mongoose.Types.ObjectId.isValid(invoice.retailerId.toString())) {
      retailer = await Retailer.findById(invoice.retailerId).lean();
    }

    // Populate order details (for delivery address, discounts, order ref)
    let order: any = null;
    if (invoice.orderId && mongoose.Types.ObjectId.isValid(invoice.orderId.toString())) {
      order = await Order.findById(invoice.orderId)
        .select('orderNumber status paymentStatus deliveryAddress billingAddress discountAmountPaise couponCode grandTotalPaise items createdAt')
        .lean();
    }

    // Populate payment transactions history
    const payments = await PaymentTransaction.find({
      $or: [
        { invoiceId: invoice._id },
        { invoiceNumber: invoice.invoiceNumber },
        ...(invoice.orderId ? [{ orderId: invoice.orderId }] : []),
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    const invObj = invoice.toJSON();

    return {
      ...invObj,
      retailer: retailer
        ? {
            id: retailer._id?.toString(),
            businessName: retailer.businessName,
            tradeName: retailer.tradeName,
            contactPerson: retailer.contactPerson,
            phone: retailer.phone,
            email: retailer.email,
            gstin: retailer.gstin,
            pan: retailer.pan,
            billingAddress: retailer.billingAddress,
            shippingAddress: retailer.shippingAddress || order?.deliveryAddress,
            paymentTermsDays: retailer.paymentTermsDays,
          }
        : undefined,
      order: order
        ? {
            id: order._id?.toString(),
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            deliveryAddress: order.deliveryAddress,
            billingAddress: order.billingAddress,
            discountAmountPaise: order.discountAmountPaise || 0,
            couponCode: order.couponCode,
            createdAt: order.createdAt,
          }
        : undefined,
      payments: payments.map((p: any) => ({
        id: p._id.toString(),
        amountPaise: p.amountPaise,
        paymentMethod: p.paymentMethod,
        provider: p.provider,
        status: p.status,
        bankReferenceUtr: p.bankReferenceUtr,
        notes: p.notes,
        verifiedAt: p.verifiedAt,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Generates a tax invoice or proforma invoice from an existing Order.
   * Posts debit to customer ledger only when formally issued (not proforma).
   */
  async generateFromOrder(
    orderId: string,
    actorUser: any,
    options?: { asProforma?: boolean }
  ): Promise<IInvoiceDocument> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw ApiError.badRequest('Invalid order ID');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    // Check if invoice already exists for this order
    const existing = await Invoice.findOne({ orderId: order._id });
    if (existing) {
      return existing;
    }

    let retailer: any = null;
    if (order.retailerId && mongoose.Types.ObjectId.isValid(order.retailerId.toString())) {
      retailer = await Retailer.findById(order.retailerId);
    }
    if (!retailer && order.placedByUserId && mongoose.Types.ObjectId.isValid(order.placedByUserId.toString())) {
      const user = await User.findById(order.placedByUserId);
      if (user?.retailerProfileId && mongoose.Types.ObjectId.isValid(user.retailerProfileId.toString())) {
        retailer = await Retailer.findById(user.retailerProfileId);
      }
    }
    if (!retailer) {
      retailer = {
        _id: (order.retailerId && mongoose.Types.ObjectId.isValid(order.retailerId.toString()))
          ? order.retailerId
          : new mongoose.Types.ObjectId(),
        businessName: order.retailerName || 'Valued Trade Customer',
        gstin: (order.deliveryAddress as any)?.gstin || 'Unregistered / Non-GST',
        billingAddress: order.deliveryAddress || {
          street: 'Main Commercial Market',
          city: 'Mohali',
          state: 'Punjab',
          pincode: '160055',
          stateCode: '03',
        },
        paymentTermsDays: 15,
        outstandingReceivablesPaise: 0,
      };
    }

    const now = new Date();
    const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const uniqueSuffix = `${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
    const invoiceNumber = `INV-${datePrefix}-${uniqueSuffix}`;

    // Due date calculated from paymentTermsDays
    const paymentTermsDays = retailer.paymentTermsDays || 15;
    const dueDate = new Date(now.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000);

    // Map order items to invoice items with tax splits
    const invoiceItems = (order.items || []).map((item) => ({
      productId: item.productId,
      sku: item.skuSnapshot || (item as any).variantSkuSnapshot || 'SKU-ITEM',
      name: item.productNameSnapshot || 'Product Item',
      hsnCode: item.hsnCodeSnapshot || '9999',
      quantity: Number(item.quantity) || 1,
      unitPricePaise: Number(item.unitPricePaiseSnapshot) || 0,
      taxableAmountPaise: Number(item.taxableAmountPaise) || 0,
      gstRatePercent: Number(item.gstRatePercentSnapshot) || 0,
      cgstPaise: Number(item.cgstPaise) || 0,
      sgstPaise: Number(item.sgstPaise) || 0,
      igstPaise: Number(item.igstPaise) || 0,
      totalPaise: Number(item.lineTotalPaise) || 0,
    }));

    const totalPaise = order.grandTotalPaise;
    const subtotalPaise = order.taxableAmountPaise;
    const taxPaise =
      (order.totalCgstPaise || 0) +
      (order.totalSgstPaise || 0) +
      (order.totalIgstPaise || 0);

    // Check existing verified payments
    const existingPayments = await PaymentTransaction.find({
      orderId: order._id,
      status: PaymentStatus.SUCCESSFUL,
    }).lean();
    const verifiedPaidPaise = existingPayments.reduce((sum, p) => sum + (p.amountPaise || 0), 0);
    const isPaid = order.paymentStatus === PaymentStatus.SUCCESSFUL || verifiedPaidPaise >= totalPaise;
    const paidAmountPaise = isPaid ? totalPaise : verifiedPaidPaise;
    const outstandingAmountPaise = Math.max(0, totalPaise - paidAmountPaise);

    let status = InvoiceStatus.ISSUED;
    if (options?.asProforma) {
      status = InvoiceStatus.DRAFT;
    } else if (outstandingAmountPaise === 0 && totalPaise > 0) {
      status = InvoiceStatus.PAID;
    } else if (paidAmountPaise > 0) {
      status = InvoiceStatus.PARTIALLY_PAID;
    }

    const invoice = await Invoice.create({
      invoiceNumber,
      orderId: order._id,
      orderNumber: order.orderNumber,
      retailerId: retailer._id,
      retailerBusinessName: retailer.businessName,
      retailerGstin: retailer.gstin,
      issueDate: now,
      dueDate,
      subtotalPaise,
      taxPaise,
      totalPaise,
      paidAmountPaise,
      outstandingAmountPaise,
      status,
      items: invoiceItems,
      zohoSyncStatus: 'not_synced',
      notes: options?.asProforma
        ? `Proforma Invoice for Order #${order.orderNumber}`
        : `Generated for Order #${order.orderNumber}`,
      createdByUserId: actorUser?.id || actorUser?._id,
    });

    // Check if already posted to ledger (only post when formally issued, not proforma)
    if (!options?.asProforma) {
      try {
        const existingLedger = await LedgerEntry.findOne({
          referenceModel: 'Invoice',
          referenceNumber: invoiceNumber,
        });

        if (!existingLedger && retailer._id) {
          const lastEntry = await LedgerEntry.findOne({ retailerId: retailer._id })
            .sort({ date: -1, _id: -1 })
            .lean();

          const previousBalance = lastEntry
            ? lastEntry.runningBalancePaise
            : retailer.outstandingReceivablesPaise || 0;

          const newBalance = isPaid
            ? previousBalance
            : previousBalance + outstandingAmountPaise;

          await LedgerEntry.create({
            retailerId: retailer._id,
            entryNumber: `LED-INV-${datePrefix}-${uniqueSuffix}`,
            date: now,
            type: LedgerEntryType.INVOICE_POSTED,
            referenceModel: 'Invoice',
            referenceId: invoice._id,
            referenceNumber: invoiceNumber,
            description: `Tax Invoice #${invoiceNumber} issued for Order #${order.orderNumber}`,
            debitPaise: totalPaise,
            creditPaise: isPaid ? totalPaise : paidAmountPaise,
            runningBalancePaise: newBalance,
            recordedByUserId: actorUser?.id || actorUser?._id,
          });

          if (!isPaid) {
            await Retailer.findByIdAndUpdate(retailer._id, {
              $inc: { outstandingReceivablesPaise: outstandingAmountPaise },
            });
          }
        }
      } catch (ledgerErr: any) {
        logger.warn(`[InvoiceService] Non-fatal ledger entry notice: ${ledgerErr.message}`);
      }
    }

    await auditLogger.logAction({
      actorId: (actorUser.id || actorUser._id).toString(),
      action: options?.asProforma ? 'PROFORMA_INVOICE_GENERATED' : 'INVOICE_GENERATED',
      targetResource: 'Invoice',
      targetId: invoice.id,
      details: {
        invoiceNumber,
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalPaise,
        status,
      },
    });

    return invoice;
  }

  /**
   * Converts a Draft / Proforma invoice to an official Issued Tax Invoice
   * and posts debit to the customer ledger.
   */
  async issueTaxInvoice(invoiceId: string, actorUser: any): Promise<IInvoiceDocument> {
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      throw ApiError.badRequest('Invalid invoice ID');
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw ApiError.badRequest(`Invoice #${invoice.invoiceNumber} is already in status '${invoice.status}'`);
    }

    const isPaid = invoice.outstandingAmountPaise === 0;
    invoice.status = isPaid
      ? InvoiceStatus.PAID
      : invoice.paidAmountPaise > 0
        ? InvoiceStatus.PARTIALLY_PAID
        : InvoiceStatus.ISSUED;
    invoice.issueDate = new Date();
    await invoice.save();

    // Post to ledger if not already present
    try {
      const existingLedger = await LedgerEntry.findOne({
        referenceModel: 'Invoice',
        referenceNumber: invoice.invoiceNumber,
      });

      if (!existingLedger && invoice.retailerId) {
        const lastEntry = await LedgerEntry.findOne({ retailerId: invoice.retailerId })
          .sort({ date: -1, _id: -1 })
          .lean();

        const previousBalance = lastEntry ? lastEntry.runningBalancePaise : 0;
        const newBalance = isPaid
          ? previousBalance
          : previousBalance + invoice.outstandingAmountPaise;

        const now = new Date();
        const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const uniqueSuffix = `${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;

        await LedgerEntry.create({
          retailerId: invoice.retailerId,
          entryNumber: `LED-INV-${datePrefix}-${uniqueSuffix}`,
          date: now,
          type: LedgerEntryType.INVOICE_POSTED,
          referenceModel: 'Invoice',
          referenceId: invoice._id,
          referenceNumber: invoice.invoiceNumber,
          description: `Tax Invoice #${invoice.invoiceNumber} issued${invoice.orderNumber ? ` for Order #${invoice.orderNumber}` : ''}`,
          debitPaise: invoice.totalPaise,
          creditPaise: isPaid ? invoice.totalPaise : invoice.paidAmountPaise,
          runningBalancePaise: newBalance,
          recordedByUserId: actorUser?.id || actorUser?._id,
        });

        if (!isPaid) {
          await Retailer.findByIdAndUpdate(invoice.retailerId, {
            $inc: { outstandingReceivablesPaise: invoice.outstandingAmountPaise },
          });
        }
      }
    } catch (ledgerErr: any) {
      logger.warn(`[InvoiceService] Ledger post notice: ${ledgerErr.message}`);
    }

    await auditLogger.logAction({
      actorId: (actorUser.id || actorUser._id).toString(),
      action: 'INVOICE_ISSUED',
      targetResource: 'Invoice',
      targetId: invoice.id,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
      },
    });

    return invoice;
  }

  /**
   * Records an offline or manual payment against an invoice.
   * Maintains separate payment transactions, updates paid amount & balance due automatically,
   * sets status (Partially Paid / Paid), and posts credit to customer ledger.
   */
  async recordPayment(
    invoiceId: string,
    input: {
      amountPaise: number;
      paymentMethod: PaymentMethod;
      bankReferenceUtr?: string;
      notes?: string;
      paymentDate?: string;
      isVerified?: boolean;
    },
    actorUser: any
  ) {
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      throw ApiError.badRequest('Invalid invoice ID');
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw ApiError.badRequest('Cannot record payment against a cancelled invoice');
    }

    const amountPaise = Number(input.amountPaise);
    if (!amountPaise || amountPaise <= 0) {
      throw ApiError.badRequest('Payment amount must be greater than zero');
    }

    if (amountPaise > invoice.outstandingAmountPaise) {
      throw ApiError.badRequest(
        `Payment amount (₹${(amountPaise / 100).toFixed(2)}) exceeds balance due (₹${(invoice.outstandingAmountPaise / 100).toFixed(2)})`
      );
    }

    const isVerified = input.isVerified !== false; // Default true for staff/admin entry
    const now = input.paymentDate ? new Date(input.paymentDate) : new Date();
    const referenceUtr = input.bankReferenceUtr?.trim() || `OFFLINE-${Date.now().toString().slice(-6)}`;

    // 1. Maintain separate PaymentTransaction record
    const paymentTx = await PaymentTransaction.create({
      retailerId: invoice.retailerId,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId,
      paymentMethod: input.paymentMethod || PaymentMethod.BANK_TRANSFER,
      provider: input.paymentMethod === PaymentMethod.CASH ? 'cash' : 'offline_transfer',
      amountPaise,
      currency: 'INR',
      status: isVerified ? PaymentStatus.SUCCESSFUL : PaymentStatus.PENDING,
      bankReferenceUtr: referenceUtr,
      notes: input.notes || `Offline payment for Invoice #${invoice.invoiceNumber}`,
      verifiedByUserId: isVerified ? (actorUser.id || actorUser._id) : undefined,
      verifiedAt: isVerified ? now : undefined,
    });

    if (isVerified) {
      // 2. Automatically update paid amount and balance due
      const newPaidAmount = invoice.paidAmountPaise + amountPaise;
      const newOutstanding = Math.max(0, invoice.totalPaise - newPaidAmount);
      invoice.paidAmountPaise = newPaidAmount;
      invoice.outstandingAmountPaise = newOutstanding;

      // 3. Status determination:
      // Show Paid only after full payment verification; Partially Paid otherwise.
      if (newOutstanding === 0) {
        invoice.status = InvoiceStatus.PAID;
      } else if (newPaidAmount > 0) {
        invoice.status = InvoiceStatus.PARTIALLY_PAID;
      } else if (new Date(invoice.dueDate) < new Date()) {
        invoice.status = InvoiceStatus.OVERDUE;
      } else {
        invoice.status = InvoiceStatus.ISSUED;
      }
      await invoice.save();

      // 4. Update Retailer ledger and receivables
      const retailer = await Retailer.findById(invoice.retailerId);
      if (retailer) {
        const lastEntry = await LedgerEntry.findOne({ retailerId: retailer._id })
          .sort({ date: -1, _id: -1 })
          .lean();
        const previousBalance = lastEntry
          ? lastEntry.runningBalancePaise
          : retailer.outstandingReceivablesPaise || 0;
        const newRunningBalance = Math.max(0, previousBalance - amountPaise);

        const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const entryNumber = `LED-PAY-${datePrefix}-${randomSuffix}`;

        await LedgerEntry.create({
          retailerId: retailer._id,
          entryNumber,
          date: now,
          type: LedgerEntryType.PAYMENT_RECEIVED,
          referenceModel: 'Invoice',
          referenceId: invoice._id,
          referenceNumber: invoice.invoiceNumber,
          description: `Payment of ₹${(amountPaise / 100).toFixed(2)} received for Invoice #${invoice.invoiceNumber} via ${input.paymentMethod} (Ref: ${referenceUtr})`,
          debitPaise: 0,
          creditPaise: amountPaise,
          runningBalancePaise: newRunningBalance,
          recordedByUserId: actorUser?.id || actorUser?._id,
        });

        await Retailer.findByIdAndUpdate(retailer._id, {
          $inc: { outstandingReceivablesPaise: -amountPaise },
        });
      }

      // 5. Update linked order paymentStatus if applicable
      if (invoice.orderId) {
        const order = await Order.findById(invoice.orderId);
        if (order) {
          const totalPaidForOrder = await PaymentTransaction.aggregate([
            { $match: { orderId: order._id, status: PaymentStatus.SUCCESSFUL } },
            { $group: { _id: null, total: { $sum: '$amountPaise' } } },
          ]);
          const paidOrderPaise = totalPaidForOrder[0]?.total || 0;
          if (paidOrderPaise >= order.grandTotalPaise) {
            order.paymentStatus = PaymentStatus.SUCCESSFUL;
          } else if (paidOrderPaise > 0) {
            order.paymentStatus = PaymentStatus.PARTIALLY_PAID;
          }
          await order.save();
        }
      }
    } else {
      // Pending verification: show Partially Paid if some verified payment exists
      if (invoice.paidAmountPaise > 0 && invoice.outstandingAmountPaise > 0) {
        invoice.status = InvoiceStatus.PARTIALLY_PAID;
      }
      await invoice.save();
    }

    await auditLogger.logAction({
      actorId: (actorUser.id || actorUser._id).toString(),
      action: 'INVOICE_PAYMENT_RECORDED',
      targetResource: 'Invoice',
      targetId: invoice.id,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        amountPaise,
        isVerified,
        paymentTransactionId: paymentTx.id,
        newStatus: invoice.status,
      },
    });

    const fullDetails = await this.getInvoiceById(invoice.id, actorUser);
    return {
      success: true,
      transaction: paymentTx,
      invoice: fullDetails,
    };
  }

  /**
   * Syncs invoice to Zoho Books with idempotency and clear error handling.
   */
  async syncInvoiceToZoho(invoiceId: string, actorUser: any) {
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      throw ApiError.badRequest('Invalid invoice ID');
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    const zohoStatus = zohoService.getSyncStatus();
    if (!zohoStatus.isConfigured) {
      invoice.zohoSyncStatus = 'failed';
      invoice.zohoLastSyncError = `Zoho Books credentials not configured: [${zohoStatus.missingKeys.join(', ')}]`;
      await invoice.save();

      throw ApiError.badRequest(
        `Zoho integration credentials are not configured on this server (${zohoStatus.missingKeys.join(', ')}). Please configure Zoho API keys in environment variables.`
      );
    }

    const syncResult = await zohoService.syncInvoice(invoiceId);
    if (!syncResult.success) {
      invoice.zohoSyncStatus = 'failed';
      invoice.zohoLastSyncError = syncResult.error;
      await invoice.save();

      throw ApiError.badRequest(`Zoho sync failed: ${syncResult.error}`);
    }

    invoice.zohoInvoiceId = syncResult.zohoInvoiceId;
    invoice.zohoSyncStatus = 'synced';
    invoice.zohoLastSyncedAt = new Date();
    invoice.zohoLastSyncError = undefined;
    await invoice.save();

    await auditLogger.logAction({
      actorId: (actorUser.id || actorUser._id).toString(),
      action: 'INVOICE_ZOHO_SYNCED',
      targetResource: 'Invoice',
      targetId: invoice.id,
      details: {
        zohoInvoiceId: syncResult.zohoInvoiceId,
      },
    });

    return {
      success: true,
      zohoInvoiceId: syncResult.zohoInvoiceId,
      invoice: invoice.toJSON(),
    };
  }

  /**
   * Generates a printable Tax Invoice / Proforma PDF stream.
   * Access is strictly restricted to owning customer or authorized staff.
   */
  async generatePdf(invoiceId: string, currentUser: any): Promise<{ doc: PDFKit.PDFDocument; invoiceNumber: string }> {
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      throw ApiError.badRequest('Invalid invoice ID');
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    if (currentUser.role === UserRole.RETAILER) {
      if (
        !currentUser.retailerProfileId ||
        invoice.retailerId.toString() !== currentUser.retailerProfileId.toString()
      ) {
        throw ApiError.forbidden('You do not have permission to view this invoice');
      }
    }

    let retailer: any = null;
    if (invoice.retailerId && mongoose.Types.ObjectId.isValid(invoice.retailerId.toString())) {
      retailer = await Retailer.findById(invoice.retailerId).lean();
    }

    const doc = InvoicePdfGenerator.generateInvoicePdf(invoice, retailer);
    return {
      doc,
      invoiceNumber: invoice.invoiceNumber,
    };
  }
}

export const invoiceService = new InvoiceService();
