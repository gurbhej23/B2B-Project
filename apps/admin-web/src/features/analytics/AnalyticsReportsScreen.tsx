import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  TrendingUp,
  FileText,
  CreditCard,
  Download,
  Calendar,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Package,
  Users,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatPaiseToINR } from '@necessity/shared';

export const AnalyticsReportsScreen: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date Filter Preset
  const [datePreset, setDatePreset] = useState<'today' | '7d' | '30d' | 'month' | 'all'>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const calculateDateRange = (preset: string) => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date = now;

    if (preset === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (preset === '7d') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (preset === '30d') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (preset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else if (preset === 'custom' && customStart) {
      start = new Date(customStart);
      if (customEnd) {
        const e = new Date(customEnd);
        e.setHours(23, 59, 59, 999);
        end = e;
      }
    }

    return {
      startDate: start ? start.toISOString() : undefined,
      endDate: end.toISOString(),
    };
  };

  const fetchAnalytics = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const dates = calculateDateRange(datePreset);
      const params: any = {};
      if (dates.startDate) params.startDate = dates.startDate;
      if (dates.endDate) params.endDate = dates.endDate;

      const res = await api.get('/analytics/overview', { params });
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
      } else {
        throw new Error(res.data?.message || 'Failed to load analytics');
      }
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError(err.response?.data?.message || err.message || 'Unable to retrieve analytics data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [datePreset]);

  const handleExportCsv = async (type: 'sales' | 'customers' | 'invoices' | 'payments') => {
    setIsExporting(type);
    try {
      const dates = calculateDateRange(datePreset);
      const params: any = { type };
      if (dates.startDate) params.startDate = dates.startDate;
      if (dates.endDate) params.endDate = dates.endDate;

      const res = await api.get('/analytics/export', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Necessity-India-${type}-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Error downloading CSV'}`);
    } finally {
      setIsExporting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-[#F0E0D5]">
          <div className="space-y-2">
            <div className="h-6 w-64 bg-slate-100 animate-pulse rounded"></div>
            <div className="h-4 w-96 bg-slate-100 animate-pulse rounded"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-[#F0E0D5] animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const fin = data?.financialSummary || {};
  const orders = data?.orderStats || {};
  const gateway = data?.paymentGatewayStats || {};
  const timeline = (data?.salesTimeline || []).map((t: any) => ({
    date: new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    orders: t.orderCount,
    sales: t.orderValuePaise / 100,
  }));

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="hidden lg:block">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Reports & Business Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Authoritative revenue auditing, tax invoice reconciliation, and fulfillment pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Preset Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center bg-slate-50 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full touch-scroll">
            {[
              { id: 'today', label: 'Today' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${datePreset === p.id
                  ? 'bg-[#F47732] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchAnalytics(true)}
            disabled={isRefreshing}
            className="inline-flex items-center px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center text-red-700 text-sm">
          <AlertTriangle className="h-5 w-5 mr-2 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Distinct Financial Summary Cards (Distinguishing Invoiced Sales vs Orders vs Cash vs Receivables) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Invoiced Sales */}
        <div className="bg-white rounded-2xl border border-[#F0E0D5] p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Invoiced Sales</span>
            <div className="h-9 w-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#F47732]">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPaiseToINR(fin.invoicedSalesPaise || 0)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Recognized gross revenue on issued GST invoices</p>
        </div>

        {/* Gross Order Bookings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Order Bookings</span>
            <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPaiseToINR(fin.grossOrderValuePaise || 0)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{orders.totalOrdersCount || 0} wholesale orders (excl. cancelled)</p>
        </div>

        {/* Collected Payments */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cash Collected</span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-700 tracking-tight">
              {formatPaiseToINR(fin.collectedPaymentsPaise || 0)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Verified cash, NEFT, and gateway settlements</p>
        </div>

        {/* Outstanding Receivables & Overdue */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Receivables</span>
            <div className="h-9 w-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPaiseToINR(fin.outstandingReceivablesPaise || 0)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-rose-600 font-semibold mt-1">
            <span>Overdue: {formatPaiseToINR(fin.overdueInvoiceAmountPaise || 0)}</span>
            <span>({fin.overdueInvoicesCount || 0} inv)</span>
          </div>
        </div>
      </div>

      {/* Operational Pipeline & Payment Gateway Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Fulfillment Status Pipeline */}
        <div className="bg-white rounded-2xl border border-[#F0E0D5] p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Order Fulfillment Pipeline</h2>
              <p className="text-xs text-slate-500">Live operational status across all active trade orders</p>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
              {orders.totalOrdersCount || 0} Total Orders
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <span className="text-[11px] font-bold text-amber-700">SUBMITTED (Pending)</span>
              <div className="text-xl font-black text-amber-900 mt-1">{orders.breakdown?.SUBMITTED?.count || 0}</div>
              <span className="text-[10px] text-amber-700/80 font-mono">{formatPaiseToINR(orders.breakdown?.SUBMITTED?.totalValuePaise || 0)}</span>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-[11px] font-bold text-blue-700">APPROVED</span>
              <div className="text-xl font-black text-blue-900 mt-1">{orders.breakdown?.APPROVED?.count || 0}</div>
              <span className="text-[10px] text-blue-700/80 font-mono">{formatPaiseToINR(orders.breakdown?.APPROVED?.totalValuePaise || 0)}</span>
            </div>

            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
              <span className="text-[11px] font-bold text-purple-700">DISPATCHED</span>
              <div className="text-xl font-black text-purple-900 mt-1">{orders.breakdown?.DISPATCHED?.count || 0}</div>
              <span className="text-[10px] text-purple-700/80 font-mono">{formatPaiseToINR(orders.breakdown?.DISPATCHED?.totalValuePaise || 0)}</span>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-700">DELIVERED</span>
              <div className="text-xl font-black text-emerald-900 mt-1">{orders.breakdown?.DELIVERED?.count || 0}</div>
              <span className="text-[10px] text-emerald-700/80 font-mono">{formatPaiseToINR(orders.breakdown?.DELIVERED?.totalValuePaise || 0)}</span>
            </div>
          </div>
        </div>

        {/* Payment Gateway Health */}
        <div className="bg-white rounded-2xl border border-[#F0E0D5] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Gateway Settlements</h2>
              <p className="text-xs text-slate-500">Razorpay & Bank Transfer performance</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {gateway.paymentSuccessRate || 100}% Success Rate
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Successful Transactions:</span>
              <span className="font-bold text-emerald-700">{gateway.successfulPaymentsCount || 0}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Pending Verifications:</span>
              <span className="font-bold text-amber-600">{gateway.pendingPaymentsCount || 0}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Failed / Abandoned:</span>
              <span className="font-bold text-rose-600">{gateway.failedPaymentsCount || 0}</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-900 font-bold">Total Attempts:</span>
              <span className="font-bold text-slate-900">{gateway.totalTransactionsCount || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Timeline Chart */}
      <div className="bg-white rounded-2xl border border-[#F0E0D5] p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Sales Trend (₹ INR)</h2>
            <p className="text-xs text-slate-500">Daily gross commercial order bookings across the selected date range</p>
          </div>
        </div>

        {timeline.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
            <Calendar className="h-8 w-8 mb-2 stroke-1" />
            <p className="text-sm">No sales order bookings recorded in this timeframe.</p>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F47732" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F47732" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Gross Orders']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#F0E0D5',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="#F47732" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Products & Top Customers Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white rounded-2xl border border-[#F0E0D5] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Top-Selling Products</h2>
              <p className="text-xs text-slate-500">Highest gross revenue wholesale products</p>
            </div>
            <Package className="h-4 w-4 text-[#F47732]" />
          </div>

          <div className="divide-y divide-slate-100">
            {(data?.topSellingProducts || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No product sales in this period</div>
            ) : (
              (data?.topSellingProducts || []).map((prod: any, idx: number) => (
                <div key={prod.productId || idx} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 text-xs font-bold text-slate-400 font-mono">#{idx + 1}</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{prod.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">SKU: {prod.sku}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900">{formatPaiseToINR(prod.revenuePaise)}</div>
                    <div className="text-[10px] text-slate-500">{prod.unitsSold} units sold</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Customers by Sales & Exposure */}
        <div className="bg-white rounded-2xl border border-[#F0E0D5] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Top Wholesale Clients</h2>
              <p className="text-xs text-slate-500">Highest gross purchasers and order volume</p>
            </div>
            <Users className="h-4 w-4 text-[#F47732]" />
          </div>

          <div className="divide-y divide-slate-100">
            {(data?.topCustomers || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No customer orders in this period</div>
            ) : (
              (data?.topCustomers || []).map((cust: any, idx: number) => (
                <div key={cust.retailerId || idx} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 text-xs font-bold text-slate-400 font-mono">#{idx + 1}</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{cust.businessName}</div>
                      <div className="text-[10px] text-slate-500">{cust.contactPerson} • {cust.phone}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-[#F47732]">{formatPaiseToINR(cust.totalSpentPaise)}</div>
                    <div className="text-[10px] text-slate-500">
                      Balance: {formatPaiseToINR(cust.outstandingReceivablesPaise)}
                    </div>
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

