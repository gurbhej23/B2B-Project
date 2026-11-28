import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { IProduct, formatPaiseToINR } from '@necessity/shared';
import { CustomSelect } from '../../components/ui';
import {
  Search,
  Filter,
  Plus,
  Package,
  Layers,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  Edit,
  Copy,
  Upload,
  Download,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Tag,
  Boxes,
  Trash2,
  Image as ImageIcon,
  Film,
  Play,
  Video,
} from 'lucide-react';

export const AdminProductsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Search and Filter states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'dealerPricePaise' | 'stockOnHand' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Selection states for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [detailProduct, setDetailProduct] = useState<IProduct | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<IProduct | null>(null);
  const [newDuplicateSku, setNewDuplicateSku] = useState('');
  const [newDuplicateName, setNewDuplicateName] = useState('');
  const [adjustingProduct, setAdjustingProduct] = useState<IProduct | null>(null);
  const [quantityDelta, setQuantityDelta] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Inventory count correction');
  const [productToDelete, setProductToDelete] = useState<IProduct | null>(null);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await apiClient.get('/products/categories');
      return res.data.data;
    },
  });

  // Fetch brands
  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await apiClient.get('/products/brands');
      return res.data.data;
    },
  });

  // Fetch products with full criteria
  const { data: productsData, isLoading, refetch } = useQuery({
    queryKey: [
      'admin-products',
      search,
      selectedCategory,
      selectedBrand,
      statusFilter,
      stockFilter,
      sortBy,
      sortOrder,
      page,
      limit,
    ],
    queryFn: async () => {
      const params: any = {
        page,
        limit,
        sortBy,
        sortOrder,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedCategory) params.categoryId = selectedCategory;
      if (selectedBrand !== 'all') params.brand = selectedBrand;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (stockFilter !== 'all') params.stockFilter = stockFilter;

      const res = await apiClient.get('/products', { params });
      return res.data;
    },
  });

  const products: IProduct[] = productsData?.data || [];
  const pagination = productsData?.pagination || { total: 0, totalPages: 1 };

  // Status toggle mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiClient.patch(`/products/${id}/status`, { isActive });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setActionNotice({
        type: 'success',
        message: `Product ${vars.isActive ? 'activated' : 'deactivated'} successfully.`,
      });
      setTimeout(() => setActionNotice(null), 4000);
    },
    onError: (err: any) => {
      setActionNotice({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to update product status',
      });
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async ({ id, sku, name }: { id: string; sku: string; name: string }) => {
      return apiClient.post(`/products/${id}/duplicate`, { newSku: sku, newName: name });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setDuplicateSource(null);
      setNewDuplicateSku('');
      setNewDuplicateName('');
      setActionNotice({
        type: 'success',
        message: `Product cloned with new SKU '${res.data.data.sku}'.`,
      });
      setTimeout(() => setActionNotice(null), 4000);
    },
    onError: (err: any) => {
      setActionNotice({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to duplicate product',
      });
    },
  });

  // Stock adjustment mutation
  const adjustStockMutation = useMutation({
    mutationFn: async ({
      productId,
      delta,
      reasonText,
    }: {
      productId: string;
      delta: number;
      reasonText: string;
    }) => {
      return apiClient.patch(`/products/${productId}/stock`, {
        quantityDelta: delta,
        reason: reasonText,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-overview'] });
      setAdjustingProduct(null);
      setQuantityDelta(0);
      setActionNotice({
        type: 'success',
        message: 'Inventory stock level adjusted and logged to audit trail.',
      });
      setTimeout(() => setActionNotice(null), 4000);
    },
    onError: (err: any) => {
      setActionNotice({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to adjust inventory stock',
      });
    },
  });

  // Bulk status mutation
  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, ids }: { action: 'activate' | 'deactivate' | 'delete'; ids: string[] }) => {
      return apiClient.post('/products/bulk-status', { productIds: ids, action });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setSelectedIds([]);
      setActionNotice({
        type: 'success',
        message: res.data.message || 'Bulk operation completed successfully.',
      });
      setTimeout(() => setActionNotice(null), 4000);
    },
    onError: (err: any) => {
      setActionNotice({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to complete bulk action',
      });
    },
  });

  // Single delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/products/${id}`);
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-overview'] });
      setProductToDelete(null);
      setDetailProduct(null);
      setActionNotice({
        type: 'success',
        message: res.message || 'Product successfully deleted or archived.',
      });
      setTimeout(() => setActionNotice(null), 5000);
    },
    onError: (err: any) => {
      setActionNotice({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to delete product',
      });
    },
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(products.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenDuplicate = (product: IProduct) => {
    setDuplicateSource(product);
    setNewDuplicateSku(`${product.sku}-COPY`);
    setNewDuplicateName(`${product.name} (Copy)`);
  };

  const handleConfirmDuplicate = () => {
    if (!duplicateSource || !newDuplicateSku.trim()) return;
    duplicateMutation.mutate({
      id: duplicateSource.id,
      sku: newDuplicateSku.trim(),
      name: newDuplicateName.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#F0E0D5]">
        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-2xl font-bold tracking-tight text-[#292929] flex items-center gap-3">
            <Package className="h-6 w-6 text-[#F47732]" />
            Products & Stock Catalogue
          </h1>
          <p className="text-sm text-[#292929]">
            Manage products, monitor stock levels, and keep your product catalogue organized in one place.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/admin/products/import"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-[#292929] bg-white hover:bg-[#FFF8F3] border border-[#F0E0D5] rounded-lg shadow-xs transition-all"
          >
            <Upload className="h-3.5 w-3.5 text-[#737373]" />
            <span>Import CSV</span>
          </Link>

          <Link
            to="/admin/products/export"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-[#292929] bg-white hover:bg-[#FFF8F3] border border-[#F0E0D5] rounded-lg shadow-xs transition-all"
          >
            <Download className="h-3.5 w-3.5 text-[#737373]" />
            <span>Export</span>
          </Link>

          <Link
            to="/admin/products/new"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#F47732] hover:bg-[#E95B2A] rounded-lg shadow-xs transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Products</span>
          </Link>
        </div>
      </div>

      {/* Global Action Notification Banner */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium flex items-center justify-between shadow-sm transition-all ${actionNotice.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 rounded text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Search Bar, Filter & Refresh */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 lg:flex lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#737373]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by SKU, Product Name, Barcode, or Brand..."
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

        <div className="flex items-center gap-2.5 ">

          {/* Status Filter */}
          <div className="w-36 sm:w-40">
            <CustomSelect
              id="product-status-filter"
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val as any);
                setPage(1);
              }}
              icon={<Filter className="h-3.5 w-3.5" />}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'active', label: 'Active Only' },
                { value: 'inactive', label: 'Inactive Only' },
              ]}
              title="Filter by status"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#292929] hover:text-[#F47732] bg-white hover:bg-[#FFF8F3] border border-[#F0E0D5] hover:border-[#F47732] rounded-lg shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#F47732] disabled:opacity-50 flex-shrink-0"
            title="Refresh catalogue"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#F47732]' : 'text-[#737373]'}`} />
          </button>
        </div>
      </div>

      {/* Secondary Filter Row: Brand, Stock, Sort */}
      <div className="text-xs pt-1 lg:justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Category Filter */}
          <div className="w-70 sm:w-74">
            <CustomSelect
              id="product-category-filter"
              value={selectedCategory}
              onChange={(val) => {
                setSelectedCategory(val);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((c: any) => ({
                  value: c._id || c.id,
                  label: c.name,
                })),
              ]}
              size="sm"
            />
          </div>
          {/* Brand */}
          <div className="w-70 sm:w-74">
            <CustomSelect
              value={selectedBrand}
              onChange={(val) => {
                setSelectedBrand(val);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Brands' },
                ...Array.from(new Set<string>(brands.map((b: any) => (b.name as string)?.trim()).filter(Boolean))).map((name: string) => ({
                  value: name,
                  label: name,
                })),
              ]}
              size="sm"
            />
          </div>

          {/* Stock Filter */}
          <div className="w-70 sm:w-74">
            <CustomSelect
              value={stockFilter}
              onChange={(val) => {
                setStockFilter(val as any);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Inventory' },
                { value: 'in_stock', label: 'In Stock (> 0)' },
                { value: 'low_stock', label: 'Low Stock (≤ Threshold)' },
                { value: 'out_of_stock', label: 'Out of Stock (0)' },
              ]}
              size="sm"
            />
          </div>

          {/* Sort By */}
          <div className="w-70 sm:w-74">
            <div className="flex-1">
              <CustomSelect
                value={sortBy}
                onChange={(val) => setSortBy(val as any)}
                options={[
                  { value: 'createdAt', label: 'Date Created' },
                  { value: 'name', label: 'Product Name' },
                  { value: 'sku', label: 'SKU Code' },
                  { value: 'dealerPricePaise', label: 'Wholesale Price' },
                  { value: 'stockOnHand', label: 'Stock Level' },
                ]}
                size="sm"
              />
            </div>
            {/* <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-1.5 border border-[#F0E0D5] bg-white hover:bg-[#FFF8F3] rounded-lg text-[#737373] hover:text-[#F47732] transition-colors"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button> */}
          </div>
        </div>
      </div>

      {/* Bulk Actions Floating Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#FFF8F3] text-[#292929] p-3 rounded-xl border border-[#F0E0D5] shadow-xs flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="font-bold bg-[#F47732] text-white px-2 py-0.5 rounded-full text-[11px]">
              {selectedIds.length}
            </span>
            <span>products selected for bulk operations</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => bulkActionMutation.mutate({ action: 'activate', ids: selectedIds })}
              disabled={bulkActionMutation.isPending}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded shadow-xs transition-colors"
            >
              Activate
            </button>
            <button
              type="button"
              onClick={() => bulkActionMutation.mutate({ action: 'deactivate', ids: selectedIds })}
              disabled={bulkActionMutation.isPending}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded shadow-xs transition-colors"
            >
              Deactivate
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected products?`)) {
                  bulkActionMutation.mutate({ action: 'delete', ids: selectedIds });
                }
              }}
              disabled={bulkActionMutation.isPending}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded shadow-xs transition-colors"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 bg-white hover:bg-[#FFF8F3] text-[#737373] hover:text-[#292929] border border-[#F0E0D5] font-semibold rounded transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-[#F0E0D5] shadow-xs overflow-hidden">
        <div className="overflow-x-auto touch-scroll">
          <table className="w-full text-left border-collapse text-xs min-w-[960px] table-fixed">
            <thead>
              <tr className="bg-[#FFF8F3] border-b border-[#F0E0D5] text-[#292929] font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === products.length}
                    onChange={handleSelectAll}
                    className="rounded border-[#F0E0D5] text-[#F47732] focus:ring-[#F47732]"
                  />
                </th>
                <th className="py-3 px-4 text-center w-[25%]">Product Details</th>
                <th className="py-3 px-4 text-center w-[15%]">SKU Code</th>
                <th className="py-3 px-4 text-center w-[16%]">Category & Brand</th>
                <th className="py-3 px-4 text-center w-[14%]">Price</th>
                <th className="py-3 px-4 text-center w-[12%]">Available Stock</th>
                <th className="py-3 px-4 text-center w-[10%]">Status</th>
                <th className="w-[10%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                      <span>Loading Inventory Catalogue...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-800">No products found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting your search criteria, category filters, or add a new SKU.
                    </p>
                    <Link
                      to="/admin/products/new"
                      className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 bg-[#F47732] text-white rounded-lg font-bold text-xs hover:bg-[#E95B2A] shadow-sm transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Product
                    </Link>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const onHand = product.stockOnHand || 0;
                  const reserved = product.stockReserved || 0;
                  const available = Math.max(0, onHand - reserved);
                  const isOutOfStock = available <= 0;
                  const isLow = available > 0 && available <= (product.lowStockThreshold || 10);
                  const marginPercent =
                    product.mrpPaise > 0
                      ? Math.round(((product.mrpPaise - product.dealerPricePaise) / product.mrpPaise) * 100)
                      : 0;

                  const isChecked = selectedIds.includes(product.id);
                  const primaryImg = product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url;

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-50/80 transition-colors ${!product.isActive ? 'bg-slate-50/40 opacity-75' : ''
                        }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(product.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>

                      {/* Product Details */}
                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center text-center">
                            {primaryImg ? (
                              <img src={primaryImg} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5 text-slate-400 mx-auto" />
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-slate-900 leading-snug">{product.name}</div>
                            {/* <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              {product.barcode && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  BAR: {product.barcode}
                                </span>
                              )}
                              <span className="text-slate-400">({product.uom})</span>
                            </div> */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {product.images && product.images.length > 1 && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  {product.images.length} photos
                                </span>
                              )}
                              {(product as any).videos && (product as any).videos.length > 0 && (
                                <span className="text-[10px] bg-[#FFF1E8] text-[#F47732] px-1.5 py-0.5 rounded font-bold border border-[#F0E0D5] flex items-center gap-1">
                                  <Film className="h-2.5 w-2.5" />
                                  <span>{(product as any).videos.length} {(product as any).videos.length === 1 ? 'video' : 'videos'}</span>
                                </span>
                              )}
                              {product.hasVariants && product.variants && product.variants.length > 0 && (
                                <span className="text-[10px] bg-[#FFF1E8] text-[#E95B2A] px-1.5 py-0.5 rounded font-bold border border-[#F0E0D5]">
                                  {product.variants.length} Variants
                                </span>
                              )}
                              {product.isTierPricingEnabled && product.tierPricing && product.tierPricing.length > 0 && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                  Tier Pricing
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SKU Code */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs">
                          {product.sku}
                        </span>
                      </td>

                      {/* Category & Brand */}
                      <td className="py-3 px-4 text-center">
                        <div className="font-semibold text-slate-800">{product.categoryName || 'General'}</div>
                        <div className="text-[11px] text-slate-500">{product.brand}</div>
                      </td>

                      {/* Price & MRP */}
                      <td className="py-3 px-4 text-center">
                        <div className="font-bold text-slate-900">
                          {formatPaiseToINR(product.dealerPricePaise)}
                        </div>
                        <div className="text-[11px] text-slate-400 line-through">
                          MRP: {formatPaiseToINR(product.mrpPaise)}
                        </div>
                        {marginPercent > 0 && (
                          <div className="text-[10px] font-semibold text-emerald-600">
                            {marginPercent}% Price Difference
                          </div>
                        )}
                      </td>

                      {/* Available Stock */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${isOutOfStock
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : isLow
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                        >
                          {available} {product.uom}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {onHand} {reserved > 0 ? `(${reserved} reserved)` : ''}
                        </div>
                      </td>

                      {/* Active Status Switch */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={product.isActive}
                          disabled={toggleStatusMutation.isPending}
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              id: product.id,
                              isActive: !product.isActive,
                            })
                          }
                          className={`relative inline-block h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${product.isActive ? 'bg-emerald-600 focus:ring-emerald-500' : 'bg-slate-300 focus:ring-slate-400'
                            }`}
                          title={product.isActive ? 'Active (Click to Deactivate)' : 'Inactive (Click to Activate)'}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute top-0.5 left-0.5 inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${product.isActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailProduct(product)}
                            className="p-1 rounded text-[#737373] hover:text-[#F47732] hover:bg-[#FFF8F3] transition-colors"
                            title="View Product Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => navigate(`/admin/products/${product.id}/edit`)}
                            className="p-1 rounded text-[#737373] hover:text-[#F47732] hover:bg-[#FFF8F3] transition-colors"
                            title="Edit Product"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setProductToDelete(product)}
                            className="p-1 rounded text-[#737373] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3 bg-[#FFF8F3] border-t border-[#F0E0D5] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#737373]">
          <div className="font-medium text-[#292929]">
            Showing {(page - 1) * limit + (products.length > 0 ? 1 : 0)} to{' '}
            {Math.min(page * limit, pagination.total)} of {pagination.total} products
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-[#F0E0D5] bg-white hover:bg-[#FFF1E8] text-[#292929] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold px-2 text-[#292929]">
              Page {page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded border border-[#F0E0D5] bg-white hover:bg-[#FFF1E8] text-[#292929] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: VIEW DETAILS DRAWER */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 !m-0">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                Product Details
              </h3>
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-4">
                <div className="h-20 w-20 rounded-xl bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {detailProduct.images?.[0]?.url ? (
                    <img src={detailProduct.images[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{detailProduct.name}</h4>
                  <p className="text-slate-500 mt-1 leading-relaxed">{detailProduct.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">SKU Code</span>
                  <span className="font-mono font-bold text-slate-800">{detailProduct.sku}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Barcode</span>
                  <span className="font-mono text-slate-800">{detailProduct.barcode || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Category</span>
                  <span className="font-bold text-slate-800">{detailProduct.categoryName || 'General'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Wholesale Price</span>
                  <span className="font-bold text-emerald-700">
                    {formatPaiseToINR(detailProduct.dealerPricePaise)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">MRP</span>
                  <span className="font-bold text-slate-800">
                    {formatPaiseToINR(detailProduct.mrpPaise)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Available Stock</span>
                  <span className="font-bold text-emerald-600">
                    {detailProduct.availableStock} {detailProduct.uom}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Pack Size</span>
                  <span className="text-slate-800 font-semibold">
                    {detailProduct.packSize} {detailProduct.uom || 'units'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">MOQ</span>
                  <span className="text-slate-800 font-semibold">
                    {detailProduct.minOrderQuantity} {detailProduct.uom}
                  </span>
                </div>
              </div>

              {/* Media Showcase: Images and Videos */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-[#F47732]" />
                    <span>Product Media Showcase</span>
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{detailProduct.images?.length || 0} Photos</span>
                    <span>•</span>
                    <span className="font-bold text-[#F47732]">
                      {(detailProduct as any).videos?.length || 0} Videos
                    </span>
                  </div>
                </div>

                {/* Images Row */}
                {detailProduct.images && detailProduct.images.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Photo Gallery</span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {detailProduct.images.map((img: any, i: number) => (
                        <div
                          key={i}
                          className="h-16 w-16 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 shrink-0 relative"
                        >
                          <img src={img.url} alt="" className="h-full w-full object-cover" />
                          {img.isPrimary && (
                            <span className="absolute bottom-0 inset-x-0 bg-[#F47732] text-white text-[8px] font-bold text-center py-0.5">
                              Cover
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Videos Row & Video Player */}
                {(detailProduct as any).videos && (detailProduct as any).videos.length > 0 ? (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#F47732] flex items-center gap-1 mb-1.5">
                      <Film className="h-3 w-3" />
                      <span>Product Videos & Demonstrations ({(detailProduct as any).videos.length})</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(detailProduct as any).videos.map((vid: any, i: number) => {
                        const ytMatch = vid.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
                        const vimeoMatch = vid.url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
                        const embedUrl = ytMatch
                          ? `https://www.youtube.com/embed/${ytMatch[1]}`
                          : vimeoMatch
                            ? `https://player.vimeo.com/video/${vimeoMatch[1]}`
                            : null;

                        return (
                          <div key={i} className="border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1.5">
                            <div className="aspect-video w-full rounded bg-black overflow-hidden flex items-center justify-center">
                              {embedUrl ? (
                                <iframe
                                  src={embedUrl}
                                  title={vid.title || `Video ${i + 1}`}
                                  className="w-full h-full border-0"
                                  allowFullScreen
                                />
                              ) : (
                                <video
                                  src={vid.url}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  className="w-full h-full object-contain"
                                />
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-800 truncate" title={vid.title}>
                                {vid.title || `Video #${i + 1}`}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">#{i + 1}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-dashed border-slate-200">
                    No product demonstration videos added yet.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const prod = detailProduct;
                    setDetailProduct(null);
                    setProductToDelete(prod);
                  }}
                  className="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/admin/products/${detailProduct.id}/edit`);
                  }}
                  className="px-4 py-2 bg-[#F47732] text-white rounded-lg text-xs font-bold hover:bg-[#E95B2A] shadow-xs transition-colors"
                >
                  Edit Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DUPLICATE PRODUCT */}
      {duplicateSource && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 !m-0">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#F0E0D5] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E0D5]">
              <h3 className="font-bold text-[#292929] text-sm flex items-center gap-2">
                <Copy className="h-4 w-4 text-[#F47732]" />
                Duplicate Product
              </h3>
              <button
                type="button"
                onClick={() => setDuplicateSource(null)}
                className="text-[#737373] hover:text-[#292929]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[#737373]">
              Cloning specifications from <strong>{duplicateSource.name}</strong> ({duplicateSource.sku}).
              Please specify a unique SKU for the new product.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-[#292929] uppercase mb-1">
                  New Unique SKU Code *
                </label>
                <input
                  type="text"
                  value={newDuplicateSku}
                  onChange={(e) => setNewDuplicateSku(e.target.value.toUpperCase())}
                  className="w-full font-mono text-xs p-2 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] uppercase"
                  placeholder="e.g. TOWEL-BATH-XL-02"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#292929] uppercase mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  value={newDuplicateName}
                  onChange={(e) => setNewDuplicateName(e.target.value)}
                  className="w-full text-xs p-2 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#F0E0D5] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDuplicateSource(null)}
                className="px-4 py-2 border border-[#F0E0D5] text-[#292929] hover:bg-[#FFF8F3] rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={duplicateMutation.isPending || !newDuplicateSku.trim()}
                onClick={handleConfirmDuplicate}
                className="px-4 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
              >
                {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADJUST STOCK */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 !m-0">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#F0E0D5] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E0D5]">
              <h3 className="font-bold text-[#292929] text-sm flex items-center gap-2">
                <Boxes className="h-4 w-4 text-[#F47732]" />
                Adjust Stock for {adjustingProduct.name}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="text-[#737373] hover:text-[#292929]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 bg-[#FFF8F3] rounded-lg border border-[#F0E0D5] text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-[#737373] block font-medium">SKU</span>
                <span className="font-mono font-bold text-[#292929]">{adjustingProduct.sku}</span>
              </div>
              <div>
                <span className="text-[#737373] block font-medium">Current On-Hand</span>
                <span className="font-bold text-[#292929]">
                  {adjustingProduct.stockOnHand} {adjustingProduct.uom}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-[#292929] uppercase mb-1">
                  Quantity Delta (+ to Add, - to Deduct)
                </label>
                <input
                  type="number"
                  value={quantityDelta}
                  onChange={(e) => setQuantityDelta(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-xs p-2 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] font-bold"
                  placeholder="e.g. 50 or -10"
                />
                <p className="text-[11px] text-[#737373] mt-1">
                  New on-hand will be:{' '}
                  <strong className="text-[#292929]">
                    {adjustingProduct.stockOnHand + quantityDelta} {adjustingProduct.uom}
                  </strong>
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#292929] uppercase mb-1">
                  Adjustment Reason
                </label>
                <input
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full text-xs p-2 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                  placeholder="e.g. Consignment arrival, stock audit, damaged goods"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#F0E0D5] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="px-4 py-2 border border-[#F0E0D5] text-[#292929] hover:bg-[#FFF8F3] rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adjustStockMutation.isPending || quantityDelta === 0}
                onClick={() =>
                  adjustStockMutation.mutate({
                    productId: adjustingProduct.id,
                    delta: quantityDelta,
                    reasonText: adjustmentReason,
                  })
                }
                className="px-4 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
              >
                {adjustStockMutation.isPending ? 'Saving...' : 'Confirm Stock Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE PRODUCT CONFIRMATION */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 !m-0">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 rounded-xl text-rose-600 flex-shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete Product</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to delete <span className="font-bold text-slate-800">{productToDelete.name}</span>?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">SKU Code:</span>
                <span className="font-mono font-bold text-slate-800">{productToDelete.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Current Stock on Hand:</span>
                <span className="font-bold text-slate-800">{productToDelete.stockOnHand} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Category:</span>
                <span className="text-slate-700">{productToDelete.categoryName || 'General'}</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>ERP Safeguard:</strong> If this product is linked to existing customer orders, it will be safely deactivated and unlisted from the catalogue to preserve order audit history. If no orders exist, it will be permanently deleted.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(productToDelete.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-950/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Confirm Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
