import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { CustomSelect } from '../../components/ui';
import {
  Boxes,
  Package,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Minus,
  ArrowUpDown,
  XCircle,
  ShieldAlert,
  Edit2,
  X,
} from 'lucide-react';

interface ProductStockItem {
  id: string;
  sku: string;
  name: string;
  categoryName?: string;
  brand: string;
  mrpPaise: number;
  dealerPricePaise: number;
  stockOnHand: number;
  stockReserved: number;
  availableStock: number;
  lowStockThreshold: number;
  warehouseLocation?: string;
  uom: string;
  isActive: boolean;
  images?: Array<{ url: string; isPrimary?: boolean }>;
}

export const StockManagementScreen: React.FC = () => {
  // Inventory State
  const [products, setProducts] = useState<ProductStockItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Stock Adjustment Modal State
  const [adjustingProduct, setAdjustingProduct] = useState<ProductStockItem | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number | ''>('');
  const [adjustType, setAdjustType] = useState<'add' | 'remove' | 'set'>('add');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustWarehouse, setAdjustWarehouse] = useState('Main Central Warehouse');
  const [adjustThreshold, setAdjustThreshold] = useState<number | ''>('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Fetch Inventory Products
  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const params: Record<string, any> = {
        page,
        limit: 15,
      };
      if (search.trim()) params.search = search.trim();
      if (stockFilter !== 'all') params.stockFilter = stockFilter;

      const res = await apiClient.get('/products', { params });
      if (res.data?.data) {
        setProducts(res.data.data);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalProducts(res.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, search, stockFilter]);

  // Handle Adjustment Modal Open
  const handleOpenAdjustModal = (product: ProductStockItem) => {
    setAdjustingProduct(product);
    setAdjustDelta('');
    setAdjustType('add');
    setAdjustReason('');
    setAdjustWarehouse(product.warehouseLocation || 'Main Central Warehouse');
    setAdjustThreshold(product.lowStockThreshold !== undefined ? product.lowStockThreshold : 10);
    setAdjustError(null);
  };

  // Calculate resulting stock preview
  const calculateResultingStock = () => {
    if (!adjustingProduct) return 0;
    const current = adjustingProduct.stockOnHand;
    const deltaNum = typeof adjustDelta === 'number' ? adjustDelta : 0;

    if (adjustType === 'add') {
      return current + deltaNum;
    } else if (adjustType === 'remove') {
      return current - deltaNum;
    } else {
      return deltaNum;
    }
  };

  // Submit Adjustment
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const deltaNum = typeof adjustDelta === 'number' ? adjustDelta : 0;
    if (deltaNum <= 0 && adjustType !== 'set') {
      setAdjustError('Please enter a quantity greater than zero');
      return;
    }

    if (!adjustReason.trim()) {
      setAdjustError('Please specify an audit reason for this inventory adjustment');
      return;
    }

    let calculatedDelta = 0;
    let txType = 'MANUAL_ADJUSTMENT';

    if (adjustType === 'add') {
      calculatedDelta = deltaNum;
      txType = 'STOCK_IN';
    } else if (adjustType === 'remove') {
      calculatedDelta = -deltaNum;
      txType = 'STOCK_OUT';
    } else {
      calculatedDelta = deltaNum - adjustingProduct.stockOnHand;
      txType = calculatedDelta > 0 ? 'STOCK_IN' : 'STOCK_OUT';
    }

    const resultingStock = adjustingProduct.stockOnHand + calculatedDelta;
    if (resultingStock < 0) {
      setAdjustError(
        `Negative stock violation: Available inventory cannot drop below 0. Current on hand is ${adjustingProduct.stockOnHand}.`
      );
      return;
    }

    if (resultingStock < adjustingProduct.stockReserved) {
      setAdjustError(
        `Reserved stock conflict: Cannot set stock to ${resultingStock} because ${adjustingProduct.stockReserved} units are allocated to open customer orders.`
      );
      return;
    }

    setIsSubmittingAdjustment(true);
    setAdjustError(null);

    try {
      await apiClient.patch(`/products/${adjustingProduct.id}/stock`, {
        quantityDelta: calculatedDelta,
        reason: adjustReason.trim(),
        warehouseLocation: adjustWarehouse,
        lowStockThreshold: typeof adjustThreshold === 'number' ? adjustThreshold : undefined,
        transactionType: txType,
      });

      setAdjustingProduct(null);
      fetchProducts();
    } catch (err: any) {
      console.error('Failed to adjust stock:', err);
      setAdjustError(err.response?.data?.message || err.message || 'Failed to adjust stock');
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#F0E0D5]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#292929] tracking-tight flex items-center gap-2">
            <Boxes className="h-7 w-7 text-[#F47732]" />
            Inventory Products
          </h1>
          <p className="text-xs sm:text-sm text-[#737373] mt-1">
            Monitor real-time product inventory, SKU availability, and perform stock adjustments.
          </p>
        </div>
      </div>

      {/* Search Bar, Filter & Refresh */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#737373]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search SKU or product name..."
            className="w-full pl-10 pr-10 py-2 text-sm border border-[#F0E0D5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] transition-all shadow-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-3 top-2.5 p-1 rounded-full text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3] transition-colors"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-44 sm:w-48">
            <CustomSelect
              id="inventory-stock-filter"
              value={stockFilter}
              onChange={(val) => {
                setStockFilter(val as any);
                setPage(1);
              }}
              icon={<Filter className="h-3.5 w-3.5" />}
              options={[
                { value: 'all', label: 'All Inventory' },
                { value: 'in_stock', label: 'In Stock' },
                { value: 'low_stock', label: 'Low Stock' },
                { value: 'out_of_stock', label: 'Out of Stock' },
              ]}
              title="Filter inventory by stock level"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchProducts()}
            disabled={isLoadingProducts}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#292929] hover:text-[#F47732] bg-white hover:bg-[#FFF8F3] border border-[#F0E0D5] hover:border-[#F47732] rounded-lg shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#F47732] disabled:opacity-50 flex-shrink-0"
            title="Refresh inventory"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingProducts ? 'animate-spin text-[#F47732]' : 'text-[#737373]'}`} />
          </button>
        </div>
      </div>

      {/* Inventory Products Table */}
      <div className="bg-white border border-[#F0E0D5] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto touch-scroll">
          <table className="w-full text-left border-collapse text-xs min-w-[850px] table-fixed">
            <thead>
              <tr className="bg-[#FFF8F3] border-b border-[#F0E0D5] text-[#292929] font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 text-center w-[25%]">Products</th>
                <th className="py-3 px-4 text-center w-[16%]">SKU Code</th>
                <th className="py-3 px-4 text-center w-[18%]">Category</th>
                <th className="py-3 px-4 text-center w-[11%]">Status</th>
                <th className="py-3 px-4 text-center w-[13%]">Available</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingProducts ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#737373]">
                    <div className="flex flex-col items-center justify-center gap-2 text-sm">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#F47732]" />
                      <span>Loading inventory records...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#737373]">
                    <Boxes className="h-10 w-10 text-[#F0E0D5] mx-auto mb-2" />
                    <p className="font-semibold text-[#292929]">No stock records found</p>
                    <p className="text-xs text-[#737373] mt-1">Try relaxing your search query or filter.</p>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const onHand = p.stockOnHand || 0;
                  const reserved = p.stockReserved || 0;
                  const available = p.availableStock !== undefined ? p.availableStock : Math.max(0, onHand - reserved);
                  const isOutOfStock = available <= 0;
                  const isLowStock = !isOutOfStock && available <= (p.lowStockThreshold || 10);
                  const primaryImg = p.images?.find((img) => img.isPrimary)?.url || p.images?.[0]?.url;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Products */}
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center text-center">
                            {primaryImg ? (
                              <img src={primaryImg} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5 text-slate-400 mx-auto" />
                            )}
                          </div>
                          <div className="text-left min-w-0">
                            <div className="font-bold text-slate-900 leading-snug">{p.name}</div>
                            {/* <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span>{p.brand}</span>
                              {p.uom && <span>• {p.uom}</span>}
                            </div> */}
                          </div>
                        </div>
                      </td>

                      {/* SKU Code */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs">
                          {p.sku}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-center text-xs text-slate-700 font-medium whitespace-nowrap">
                        {p.categoryName || 'General'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Available */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`font-mono font-bold text-sm ${isOutOfStock
                            ? 'text-rose-600'
                            : isLowStock
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                            }`}
                        >
                          {available} {p.uom}
                        </span>
                        {reserved > 0 && (
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            ({reserved} reserved)
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 pr-6 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjustModal(p)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#E95B2A] bg-[#FFF1E8] hover:bg-[#F47732] hover:text-white border border-[#F0E0D5] rounded-lg transition-colors inline-flex items-center gap-1 shadow-xs"
                            title="Adjust Stock Quantity & Warehouse"
                          >
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                          <Link
                            to={`/admin/products/${p.id}/edit`}
                            className="p-1 rounded text-[#737373] hover:text-[#F47732] hover:bg-[#FFF8F3] border border-[#F0E0D5] transition-colors"
                            title="Edit Product Details"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="py-3 px-4 border-t border-[#F0E0D5] bg-[#FFF8F3] flex items-center justify-between text-xs text-[#737373]">
            <div className="font-medium text-[#292929]">
              Showing {(page - 1) * 15 + (products.length > 0 ? 1 : 0)} to{' '}
              {Math.min(page * 15, totalProducts)} of {totalProducts} products
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded border border-[#F0E0D5] bg-white hover:bg-[#FFF1E8] text-[#292929] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="font-semibold px-2 text-[#292929]">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded border border-[#F0E0D5] bg-white hover:bg-[#FFF1E8] text-[#292929] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center !m-0">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#F0E0D5] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#FFF8F3] border-b border-[#F0E0D5] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#F47732]">
                    Stock Adjustment
                  </span>
                  <h3 className="text-lg font-bold text-[#292929] mt-0.5">{adjustingProduct.name}</h3>
                  <div className="text-xs text-[#737373] font-mono mt-0.5">
                    SKU: {adjustingProduct.sku} • Warehouse: {adjustingProduct.warehouseLocation || 'Main Central Warehouse'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="p-1 rounded-lg text-[#737373] hover:text-[#292929] hover:bg-[#FFF1E8] transition-colors"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Current Snapshot */}
            <div className="grid grid-cols-3 gap-2 bg-white p-4 border-b border-[#F0E0D5] text-center text-xs">
              <div>
                <span className="text-[#737373] font-medium">Current On-Hand</span>
                <p className="text-base font-black text-[#292929] font-mono mt-0.5">
                  {adjustingProduct.stockOnHand}
                </p>
              </div>
              <div>
                <span className="text-[#737373] font-medium">Reserved</span>
                <p className="text-base font-black text-amber-600 font-mono mt-0.5">
                  {adjustingProduct.stockReserved}
                </p>
              </div>
              <div>
                <span className="text-[#737373] font-medium">Available</span>
                <p className="text-base font-black text-emerald-600 font-mono mt-0.5">
                  {adjustingProduct.availableStock}
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveAdjustment} className="p-5 space-y-4">
              {adjustError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
                  <p>{adjustError}</p>
                </div>
              )}

              {/* Adjustment Mode Selection */}
              <div>
                <label className="block text-xs font-bold text-[#292929] uppercase tracking-wider mb-2">
                  Adjustment Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('add')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${adjustType === 'add'
                      ? 'bg-[#FFF1E8] border-[#F47732] text-[#E95B2A] shadow-xs'
                      : 'bg-white border-[#F0E0D5] text-[#737373] hover:bg-[#FFF8F3]'
                      }`}
                  >
                    <Plus className="h-3.5 w-3.5 text-[#F47732]" />
                    Stock In (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('remove')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${adjustType === 'remove'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-xs'
                      : 'bg-white border-[#F0E0D5] text-[#737373] hover:bg-[#FFF8F3]'
                      }`}
                  >
                    <Minus className="h-3.5 w-3.5 text-rose-600" />
                    Stock Out (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('set')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${adjustType === 'set'
                      ? 'bg-[#FFF8F3] border-[#F47732] text-[#292929] shadow-xs'
                      : 'bg-white border-[#F0E0D5] text-[#737373] hover:bg-[#FFF8F3]'
                      }`}
                  >
                    <ArrowUpDown className="h-3.5 w-3.5 text-[#F47732]" />
                    Exact Count
                  </button>
                </div>
              </div>

              {/* Quantity Input & Result Preview */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-bold text-[#292929] uppercase tracking-wider mb-1.5">
                    {adjustType === 'add'
                      ? 'Add Units (+)'
                      : adjustType === 'remove'
                        ? 'Remove Units (-)'
                        : 'New Exact Count'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={adjustDelta}
                    onChange={(e) =>
                      setAdjustDelta(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))
                    }
                    placeholder="Enter quantity"
                    required
                    className="w-full px-3 py-2 border border-[#F0E0D5] rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
                  />
                </div>

                <div className="bg-[#FFF8F3] p-3 rounded-xl border border-[#F0E0D5] text-center">
                  <span className="text-[11px] text-[#737373] font-medium block">Resulting Stock</span>
                  <span
                    className={`text-lg font-black font-mono ${calculateResultingStock() < 0
                      ? 'text-rose-600'
                      : calculateResultingStock() <= (adjustingProduct.lowStockThreshold || 10)
                        ? 'text-amber-600'
                        : 'text-emerald-700'
                      }`}
                  >
                    {calculateResultingStock()} units
                  </span>
                </div>
              </div>

              {/* Warehouse Location & Low Stock Alert Threshold */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#292929] uppercase tracking-wider mb-1.5">
                    Warehouse Location
                  </label>
                  <input
                    type="text"
                    value={adjustWarehouse}
                    onChange={(e) => setAdjustWarehouse(e.target.value)}
                    placeholder="e.g. Main Central Warehouse"
                    className="w-full px-3 py-2 border border-[#F0E0D5] rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#292929] uppercase tracking-wider mb-1.5">
                    Low Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={adjustThreshold}
                    onChange={(e) =>
                      setAdjustThreshold(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))
                    }
                    placeholder="Alert when units ≤"
                    className="w-full px-3 py-2 border border-[#F0E0D5] rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
                  />
                </div>
              </div>

              {/* Reason (Mandatory for audit trail) */}
              <div>
                <label className="block text-xs font-bold text-[#292929] uppercase tracking-wider mb-1.5">
                  Audit Reason / Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Purchase order shipment received; damaged unit write-off; cycle count reconciliation..."
                  required
                  className="w-full px-3 py-2 border border-[#F0E0D5] rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0E0D5]">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 border border-[#F0E0D5] text-[#292929] hover:bg-[#FFF8F3] rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjustment}
                  className="px-5 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingAdjustment ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    'Record Adjustment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
