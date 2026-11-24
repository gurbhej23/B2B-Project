import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { CustomSelect } from '../../components/ui';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ArrowRight,
  Search,
  Filter,
  ShieldCheck,
  Building2,
  Boxes,
  FileSpreadsheet,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';

interface ZohoProductItem {
  id: string;
  sku: string;
  name: string;
  categoryName?: string;
  stockOnHand: number;
  dealerPricePaise: number;
  zohoItemId?: string | null;
  zohoSyncStatus: 'synced' | 'pending' | 'failed' | 'not_synced';
  zohoLastSyncedAt?: string | null;
}

interface ZohoOverviewData {
  connectionStatus: {
    isConfigured: boolean;
    organizationId?: string;
    lastSyncTimestamp?: string;
  };
  totalProducts: number;
  syncedCount: number;
  pendingCount: number;
  failedCount: number;
  notSyncedCount: number;
  products: ZohoProductItem[];
}

export const ZohoSyncScreen: React.FC = () => {
  const [data, setData] = useState<ZohoOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Actions state
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOverview = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const res = await apiClient.get('/products/zoho/status');
      if (res.data?.data) {
        setData(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load Zoho sync status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleSyncSingleProduct = async (productId: string, sku: string) => {
    setSyncingId(productId);
    setActionMessage(null);

    try {
      const res = await apiClient.post(`/products/zoho/sync/${productId}`);
      const msg = res.data?.message || `Product ${sku} sync initiated`;
      setActionMessage({ type: 'success', text: msg });
      fetchOverview();
    } catch (err: any) {
      console.error('Single sync failed:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || `Failed to sync ${sku} to Zoho`,
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    if (!window.confirm('Do you want to initiate a full sync of all active wholesale products to Zoho Inventory?')) {
      return;
    }

    setIsBulkSyncing(true);
    setActionMessage(null);

    try {
      const res = await apiClient.post('/products/zoho/sync-all');
      setActionMessage({
        type: 'success',
        text: res.data?.message || 'Full catalogue sync to Zoho Inventory completed successfully',
      });
      fetchOverview();
    } catch (err: any) {
      console.error('Bulk sync failed:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Full sync failed to complete',
      });
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const filteredProducts = (data?.products || []).filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.zohoItemId && p.zohoItemId.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || p.zohoSyncStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#F0E0D5]">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#F47732] uppercase tracking-wider mb-1">
            <Link to="/admin/products" className="hover:underline">
              Products
            </Link>
            <span>/</span>
            <span>Integrations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#292929] tracking-tight">
            Zoho Inventory & Books Sync
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            Keep product catalogs, real-time stock levels, and tax master data synchronized with Zoho Inventory.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchOverview}
            disabled={isLoading}
            className="p-2 text-[#737373] bg-white hover:bg-[#FFF8F3] hover:text-[#F47732] border border-[#F0E0D5] rounded-xl shadow-sm transition-all disabled:opacity-50"
            title="Refresh Sync Status"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#F47732]' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={isBulkSyncing || isLoading}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#F47732] hover:bg-[#E95B2A] rounded-xl shadow-sm shadow-[#F47732]/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isBulkSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Syncing Catalogue...
              </>
            ) : (
              <>
                <Cloud className="h-4 w-4" />
                Sync All to Zoho
              </>
            )}
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-start gap-3 ${actionMessage.type === 'success'
            ? 'bg-[#FFF1E8] border-[#F0E0D5] text-[#E95B2A]'
            : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-[#F47732] flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-bold">{actionMessage.type === 'success' ? 'Sync Process Complete' : 'Sync Issue'}</p>
            <p className="mt-0.5 text-xs">{actionMessage.text}</p>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4 !mt-3">
        {/* Zoho Connection Status */}
        <div className="bg-white border border-[#F0E0D5] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#737373] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Connection</span>
            <Cloud className="h-4 w-4 text-[#F47732]" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${data?.connectionStatus?.isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
            />
            <span className="text-base font-black text-[#292929]">
              {data?.connectionStatus?.isConfigured ? 'Connected' : 'Sandbox Ready'}
            </span>
          </div>
          <span className="text-[11px] text-[#737373] mt-1 block truncate">
            {data?.connectionStatus?.organizationId ? `Org: ${data.connectionStatus.organizationId}` : 'Necessity India Master'}
          </span>
        </div>

        {/* Synced Count */}
        <div
          onClick={() => setStatusFilter('synced')}
          className="bg-white border border-[#F0E0D5] rounded-2xl p-4 shadow-sm cursor-pointer hover:border-[#F47732] transition-colors"
        >
          <div className="flex items-center justify-between text-[#737373] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Synced</span>
            <CheckCircle2 className="h-4 w-4 text-[#F47732]" />
          </div>
          <div className="text-2xl font-black text-[#E95B2A] font-mono">
            {isLoading ? '...' : data?.syncedCount || 0}
          </div>
          <span className="text-[11px] text-[#737373] mt-0.5 block">Mapped to Zoho Item IDs</span>
        </div>

        {/* Pending Sync Count */}
        <div
          onClick={() => setStatusFilter('pending')}
          className="bg-white border border-[#F0E0D5] rounded-2xl p-4 shadow-sm cursor-pointer hover:border-amber-300 transition-colors"
        >
          <div className="flex items-center justify-between text-[#737373] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending</span>
            <RefreshCw className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {isLoading ? '...' : data?.pendingCount || 0}
          </div>
          <span className="text-[11px] text-[#737373] mt-0.5 block">Queued for next cycle</span>
        </div>

        {/* Failed Count */}
        <div
          onClick={() => setStatusFilter('failed')}
          className="bg-white border border-[#F0E0D5] rounded-2xl p-4 shadow-sm cursor-pointer hover:border-rose-300 transition-colors"
        >
          <div className="flex items-center justify-between text-[#737373] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Failed</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">
            {isLoading ? '...' : data?.failedCount || 0}
          </div>
          <span className="text-[11px] text-[#737373] mt-0.5 block">Requires attention</span>
        </div>

        {/* Not Synced Count */}
        <div
          onClick={() => setStatusFilter('not_synced')}
          className="bg-white border border-[#F0E0D5] rounded-2xl p-4 shadow-sm cursor-pointer hover:border-[#F47732] transition-colors col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between text-[#737373] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Unmapped</span>
            <Boxes className="h-4 w-4 text-[#737373]" />
          </div>
          <div className="text-2xl font-black text-[#292929] font-mono">
            {isLoading ? '...' : data?.notSyncedCount || 0}
          </div>
          <span className="text-[11px] text-[#737373] mt-0.5 block">New local items</span>
        </div>
      </div>

      {/* Integration Guide Banner */}
      <div className="bg-white border border-[#F0E0D5] rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 !my-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#E95B2A] bg-[#FFF1E8] px-2 py-0.5 rounded border border-[#F0E0D5]">
              Two-Way Architecture
            </span>
          </div>
          <h3 className="text-base font-bold text-[#292929]">Automatic Zoho Books & Inventory Invoicing Pipeline</h3>
          <p className="text-xs text-[#737373] max-w-3xl leading-relaxed">
            Wholesale orders placed on the B2B mobile portal automatically trigger sales order and tax invoice generation in Zoho Books. Stock on hand is balanced with Zoho Inventory Item Masters using standardized SKU identifiers.
          </p>
        </div>
        <Link
          to="/admin/invoices"
          className="px-4 py-2 bg-white hover:bg-[#FFF8F3] hover:text-[#F47732] border border-[#F0E0D5] rounded-xl text-xs font-bold text-[#292929] flex items-center gap-1.5 whitespace-nowrap self-start md:self-auto transition-colors shadow-sm"
        >
          View Invoice Zoho Sync
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Products Mapping Table */}
      <div className="space-y-4">
        {/* Filter Bar */}
        <div className="bg-white border border-[#F0E0D5] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#737373]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by SKU, name, or Zoho Item ID..."
              className="w-full pl-9 pr-4 py-2 border border-[#F0E0D5] rounded-xl text-xs sm:text-sm bg-white text-[#292929] focus:outline-none focus:border-[#F47732] focus:ring-1 focus:ring-[#F47732]"
            />
          </div>

          <div className="w-full sm:w-60">
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              icon={<Filter className="h-4 w-4" />}
              options={[
                { value: 'all', label: 'All Sync Statuses' },
                { value: 'synced', label: 'Synced to Zoho' },
                { value: 'pending', label: 'Pending' },
                { value: 'failed', label: 'Failed' },
                { value: 'not_synced', label: 'Not Synced / Unmapped' },
              ]}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#F0E0D5] rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-[#737373] flex flex-col items-center justify-center gap-2 text-sm">
              <RefreshCw className="h-6 w-6 animate-spin text-[#F47732]" />
              Loading Zoho Item mappings...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-[#737373]">
              <Cloud className="h-10 w-10 text-[#F0E0D5] mx-auto mb-2" />
              <p className="font-semibold text-[#292929]">No items match criteria</p>
              <p className="text-xs text-[#737373] mt-1">Try resetting the filter to see all items.</p>
            </div>
          ) : (
            <div className="overflow-x-auto touch-scroll">
              <table className="min-w-[750px] w-full divide-y divide-[#F0E0D5] text-center text-xs sm:text-sm">
                <thead className="bg-[#FFF8F3] text-[#292929] font-bold uppercase tracking-wider text-[11px] border-b border-[#F0E0D5]">
                  <tr>
                    <th className="py-3 px-4 text-center">Local Product & SKU</th>
                    <th className="py-3 px-4 text-center">Zoho Item ID</th>
                    <th className="py-3 px-4 text-center">Stock</th>
                    <th className="py-3 px-4 text-center">Dealer Price (₹)</th>
                    <th className="py-3 px-4 text-center">Sync Status</th>
                    <th className="py-3 px-4 text-center">Last Synced</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E0D5]/60 bg-white">
                  {filteredProducts.map((p) => {
                    const isSynced = p.zohoSyncStatus === 'synced';
                    const isPending = p.zohoSyncStatus === 'pending';
                    const isFailed = p.zohoSyncStatus === 'failed';

                    return (
                      <tr key={p.id} className="hover:bg-[#FFF8F3]/50 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <div className="font-bold text-[#292929]">{p.name}</div>
                          <span className="font-mono text-xs font-semibold text-[#737373]">{p.sku}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.zohoItemId ? (
                            <span className="font-mono text-xs bg-[#FFF8F3] px-2 py-0.5 rounded text-[#292929] font-semibold border border-[#F0E0D5]">
                              {p.zohoItemId}
                            </span>
                          ) : (
                            <span className="text-[#737373] text-xs italic">Unmapped</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-[#292929]">
                          {p.stockOnHand}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-[#E95B2A]">
                          ₹{(p.dealerPricePaise / 100).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isSynced ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF1E8] text-[#E95B2A] border border-[#F0E0D5]">
                              Synced
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Pending
                            </span>
                          ) : isFailed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              Not Synced
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#737373] whitespace-nowrap text-center">
                          {p.zohoLastSyncedAt ? new Date(p.zohoLastSyncedAt).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            disabled={syncingId === p.id}
                            onClick={() => handleSyncSingleProduct(p.id, p.sku)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#E95B2A] bg-[#FFF1E8] hover:bg-[#F47732] hover:text-white border border-[#F0E0D5] rounded-lg transition-colors inline-flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            {syncingId === p.id ? (
                              <>
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <Cloud className="h-3 w-3" />
                                Push to Zoho
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
