import mongoose from 'mongoose';
import { Order } from '../orders/order.model';
import { User } from '../users/user.model';
import { Retailer } from '../retailers/retailer.model';
import { PaymentTransaction } from '../payments/payment.model';
import { Product } from '../products/product.model';
import { AuditLog } from '../audit/audit.model';
import {
  OrderStatus,
  AccountStatus,
  PaymentStatus,
  CreditStatus,
  UserRole,
} from '@necessity/shared';

export interface DashboardOverviewData {
  summaryBoxes: {
    totalUsersCount: number;
    pendingUsersCount: number;
    totalProductsCount: number;
    activeProductsCount: number;
    totalOrdersCount: number;
    nonCancelledOrdersCount: number;
    totalRevenuePaise: number;
  };
  operationalCards: {
    pendingOrdersCount: number;
    pendingRetailersCount: number;
    paymentsToVerifyCount: number;
    totalOutstandingPaise: number;
  };
  todayOrders: {
    count: number;
    totalValuePaise: number;
  };
  retailerStats: {
    approvedRetailersCount: number;
    totalCreditAssignedPaise: number;
    accountsOnHoldCount: number;
  };
  lowStockAlerts: Array<{
    id: string;
    variantId?: string;
    sku: string;
    name: string;
    brand: string;
    categoryName?: string;
    uom: string;
    stockOnHand: number;
    stockReserved: number;
    availableStock: number;
    lowStockThreshold: number;
    isOutOfStock: boolean;
    hasVariants: boolean;
  }>;
  lowStockSummary: {
    totalLowStockCount: number;
    totalOutOfStockCount: number;
  };
  recentActivity: Array<{
    id: string;
    type: 'order' | 'retailer' | 'payment' | 'credit' | 'system';
    action: string;
    title: string;
    description: string;
    timestamp: Date;
    actorName?: string;
    statusBadge?: string;
    link?: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    retailerName: string;
    itemCount: number;
    grandTotalPaise: number;
    paymentStatus: string;
    status: OrderStatus;
    createdAt: Date;
  }>;
  recentUsers: Array<{
    id: string;
    name: string;
    businessName: string;
    email?: string;
    phone: string;
    role: UserRole;
    accountStatus: AccountStatus;
    createdAt: Date;
  }>;
}

export class DashboardService {
  async getOverview(): Promise<DashboardOverviewData> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // Concurrently run authoritative database queries
    const [
      pendingOrdersCount,
      pendingRetailersCount,
      paymentsToVerifyCount,
      retailerAgg,
      todayOrdersAgg,
      products,
      auditLogs,
      recentOrdersRaw,
      recentUsersRaw,
      totalRetailerUsersCount,
      totalRetailersCount,
      totalProductsCount,
      totalOrdersCount,
      allTimeOrdersAgg,
    ] = await Promise.all([
      // 1. Pending orders awaiting review
      Order.countDocuments({ status: OrderStatus.SUBMITTED }),

      // 2. Pending retailers awaiting KYC / credit assignment
      User.countDocuments({ role: UserRole.RETAILER, accountStatus: AccountStatus.PENDING }),

      // 3. Payments awaiting verification (manual bank transfers / pending gateway)
      PaymentTransaction.countDocuments({
        status: { $in: [PaymentStatus.PENDING, PaymentStatus.SUBMITTED_FOR_VERIFICATION] },
      }),

      // 4. Retailer credit portfolio & verified outstanding receivables
      Retailer.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalOutstandingPaise: { $sum: '$outstandingReceivablesPaise' },
            totalCreditLimitPaise: { $sum: '$creditLimitPaise' },
            approvedRetailersCount: { $sum: 1 },
            accountsOnHoldCount: {
              $sum: { $cond: [{ $eq: ['$creditStatus', CreditStatus.ON_HOLD] }, 1, 0] },
            },
          },
        },
      ]),

      // 5. Today's orders count and gross value (excluding cancelled orders)
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfToday },
            status: { $ne: OrderStatus.CANCELLED },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalValuePaise: { $sum: '$grandTotalPaise' },
          },
        },
      ]),

      // 6. Active products for inventory & low stock calculations
      Product.find({ isActive: true }).select(
        'sku name brand categoryName uom stockOnHand stockReserved lowStockThreshold hasVariants variants'
      ).lean(),

      // 7. Recent audit trail logs
      AuditLog.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('actorId', 'name email phone role')
        .lean(),

      // 8. Recent order placements
      Order.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .select('orderNumber retailerName grandTotalPaise paymentStatus status createdAt items')
        .lean(),

      // 9. Recent registered customers / retailers only (excluding admin & internal staff)
      User.find({ role: UserRole.RETAILER })
        .sort({ createdAt: -1 })
        .limit(6)
        .select('name email phone role accountStatus createdAt retailerProfileId')
        .lean(),

      // 10. Total customer users count
      User.countDocuments({ role: UserRole.RETAILER }),

      // 11. Total registered retailers count (excluding archived)
      Retailer.countDocuments({ isArchived: { $ne: true } }),

      // 12. Total products count
      Product.countDocuments(),

      // 13. Total orders count
      Order.countDocuments(),

      // 14. All-time non-cancelled orders count & gross revenue
      Order.aggregate([
        { $match: { status: { $ne: OrderStatus.CANCELLED } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalRevenuePaise: { $sum: '$grandTotalPaise' },
          },
        },
      ]),
    ] as any) as [
        number,
        number,
        number,
        any[],
        any[],
        any[],
        any[],
        any[],
        any[],
        number,
        number,
        number,
        number,
        any[]
      ];

    // Format recent users with linked Retailer business details if available
    const userIds = recentUsersRaw.map((u: any) => u._id);
    const retailerProfileIds = recentUsersRaw
      .map((u: any) => u.retailerProfileId)
      .filter((id: any) => Boolean(id));

    const retailers = await Retailer.find({
      $or: [
        { userId: { $in: userIds } },
        ...(retailerProfileIds.length > 0 ? [{ _id: { $in: retailerProfileIds } }] : []),
      ],
    })
      .select('_id userId businessName phone email')
      .lean();

    const retailerMap = new Map();
    retailers.forEach((r: any) => {
      if (r.userId) retailerMap.set(r.userId.toString(), r);
      if (r._id) retailerMap.set(r._id.toString(), r);
    });

    const formattedRecentUsers = recentUsersRaw.map((u: any) => {
      const r =
        retailerMap.get(u._id.toString()) ||
        (u.retailerProfileId ? retailerMap.get(u.retailerProfileId.toString()) : null);
      return {
        id: u._id.toString(),
        name: u.name,
        businessName: r?.businessName || u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        accountStatus: u.accountStatus,
        createdAt: u.createdAt,
      };
    });

    const formattedRecentOrders = recentOrdersRaw.map((o: any) => ({
      id: o._id.toString(),
      orderNumber: o.orderNumber,
      retailerName: o.retailerName,
      itemCount: Array.isArray(o.items) ? o.items.length : 1,
      grandTotalPaise: o.grandTotalPaise,
      paymentStatus: o.paymentStatus || 'pending',
      status: o.status,
      createdAt: o.createdAt,
    }));

    const retailerMetrics = retailerAgg[0] || {
      totalOutstandingPaise: 0,
      totalCreditLimitPaise: 0,
      approvedRetailersCount: 0,
      accountsOnHoldCount: 0,
    };

    const todayMetrics = todayOrdersAgg[0] || {
      count: 0,
      totalValuePaise: 0,
    };

    // Calculate low stock items across non-variant products and variants
    const lowStockItems: any[] = [];
    let totalLowStockCount = 0;
    let totalOutOfStockCount = 0;

    for (const p of products) {
      const threshold = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 10;
      const onHand = p.stockOnHand || 0;
      const reserved = p.stockReserved || 0;
      const available = Math.max(0, onHand - reserved);

      if (p.hasVariants && Array.isArray(p.variants) && p.variants.length > 0) {
        for (const v of p.variants) {
          if (v.isActive === false) continue;
          const vOnHand = v.stockOnHand || 0;
          const vReserved = v.stockReserved || 0;
          const vAvailable = Math.max(0, vOnHand - vReserved);
          if (vAvailable <= threshold) {
            if (vAvailable <= 0) totalOutOfStockCount++;
            else totalLowStockCount++;

            lowStockItems.push({
              id: (p as any)._id.toString(),
              variantId: (v as any)._id?.toString(),
              sku: v.sku,
              name: `${p.name} — ${v.name || (v.attributes ? Object.values(v.attributes).join('/') : v.sku)}`,
              brand: p.brand,
              categoryName: p.categoryName,
              uom: p.uom,
              stockOnHand: vOnHand,
              stockReserved: vReserved,
              availableStock: vAvailable,
              lowStockThreshold: threshold,
              isOutOfStock: vAvailable <= 0,
              hasVariants: true,
            });
          }
        }
      } else {
        if (available <= threshold) {
          if (available <= 0) totalOutOfStockCount++;
          else totalLowStockCount++;

          lowStockItems.push({
            id: (p as any)._id.toString(),
            sku: p.sku,
            name: p.name,
            brand: p.brand,
            categoryName: p.categoryName,
            uom: p.uom,
            stockOnHand: onHand,
            stockReserved: reserved,
            availableStock: available,
            lowStockThreshold: threshold,
            isOutOfStock: available <= 0,
            hasVariants: false,
          });
        }
      }
    }

    // Sort: Out of stock first, then lowest available stock ascending
    lowStockItems.sort((a, b) => {
      if (a.isOutOfStock !== b.isOutOfStock) return a.isOutOfStock ? -1 : 1;
      return a.availableStock - b.availableStock;
    });

    // Format recent activity
    const activityItems: any[] = [];

    // Map audit logs
    for (const log of auditLogs) {
      const actor = (log as any).actorId;
      const actorName = actor ? actor.name || actor.email || actor.phone : 'System Admin';
      const details = (log as any).details || {};

      let type: any = 'system';
      let title = log.action.replace(/_/g, ' ');
      let description = `Action performed on ${log.targetResource}`;
      let statusBadge = undefined;
      let link = undefined;

      if (log.action.includes('ORDER')) {
        type = 'order';
        title = `Order: ${details.orderNumber || log.targetId || log.action}`;
        description = details.status ? `Status updated to ${details.status}` : `Order action: ${log.action}`;
        statusBadge = details.status || 'Order';
        link = '/admin/orders';
      } else if (log.action.includes('RETAILER') || log.action.includes('CUSTOMER')) {
        type = 'retailer';
        title = `Customer: ${details.businessName || details.name || 'Retailer Account'}`;
        description = log.action.includes('APPROVED')
          ? `Account approved with credit limit`
          : log.action.includes('REJECTED')
            ? `Application rejected`
            : `Profile updated (${log.action})`;
        statusBadge = log.action.includes('APPROVED') ? 'Approved' : 'Updated';
        link = '/admin/pending-retailers';
      } else if (log.action.includes('PAYMENT') || log.action.includes('TRANSFER')) {
        type = 'payment';
        title = `Payment: ${details.orderNumber || details.utr || 'Transaction'}`;
        description = log.action.includes('VERIFIED')
          ? `Payment verified successfully`
          : `Payment initiated / submitted`;
        statusBadge = 'Payment';
        link = '/admin/credit';
      }

      activityItems.push({
        id: (log as any)._id.toString(),
        type,
        action: log.action,
        title,
        description,
        timestamp: (log as any).createdAt,
        actorName,
        statusBadge,
        link,
      });
    }

    // If few audit logs exist, merge recent orders
    if (activityItems.length < 5) {
      for (const order of recentOrdersRaw) {
        if (!activityItems.some((a) => a.title.includes(order.orderNumber))) {
          activityItems.push({
            id: (order as any)._id.toString(),
            type: 'order',
            action: 'ORDER_PLACED',
            title: `Order #${order.orderNumber}`,
            description: `${order.retailerName} placed order worth ₹${((order.grandTotalPaise || 0) / 100).toFixed(2)}`,
            timestamp: (order as any).createdAt,
            actorName: order.retailerName,
            statusBadge: order.status,
            link: '/admin/orders',
          });
        }
      }
    }

    // Sort activity chronologically descending
    activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const allTimeOrdersMetrics = allTimeOrdersAgg[0] || {
      count: 0,
      totalRevenuePaise: 0,
    };

    const effectiveTotalUsers = Math.max(totalRetailerUsersCount || 0, totalRetailersCount || 0);

    return {
      summaryBoxes: {
        totalUsersCount: effectiveTotalUsers || 0,
        pendingUsersCount: pendingRetailersCount || 0,
        totalProductsCount: totalProductsCount || 0,
        activeProductsCount: products.length || 0,
        totalOrdersCount: totalOrdersCount || 0,
        nonCancelledOrdersCount: allTimeOrdersMetrics.count || 0,
        totalRevenuePaise: allTimeOrdersMetrics.totalRevenuePaise || 0,
      },
      operationalCards: {
        pendingOrdersCount,
        pendingRetailersCount,
        paymentsToVerifyCount,
        totalOutstandingPaise: retailerMetrics.totalOutstandingPaise || 0,
      },
      todayOrders: {
        count: todayMetrics.count || 0,
        totalValuePaise: todayMetrics.totalValuePaise || 0,
      },
      retailerStats: {
        approvedRetailersCount: retailerMetrics.approvedRetailersCount || 0,
        totalCreditAssignedPaise: retailerMetrics.totalCreditLimitPaise || 0,
        accountsOnHoldCount: retailerMetrics.accountsOnHoldCount || 0,
      },
      lowStockAlerts: lowStockItems.slice(0, 8),
      lowStockSummary: {
        totalLowStockCount,
        totalOutOfStockCount,
      },
      recentActivity: activityItems.slice(0, 10),
      recentOrders: formattedRecentOrders,
      recentUsers: formattedRecentUsers,
    };
  }
}

export const dashboardService = new DashboardService();
