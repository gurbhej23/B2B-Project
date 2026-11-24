import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { CustomSelect } from '../../components/ui';
import {
  Download,
  FileSpreadsheet,
  Filter,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  Search,
  Layers,
  Tag,
  AlertCircle,
  Eye,
} from 'lucide-react';

interface CategoryOption {
  _id: string;
  name: string;
}

interface BrandOption {
  _id: string;
  name: string;
}

interface PreviewItem {
  id: string;
  sku: string;
  name: string;
  categoryName?: string;
  brand: string;
  mrpPaise: number;
  dealerPricePaise: number;
  stockOnHand: number;
  availableStock: number;
  isActive: boolean;
}

export const ExportProductsScreen: React.FC = () => {
  // Filter States
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Metadata
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [matchingCount, setMatchingCount] = useState<number>(0);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Column selection state
  const availableColumns = [
    { id: 'sku', label: 'SKU / Product Code', default: true },
    { id: 'name', label: 'Product Name', default: true },
    { id: 'category', label: 'Category', default: true },
    { id: 'brand', label: 'Brand', default: true },
    { id: 'mrp', label: 'MRP (INR)', default: true },
    { id: 'dealerPrice', label: 'Wholesale Dealer Price (INR)', default: true },
    { id: 'gst', label: 'GST Rate (%)', default: true },
    { id: 'uom', label: 'Unit of Measure (UOM)', default: true },
    { id: 'packSize', label: 'Pack Size', default: true },
    { id: 'caseQuantity', label: 'Case Quantity', default: true },
    { id: 'stockOnHand', label: 'Stock on Hand', default: true },
    { id: 'stockReserved', label: 'Reserved Stock', default: true },
    { id: 'availableStock', label: 'Available Stock', default: true },
    { id: 'lowStockThreshold', label: 'Low Stock Threshold', default: true },
    { id: 'barcode', label: 'Barcode', default: true },
    { id: 'warehouse', label: 'Warehouse Location', default: true },
    { id: 'status', label: 'Status (Active/Inactive)', default: true },
    { id: 'zohoItemId', label: 'Zoho Inventory Item ID', default: true },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    availableColumns.map((c) => c.id)
  );

  // Load initial categories and brands
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          apiClient.get('/products/categories'),
          apiClient.get('/products/brands'),
        ]);
        if (catRes.data?.data) setCategories(catRes.data.data);
        if (brandRes.data?.data) setBrands(brandRes.data.data);
      } catch (err) {
        console.error('Failed to load metadata for export:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch count & preview whenever filters change
  useEffect(() => {
    const fetchPreview = async () => {
      setIsLoadingPreview(true);
      setExportError(null);
      try {
        const params: Record<string, any> = {
          page: 1,
          limit: 5,
        };
        if (search.trim()) params.search = search.trim();
        if (categoryId) params.categoryId = categoryId;
        if (brand) params.brand = brand;
        if (status !== 'all') params.status = status;
        if (stockFilter !== 'all') params.stockFilter = stockFilter;

        const res = await apiClient.get('/products', { params });
        if (res.data?.data) {
          setPreviewItems(res.data.data);
          setMatchingCount(res.data.pagination?.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch export preview:', err);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    const timer = setTimeout(fetchPreview, 250);
    return () => clearTimeout(timer);
  }, [search, categoryId, brand, status, stockFilter]);

  const toggleColumn = (colId: string) => {
    setSelectedColumns((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(availableColumns.map((c) => c.id));
  };

  const deselectAllColumns = () => {
    setSelectedColumns(['sku', 'name', 'dealerPrice']);
  };

  // Trigger file download
  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      const params: Record<string, any> = {};
      if (search.trim()) params.search = search.trim();
      if (categoryId) params.categoryId = categoryId;
      if (brand) params.brand = brand;
      if (status !== 'all') params.status = status;
      if (stockFilter !== 'all') params.stockFilter = stockFilter;

      const response = await apiClient.get('/products/export', {
        params,
        responseType: 'blob',
      });

      // Create blob link and trigger click
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `products_export_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportSuccess(true);
    } catch (err: any) {
      console.error('Export failed:', err);
      setExportError(
        err.response?.data?.message || err.message || 'Failed to download export file. Please try again.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setCategoryId('');
    setBrand('');
    setStatus('all');
    setStockFilter('all');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#F0E0D5]">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#F47732] uppercase tracking-wider mb-1">
            <Link to="/admin/products" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Products & Stock
            </Link>
            <span>/</span>
            <span>Export Catalogue</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#292929] tracking-tight">
            Export Products & Inventory
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            Download your B2B product catalogue in CSV/Excel compatible format with automated spreadsheet formula injection protection.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Filter and Target Criteria */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filter Configuration Card */}
          <div className="bg-white border border-[#F0E0D5] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#F47732]" />
                <h2 className="text-base font-bold text-[#292929]">1. Filter Export Scope</h2>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-[#737373] hover:text-[#F47732] font-medium transition-colors"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Search */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#292929] uppercase tracking-wider mb-1.5">
                  Search Query
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#737373]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by product name, SKU, or barcode..."
                    className="w-full pl-9 pr-4 py-2 border border-[#F0E0D5] rounded-xl text-sm bg-white text-[#292929] focus:outline-none focus:border-[#F47732] focus:ring-1 focus:ring-[#F47732] transition-colors"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-[#292929] uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <CustomSelect
                  value={categoryId}
                  onChange={(val) => setCategoryId(val)}
                  icon={<Layers className="h-4 w-4" />}
                  options={[
                    { value: '', label: 'All Categories' },
                    ...categories.map((c) => ({ value: c._id, label: c.name })),
                  ]}
                />
              </div>

              {/* Brand */}
              <div>
                <label className="block text-xs font-bold text-[#292929] uppercase tracking-wider mb-1.5">
                  Brand
                </label>
                <CustomSelect
                  value={brand}
                  onChange={(val) => setBrand(val)}
                  icon={<Tag className="h-4 w-4" />}
                  options={[
                    { value: '', label: 'All Brands' },
                    ...brands.map((b) => ({ value: b.name, label: b.name })),
                  ]}
                />
              </div>

              {/* Product Status */}
              <div>
                <label className="block text-xs font-bold text-[#292929] uppercase tracking-wider mb-1.5">
                  Product Status
                </label>
                <CustomSelect
                  value={status}
                  onChange={(val) => setStatus(val as any)}
                  options={[
                    { value: 'all', label: 'All Statuses (Active & Inactive)' },
                    { value: 'active', label: 'Active Only' },
                    { value: 'inactive', label: 'Inactive Only' },
                  ]}
                />
              </div>

              {/* Stock Filter */}
              <div>
                <label className="block text-xs font-bold text-[#292929] uppercase tracking-wider mb-1.5">
                  Stock Level
                </label>
                <CustomSelect
                  value={stockFilter}
                  onChange={(val) => setStockFilter(val as any)}
                  options={[
                    { value: 'all', label: 'All Stock Levels' },
                    { value: 'in_stock', label: 'In Stock (> Low Threshold)' },
                    { value: 'low_stock', label: 'Low Stock (At or Below Threshold)' },
                    { value: 'out_of_stock', label: 'Out of Stock (Zero Available)' },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Preview of items to be exported */}
          <div className="bg-white border border-[#F0E0D5] rounded-2xl p-5 shadow-sm space-y-3 !my-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#F47732]" />
                <h2 className="text-base font-bold text-[#292929]">Data Sample Preview</h2>
              </div>
              <span className="text-xs font-semibold text-[#737373]">
                Showing top {previewItems.length} of {matchingCount} items
              </span>
            </div>

            {isLoadingPreview ? (
              <div className="py-8 flex items-center justify-center text-[#737373] gap-2 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin text-[#F47732]" />
                Calculating matching records...
              </div>
            ) : previewItems.length === 0 ? (
              <div className="py-8 text-center bg-[#FFF8F3]/30 rounded-xl border border-dashed border-[#F0E0D5]">
                <AlertCircle className="h-8 w-8 text-[#F0E0D5] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#292929]">No products match this filter</p>
                <p className="text-xs text-[#737373] mt-1">Adjust your search or filter values to export records.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#F0E0D5]">
                <table className="min-w-full divide-y divide-[#F0E0D5] text-center text-xs">
                  <thead className="bg-[#FFF8F3] font-bold text-[#292929] uppercase tracking-wider border-b border-[#F0E0D5]">
                    <tr>
                      <th className="py-2.5 px-3 text-center">SKU</th>
                      <th className="py-2.5 px-3 text-center">Product Name</th>
                      <th className="py-2.5 px-3 text-center">Category</th>
                      <th className="py-2.5 px-3 text-center">Brand</th>
                      <th className="py-2.5 px-3 text-center">Wholesale (₹)</th>
                      <th className="py-2.5 px-3 text-center">Stock</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E0D5]/60 bg-white">
                    {previewItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FFF8F3]/50">
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#292929] text-center">{item.sku}</td>
                        <td className="py-2.5 px-3 font-medium text-[#292929] max-w-[180px] truncate text-center">{item.name}</td>
                        <td className="py-2.5 px-3 text-[#737373] text-center">{item.categoryName || '—'}</td>
                        <td className="py-2.5 px-3 text-[#737373] text-center">{item.brand}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-[#E95B2A]">
                          ₹{(item.dealerPricePaise / 100).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-[#292929]">{item.stockOnHand}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${item.isActive ? 'bg-[#FFF1E8] text-[#E95B2A] border border-[#F0E0D5]' : 'bg-slate-100 text-[#737373]'
                              }`}
                          >
                            {item.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Column Selection & Export Action */}
        <div className="space-y-6">
          {/* Summary & Download Card */}
          <div className="bg-white border border-[#F0E0D5] rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div>
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#E95B2A] bg-[#FFF1E8] px-2 py-0.5 rounded border border-[#F0E0D5]">
                  Ready to Export
                </span>
                <h3 className="text-xl font-black mt-2 text-[#292929]">Export Summary</h3>
              </div>

              <div className="space-y-2 py-2 border-y border-[#F0E0D5] text-xs">
                <div className="flex justify-between">
                  <span className="text-[#737373]">Total Matching Products:</span>
                  <span className="font-bold text-[#292929] font-mono text-sm">{matchingCount} items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#737373]">Format:</span>
                  <span className="font-semibold text-[#292929]">CSV (.csv) / Excel compatible</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#737373]">Columns Included:</span>
                  <span className="font-semibold text-[#E95B2A]">{selectedColumns.length} fields</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#737373]">File Protection:</span>
                  <span className="font-semibold text-[#F47732]">Formula Escaping ON</span>
                </div>
              </div>

              {exportError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600 mt-0.5" />
                  <p>{exportError}</p>
                </div>
              )}

              {exportSuccess && (
                <div className="bg-[#FFF1E8] border border-[#F0E0D5] text-[#E95B2A] p-3 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#F47732]" />
                  <p className="font-medium">File successfully generated and downloaded.</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || matchingCount === 0}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all ${isExporting || matchingCount === 0
                  ? 'bg-slate-100 text-[#737373] cursor-not-allowed border border-[#F0E0D5]'
                  : 'bg-[#F47732] hover:bg-[#E95B2A] text-white font-bold shadow-[#F47732]/20 active:scale-[0.98]'
                  }`}
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating Export...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download CSV ({matchingCount} Products)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Included Fields Selection Card */}
          <div className="bg-white border border-[#F0E0D5] rounded-2xl p-5 shadow-sm space-y-3 !my-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#292929]">Included Columns</h3>
              <div className="space-x-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAllColumns}
                  className="text-[#F47732] hover:underline font-semibold"
                >
                  All
                </button>
                <span className="text-[#F0E0D5]">|</span>
                <button
                  type="button"
                  onClick={deselectAllColumns}
                  className="text-[#737373] hover:underline font-medium"
                >
                  Essential
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[#F0E0D5]/60 text-xs">
              {availableColumns.map((col) => {
                const isChecked = selectedColumns.includes(col.id);
                return (
                  <label
                    key={col.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#FFF8F3]/50 cursor-pointer"
                  >
                    <span className="text-[#292929] font-medium">{col.label}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleColumn(col.id)}
                      className="rounded border-[#F0E0D5] text-[#F47732] focus:ring-[#F47732] h-4 w-4"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
