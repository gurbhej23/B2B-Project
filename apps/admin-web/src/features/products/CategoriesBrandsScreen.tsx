import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { CustomSelect } from '../../components/ui';
import {
  Tag,
  Plus,
  Search,
  Filter,
  X,
  Edit2,
  Trash2,
  RefreshCw,
  AlertCircle,
  Building2,
  FolderTree,
} from 'lucide-react';

interface CategoryItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  displayOrder?: number;
  productCount?: number;
  totalQuantity?: number;
  tquantity?: number;
}

interface BrandItem {
  _id: string;
  id?: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
  productCount?: number;
}

export const CategoriesBrandsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'categories' | 'brands'>('categories');

  // Categories state
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Brands state
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandStatusFilter, setBrandStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Category Modal
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    displayOrder: 0,
    isActive: true,
  });
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Brand Modal
  const [editingBrand, setEditingBrand] = useState<BrandItem | null>(null);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [brandForm, setBrandForm] = useState({
    name: '',
    slug: '',
    description: '',
    logoUrl: '',
    isActive: true,
  });
  const [isSubmittingBrand, setIsSubmittingBrand] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);

  // Delete confirmations
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const res = await apiClient.get('/products/categories');
      if (res.data?.data) {
        setCategories(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchBrands = async () => {
    setIsLoadingBrands(true);
    try {
      const res = await apiClient.get('/products/brands');
      if (res.data?.data) {
        setBrands(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    } finally {
      setIsLoadingBrands(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, []);

  // Category Actions
  const handleOpenCategoryModal = (cat?: CategoryItem) => {
    setCategoryError(null);
    if (cat) {
      setEditingCategory(cat);
      setCategoryForm({
        name: cat.name,
        slug: cat.slug,
        description: cat.description || '',
        imageUrl: cat.imageUrl || '',
        displayOrder: cat.displayOrder || 0,
        isActive: cat.isActive !== false,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        slug: '',
        description: '',
        imageUrl: '',
        displayOrder: categories.length + 1,
        isActive: true,
      });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      setCategoryError('Category name is required');
      return;
    }

    setIsSubmittingCategory(true);
    setCategoryError(null);

    try {
      const payload = {
        name: categoryForm.name.trim(),
      };
      if (editingCategory) {
        await apiClient.patch(`/products/categories/${editingCategory._id}`, payload);
      } else {
        await apiClient.post('/products/categories', payload);
      }
      setIsCategoryModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      setCategoryError(err.response?.data?.message || err.message || 'Failed to save category');
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    setDeletingId(id);
    setActionError(null);

    try {
      await apiClient.delete(`/products/categories/${id}`);
      fetchCategories();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleCategoryStatus = async (cat: CategoryItem) => {
    const currentActive = cat.isActive !== false;
    const newStatus = !currentActive;
    setTogglingId(cat._id);
    setActionError(null);

    // Optimistic update
    setCategories((prev) =>
      prev.map((c) => (c._id === cat._id ? { ...c, isActive: newStatus } : c))
    );

    try {
      await apiClient.patch(`/products/categories/${cat._id}`, { isActive: newStatus });
    } catch (err: any) {
      // Revert on failure
      setCategories((prev) =>
        prev.map((c) => (c._id === cat._id ? { ...c, isActive: currentActive } : c))
      );
      setActionError(err.response?.data?.message || err.message || 'Failed to update category status');
    } finally {
      setTogglingId(null);
    }
  };

  // Brand Actions
  const handleOpenBrandModal = (brand?: BrandItem) => {
    setBrandError(null);
    if (brand) {
      setEditingBrand(brand);
      setBrandForm({
        name: brand.name,
        slug: brand.slug,
        description: brand.description || '',
        logoUrl: brand.logoUrl || '',
        isActive: brand.isActive !== false,
      });
    } else {
      setEditingBrand(null);
      setBrandForm({
        name: '',
        slug: '',
        description: '',
        logoUrl: '',
        isActive: true,
      });
    }
    setIsBrandModalOpen(true);
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandForm.name.trim()) {
      setBrandError('Brand name is required');
      return;
    }

    setIsSubmittingBrand(true);
    setBrandError(null);

    try {
      const payload = {
        name: brandForm.name.trim(),
      };
      if (editingBrand) {
        await apiClient.patch(`/products/brands/${editingBrand._id}`, payload);
      } else {
        await apiClient.post('/products/brands', payload);
      }
      setIsBrandModalOpen(false);
      fetchBrands();
    } catch (err: any) {
      setBrandError(err.response?.data?.message || err.message || 'Failed to save brand');
    } finally {
      setIsSubmittingBrand(false);
    }
  };

  const handleDeleteBrand = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this brand?')) return;
    setDeletingId(id);
    setActionError(null);

    try {
      await apiClient.delete(`/products/brands/${id}`);
      fetchBrands();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to delete brand');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleBrandStatus = async (brand: BrandItem) => {
    const currentActive = brand.isActive !== false;
    const newStatus = !currentActive;
    setTogglingId(brand._id);
    setActionError(null);

    // Optimistic update
    setBrands((prev) =>
      prev.map((b) => (b._id === brand._id ? { ...b, isActive: newStatus } : b))
    );

    try {
      await apiClient.patch(`/products/brands/${brand._id}`, { isActive: newStatus });
    } catch (err: any) {
      // Revert on failure
      setBrands((prev) =>
        prev.map((b) => (b._id === brand._id ? { ...b, isActive: currentActive } : b))
      );
      setActionError(err.response?.data?.message || err.message || 'Failed to update brand status');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredCategories = categories.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
      c.slug.toLowerCase().includes(categorySearch.toLowerCase());
    const matchesStatus =
      categoryStatusFilter === 'all'
        ? true
        : categoryStatusFilter === 'active'
          ? c.isActive !== false
          : c.isActive === false;
    return matchesSearch && matchesStatus;
  });

  const filteredBrands = brands.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(brandSearch.toLowerCase()) ||
      b.slug.toLowerCase().includes(brandSearch.toLowerCase());
    const matchesStatus =
      brandStatusFilter === 'all'
        ? true
        : brandStatusFilter === 'active'
          ? b.isActive !== false
          : b.isActive === false;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#F0E0D5]">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-black text-[#292929] tracking-tight flex items-center gap-2">
            <FolderTree className="h-7 w-7 text-[#F47732]" />
            Categories & Brands
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            Organize products into logical wholesale categories and manage manufacturer brand catalogs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'categories' ? (
            <button
              type="button"
              onClick={() => handleOpenCategoryModal()}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#F47732] hover:bg-[#E95B2A] rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenBrandModal()}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#F47732] hover:bg-[#E95B2A] rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Brand
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Action Failed</p>
            <p className="text-rose-700 text-xs mt-0.5">{actionError}</p>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-700 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#F0E0D5] !m-0">
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`pb-2 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-all !mt-3 ${activeTab === 'categories'
            ? 'border-[#F47732] text-[#F47732]'
            : 'border-transparent text-[#737373] hover:text-[#292929]'
            }`}
        >
          <FolderTree className="h-4 w-4" />
          Categories ({categories.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('brands')}
          className={`pb-2 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-all !mt-3 ${activeTab === 'brands'
            ? 'border-[#F47732] text-[#F47732]'
            : 'border-transparent text-[#737373] hover:text-[#292929]'
            }`}
        >
          <Tag className="h-4 w-4" />
          Manufacturer Brands ({brands.length})
        </button>
      </div>

      {/* CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          {/* Search Bar, Filter & Refresh */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#737373]" />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories by name or slug..."
                className="w-full pl-10 pr-10 py-2 text-sm border border-[#F0E0D5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] transition-all shadow-xs"
              />
              {categorySearch && (
                <button
                  type="button"
                  onClick={() => setCategorySearch('')}
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
                  id="category-status-filter"
                  value={categoryStatusFilter}
                  onChange={(val) => setCategoryStatusFilter(val as any)}
                  icon={<Filter className="h-3.5 w-3.5" />}
                  options={[
                    { value: 'all', label: 'All Categories' },
                    { value: 'active', label: 'Active Categories' },
                    { value: 'inactive', label: 'Inactive Categories' },
                  ]}
                  title="Filter categories by status"
                />
              </div>

              <button
                type="button"
                onClick={() => fetchCategories()}
                disabled={isLoadingCategories}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#292929] hover:text-[#F47732] bg-white hover:bg-[#FFF8F3] border border-[#F0E0D5] hover:border-[#F47732] rounded-lg shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#F47732] disabled:opacity-50 flex-shrink-0"
                title="Refresh categories"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingCategories ? 'animate-spin text-[#F47732]' : 'text-[#737373]'}`} />
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#F1E7E1] rounded-[12px] shadow-xs overflow-hidden">
            {isLoadingCategories ? (
              <div className="py-8 text-center text-[#737373] flex flex-col items-center justify-center gap-2 text-sm">
                <RefreshCw className="h-6 w-6 animate-spin text-[#F47732]" />
                Loading product categories...
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="py-8 text-center text-[#737373]">
                <FolderTree className="h-10 w-10 text-[#F0E0D5] mx-auto mb-2" />
                <p className="font-semibold text-[#292929]">No categories found</p>
                <button
                  type="button"
                  onClick={() => handleOpenCategoryModal()}
                  className="mt-3 text-xs font-bold text-[#F47732] hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create First Category
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto touch-scroll">
                <table className="w-full min-w-[700px] table-fixed divide-y divide-[#F1E7E1] text-xs sm:text-sm"><thead>
                  <tr className="bg-[#FFF8F3] border-b border-[#F0E0D5] text-[#292929] font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 text-center w-[25%]">Category Name</th>
                    <th className="py-3 px-4 text-center w-[16%]">Slug Identifier</th>
                    <th className="py-3 px-4 text-center w-[18%]">Total Quantity</th>
                    <th className="py-3 px-4 text-center w-[11%]">Status</th>
                    <th className="py-3 px-4 text-center w-[20%]"></th>
                  </tr>
                </thead>
                  <tbody className="divide-y divide-[#F1E7E1] bg-white">
                    {filteredCategories.map((cat) => {
                      const isActive = cat.isActive !== false;
                      const isToggling = togglingId === cat._id;
                      return (
                        <tr key={cat._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 text-center font-semibold whitespace-nowrap">
                            <div className="flex items-center justify-center gap-3">
                              <FolderTree className="h-4 w-4 text-[#F47732] shrink-0" />
                              <span className="truncate">{cat.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-[#737373] text-center">
                            {cat.slug}
                          </td>
                          <td className="w-[15%] px-4 text-center align-middle font-mono font-bold">
                            <span className="inline-flex items-center justify-center bg-[#FFF1E8] text-[#E95B2A] border border-[#F0E0D5] px-2.5 py-0.5 rounded-full text-xs">
                              {cat.tquantity ?? cat.totalQuantity ?? 0}
                            </span>
                          </td>
                          <td className="w-[14%] px-4 text-center align-middle">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isActive}
                              disabled={isToggling}
                              onClick={() => handleToggleCategoryStatus(cat)}
                              className={`relative inline-block h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:ring-offset-1 ${isActive ? 'bg-[#F47732]' : 'bg-slate-300'
                                } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
                              title={isActive ? `Active (Click to Deactivate ${cat.name})` : `Inactive (Click to Activate ${cat.name})`}
                            >
                              <span className="sr-only">{isActive ? 'Deactivate category' : 'Activate category'}</span>
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none absolute top-0.5 left-0.5 inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                              />
                            </button>
                          </td>
                          <td className="w-[14%] px-4 text-center align-middle">
                            <div className="flex items-center justify-center gap-4">
                              <button
                                type="button"
                                onClick={() => handleOpenCategoryModal(cat)}
                                className="p-1.5 text-[#737373] hover:text-[#F47732] hover:bg-[#FFF1E8] rounded-lg transition-colors"
                                title="Edit Category"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === cat._id}
                                onClick={() => handleDeleteCategory(cat._id)}
                                className="p-1.5 text-[#737373] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Category"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
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
      )}

      {/* BRANDS TAB */}
      {activeTab === 'brands' && (
        <div className="space-y-4">
          {/* Search Bar, Filter & Refresh */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#737373]" />
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Search brands by name or slug..."
                className="w-full pl-10 pr-10 py-2 text-sm border border-[#F0E0D5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] transition-all shadow-xs"
              />
              {brandSearch && (
                <button
                  type="button"
                  onClick={() => setBrandSearch('')}
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
                  id="brand-status-filter"
                  value={brandStatusFilter}
                  onChange={(val) => setBrandStatusFilter(val as any)}
                  icon={<Filter className="h-3.5 w-3.5" />}
                  options={[
                    { value: 'all', label: 'All Brands' },
                    { value: 'active', label: 'Active Brands' },
                    { value: 'inactive', label: 'Inactive Brands' },
                  ]}
                  title="Filter brands by status"
                />
              </div>

              <button
                type="button"
                onClick={() => fetchBrands()}
                disabled={isLoadingBrands}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#292929] hover:text-[#F47732] bg-white hover:bg-[#FFF8F3] border border-[#F0E0D5] hover:border-[#F47732] rounded-lg shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#F47732] disabled:opacity-50 flex-shrink-0"
                title="Refresh brands"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingBrands ? 'animate-spin text-[#F47732]' : 'text-[#737373]'}`} />
              </button>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md border border-[#F0E0D5] rounded-xl shadow-xs overflow-hidden">
            {isLoadingBrands ? (
              <div className="py-10 text-center text-[#737373] flex flex-col items-center justify-center gap-2 text-sm">
                <RefreshCw className="h-6 w-6 animate-spin text-[#F47732]" />
                Loading manufacturer brands...
              </div>
            ) : filteredBrands.length === 0 ? (
              <div className="py-10 text-center text-[#737373]">
                <Tag className="h-10 w-10 text-[#F0E0D5] mx-auto mb-2" />
                <p className="font-semibold text-[#292929]">No brands found</p>
                <button
                  type="button"
                  onClick={() => handleOpenBrandModal()}
                  className="mt-3 text-xs font-bold text-[#F47732] hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add First Brand
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto touch-scroll">
                <table className="min-w-[680px] w-full divide-y divide-[#F0E0D5] text-xs sm:text-sm">
                  <thead className="bg-[#FFF8F3] text-[#292929] font-bold uppercase tracking-wider text-[11px]">
                    <tr className="bg-[#FFF8F3]">
                      <th className="py-3 px-4 text-center w-[25%]">Brand</th>
                      <th className="py-3 px-4 text-center w-[16%]">Slug Identifier</th>
                      <th className="py-3 px-4 text-center w-[18%]">Assigned Products</th>
                      <th className="py-3 px-4 text-center w-[11%]">Status</th>
                      <th className="py-3 px-4 text-center w-[20%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E0D5] bg-transparent">
                    {filteredBrands.map((b) => {
                      const isActive = b.isActive !== false;
                      const isToggling = togglingId === b._id;
                      return (
                        <tr key={b._id} className="hover:bg-[#FFF8F3]/50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-[#292929] text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Building2 className="h-4 w-4 text-[#F47732] shrink-0" />
                              <span>{b.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-[#737373] text-center">
                            {b.slug}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            <span className="bg-[#FFF1E8] text-[#E95B2A] border border-[#F0E0D5] px-2.5 py-0.5 rounded-full text-xs">
                              {b.productCount || 0}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isActive}
                              disabled={isToggling}
                              onClick={() => handleToggleBrandStatus(b)}
                              className={`relative inline-block h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:ring-offset-1 ${isActive ? 'bg-[#F47732]' : 'bg-slate-300'
                                } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
                              title={isActive ? `Active (Click to Deactivate ${b.name})` : `Inactive (Click to Activate ${b.name})`}
                            >
                              <span className="sr-only">{isActive ? 'Deactivate brand' : 'Activate brand'}</span>
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none absolute top-0.5 left-0.5 inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                              />
                            </button>
                          </td>
                          <td className="py-3 px-4 text-left p-6">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenBrandModal(b)}
                                className="p-1.5 text-[#737373] hover:text-[#F47732] hover:bg-[#FFF1E8] rounded-lg transition-colors"
                                title="Edit Brand"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === b._id}
                                onClick={() => handleDeleteBrand(b._id)}
                                className="p-1.5 text-[#737373] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Brand"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
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
      )}

      {/* CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-md flex items-center justify-center p-4 !m-0"
          style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        >
          <div
            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-lg w-full p-4 sm:p-5 border border-[#F0E0D5]"
            style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          >
            <h3 className="text-xl font-bold text-[#292929] mb-4">
              {editingCategory ? 'Edit Product Category' : 'Add New Product Category'}
            </h3>

            <form onSubmit={handleSaveCategory} className="space-y-5">
              {categoryError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {categoryError}
                </div>
              )}

              <div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g. Bed Linen & Pillow Covers"
                  className="w-full px-4 py-3 border border-[#E5E7EB] rounded-xl text-sm focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929] placeholder:text-[#9CA3AF] transition-all outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-5 py-2.5 border border-[#E5E7EB] hover:bg-neutral-50 text-[#525252] font-medium rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCategory}
                  className="px-6 py-2.5 bg-[#F9AA7B] hover:bg-[#F47732] text-white font-medium rounded-xl text-sm shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingCategory ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingCategory ? (
                    'Save Category'
                  ) : (
                    'Create Category'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BRAND MODAL */}
      {isBrandModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-md flex items-center justify-center p-4 !m-0"
          style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        >
          <div
            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-7 border border-[#F0E0D5]"
            style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          >
            <h3 className="text-xl font-bold text-[#292929] mb-4">
              {editingBrand ? 'Edit Product Brand' : 'Add New Product Brand'}
            </h3>

            <form onSubmit={handleSaveBrand} className="space-y-5">
              {brandError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {brandError}
                </div>
              )}

              <div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={brandForm.name}
                  onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                  placeholder="e.g. Necessity Prime"
                  className="w-full px-4 py-3 border border-[#E5E7EB] rounded-xl text-sm focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929] placeholder:text-[#9CA3AF] transition-all outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBrandModalOpen(false)}
                  className="px-5 py-2.5 border border-[#E5E7EB] hover:bg-neutral-50 text-[#525252] font-medium rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBrand}
                  className="px-6 py-2.5 bg-[#F9AA7B] hover:bg-[#F47732] text-white font-medium rounded-xl text-sm shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingBrand ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingBrand ? (
                    'Save Brand'
                  ) : (
                    'Create Brand'
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
