import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Users,
  Clock,
  ShieldCheck,
  CreditCard,
  Building2,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  ShoppingCart,
  Calendar,
  AlertCircle,
  Eye,
  UserCheck,
  UserRoundCheck,
} from 'lucide-react';
import { formatPaiseToINR } from '@necessity/shared';

interface DashboardData {
  summaryBoxes?: {
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
    timestamp: string;
    actorName?: string;
    statusBadge?: string;
    link?: string;
  }>;
  recentOrders?: Array<{
    id: string;
    orderNumber: string;
    retailerName: string;
    itemCount: number;
    grandTotalPaise: number;
    paymentStatus: string;
    status: string;
    createdAt: string;
  }>;
  recentUsers?: Array<{
    id: string;
    name: string;
    businessName: string;
    email?: string;
    phone: string;
    role: string;
    accountStatus: string;
    createdAt: string;
  }>;
}

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await api.get('/dashboard/overview');
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setLastRefreshed(new Date());
      } else {
        throw new Error(res.data?.message || 'Failed to load dashboard statistics');
      }
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setError(err.response?.data?.message || err.message || 'Unable to connect to executive dashboard API');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const getOrderStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'submitted':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF8F3] text-[#F47732] border border-[#F0E0D5]">
            Submitted
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Approved
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF1E8] text-[#E95B2A] border border-[#F0E0D5]">
            Processing
          </span>
        );
      case 'dispatched':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            Dispatched
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Delivered
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Paid
          </span>
        );
      case 'pending':
      case 'submitted_for_verification':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Verification Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status || 'Pending'}
          </span>
        );
    }
  };

  const getAccountStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Active
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Pending KYC
          </span>
        );
      case 'suspended':
      case 'rejected':
      case 'on_hold':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            {status?.replace('_', ' ')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status || 'Pending'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="text-[#292929]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl sm:text-2xl font-bold tracking-tight text-[#292929] flex items-center gap-3">
              <UserRoundCheck className="h-6 w-6 text-[#F47732]" />
              Welcome back, Admin
            </h1>
            <p className="text-sm text-[#292929]">
              Monitor orders, approvals, and inventory performance.</p>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-rose-800 text-sm">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* SECTION 1: Four Primary Executive KPI Boxes */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Box 1: Total users */}
          <Link
            to="/admin/customers"
            className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-[#F0E0D5] hover:border-[#F47732] hover:shadow-sm transition-all flex items-center justify-between group"
          >
            <div className="space-y-1">
              <span className="text-xs sm:text-[13px] font-normal text-[#737373] block">
                Total users
              </span>
              <div className="text-2xl sm:text-2xl font-bold text-[#292929] tabular-nums tracking-tight">
                {isLoading ? (
                  <div className="h-8 w-16 bg-[#FFF8F3] animate-pulse rounded"></div>
                ) : (
                  data?.summaryBoxes?.totalUsersCount ?? data?.retailerStats?.approvedRetailersCount ?? 0
                )}
              </div>
              <span className="text-xs font-semibold text-[#E95B2A] block">
                {data?.summaryBoxes?.pendingUsersCount ?? data?.operationalCards?.pendingRetailersCount ?? 0} pending approval
              </span>
            </div>
            <div className="text-3xl shrink-0 select-none flex items-center justify-center">
              <svg className="h-8 w-8 text-[#4A2D73]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
          </Link>

          {/* Box 2: Total products */}
          <Link
            to="/admin/products"
            className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-[#F0E0D5] hover:border-[#F47732] hover:shadow-sm transition-all flex items-center justify-between group"
          >
            <div className="space-y-1">
              <span className="text-xs sm:text-[13px] font-normal text-[#737373] block">
                Total products
              </span>
              <div className="text-2xl sm:text-2xl font-bold text-[#292929] tabular-nums tracking-tight">
                {isLoading ? (
                  <div className="h-8 w-16 bg-[#FFF8F3] animate-pulse rounded"></div>
                ) : (
                  data?.summaryBoxes?.totalProductsCount ?? 0
                )}
              </div>
              <span className="text-xs font-normal text-[#737373] block">
                {data?.summaryBoxes?.activeProductsCount ?? 0} active
              </span>
            </div>
            <div className="text-3xl shrink-0 select-none flex items-center justify-center">
              <span role="img" aria-label="Total products">📦</span>
            </div>
          </Link>

          {/* Box 3: Total orders */}
          <Link
            to="/admin/orders"
            className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-[#F0E0D5] hover:border-[#F47732] hover:shadow-sm transition-all flex items-center justify-between group"
          >
            <div className="space-y-1">
              <span className="text-xs sm:text-[13px] font-normal text-[#737373] block">
                Total orders
              </span>
              <div className="text-2xl sm:text-2xl font-bold text-[#292929] tabular-nums tracking-tight">
                {isLoading ? (
                  <div className="h-8 w-16 bg-[#FFF8F3] animate-pulse rounded"></div>
                ) : (
                  data?.summaryBoxes?.nonCancelledOrdersCount ?? data?.summaryBoxes?.totalOrdersCount ?? data?.todayOrders?.count ?? 0
                )}
              </div>
              <span className="text-xs font-normal text-[#737373] block">
                Non-cancelled
              </span>
            </div>
            <div className="text-3xl shrink-0 select-none flex items-center justify-center">
              <span role="img" aria-label="Total orders">🛒</span>
            </div>
          </Link>

          {/* Box 4: Revenue */}
          <Link
            to="/admin/orders"
            className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-[#F0E0D5] hover:border-[#F47732] hover:shadow-sm transition-all flex items-center justify-between group"
          >
            <div className="space-y-1">
              <span className="text-xs sm:text-[13px] font-normal text-[#737373] block">
                Revenue
              </span>
              <div className="text-2xl sm:text-2xl font-bold text-[#292929] tabular-nums tracking-tight">
                {isLoading ? (
                  <div className="h-8 w-24 bg-[#FFF8F3] animate-pulse rounded"></div>
                ) : (
                  formatPaiseToINR(data?.summaryBoxes?.totalRevenuePaise ?? 0)
                )}
              </div>
              <span className="text-xs font-normal text-[#737373] block">
                All time
              </span>
            </div>
            <div className="text-3xl shrink-0 select-none flex items-center justify-center">
              <span role="img" aria-label="Revenue">💰</span>
            </div>
          </Link>
        </div>
      </div>
      {/* SECTION 3: Low Stock Warning Bar (if alerts exist) */}
      {data?.lowStockSummary && data.lowStockSummary.totalLowStockCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Low Stock Threshold Alert: {data.lowStockSummary.totalLowStockCount} item(s) need reordering
                {data.lowStockSummary.totalOutOfStockCount > 0 && ` (${data.lowStockSummary.totalOutOfStockCount} out of stock)`}
              </p>
              <p className="text-xs text-amber-700">
                Replenish inventory to prevent order fulfillment bottlenecks.
              </p>
            </div>
          </div>
          <Link
            to="/admin/products/stock"
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition whitespace-nowrap self-start sm:self-auto"
          >
            Manage Inventory Stock <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* SECTION 5: Recent Orders & Recent Customers (1 Row, 2 Columns List Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Recent Wholesale Orders List */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#F0E0D5] flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[#F0E0D5] flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-[#FFF8F3] text-[#F47732] border border-[#F0E0D5] flex items-center justify-center shrink-0">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base text-[#292929] truncate">Recent Orders</h3>
                <p className="text-xs text-[#737373] mt-0.5 truncate">Latest purchase orders received across territories</p>
              </div>
            </div>

            <Link
              to="/admin/orders"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#F47732] hover:text-[#E95B2A] transition shrink-0"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-[#F0E0D5] flex-1">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between gap-4 animate-pulse">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-[#FFF8F3] rounded w-36"></div>
                    <div className="h-3 bg-[#FFF8F3] rounded w-48"></div>
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="h-4 bg-[#FFF8F3] rounded w-20 ml-auto"></div>
                    <div className="h-3 bg-[#FFF8F3] rounded w-16 ml-auto"></div>
                  </div>
                </div>
              ))
            ) : !data?.recentOrders || data.recentOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#737373]">
                <ShoppingCart className="h-8 w-8 text-[#D1D5DB] mx-auto mb-2" />
                <p>No recent wholesale orders recorded yet.</p>
              </div>
            ) : (
              data.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 hover:bg-[#FFF8F3]/50 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-sm text-[#292929] group-hover:text-[#F47732] transition-colors">
                        #{order.orderNumber}
                      </span>
                      {getOrderStatusBadge(order.status)}
                      {getPaymentStatusBadge(order.paymentStatus)}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#737373]">
                      <span className="font-medium text-[#292929]">{order.retailerName}</span>
                      <span>•</span>
                      <span>{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}</span>
                      <span>•</span>
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <div className="font-bold text-sm sm:text-base text-[#292929] tabular-nums">
                        {formatPaiseToINR(order.grandTotalPaise)}
                      </div>
                    </div>
                    <Link
                      to="/admin/orders"
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-[#F0E0D5] bg-white text-xs font-semibold text-[#292929] hover:bg-[#FFF8F3] hover:text-[#F47732] hover:border-[#F47732] shadow-sm transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Recent Registered Customers List */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#F0E0D5] flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[#F0E0D5] flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-[#FFF1E8] text-[#E95B2A] border border-[#F0E0D5] flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base text-[#292929] truncate">Recent Customers</h3>
                <p className="text-xs text-[#737373] mt-0.5 truncate">Newly onboarded retail buyers & dealers</p>
              </div>
            </div>

            <Link
              to="/admin/customers"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#F47732] hover:text-[#E95B2A] transition shrink-0"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-[#F0E0D5] flex-1">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between gap-4 animate-pulse">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-[#FFF8F3] rounded w-36"></div>
                    <div className="h-3 bg-[#FFF8F3] rounded w-48"></div>
                  </div>
                  <div className="h-7 bg-[#FFF8F3] rounded w-16"></div>
                </div>
              ))
            ) : !data?.recentUsers ||
              data.recentUsers.filter(
                (u) =>
                  u.role === 'retailer' ||
                  !['super_admin', 'admin', 'sales_manager', 'salesman', 'accounts_manager', 'warehouse_manager'].includes(
                    u.role?.toLowerCase()
                  )
              ).length === 0 ? (
              <div className="p-8 text-center text-sm text-[#737373]">
                <Users className="h-8 w-8 text-[#D1D5DB] mx-auto mb-2" />
                <p>No recent registered customers found.</p>
              </div>
            ) : (
              data.recentUsers
                .filter(
                  (u) =>
                    u.role === 'retailer' ||
                    !['super_admin', 'admin', 'sales_manager', 'salesman', 'accounts_manager', 'warehouse_manager'].includes(
                      u.role?.toLowerCase()
                    )
                )
                .map((u) => (
                  <div
                    key={u.id}
                    className="p-4 hover:bg-[#FFF8F3]/50 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-[#292929] group-hover:text-[#F47732] transition-colors">
                          {u.name}
                        </span>
                        {getAccountStatusBadge(u.accountStatus)}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#737373]">
                        {u.businessName && (
                          <>
                            <span className="font-medium text-[#292929]">{u.businessName}</span>
                            <span>•</span>
                          </>
                        )}
                        <span className="font-mono">{u.phone}</span>
                        {u.email && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[140px] sm:max-w-[200px]">{u.email}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{formatDate(u.createdAt)}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {u.accountStatus?.toLowerCase() === 'pending' ? (
                        <Link
                          to="/admin/pending-retailers"
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-[#F0E0D5] bg-[#FFF8F3] text-xs font-semibold text-[#F47732] hover:bg-[#F47732] hover:text-white transition shadow-sm"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Review</span>
                        </Link>
                      ) : (
                        <Link
                          to="/admin/customers"
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-[#F0E0D5] bg-white text-xs font-semibold text-[#292929] hover:bg-[#FFF8F3] hover:text-[#F47732] hover:border-[#F47732] shadow-sm transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View</span>
                        </Link>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
