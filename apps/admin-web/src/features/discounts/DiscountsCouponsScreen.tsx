import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api';
import { CustomSelect } from '../../components/ui';
import {
  Tag,
  Percent,
  Plus,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Eye,
  X,
  RefreshCw,
  ShoppingBag,
  Ticket,
  Users,
  Clock,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  TrendingDown,
  ShoppingCart,
  Gift,
} from 'lucide-react';
import { DiscountType, DiscountScope, CustomerType, formatPaiseToINR } from '@necessity/shared';

interface ProductDiscountItem {
  id: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  scope: DiscountScope;
  applicableProductIds?: any[];
  applicableCategoryIds?: any[];
  eligibleCustomerTypes?: string[];
  eligiblePricingGroupIds?: string[];
  eligibleDiscountGroupIds?: string[];
  minQuantity?: number;
  maxDiscountPaise?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

interface CouponItem {
  id: string;
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValuePaise: number;
  maxDiscountPaise?: number;
  eligibleCustomerTypes?: string[];
  eligiblePricingGroupIds?: string[];
  eligibleDiscountGroupIds?: string[];
  eligibleRetailerIds?: any[];
  startDate: string;
  endDate: string;
  totalUsageLimit?: number | null;
  perCustomerLimit: number;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
}

interface RedemptionItem {
  id: string;
  couponCode: string;
  retailerName?: string;
  orderNumber?: string;
  discountAmountPaise: number;
  redeemedAt: string;
}

export const DiscountsCouponsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'discounts' | 'coupons'>('discounts');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'expired' | 'draft'>('all');

  // Product Discounts state
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscountItem[]>([]);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [discountSearch, setDiscountSearch] = useState('');
  const [discountStatusFilter, setDiscountStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Coupons state
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [couponSearch, setCouponSearch] = useState('');
  const [couponStatusFilter, setCouponStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Reference data
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [productsList, setProductsList] = useState<Array<{ id: string; name: string; sku: string }>>([]);

  // Modals state
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<ProductDiscountItem | null>(null);

  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponItem | null>(null);

  const [isRedemptionsModalOpen, setIsRedemptionsModalOpen] = useState(false);
  const [selectedCouponForRedemption, setSelectedCouponForRedemption] = useState<CouponItem | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionItem[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  // Form states - Product Discount
  const [pDiscountName, setPDiscountName] = useState('');
  const [pDiscountType, setPDiscountType] = useState<DiscountType>(DiscountType.PERCENTAGE);
  const [pDiscountValue, setPDiscountValue] = useState<number | ''>('');
  const [pDiscountScope, setPDiscountScope] = useState<DiscountScope>(DiscountScope.ALL_PRODUCTS);
  const [pSelectedProductIds, setPSelectedProductIds] = useState<string[]>([]);
  const [pSelectedCategoryIds, setPSelectedCategoryIds] = useState<string[]>([]);
  const [pMinOrderINR, setPMinOrderINR] = useState<number | ''>('');
  const [pMaxDiscountINR, setPMaxDiscountINR] = useState<number | ''>('');
  const [pStartDate, setPStartDate] = useState('');
  const [pEndDate, setPEndDate] = useState('');
  const [pTotalLimit, setPTotalLimit] = useState<number | ''>('');
  const [pIsActive, setPIsActive] = useState<boolean>(true);

  // Form states - Coupon
  const [cCode, setCCode] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cDiscountType, setCDiscountType] = useState<DiscountType>(DiscountType.PERCENTAGE);
  const [cDiscountValue, setCDiscountValue] = useState<number | ''>('');
  const [cMinOrderINR, setCMinOrderINR] = useState<number | ''>('');
  const [cMaxDiscountINR, setCMaxDiscountINR] = useState<number | ''>('');
  const [cStartDate, setCStartDate] = useState('');
  const [cEndDate, setCEndDate] = useState('');
  const [cTotalLimit, setCTotalLimit] = useState<number | ''>('');
  const [cPerCustomerLimit, setCPerCustomerLimit] = useState<number | ''>(1);
  const [cIsActive, setCIsActive] = useState<boolean>(true);

  // Form error/saving states
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch reference categories and products
  useEffect(() => {
    const fetchReferences = async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          apiClient.get('/products/categories').catch(() => ({ data: { data: [] } })),
          apiClient.get('/products?limit=100').catch(() => ({ data: { data: [] } })),
        ]);
        if (catRes.data?.data) setCategories(catRes.data.data);
        if (prodRes.data?.data) setProductsList(prodRes.data.data);
      } catch {
        // Fallback or ignore
      }
    };
    fetchReferences();
  }, []);

  // Fetch Product Discounts
  const fetchProductDiscounts = useCallback(async () => {
    setLoadingDiscounts(true);
    try {
      const params: any = {};
      if (discountSearch.trim()) params.search = discountSearch.trim();
      if (discountStatusFilter !== 'all') params.status = discountStatusFilter;

      const res = await apiClient.get('/discounts/products', { params });
      if (res.data?.data) {
        setProductDiscounts(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch product discounts:', err);
    } finally {
      setLoadingDiscounts(false);
    }
  }, [discountSearch, discountStatusFilter]);

  // Fetch Coupons
  const fetchCoupons = useCallback(async () => {
    setLoadingCoupons(true);
    try {
      const params: any = {};
      if (couponSearch.trim()) params.search = couponSearch.trim();
      if (couponStatusFilter !== 'all') params.status = couponStatusFilter;

      const res = await apiClient.get('/discounts/coupons', { params });
      if (res.data?.data) {
        setCoupons(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch coupons:', err);
    } finally {
      setLoadingCoupons(false);
    }
  }, [couponSearch, couponStatusFilter]);

  // Initial and reactive data fetching
  useEffect(() => {
    fetchProductDiscounts();
    fetchCoupons();
  }, [fetchProductDiscounts, fetchCoupons]);

  // Open Product Discount Modal
  const openProductDiscountModal = (discount?: ProductDiscountItem) => {
    setFormError(null);
    if (discount) {
      setEditingDiscount(discount);
      setPDiscountName(discount.name);
      setPDiscountType(discount.discountType);
      setPDiscountValue(
        discount.discountType === DiscountType.PERCENTAGE
          ? discount.discountValue
          : discount.discountValue / 100
      );
      setPDiscountScope(discount.scope);
      setPSelectedProductIds(
        discount.applicableProductIds?.map((p: any) => p._id || p.id || p) || []
      );
      setPSelectedCategoryIds(
        discount.applicableCategoryIds?.map((c: any) => c._id || c.id || c) || []
      );
      setPMinOrderINR(discount.minQuantity || '');
      setPMaxDiscountINR(discount.maxDiscountPaise ? discount.maxDiscountPaise / 100 : '');
      setPStartDate(discount.startDate ? discount.startDate.substring(0, 10) : '');
      setPEndDate(discount.endDate ? discount.endDate.substring(0, 10) : '');
      setPTotalLimit('');
      setPIsActive(discount.isActive !== false);
    } else {
      setEditingDiscount(null);
      setPDiscountName('');
      setPDiscountType(DiscountType.PERCENTAGE);
      setPDiscountValue('');
      setPDiscountScope(DiscountScope.ALL_PRODUCTS);
      setPSelectedProductIds([]);
      setPSelectedCategoryIds([]);
      setPMinOrderINR('');
      setPMaxDiscountINR('');
      const today = new Date().toISOString().substring(0, 10);
      const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10);
      setPStartDate(today);
      setPEndDate(nextMonth);
      setPTotalLimit('');
      setPIsActive(true);
    }
    setIsDiscountModalOpen(true);
  };

  // Open Coupon Modal
  const openCouponModal = (coupon?: CouponItem) => {
    setFormError(null);
    if (coupon) {
      setEditingCoupon(coupon);
      setCCode(coupon.code);
      setCDescription(coupon.description || '');
      setCDiscountType(coupon.discountType);
      setCDiscountValue(
        coupon.discountType === DiscountType.PERCENTAGE
          ? coupon.discountValue
          : coupon.discountValue / 100
      );
      setCMinOrderINR(coupon.minOrderValuePaise ? coupon.minOrderValuePaise / 100 : '');
      setCMaxDiscountINR(coupon.maxDiscountPaise ? coupon.maxDiscountPaise / 100 : '');
      setCStartDate(coupon.startDate ? coupon.startDate.substring(0, 10) : '');
      setCEndDate(coupon.endDate ? coupon.endDate.substring(0, 10) : '');
      setCTotalLimit(coupon.totalUsageLimit !== undefined && coupon.totalUsageLimit !== null ? coupon.totalUsageLimit : '');
      setCPerCustomerLimit(coupon.perCustomerLimit || 1);
      setCIsActive(coupon.isActive !== false);
    } else {
      setEditingCoupon(null);
      setCCode('');
      setCDescription('');
      setCDiscountType(DiscountType.PERCENTAGE);
      setCDiscountValue('');
      setCMinOrderINR('');
      setCMaxDiscountINR('');
      const today = new Date().toISOString().substring(0, 10);
      const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10);
      setCStartDate(today);
      setCEndDate(nextMonth);
      setCTotalLimit('');
      setCPerCustomerLimit(1);
      setCIsActive(true);
    }
    setIsCouponModalOpen(true);
  };

  // Save Product Discount
  const handleSaveProductDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!pDiscountName.trim()) {
      setFormError('Discount name is required');
      return;
    }
    if (pDiscountValue === '' || Number(pDiscountValue) <= 0) {
      setFormError('Please enter a valid positive discount value');
      return;
    }
    if (pDiscountType === DiscountType.PERCENTAGE && Number(pDiscountValue) > 100) {
      setFormError('Percentage discount cannot exceed 100%');
      return;
    }
    if (!pStartDate) {
      setFormError('Start date is required');
      return;
    }

    const finalEndDate = pEndDate || new Date(new Date(pStartDate).getTime() + 365 * 86400000).toISOString().substring(0, 10);

    if (new Date(finalEndDate) <= new Date(pStartDate)) {
      setFormError('End date must be after start date');
      return;
    }

    setIsSubmitting(true);
    try {
      const discountValueCalculated =
        pDiscountType === DiscountType.PERCENTAGE
          ? Number(pDiscountValue)
          : Math.round(Number(pDiscountValue) * 100);

      const payload: any = {
        name: pDiscountName.trim(),
        discountType: pDiscountType,
        discountValue: discountValueCalculated,
        scope: pDiscountScope,
        applicableProductIds: pDiscountScope === DiscountScope.PRODUCTS ? pSelectedProductIds : [],
        applicableCategoryIds: pDiscountScope === DiscountScope.CATEGORIES ? pSelectedCategoryIds : [],
        minQuantity: pMinOrderINR ? Math.max(1, Math.round(Number(pMinOrderINR))) : 1,
        maxDiscountPaise: pMaxDiscountINR ? Math.round(Number(pMaxDiscountINR) * 100) : undefined,
        startDate: pStartDate,
        endDate: finalEndDate,
        priority: 1,
        isActive: pIsActive,
      };

      if (editingDiscount) {
        await apiClient.put(`/discounts/products/${editingDiscount.id}`, payload);
        setActionSuccess(`Discount '${pDiscountName}' updated successfully`);
      } else {
        await apiClient.post('/discounts/products', payload);
        setActionSuccess(`Discount '${pDiscountName}' created successfully`);
      }

      setIsDiscountModalOpen(false);
      fetchProductDiscounts();
      fetchCoupons();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save product discount');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Coupon
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCode = cCode.trim().toUpperCase();
    if (!cleanCode) {
      setFormError('Coupon code is required');
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(cleanCode)) {
      setFormError('Coupon code must contain only letters, numbers, and hyphens');
      return;
    }
    if (cDiscountValue === '' || Number(cDiscountValue) <= 0) {
      setFormError('Please enter a valid positive discount value');
      return;
    }
    if (cDiscountType === DiscountType.PERCENTAGE && Number(cDiscountValue) > 100) {
      setFormError('Percentage discount cannot exceed 100%');
      return;
    }
    if (!cStartDate) {
      setFormError('Start date is required');
      return;
    }

    const finalEndDate = cEndDate || new Date(new Date(cStartDate).getTime() + 365 * 86400000).toISOString().substring(0, 10);

    if (new Date(finalEndDate) <= new Date(cStartDate)) {
      setFormError('End date must be after start date');
      return;
    }

    setIsSubmitting(true);
    try {
      const discountValueCalculated =
        cDiscountType === DiscountType.PERCENTAGE
          ? Number(cDiscountValue)
          : Math.round(Number(cDiscountValue) * 100);

      const payload: any = {
        code: cleanCode,
        description: cDescription.trim() || undefined,
        discountType: cDiscountType,
        discountValue: discountValueCalculated,
        minOrderValuePaise: cMinOrderINR ? Math.round(Number(cMinOrderINR) * 100) : 0,
        maxDiscountPaise: cMaxDiscountINR ? Math.round(Number(cMaxDiscountINR) * 100) : undefined,
        startDate: cStartDate,
        endDate: finalEndDate,
        totalUsageLimit: cTotalLimit !== '' ? Number(cTotalLimit) : null,
        perCustomerLimit: Number(cPerCustomerLimit) || 1,
        isActive: cIsActive,
      };

      if (editingCoupon) {
        await apiClient.put(`/discounts/coupons/${editingCoupon.id}`, payload);
        setActionSuccess(`Coupon '${cleanCode}' updated successfully`);
      } else {
        await apiClient.post('/discounts/coupons', payload);
        setActionSuccess(`Coupon '${cleanCode}' created successfully`);
      }

      setIsCouponModalOpen(false);
      fetchCoupons();
      fetchProductDiscounts();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save coupon');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Product Discount Status
  const handleToggleProductDiscount = async (discount: ProductDiscountItem) => {
    try {
      const newStatus = !discount.isActive;
      await apiClient.patch(`/discounts/products/${discount.id}/status`, { isActive: newStatus });
      setProductDiscounts((prev) =>
        prev.map((d) => (d.id === discount.id ? { ...d, isActive: newStatus } : d))
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle discount status');
    }
  };

  // Toggle Coupon Status
  const handleToggleCoupon = async (coupon: CouponItem) => {
    try {
      const newStatus = !coupon.isActive;
      await apiClient.patch(`/discounts/coupons/${coupon.id}/status`, { isActive: newStatus });
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, isActive: newStatus } : c))
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle coupon status');
    }
  };

  // Delete Product Discount
  const handleDeleteProductDiscount = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete discount '${name}'?`)) return;
    try {
      await apiClient.delete(`/discounts/products/${id}`);
      setProductDiscounts((prev) => prev.filter((d) => d.id !== id));
      setActionSuccess(`Discount '${name}' deleted successfully`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete discount');
    }
  };

  // Delete Coupon
  const handleDeleteCoupon = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete coupon '${code}'?`)) return;
    try {
      await apiClient.delete(`/discounts/coupons/${id}`);
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      setActionSuccess(`Coupon '${code}' deleted successfully`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete coupon');
    }
  };

  // View Redemptions
  const handleViewRedemptions = async (coupon: CouponItem) => {
    setSelectedCouponForRedemption(coupon);
    setIsRedemptionsModalOpen(true);
    setLoadingRedemptions(true);
    try {
      const res = await apiClient.get(`/discounts/coupons/${coupon.id}/redemptions`);
      if (res.data?.data) {
        setRedemptions(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load redemptions:', err);
    } finally {
      setLoadingRedemptions(false);
    }
  };

  const getItemStatus = (startDate: string, endDate: string, isActive: boolean) => {
    if (!isActive) return { label: 'Draft', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (now > end) return { label: 'Expired', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    if (now < start) return { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    return { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  const filteredDiscounts = productDiscounts.filter((d) => {
    const matchesSearch = !discountSearch.trim() || d.name.toLowerCase().includes(discountSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    const status = getItemStatus(d.startDate, d.endDate, d.isActive).label.toLowerCase();
    return status === statusFilter;
  });

  const filteredCoupons = coupons.filter((c) => {
    const query = couponSearch.toLowerCase().trim();
    const matchesSearch =
      !query ||
      c.code.toLowerCase().includes(query) ||
      (c.description && c.description.toLowerCase().includes(query));
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    const status = getItemStatus(c.startDate, c.endDate, c.isActive).label.toLowerCase();
    return status === statusFilter;
  });

  const activeDiscountsCount = productDiscounts.filter((d) => {
    return getItemStatus(d.startDate, d.endDate, d.isActive).label === 'Active';
  }).length;

  const activeCouponsCount = coupons.filter((c) => {
    return getItemStatus(c.startDate, c.endDate, c.isActive).label === 'Active';
  }).length;

  const totalRedemptionsCount = coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);

  // Dynamic calculated estimated value given from coupons usage & discounts
  const calculatedSavingsPaise = coupons.reduce((sum, c) => {
    const usage = c.usageCount || 0;
    if (usage === 0) return sum;
    if (c.discountType === DiscountType.PERCENTAGE) {
      const orderBase = c.minOrderValuePaise || 100000;
      return sum + Math.round((orderBase * (c.discountValue / 100)) * usage);
    } else {
      return sum + Math.round(c.discountValue * usage);
    }
  }, 0);

  const displayActiveDiscounts = activeDiscountsCount;
  const displayActiveCoupons = activeCouponsCount;
  const displayTotalRedemptions = totalRedemptionsCount;
  const displayEstValue = calculatedSavingsPaise > 0 ? formatPaiseToINR(calculatedSavingsPaise) : '₹0';

  return (
    <>
      <div className="space-y-6">
        {/* Top Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1e293b]">Discounts & Coupons</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Create automatic discounts and shareable coupon codes for your customers.
          </p>
        </div>

        {/* 4 Metric KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Discounts */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#FFF8F3] border border-[#F0E0D5] flex items-center justify-center text-[#F47732] shrink-0">
              <TrendingDown className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Active Discounts</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{displayActiveDiscounts}</div>
            </div>
          </div>

          {/* Card 2: Active Coupons */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shrink-0">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Active Coupons</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{displayActiveCoupons}</div>
            </div>
          </div>

          {/* Card 3: Total Redemptions */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shrink-0">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Total Redemptions</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{displayTotalRedemptions}</div>
            </div>
          </div>

          {/* Card 4: Est. Value Given */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-500 shrink-0">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Est. Value Given</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{displayEstValue}</div>
            </div>
          </div>
        </div>

        {/* Action Notification */}
        {actionSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Navigation Tabs (Discounts & Coupons) */}
        <div className="flex items-center space-x-8 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('discounts')}
            className={`flex items-center space-x-2 pb-3.5 pt-1 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === 'discounts'
              ? 'border-[#F47732] text-[#F47732]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <TrendingDown className="h-4 w-4" />
            <span>Discounts</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'discounts' ? 'bg-[#FFF8F3] text-[#F47732]' : 'bg-slate-100 text-slate-600'
                }`}
            >
              {productDiscounts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('coupons')}
            className={`flex items-center space-x-2 pb-3.5 pt-1 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === 'coupons'
              ? 'border-[#F47732] text-[#F47732]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <Ticket className="h-4 w-4" />
            <span>Coupons & Codes</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'coupons' ? 'bg-[#FFF8F3] text-[#F47732]' : 'bg-slate-100 text-slate-600'
                }`}
            >
              {coupons.length}
            </span>
          </button>
        </div>

        {/* Single Unified Filter & Action Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'coupons' ? 'Search by code or description...' : 'Search discounts...'}
              value={activeTab === 'coupons' ? couponSearch : discountSearch}
              onChange={(e) => {
                if (activeTab === 'coupons') setCouponSearch(e.target.value);
                else setDiscountSearch(e.target.value);
              }}
              className="w-full pl-10 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#F47732] focus:border-[#F47732] text-slate-800 placeholder-slate-400 shadow-2xs"
            />
            {((activeTab === 'coupons' && couponSearch) || (activeTab !== 'coupons' && discountSearch)) && (
              <button
                onClick={() => {
                  if (activeTab === 'coupons') setCouponSearch('');
                  else setDiscountSearch('');
                }}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status Pill Filters (All, Active, Scheduled, Expired, Draft) */}
          <div className="bg-slate-100/80 p-1 rounded-xl flex items-center space-x-1 shrink-0 overflow-x-auto">
            {(['all', 'active', 'scheduled', 'expired', 'draft'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${statusFilter === filter
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                {filter === 'all' ? 'All' : filter}
              </button>
            ))}
          </div>

          {/* Action Button */}
          {activeTab === 'discounts' ? (
            <button
              onClick={() => openProductDiscountModal()}
              className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#F47732] hover:bg-[#E95B2A] transition-colors shadow-sm shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>New Discount</span>
            </button>
          ) : (
            <button
              onClick={() => openCouponModal()}
              className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#F47732] hover:bg-[#E95B2A] transition-colors shadow-sm shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>New Coupon</span>
            </button>
          )}
        </div>

        {/* TAB A: PRODUCT DISCOUNTS */}
        {activeTab === 'discounts' && (
          <div className="bg-white border border-[#F0E0D5] rounded-2xl shadow-xs overflow-hidden">
            {loadingDiscounts ? (
              <div className="p-12 text-center text-sm text-[#737373]">
                <div className="w-8 h-8 border-3 border-[#F47732] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Loading product discounts...
              </div>
            ) : filteredDiscounts.length === 0 ? (
              <div className="p-12 text-center">
                <TrendingDown className="h-10 w-10 text-[#737373] opacity-40 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-[#292929]">No Product Discounts Found</h3>
                <p className="text-xs text-[#737373] mt-1">
                  {discountSearch || statusFilter !== 'all'
                    ? 'No discounts match your current search or status filter.'
                    : 'Create your first promotional scheme to boost wholesale purchasing volume.'}
                </p>
                <button
                  onClick={() => openProductDiscountModal()}
                  className="mt-4 px-3.5 py-1.5 bg-[#F47732] text-white rounded-lg text-xs font-semibold hover:bg-[#E95B2A] transition-colors"
                >
                  Create Discount
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FFF8F3] text-slate-700 font-bold tracking-wider uppercase border-b border-[#F0E0D5]">
                    <tr>
                      <th className="py-3 px-4 text-left">NAME</th>
                      <th className="py-3 px-4 text-left">VALUE</th>
                      <th className="py-3 px-4 text-left">APPLIES TO</th>
                      <th className="py-3 px-4 text-left">VALIDITY</th>
                      <th className="py-3 px-4 text-left">USAGE</th>
                      <th className="py-3 px-4 text-center">STATUS</th>
                      <th className="py-3 px-4 text-right">ACTIVE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E0D5]">
                    {filteredDiscounts.map((d) => {
                      const statusInfo = getItemStatus(d.startDate, d.endDate, d.isActive);
                      return (
                        <tr key={d.id} className="hover:bg-[#FFF8F3]/50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-[#292929]">
                            <div>{d.name}</div>
                            <span className="text-[10px] text-[#737373] font-mono">Priority: {d.priority}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#FFF8F3] text-[#F47732] border border-[#F0E0D5]">
                              {d.discountType === DiscountType.PERCENTAGE
                                ? `${d.discountValue}% OFF`
                                : `₹${(d.discountValue / 100).toFixed(2)} OFF`}
                            </span>
                            {d.maxDiscountPaise ? (
                              <div className="text-[10px] text-[#737373] mt-0.5">
                                Max {formatPaiseToINR(d.maxDiscountPaise)}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-4">
                            {d.scope === DiscountScope.ALL_PRODUCTS && (
                              <span className="text-slate-700 font-medium">All Catalogue Items</span>
                            )}
                            {d.scope === DiscountScope.CATEGORIES && (
                              <span className="text-slate-700 font-medium">
                                {d.applicableCategoryIds?.length || 0} Categories
                              </span>
                            )}
                            {d.scope === DiscountScope.PRODUCTS && (
                              <span className="text-slate-700 font-medium">
                                {d.applicableProductIds?.length || 0} Products
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-[#737373]">
                            <div>{new Date(d.startDate).toLocaleDateString()} to</div>
                            <div className={statusInfo.label === 'Expired' ? 'text-rose-600 font-semibold' : ''}>
                              {new Date(d.endDate).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-800 font-medium">
                            {d.minQuantity || 1} units min
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusInfo.label === 'Active'
                                  ? 'bg-emerald-500'
                                  : statusInfo.label === 'Scheduled'
                                    ? 'bg-blue-500'
                                    : statusInfo.label === 'Draft'
                                      ? 'bg-amber-500'
                                      : 'bg-slate-400'
                                  }`}
                              />
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center space-x-2">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={d.isActive}
                                onClick={() => handleToggleProductDiscount(d)}
                                className={`relative inline-block h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:ring-offset-1 ${d.isActive ? 'bg-[#F47732]' : 'bg-slate-300'
                                  }`}
                                title={d.isActive ? 'Active (Click to Deactivate)' : 'Inactive (Click to Activate)'}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none absolute top-0.5 left-0.5 inline-flex h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${d.isActive ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                              </button>
                              <button
                                onClick={() => openProductDiscountModal(d)}
                                title="Edit"
                                className="p-1 text-[#737373] hover:text-[#F47732] hover:bg-[#FFF8F3] rounded-md transition-colors"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProductDiscount(d.id, d.name)}
                                title="Delete"
                                className="p-1 text-[#737373] hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
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
        )}

        {/* TAB B: ORDER COUPONS */}
        {activeTab === 'coupons' && (
          <div className="space-y-6">
            {/* Coupon Cards Grid (matching screenshot 2 with colored top accents) */}
            {filteredCoupons.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCoupons.map((c, idx) => {
                  const statusInfo = getItemStatus(c.startDate, c.endDate, c.isActive);
                  const isGreen = idx % 3 === 0 || idx % 3 === 1;
                  const accentColor =
                    statusInfo.label === 'Active'
                      ? isGreen
                        ? 'bg-[#57E4A0]'
                        : 'bg-[#60A5FA]'
                      : statusInfo.label === 'Scheduled'
                        ? 'bg-blue-400'
                        : 'bg-amber-400';

                  return (
                    <div
                      key={`card-${c.id}`}
                      className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
                    >
                      {/* Top colored accent bar */}
                      <div className={`h-2 w-full ${accentColor}`} />
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-sm text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 tracking-wider">
                              {c.code}
                            </span>
                            {c.description && (
                              <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{c.description}</p>
                            )}
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="text-xl font-bold text-[#F47732]">
                              {c.discountType === DiscountType.PERCENTAGE
                                ? `${c.discountValue}% OFF`
                                : `₹${(c.discountValue / 100).toFixed(2)} OFF`}
                            </span>
                            {c.maxDiscountPaise && (
                              <div className="text-[10px] text-slate-400">
                                Up to {formatPaiseToINR(c.maxDiscountPaise)}
                              </div>
                            )}
                          </div>
                          <div className="text-right text-xs">
                            <div className="font-semibold text-slate-700">
                              {c.minOrderValuePaise > 0 ? formatPaiseToINR(c.minOrderValuePaise) : 'No min'}
                            </div>
                            <div className="text-[10px] text-slate-400">Min Order</div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <div>
                            <span className="font-semibold text-slate-800">{c.usageCount}</span>
                            <span> / {c.totalUsageLimit ? c.totalUsageLimit : '∞'} used</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Valid till {new Date(c.endDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={c.isActive}
                          onClick={() => handleToggleCoupon(c)}
                          className={`relative inline-block h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${c.isActive ? 'bg-[#F47732]' : 'bg-slate-300'
                            }`}
                          title={c.isActive ? 'Active' : 'Inactive'}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute top-0.5 left-0.5 inline-flex h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${c.isActive ? 'translate-x-4' : 'translate-x-0'
                              }`}
                          />
                        </button>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleViewRedemptions(c)}
                            title="View Redemptions"
                            className="p-1 text-slate-500 hover:text-[#F47732] hover:bg-white rounded transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openCouponModal(c)}
                            title="Edit"
                            className="p-1 text-slate-500 hover:text-[#F47732] hover:bg-white rounded transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCoupon(c.id, c.code)}
                            title="Delete"
                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL: CREATE / EDIT PRODUCT DISCOUNT */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 !m-0">
          <div
            className="modal-card relative bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-[#F0E0D5] my-8 animate-dropdown-in"
            style={{ backgroundColor: '#FFFFFF' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#F0E0D5] mb-5">
              <div>
                <h2 className="text-xl font-bold text-[#292929] tracking-tight">
                  {editingDiscount ? 'Edit Discount' : 'Create Discount'}
                </h2>
                <p className="text-xs text-[#737373] mt-0.5">
                  Set up wholesale discount schemes and order incentives
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(false)}
                className="p-1.5 text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3] rounded-xl transition-colors border border-transparent hover:border-[#F0E0D5]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span className="font-medium">{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProductDiscount} className="space-y-4">
              {/* Discount Name */}
              <div>
                <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                  <span>Discount Name</span> <span className="text-[#F47732]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Sale"
                  value={pDiscountName}
                  onChange={(e) => setPDiscountName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                />
              </div>

              {/* Discount Type & Discount Value */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    <span>Discount Type</span> <span className="text-[#F47732]">*</span>
                  </label>
                  <select
                    value={pDiscountType}
                    onChange={(e) => setPDiscountType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#F0E0D5] hover:border-[#F47732] rounded-xl text-[#292929] transition-all cursor-pointer shadow-2xs"
                  >
                    <option value={DiscountType.PERCENTAGE}>Percentage (%)</option>
                    <option value={DiscountType.FIXED_AMOUNT}>Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    <span>Discount Value {pDiscountType === DiscountType.PERCENTAGE ? '(%)' : '(₹)'}</span>{' '}
                    <span className="text-[#F47732]">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={pDiscountType === DiscountType.PERCENTAGE ? 100 : undefined}
                    placeholder="10"
                    value={pDiscountValue}
                    onChange={(e) =>
                      setPDiscountValue(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                  />
                </div>
              </div>

              {/* Applies To */}
              <div>
                <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                  Applies To
                </label>
                <select
                  value={pDiscountScope}
                  onChange={(e) => setPDiscountScope(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#F0E0D5] hover:border-[#F47732] rounded-xl text-[#292929] transition-all cursor-pointer shadow-2xs"
                >
                  <option value={DiscountScope.ALL_PRODUCTS}>All Products</option>
                  <option value={DiscountScope.CATEGORIES}>Specific Categories</option>
                  <option value={DiscountScope.PRODUCTS}>Specific Products</option>
                </select>
              </div>

              {/* Specific Categories Picker */}
              {pDiscountScope === DiscountScope.CATEGORIES && (
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Select Categories
                  </label>
                  <div className="max-h-36 overflow-y-auto border border-[#F0E0D5] rounded-xl p-2.5 space-y-1.5 bg-[#FFF8F3]/40">
                    {categories.length === 0 ? (
                      <div className="text-xs text-[#737373] p-1">No categories found</div>
                    ) : (
                      categories.map((cat) => {
                        const isSelected = pSelectedCategoryIds.includes(cat.id);
                        return (
                          <label
                            key={cat.id}
                            className="flex items-center space-x-2 text-xs text-[#292929] cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setPSelectedCategoryIds([...pSelectedCategoryIds, cat.id]);
                                else setPSelectedCategoryIds(pSelectedCategoryIds.filter((id) => id !== cat.id));
                              }}
                              className="rounded text-[#F47732] focus:ring-[#F47732] accent-[#F47732]"
                            />
                            <span className="font-medium">{cat.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Specific Products Picker */}
              {pDiscountScope === DiscountScope.PRODUCTS && (
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Select Products
                  </label>
                  <div className="max-h-36 overflow-y-auto border border-[#F0E0D5] rounded-xl p-2.5 space-y-1.5 bg-[#FFF8F3]/40">
                    {productsList.length === 0 ? (
                      <div className="text-xs text-[#737373] p-1">No products found</div>
                    ) : (
                      productsList.map((prod) => {
                        const isSelected = pSelectedProductIds.includes(prod.id);
                        return (
                          <label
                            key={prod.id}
                            className="flex items-center space-x-2 text-xs text-[#292929] cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setPSelectedProductIds([...pSelectedProductIds, prod.id]);
                                else setPSelectedProductIds(pSelectedProductIds.filter((id) => id !== prod.id));
                              }}
                              className="rounded text-[#F47732] focus:ring-[#F47732] accent-[#F47732]"
                            />
                            <span className="font-medium">{prod.name} ({prod.sku})</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Min Order Value & Max Discount */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    Min Order Value (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={pMinOrderINR}
                    onChange={(e) =>
                      setPMinOrderINR(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    Max Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="No limit"
                    value={pMaxDiscountINR}
                    onChange={(e) =>
                      setPMaxDiscountINR(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                  />
                </div>
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    <span>Start Date</span> <span className="text-[#F47732]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={pStartDate}
                    onChange={(e) => setPStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] transition-all cursor-pointer shadow-2xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={pEndDate}
                    onChange={(e) => setPEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] transition-all cursor-pointer shadow-2xs outline-none"
                  />
                </div>
              </div>

              {/* Total Usage Limit */}
              <div>
                <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                  Total Usage Limit
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={pTotalLimit}
                  onChange={(e) =>
                    setPTotalLimit(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                />
              </div>

              {/* Enable Discount Toggle Box */}
              <div className="flex items-center justify-between p-3.5 bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl">
                <div>
                  <div className="text-sm font-bold text-[#292929]">Enable Discount</div>
                  <div className="text-xs text-[#737373] mt-0.5">
                    Discount will be visible to customers if enabled
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pIsActive}
                  onClick={() => setPIsActive(!pIsActive)}
                  className={`relative inline-block h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:ring-offset-1 ${
                    pIsActive ? 'bg-[#F47732]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute top-0.5 left-0.5 inline-flex h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
                      pIsActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#F0E0D5] mt-6">
                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(false)}
                  className="px-5 py-2.5 border border-[#E2E8F0] text-[#737373] hover:text-[#292929] hover:bg-slate-50 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#F47732] text-white hover:bg-[#E95B2A] rounded-xl text-sm font-semibold transition-all shadow-xs hover:shadow-md hover:shadow-[#F47732]/25 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingDiscount ? 'Update Discount' : 'Create Discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT COUPON */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 !m-0">
          <div
            className="modal-card relative bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-[#F0E0D5] my-8 animate-dropdown-in"
            style={{ backgroundColor: '#FFFFFF' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#F0E0D5] mb-5">
              <div>
                <h2 className="text-xl font-bold text-[#292929] tracking-tight">
                  {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
                </h2>
                <p className="text-xs text-[#737373] mt-0.5">
                  Set up shareable promo codes for orders and campaigns
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCouponModalOpen(false)}
                className="p-1.5 text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3] rounded-xl transition-colors border border-transparent hover:border-[#F0E0D5]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span className="font-medium">{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCoupon} className="space-y-4">
              {/* Coupon Code */}
              <div>
                <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                  <span>Coupon Code</span> <span className="text-[#F47732]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUMMER20"
                  value={cCode}
                  onChange={(e) => setCCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 text-sm font-mono uppercase bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. 20% off on bulk seasonal orders"
                  value={cDescription}
                  onChange={(e) => setCDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                />
              </div>

              {/* Discount Type & Discount Value */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    <span>Discount Type</span> <span className="text-[#F47732]">*</span>
                  </label>
                  <select
                    value={cDiscountType}
                    onChange={(e) => setCDiscountType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#F0E0D5] hover:border-[#F47732] rounded-xl text-[#292929] transition-all cursor-pointer shadow-2xs"
                  >
                    <option value={DiscountType.PERCENTAGE}>Percentage (%)</option>
                    <option value={DiscountType.FIXED_AMOUNT}>Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    <span>Discount Value {cDiscountType === DiscountType.PERCENTAGE ? '(%)' : '(₹)'}</span>{' '}
                    <span className="text-[#F47732]">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={cDiscountType === DiscountType.PERCENTAGE ? 100 : undefined}
                    placeholder="10"
                    value={cDiscountValue}
                    onChange={(e) =>
                      setCDiscountValue(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                  />
                </div>
              </div>

              {/* Min Order Value & Max Discount */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    Min Order Value (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={cMinOrderINR}
                    onChange={(e) =>
                      setCMinOrderINR(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    Max Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="No limit"
                    value={cMaxDiscountINR}
                    onChange={(e) =>
                      setCMaxDiscountINR(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                  />
                </div>
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    <span>Start Date</span> <span className="text-[#F47732]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={cStartDate}
                    onChange={(e) => setCStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] transition-all cursor-pointer shadow-2xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={cEndDate}
                    onChange={(e) => setCEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] transition-all cursor-pointer shadow-2xs outline-none"
                  />
                </div>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    Total Usage Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={cTotalLimit}
                    onChange={(e) =>
                      setCTotalLimit(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1.5">
                    Per Customer Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={cPerCustomerLimit}
                    onChange={(e) =>
                      setCPerCustomerLimit(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] hover:border-[#F47732]/60 focus:border-[#F47732] focus:ring-2 focus:ring-[#F47732]/20 rounded-xl text-[#292929] placeholder-[#9CA3AF] transition-all shadow-2xs outline-none"
                  />
                </div>
              </div>

              {/* Enable Coupon Toggle Box */}
              <div className="flex items-center justify-between p-3.5 bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl">
                <div>
                  <div className="text-sm font-bold text-[#292929]">Enable Coupon</div>
                  <div className="text-xs text-[#737373] mt-0.5">
                    Coupon will be active for checkout if enabled
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={cIsActive}
                  onClick={() => setCIsActive(!cIsActive)}
                  className={`relative inline-block h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:ring-offset-1 ${
                    cIsActive ? 'bg-[#F47732]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute top-0.5 left-0.5 inline-flex h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
                      cIsActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#F0E0D5] mt-6">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="px-5 py-2.5 border border-[#E2E8F0] text-[#737373] hover:text-[#292929] hover:bg-slate-50 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#F47732] text-white hover:bg-[#E95B2A] rounded-xl text-sm font-semibold transition-all shadow-xs hover:shadow-md hover:shadow-[#F47732]/25 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REDEMPTION HISTORY */}
      {isRedemptionsModalOpen && selectedCouponForRedemption && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 !m-0">
          <div
            className="modal-card relative bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-[#F0E0D5]"
            style={{ backgroundColor: '#FFFFFF' }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#F0E0D5]">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#292929]">
                  Redemption History: {selectedCouponForRedemption.code}
                </h2>
                <p className="text-xs text-[#737373] mt-0.5">
                  Total Redemptions: {selectedCouponForRedemption.usageCount}
                </p>
              </div>
              <button
                onClick={() => setIsRedemptionsModalOpen(false)}
                className="p-1.5 text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3] rounded-xl transition-colors border border-transparent hover:border-[#F0E0D5]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto">
              {loadingRedemptions ? (
                <div className="p-8 text-center text-sm text-[#737373]">
                  <div className="w-6 h-6 border-2 border-[#F47732] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Loading redemption records...
                </div>
              ) : redemptions.length === 0 ? (
                <div className="p-8 text-center text-[#737373] text-sm">
                  No orders have redeemed this coupon yet.
                </div>
              ) : (
                <table className="w-full text-center text-xs">
                  <thead className="bg-[#FFF8F3] text-[#737373] font-semibold border-b border-[#F0E0D5]">
                    <tr>
                      <th className="py-2.5 px-3 text-center">Order Number</th>
                      <th className="py-2.5 px-3 text-center">Retailer Account</th>
                      <th className="py-2.5 px-3 text-center">Discount Saved</th>
                      <th className="py-2.5 px-3 text-center">Redeemed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E0D5]">
                    {redemptions.map((r) => (
                      <tr key={r.id} className="hover:bg-[#FFF8F3]/50">
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#292929] text-center">
                          {r.orderNumber || 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-[#292929] text-center">
                          {r.retailerName || (r as any).retailerId?.businessName || 'Wholesale Buyer'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-600 text-center">
                          {formatPaiseToINR(r.discountAmountPaise)}
                        </td>
                        <td className="py-2.5 px-3 text-[#737373] text-center">
                          {new Date(r.redeemedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-[#F0E0D5] mt-6">
              <button
                onClick={() => setIsRedemptionsModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 text-[#292929] hover:bg-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DiscountsCouponsScreen;
