import mongoose from 'mongoose';
import { LedgerEntry, ILedgerEntryDocument } from './ledger.model';
import { Retailer } from '../retailers/retailer.model';
import { PaymentTransaction } from '../payments/payment.model';
import { Invoice } from '../invoices/invoice.model';
import { auditLogger } from '../audit/audit.service';
import { ApiError } from '../../utils/api-error';
import {
  CreditStatus,
  LedgerEntryType,
  PaymentMethod,
  PaymentStatus,
  InvoiceStatus,
  UserRole,
} from '@necessity/shared';

export interface RecordPaymentInput {
  retailerId: string;
  amountPaise: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  invoiceId?: string;
  notes?: string;
}

export interface RecordAdjustmentInput {
  retailerId: string;
  type: LedgerEntryType.CREDIT_NOTE | LedgerEntryType.DEBIT_ADJUSTMENT;
  amountPaise: number;
  reason: string;
  referenceNumber?: string;
}

export interface UpdateCreditTermsInput {
  creditLimitPaise?: number;
  paymentTermsDays?: number;
  creditStatus?: CreditStatus;
  creditHoldReason?: string;
}

export class CreditService {
  /**
   * Retrieves high-level credit portfolio overview for all retailers
   * with aggregated metrics (Total Credit, Total Receivables, Available Credit).
   */
  async getCreditOverview(query: {
    search?: string;
    creditStatus?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, creditStatus, page = 1, limit = 20 } = query;
    const filter: any = { isActive: true };

    if (creditStatus && Object.values(CreditStatus).includes(creditStatus as any)) {
      filter.creditStatus = creditStatus;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { businessName: regex },
        { tradeName: regex },
        { contactPerson: regex },
        { phone: regex },
        { gstin: regex },
      ];
    }

    const skip = (page - 1) * limit;

    const [retailers, total, aggregateTotals] = await Promise.all([
      Retailer.find(filter)
        .sort({ businessName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Retailer.countDocuments(filter),
      Retailer.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalCreditLimitPaise: { $sum: '$creditLimitPaise' },
            totalOutstandingPaise: { $sum: '$outstandingReceivablesPaise' },
            totalActiveReservationsPaise: { $sum: '$activeReservationsPaise' },
            accountsOnHoldCount: {
              $sum: {
                $cond: [{ $eq: ['$creditStatus', CreditStatus.ON_HOLD] }, 1, 0],
              },
            },
            totalRetailersCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const aggregates = aggregateTotals[0] || {
      totalCreditLimitPaise: 0,
      totalOutstandingPaise: 0,
      totalActiveReservationsPaise: 0,
      accountsOnHoldCount: 0,
      totalRetailersCount: 0,
    };

    const totalAvailableCreditPaise = Math.max(
      0,
      aggregates.totalCreditLimitPaise -
        aggregates.totalOutstandingPaise -
        aggregates.totalActiveReservationsPaise
    );

    // Map item available credit
    const items = retailers.map((r: any) => {
      const isHold =
        r.creditStatus === CreditStatus.ON_HOLD ||
        r.creditStatus === CreditStatus.RESTRICTED;
      const availablePaise = isHold
        ? 0
        : Math.max(
            0,
            (r.creditLimitPaise || 0) -
              (r.outstandingReceivablesPaise || 0) -
              (r.activeReservationsPaise || 0)
          );

      return {
        id: r._id.toString(),
        retailerId: r._id.toString(),
        businessName: r.businessName,
        tradeName: r.tradeName,
        contactPerson: r.contactPerson,
        phone: r.phone,
        email: r.email,
        gstin: r.gstin,
        creditLimitPaise: r.creditLimitPaise || 0,
        paymentTermsDays: r.paymentTermsDays || 15,
        creditStatus: r.creditStatus || CreditStatus.NORMAL,
        creditHoldReason: r.creditHoldReason,
        outstandingReceivablesPaise: r.outstandingReceivablesPaise || 0,
        activeReservationsPaise: r.activeReservationsPaise || 0,
        availableCreditPaise: availablePaise,
        updatedAt: r.updatedAt,
      };
    });

    return {
      items,
      summary: {
        totalCreditLimitPaise: aggregates.totalCreditLimitPaise,
        totalOutstandingPaise: aggregates.totalOutstandingPaise,
        totalActiveReservationsPaise: aggregates.totalActiveReservationsPaise,
        totalAvailableCreditPaise,
        accountsOnHoldCount: aggregates.accountsOnHoldCount,
        totalRetailersCount: aggregates.totalRetailersCount,
      },
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
   * Generates a sequential customer ledger statement with calculated running balance.
   */
  async getLedger(
    query: {
      retailerId: string;
      startDate?: string;
      endDate?: string;
      type?: LedgerEntryType;
      page?: number;
      limit?: number;
    },
    currentUser: any
  ) {
    const { retailerId, startDate, endDate, type, page = 1, limit = 50 } = query;

    if (!mongoose.Types.ObjectId.isValid(retailerId)) {
      throw ApiError.badRequest('Invalid retailer ID');
    }

    // Role check: Retailers can only view their own ledger
    if (currentUser.role === UserRole.RETAILER) {
      if (
        !currentUser.retailerProfileId ||
        currentUser.retailerProfileId.toString() !== retailerId
      ) {
        throw ApiError.forbidden('You do not have permission to view this customer ledger');
      }
    }

    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      throw ApiError.notFound('Customer account not found');
    }

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = eDate;
    }

    const entryFilter: any = { retailerId: retailer._id };
    if (Object.keys(dateFilter).length > 0) {
      entryFilter.date = dateFilter;
    }
    if (type && Object.values(LedgerEntryType).includes(type)) {
      entryFilter.type = type;
    }

    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      LedgerEntry.find(entryFilter)
        .sort({ date: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LedgerEntry.countDocuments(entryFilter),
    ]);

    // Calculate totals in the filtered period
    const periodStats = await LedgerEntry.aggregate([
      { $match: entryFilter },
      {
        $group: {
          _id: null,
          totalDebitPaise: { $sum: '$debitPaise' },
          totalCreditPaise: { $sum: '$creditPaise' },
        },
      },
    ]);

    const totalDebitPaise = periodStats[0]?.totalDebitPaise || 0;
    const totalCreditPaise = periodStats[0]?.totalCreditPaise || 0;

    return {
      customer: {
        id: retailer._id.toString(),
        businessName: retailer.businessName,
        contactPerson: retailer.contactPerson,
        phone: retailer.phone,
        gstin: retailer.gstin,
        creditLimitPaise: retailer.creditLimitPaise,
        outstandingReceivablesPaise: retailer.outstandingReceivablesPaise,
        availableCreditPaise: retailer.calculateAvailableCreditPaise(),
        paymentTermsDays: retailer.paymentTermsDays,
        creditStatus: retailer.creditStatus,
        creditHoldReason: retailer.creditHoldReason,
      },
      periodStats: {
        totalDebitPaise,
        totalCreditPaise,
        netMovementPaise: totalDebitPaise - totalCreditPaise,
      },
      entries: entries.map((e: any) => ({
        id: e._id.toString(),
        entryNumber: e.entryNumber,
        date: e.date,
        type: e.type,
        referenceModel: e.referenceModel,
        referenceNumber: e.referenceNumber,
        referenceId: e.referenceId ? e.referenceId.toString() : undefined,
        description: e.description,
        debitPaise: e.debitPaise,
        creditPaise: e.creditPaise,
        runningBalancePaise: e.runningBalancePaise,
        createdAt: e.createdAt,
      })),
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
   * Records a payment against customer balance without deleting or mutating historical records.
   * Decrements outstanding receivables and creates an immutable ledger entry.
   */
  async recordPayment(input: RecordPaymentInput, actorUser: any) {
    const {
      retailerId,
      amountPaise,
      paymentMethod,
      referenceNumber,
      invoiceId,
      notes,
    } = input;

    if (!mongoose.Types.ObjectId.isValid(retailerId)) {
      throw ApiError.badRequest('Invalid retailer ID');
    }

    if (!amountPaise || amountPaise <= 0) {
      throw ApiError.badRequest('Payment amount must be greater than zero');
    }

    if (!referenceNumber || !referenceNumber.trim()) {
      throw ApiError.badRequest('Payment reference/UTR number is required');
    }

    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      throw ApiError.notFound('Retailer not found');
    }

    let invoice: any = null;
    if (invoiceId) {
      if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
        throw ApiError.badRequest('Invalid invoice ID');
      }
      invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        throw ApiError.notFound('Referenced invoice not found');
      }
      if (invoice.retailerId.toString() !== retailerId) {
        throw ApiError.badRequest('Invoice does not belong to this retailer');
      }
    }

    // 1. Authoritatively calculate sequential running balance
    const lastEntry = await LedgerEntry.findOne({ retailerId: retailer._id })
      .sort({ date: -1, _id: -1 })
      .lean();

    const previousBalance = lastEntry
      ? lastEntry.runningBalancePaise
      : retailer.outstandingReceivablesPaise || 0;

    const newRunningBalance = Math.max(0, previousBalance - amountPaise);

    // 2. Generate unique entry numbers
    const now = new Date();
    const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const entryNumber = `LED-PAY-${datePrefix}-${randomSuffix}`;

    // 3. Create persistent PaymentTransaction
    const paymentTx = await PaymentTransaction.create({
      retailerId: retailer._id,
      orderId: invoice?.orderId || retailer._id, // fallback when order isn't present
      invoiceId: invoice?._id,
      invoiceNumber: invoice?.invoiceNumber,
      paymentMethod,
      provider: 'admin_recorded',
      amountPaise,
      currency: 'INR',
      status: PaymentStatus.SUCCESSFUL,
      bankReferenceUtr: referenceNumber.trim(),
      notes: notes || `Direct B2B payment received for ${retailer.businessName}`,
      verifiedByUserId: actorUser.id || actorUser._id,
      verifiedAt: now,
    });

    // 4. Create immutable Ledger Entry
    const ledgerDesc = invoice
      ? `Payment received for Invoice #${invoice.invoiceNumber} via ${paymentMethod} (Ref: ${referenceNumber.trim()})`
      : `Payment received via ${paymentMethod} (Ref: ${referenceNumber.trim()})${notes ? ' - ' + notes : ''}`;

    const ledgerEntry = await LedgerEntry.create({
      retailerId: retailer._id,
      entryNumber,
      date: now,
      type: LedgerEntryType.PAYMENT_RECEIVED,
      referenceModel: 'PaymentTransaction',
      referenceId: paymentTx._id,
      referenceNumber: referenceNumber.trim(),
      description: ledgerDesc,
      debitPaise: 0,
      creditPaise: amountPaise,
      runningBalancePaise: newRunningBalance,
      recordedByUserId: actorUser.id || actorUser._id,
    });

    // 5. Update Retailer outstanding receivables
    await Retailer.findByIdAndUpdate(retailer._id, {
      $inc: { outstandingReceivablesPaise: -amountPaise },
    });

    // 6. Update linked invoice if provided
    if (invoice) {
      const newPaidAmount = invoice.paidAmountPaise + amountPaise;
      const newOutstanding = Math.max(0, invoice.totalPaise - newPaidAmount);
      invoice.paidAmountPaise = Math.min(invoice.totalPaise, newPaidAmount);
      invoice.outstandingAmountPaise = newOutstanding;
      invoice.status =
        newOutstanding === 0
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;
      await invoice.save();
    }

    // 7. Audit log
    await auditLogger.logAction({
      actorId: (actorUser.id || actorUser._id).toString(),
      action: 'PAYMENT_RECORDED',
      targetResource: 'LedgerEntry',
      targetId: ledgerEntry.id,
      details: {
        retailerId: retailer.id,
        retailerName: retailer.businessName,
        amountPaise,
        referenceNumber,
        newRunningBalance,
        invoiceId: invoice?.id,
      },
    });

    return {
      payment: paymentTx,
      ledgerEntry,
      newRunningBalance,
      invoice: invoice ? invoice.toJSON() : null,
    };
  }

  /**
   * Records a manual debit or credit adjustment (credit note / debit note).
   */
  async recordAdjustment(input: RecordAdjustmentInput, actorUser: any) {
    const { retailerId, type, amountPaise, reason, referenceNumber } = input;

    if (!mongoose.Types.ObjectId.isValid(retailerId)) {
      throw ApiError.badRequest('Invalid retailer ID');
    }

    if (!amountPaise || amountPaise <= 0) {
      throw ApiError.badRequest('Adjustment amount must be greater than zero');
    }

    if (!reason || !reason.trim()) {
      throw ApiError.badRequest('Reason for ledger adjustment is mandatory');
    }

    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      throw ApiError.notFound('Retailer not found');
    }

    const lastEntry = await LedgerEntry.findOne({ retailerId: retailer._id })
      .sort({ date: -1, _id: -1 })
      .lean();

    const previousBalance = lastEntry
      ? lastEntry.runningBalancePaise
      : retailer.outstandingReceivablesPaise || 0;

    let debitPaise = 0;
    let creditPaise = 0;
    let newBalance = previousBalance;

    if (type === LedgerEntryType.CREDIT_NOTE) {
      creditPaise = amountPaise;
      newBalance = Math.max(0, previousBalance - amountPaise);
      await Retailer.findByIdAndUpdate(retailer._id, {
        $inc: { outstandingReceivablesPaise: -amountPaise },
      });
    } else {
      debitPaise = amountPaise;
      newBalance = previousBalance + amountPaise;
      await Retailer.findByIdAndUpdate(retailer._id, {
        $inc: { outstandingReceivablesPaise: amountPaise },
      });
    }

    const now = new Date();
    const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prefix = type === LedgerEntryType.CREDIT_NOTE ? 'CN' : 'DN';
    const entryNumber = `LED-${prefix}-${datePrefix}-${randomSuffix}`;
    const refNum = referenceNumber?.trim() || entryNumber;

    const ledgerEntry = await LedgerEntry.create({
      retailerId: retailer._id,
      entryNumber,
      date: now,
      type,
      referenceModel: 'Adjustment',
      referenceNumber: refNum,
      description: `${type === LedgerEntryType.CREDIT_NOTE ? 'Credit Note' : 'Debit Adjustment'}: ${reason.trim()}`,
      debitPaise,
      creditPaise,
      runningBalancePaise: newBalance,
      recordedByUserId: actorUser.id || actorUser._id,
    });

    await auditLogger.logAction({
      actorId: (actorUser.id || actorUser._id).toString(),
      action: 'LEDGER_ADJUSTMENT_RECORDED',
      targetResource: 'LedgerEntry',
      targetId: ledgerEntry.id,
      details: {
        retailerId: retailer.id,
        type,
        amountPaise,
        reason,
        newBalance,
      },
    });

    return ledgerEntry;
  }

  /**
   * Updates customer credit limit, terms, or hold status with audit tracking.
   */
  async updateCreditTerms(
    retailerId: string,
    input: UpdateCreditTermsInput,
    actorUser: any
  ) {
    if (!mongoose.Types.ObjectId.isValid(retailerId)) {
      throw ApiError.badRequest('Invalid retailer ID');
    }

    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      throw ApiError.notFound('Retailer not found');
    }

    const updates: any = {};
    if (typeof input.creditLimitPaise === 'number' && input.creditLimitPaise >= 0) {
      updates.creditLimitPaise = input.creditLimitPaise;
    }
    if (typeof input.paymentTermsDays === 'number' && input.paymentTermsDays >= 0) {
      updates.paymentTermsDays = input.paymentTermsDays;
    }
    if (input.creditStatus && Object.values(CreditStatus).includes(input.creditStatus)) {
      updates.creditStatus = input.creditStatus;
      if (input.creditStatus === CreditStatus.ON_HOLD) {
        updates.creditHoldReason = input.creditHoldReason || 'Credit put on hold by accounts manager';
      } else {
        updates.creditHoldReason = '';
      }
    }

    const updatedRetailer = await Retailer.findByIdAndUpdate(retailerId, updates, {
      new: true,
    });

    await auditLogger.logAction({
      actorId: (actorUser.id || actorUser._id).toString(),
      action: 'CREDIT_TERMS_UPDATED',
      targetResource: 'Retailer',
      targetId: retailer.id,
      details: { updates },
    });

    return updatedRetailer;
  }
}

export const creditService = new CreditService();
