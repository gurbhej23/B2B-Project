import mongoose from 'mongoose';
import { Order } from '../orders/order.model';
import { Invoice } from '../invoices/invoice.model';
import { Retailer } from '../retailers/retailer.model';
import { PaymentTransaction } from '../payments/payment.model';
import { Product } from '../products/product.model';
import {
  OrderStatus,
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
  formatPaiseToINR,
} from '@necessity/shared';

export interface AnalyticsFilterQuery {
  startDate?: string;
  endDate?: string;
  retailerId?: string;
  productId?: string;
}

export class AnalyticsService {
  /**
   * Computes comprehensive authoritative business analytics using MongoDB aggregations.
   * Clearly distinguishes Gross Order Value, Invoiced Sales, Collected Payments, and Outstanding Receivables.
   */
  async getOverviewMetrics(query: AnalyticsFilterQuery) {
    const { startDate, endDate, retailerId, productId } = query;

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = eDate;
    }

    const hasDate = Object.keys(dateFilter).length > 0;

    // Base match for orders
    const orderMatch: any = {};
    if (hasDate) orderMatch.createdAt = dateFilter;
    if (retailerId && mongoose.Types.ObjectId.isValid(retailerId)) {
      orderMatch.retailerId = new mongoose.Types.ObjectId(retailerId);
    }

    // 1. Order Status Breakdown & Gross Order Value
    const orderStatsAgg = await Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValuePaise: { $sum: '$grandTotalPaise' },
        },
      },
    ]);

    const orderStatusCounts: Record<string, { count: number; totalValuePaise: number }> = {
      SUBMITTED: { count: 0, totalValuePaise: 0 },
      APPROVED: { count: 0, totalValuePaise: 0 },
      PROCESSING: { count: 0, totalValuePaise: 0 },
      DISPATCHED: { count: 0, totalValuePaise: 0 },
      DELIVERED: { count: 0, totalValuePaise: 0 },
      CANCELLED: { count: 0, totalValuePaise: 0 },
      REJECTED: { count: 0, totalValuePaise: 0 },
    };

    let totalOrdersCount = 0;
    let grossOrderValuePaise = 0; // Excludes cancelled and rejected orders

    orderStatsAgg.forEach((stat) => {
      totalOrdersCount += stat.count;
      if (orderStatusCounts[stat._id]) {
        orderStatusCounts[stat._id] = {
          count: stat.count,
          totalValuePaise: stat.totalValuePaise,
        };
      }
      if (stat._id !== OrderStatus.CANCELLED && stat._id !== OrderStatus.REJECTED) {
        grossOrderValuePaise += stat.totalValuePaise;
      }
    });

    // 2. Invoiced Sales & Overdue Invoices
    const invoiceMatch: any = {};
    if (hasDate) invoiceMatch.issueDate = dateFilter;
    if (retailerId && mongoose.Types.ObjectId.isValid(retailerId)) {
      invoiceMatch.retailerId = new mongoose.Types.ObjectId(retailerId);
    }

    const invoiceStatsAgg = await Invoice.aggregate([
      { $match: invoiceMatch },
      {
        $group: {
          _id: null,
          invoicedSalesPaise: { $sum: '$totalPaise' },
          invoiceCount: { $sum: 1 },
          paidAmountPaise: { $sum: '$paidAmountPaise' },
          outstandingInvoiceAmountPaise: { $sum: '$outstandingAmountPaise' },
          overduePaise: {
            $sum: {
              $cond: [{ $eq: ['$status', InvoiceStatus.OVERDUE] }, '$outstandingAmountPaise', 0],
            },
          },
          overdueCount: {
            $sum: {
              $cond: [{ $eq: ['$status', InvoiceStatus.OVERDUE] }, 1, 0],
            },
          },
        },
      },
    ]);

    const invoiceStats = invoiceStatsAgg[0] || {
      invoicedSalesPaise: 0,
      invoiceCount: 0,
      paidAmountPaise: 0,
      outstandingInvoiceAmountPaise: 0,
      overduePaise: 0,
      overdueCount: 0,
    };

    // 3. Collected Payments & Gateway Performance
    const paymentMatch: any = {};
    if (hasDate) paymentMatch.createdAt = dateFilter;
    if (retailerId && mongoose.Types.ObjectId.isValid(retailerId)) {
      paymentMatch.retailerId = new mongoose.Types.ObjectId(retailerId);
    }

    const paymentAgg = await PaymentTransaction.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalPaise: { $sum: '$amountPaise' },
        },
      },
    ]);

    let collectedPaymentsPaise = 0;
    let successfulPaymentsCount = 0;
    let pendingPaymentsCount = 0;
    let failedPaymentsCount = 0;
    let totalTransactionsCount = 0;

    paymentAgg.forEach((p) => {
      totalTransactionsCount += p.count;
      if (p._id === PaymentStatus.SUCCESSFUL) {
        collectedPaymentsPaise += p.totalPaise;
        successfulPaymentsCount += p.count;
      } else if (p._id === PaymentStatus.PENDING || p._id === PaymentStatus.SUBMITTED_FOR_VERIFICATION) {
        pendingPaymentsCount += p.count;
      } else if (p._id === PaymentStatus.FAILED) {
        failedPaymentsCount += p.count;
      }
    });

    const paymentSuccessRate =
      totalTransactionsCount > 0
        ? Math.round((successfulPaymentsCount / totalTransactionsCount) * 100)
        : 100;

    // 4. Outstanding Credit Portfolio from active retailers
    const retailerCreditAgg = await Retailer.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalAssignedCreditPaise: { $sum: '$creditLimitPaise' },
          totalOutstandingReceivablesPaise: { $sum: '$outstandingReceivablesPaise' },
          totalActiveReservationsPaise: { $sum: '$activeReservationsPaise' },
        },
      },
    ]);

    const creditStats = retailerCreditAgg[0] || {
      totalAssignedCreditPaise: 0,
      totalOutstandingReceivablesPaise: 0,
      totalActiveReservationsPaise: 0,
    };

    // 5. Sales by Date Range (Timeline Chart)
    const timelineAgg = await Order.aggregate([
      {
        $match: {
          ...orderMatch,
          status: { $nin: [OrderStatus.CANCELLED, OrderStatus.REJECTED] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orderCount: { $sum: 1 },
          orderValuePaise: { $sum: '$grandTotalPaise' },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]);

    const salesTimeline = timelineAgg.map((item) => ({
      date: item._id,
      orderCount: item.orderCount,
      orderValuePaise: item.orderValuePaise,
    }));

    // 6. Top Selling Products
    const topProductsAgg = await Order.aggregate([
      {
        $match: {
          ...orderMatch,
          status: { $nin: [OrderStatus.CANCELLED, OrderStatus.REJECTED] },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.productNameSnapshot' },
          sku: { $first: '$items.skuSnapshot' },
          unitsSold: { $sum: '$items.quantity' },
          revenuePaise: { $sum: '$items.lineTotalPaise' },
        },
      },
      { $sort: { revenuePaise: -1 } },
      { $limit: 8 },
    ]);

    const topSellingProducts = topProductsAgg.map((p) => ({
      productId: p._id?.toString() || '',
      name: p.name || 'Product',
      sku: p.sku || 'SKU',
      unitsSold: p.unitsSold,
      revenuePaise: p.revenuePaise,
    }));

    // 7. Top Customers by Revenue & Outstanding Exposure
    const topCustomersAgg = await Order.aggregate([
      {
        $match: {
          ...orderMatch,
          status: { $nin: [OrderStatus.CANCELLED, OrderStatus.REJECTED] },
        },
      },
      {
        $group: {
          _id: '$retailerId',
          orderCount: { $sum: 1 },
          totalSpentPaise: { $sum: '$grandTotalPaise' },
        },
      },
      { $sort: { totalSpentPaise: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: 'retailers',
          localField: '_id',
          foreignField: '_id',
          as: 'retailer',
        },
      },
      { $unwind: { path: '$retailer', preserveNullAndEmptyArrays: true } },
    ]);

    const topCustomers = topCustomersAgg.map((c) => ({
      retailerId: c._id?.toString() || '',
      businessName: c.retailer?.businessName || 'Business Customer',
      contactPerson: c.retailer?.contactPerson || '',
      phone: c.retailer?.phone || '',
      orderCount: c.orderCount,
      totalSpentPaise: c.totalSpentPaise,
      creditLimitPaise: c.retailer?.creditLimitPaise || 0,
      outstandingReceivablesPaise: c.retailer?.outstandingReceivablesPaise || 0,
    }));

    return {
      financialSummary: {
        grossOrderValuePaise,
        invoicedSalesPaise: invoiceStats.invoicedSalesPaise,
        collectedPaymentsPaise,
        outstandingReceivablesPaise: creditStats.totalOutstandingReceivablesPaise,
        activeReservationsPaise: creditStats.totalActiveReservationsPaise,
        totalAssignedCreditPaise: creditStats.totalAssignedCreditPaise,
        overdueInvoiceAmountPaise: invoiceStats.overduePaise,
        overdueInvoicesCount: invoiceStats.overdueCount,
      },
      orderStats: {
        totalOrdersCount,
        breakdown: orderStatusCounts,
      },
      paymentGatewayStats: {
        totalTransactionsCount,
        successfulPaymentsCount,
        pendingPaymentsCount,
        failedPaymentsCount,
        paymentSuccessRate,
      },
      salesTimeline,
      topSellingProducts,
      topCustomers,
    };
  }

  /**
   * Generates safe CSV formatted export data for business reports.
   */
  async exportCsvReport(type: 'sales' | 'customers' | 'invoices' | 'payments', query: AnalyticsFilterQuery): Promise<string> {
    const { startDate, endDate } = query;
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = eDate;
    }
    const hasDate = Object.keys(dateFilter).length > 0;

    if (type === 'sales' || type === 'invoices') {
      const match: any = {};
      if (hasDate) match.issueDate = dateFilter;
      const invoices = await Invoice.find(match).sort({ issueDate: -1 }).limit(1000).lean();

      const headers = ['Invoice Number', 'Order Number', 'Retailer', 'GSTIN', 'Issue Date', 'Due Date', 'Subtotal (Rs)', 'Tax (Rs)', 'Total (Rs)', 'Paid (Rs)', 'Outstanding (Rs)', 'Status'];
      const rows = invoices.map((inv: any) => [
        `"${inv.invoiceNumber}"`,
        `"${inv.orderNumber || ''}"`,
        `"${inv.retailerBusinessName.replace(/"/g, '""')}"`,
        `"${inv.retailerGstin || ''}"`,
        `"${new Date(inv.issueDate).toLocaleDateString('en-IN')}"`,
        `"${new Date(inv.dueDate).toLocaleDateString('en-IN')}"`,
        (inv.subtotalPaise / 100).toFixed(2),
        (inv.taxPaise / 100).toFixed(2),
        (inv.totalPaise / 100).toFixed(2),
        (inv.paidAmountPaise / 100).toFixed(2),
        (inv.outstandingAmountPaise / 100).toFixed(2),
        `"${inv.status}"`,
      ]);

      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    if (type === 'customers') {
      const retailers = await Retailer.find({ isActive: true }).sort({ businessName: 1 }).limit(1000).lean();

      const headers = ['Business Name', 'Contact Person', 'Phone', 'Email', 'Customer Type', 'Credit Limit (Rs)', 'Outstanding Receivables (Rs)', 'Active Reservations (Rs)', 'Available Credit (Rs)', 'Payment Terms (Days)', 'Credit Status'];
      const rows = retailers.map((r: any) => {
        const avail = Math.max(0, (r.creditLimitPaise || 0) - (r.outstandingReceivablesPaise || 0) - (r.activeReservationsPaise || 0));
        return [
          `"${r.businessName.replace(/"/g, '""')}"`,
          `"${r.contactPerson.replace(/"/g, '""')}"`,
          `"${r.phone}"`,
          `"${r.email || ''}"`,
          `"${r.customerType || 'retailer'}"`,
          ((r.creditLimitPaise || 0) / 100).toFixed(2),
          ((r.outstandingReceivablesPaise || 0) / 100).toFixed(2),
          ((r.activeReservationsPaise || 0) / 100).toFixed(2),
          (avail / 100).toFixed(2),
          r.paymentTermsDays || 15,
          `"${r.creditStatus || 'NORMAL'}"`,
        ];
      });

      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    // Default to payments
    const payMatch: any = {};
    if (hasDate) payMatch.createdAt = dateFilter;
    const payments = await PaymentTransaction.find(payMatch)
      .sort({ createdAt: -1 })
      .populate('retailerId', 'businessName')
      .populate('orderId', 'orderNumber')
      .limit(1000)
      .lean();

    const headers = ['Transaction ID', 'Order Number', 'Customer', 'Method', 'Provider', 'Amount (Rs)', 'Status', 'UTR / Reference', 'Created At'];
    const rows = payments.map((p: any) => [
      `"${p._id}"`,
      `"${p.orderId?.orderNumber || ''}"`,
      `"${p.retailerId?.businessName ? p.retailerId.businessName.replace(/"/g, '""') : ''}"`,
      `"${p.paymentMethod}"`,
      `"${p.provider}"`,
      ((p.amountPaise || 0) / 100).toFixed(2),
      `"${p.status}"`,
      `"${p.bankReferenceUtr || p.providerPaymentId || ''}"`,
      `"${new Date(p.createdAt).toLocaleDateString('en-IN')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

export const analyticsService = new AnalyticsService();

