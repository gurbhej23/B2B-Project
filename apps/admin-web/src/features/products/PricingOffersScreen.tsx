import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { CustomSelect } from '../../components/ui';
import {
  Tag,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Zap,
  Sliders,
  Layers,
  Edit2,
  ShieldCheck,
} from 'lucide-react';
import {
  CustomerType,
  formatPaiseToINR,
  inrToPaise,
} from '@necessity/shared';

interface ProductPricingItem {
  id: string;
  sku: string;
  name: string;
  categoryName?: string;
  brand: string;
  mrpPaise: number;
  dealerPricePaise: number;
  gstRatePercent: number;
  minOrderQuantity: number;
  wholesaleTiers?: Array<{
    customerType: string;
    discountPercent?: number;
    pricePaise?: number;
    minQuantity?: number;
  }>;
  offers?: Array<{
    minQuantity: number;
    discountPercent: number;
    label: string;
  }>;
  isActive: boolean;
}

export const PricingOffersScreen: React.FC = () => {
  const [products, setProducts] = useState<ProductPricingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Top View Navigation: Matrix vs Reusable Groups
  const [activeView, setActiveView] = useState<'matrix' | 'groups'>('matrix');

  // Groups and Rules state
  const [pricingGroups, setPricingGroups] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [groupFilter, setGroupFilter] = useState('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');
  const [ruleSearch, setRuleSearch] = useState('');

  // Modals for Groups and Rules
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupCustomerType, setGroupCustomerType] = useState<CustomerType>(CustomerType.WHOLESALER);
  const [groupIsDefault, setGroupIsDefault] = useState(false);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [ruleProductId, setRuleProductId] = useState('');
  const [ruleTarget, setRuleTarget] = useState<'pricingGroup' | 'customerType' | 'retailer'>('pricingGroup');
  const [rulePricingGroupId, setRulePricingGroupId] = useState('');
  const [ruleCustomerType, setRuleCustomerType] = useState<CustomerType>(CustomerType.WHOLESALER);
  const [ruleRetailerId, setRuleRetailerId] = useState('');
  const [ruleBasePriceINR, setRuleBasePriceINR] = useState<number | ''>('');
  const [ruleDiscountPercent, setRuleDiscountPercent] = useState<number | ''>('');
  const [ruleMinQuantity, setRuleMinQuantity] = useState<number | ''>(1);
  const [ruleTierPricing, setRuleTierPricing] = useState<
    Array<{ minQuantity: number; maxQuantity?: number; unitPriceINR: number }>
  >([]);
  const [ruleIsActive, setRuleIsActive] = useState(true);
  const [groupFormError, setGroupFormError] = useState<string | null>(null);
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);

  // Active product being edited in modal
  const [editingProduct, setEditingProduct] = useState<ProductPricingItem | null>(null);
  const [mrpInput, setMrpInput] = useState<number | ''>('');
  const [dealerPriceInput, setDealerPriceInput] = useState<number | ''>('');
  const [offers, setOffers] = useState<Array<{ minQuantity: number; discountPercent: number; label: string }>>([]);
  const [wholesaleTiers, setWholesaleTiers] = useState<
    Array<{ customerType: string; discountPercent?: number; pricePaise?: number; minQuantity?: number }>
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Bulk Discount Rule Simulator State
  const [bulkCategory, setBulkCategory] = useState('all');
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState<number>(5);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit: 12,
      };
      if (search.trim()) params.search = search.trim();

      const res = await apiClient.get('/products', { params });
      if (res.data?.data) {
        setProducts(res.data.data);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalProducts(res.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load products for pricing:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, search]);

  const handleOpenEditModal = (p: ProductPricingItem) => {
    setEditingProduct(p);
    setMrpInput(p.mrpPaise ? p.mrpPaise / 100 : '');
    setDealerPriceInput(p.dealerPricePaise ? p.dealerPricePaise / 100 : '');
    setOffers(p.offers ? JSON.parse(JSON.stringify(p.offers)) : []);
    setWholesaleTiers(p.wholesaleTiers ? JSON.parse(JSON.stringify(p.wholesaleTiers)) : []);
    setModalError(null);
    setSaveSuccess(false);
  };

  const handleAddOfferRow = () => {
    setOffers([
      ...offers,
      {
        minQuantity: 25,
        discountPercent: 5,
        label: 'Volume Wholesale Slab (25+ units)',
      },
    ]);
  };

  const handleRemoveOfferRow = (index: number) => {
    setOffers(offers.filter((_, i) => i !== index));
  };

  const handleAddTierRow = () => {
    setWholesaleTiers([
      ...wholesaleTiers,
      {
        customerType: 'OLD_RETAILER',
        discountPercent: 3,
        minQuantity: 10,
      },
    ]);
  };

  const handleRemoveTierRow = (index: number) => {
    setWholesaleTiers(wholesaleTiers.filter((_, i) => i !== index));
  };

  const handleSaveProductPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const mrp = Number(mrpInput);
    const dealer = Number(dealerPriceInput);

    if (isNaN(mrp) || mrp <= 0) {
      setModalError('Valid MRP is required');
      return;
    }
    if (isNaN(dealer) || dealer <= 0) {
      setModalError('Valid Wholesale/Dealer price is required');
      return;
    }
    if (dealer > mrp) {
      setModalError('Wholesale dealer price cannot exceed MRP');
      return;
    }

    setIsSaving(true);
    setModalError(null);

    try {
      await apiClient.patch(`/products/${editingProduct.id}`, {
        mrpPaise: Math.round(mrp * 100),
        dealerPricePaise: Math.round(dealer * 100),
        offers,
        wholesaleTiers,
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setEditingProduct(null);
        fetchProducts();
      }, 700);
    } catch (err: any) {
      console.error('Failed to update product pricing:', err);
      setModalError(err.response?.data?.message || err.message || 'Failed to update pricing');
    } finally {
      setIsSaving(false);
    }
  };

  // Reusable Pricing Groups & Rules Handlers
  const fetchPricingGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await apiClient.get('/pricing/groups');
      setPricingGroups(res.data?.data || []);
    } catch (e) {
      console.warn('Failed to fetch pricing groups:', e);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const fetchPricingRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const params: any = {};
      if (groupFilter !== 'all') params.pricingGroupId = groupFilter;
      if (customerTypeFilter !== 'all') params.customerType = customerTypeFilter;
      const res = await apiClient.get('/pricing/rules', { params });
      setPricingRules(res.data?.data || []);
    } catch (e) {
      console.warn('Failed to fetch pricing rules:', e);
    } finally {
      setLoadingRules(false);
    }
  }, [groupFilter, customerTypeFilter]);

  useEffect(() => {
    if (activeView === 'groups') {
      fetchPricingGroups();
      fetchPricingRules();
    }
  }, [activeView, fetchPricingGroups, fetchPricingRules]);

  const openCreateGroupModal = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupCode('');
    setGroupDescription('');
    setGroupCustomerType(CustomerType.WHOLESALER);
    setGroupIsDefault(false);
    setGroupFormError(null);
    setIsGroupModalOpen(true);
  };

  const openEditGroupModal = (group: any) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupCode(group.code);
    setGroupDescription(group.description || '');
    setGroupCustomerType(group.customerTypeDefault || CustomerType.WHOLESALER);
    setGroupIsDefault(group.isDefault || false);
    setGroupFormError(null);
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setGroupFormError('Group name is required');
      return;
    }
    const code = groupCode.trim() || groupName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    try {
      if (editingGroup) {
        await apiClient.patch(`/pricing/groups/${editingGroup.id || editingGroup._id}`, {
          name: groupName.trim(),
          description: groupDescription.trim(),
          customerTypeDefault: groupCustomerType,
          isDefault: groupIsDefault,
        });
      } else {
        await apiClient.post('/pricing/groups', {
          name: groupName.trim(),
          code,
          description: groupDescription.trim(),
          customerTypeDefault: groupCustomerType,
          isDefault: groupIsDefault,
        });
      }
      setIsGroupModalOpen(false);
      fetchPricingGroups();
    } catch (err: any) {
      setGroupFormError(err.response?.data?.error?.message || err.message || 'Failed to save group');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this pricing group? Associated rules will be affected.')) return;
    try {
      await apiClient.delete(`/pricing/groups/${id}`);
      fetchPricingGroups();
      fetchPricingRules();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to delete group');
    }
  };

  const openCreateRuleModal = () => {
    setEditingRule(null);
    setRuleProductId(products[0]?.id || '');
    setRuleTarget('pricingGroup');
    setRulePricingGroupId(pricingGroups[0]?.id || pricingGroups[0]?._id || '');
    setRuleCustomerType(CustomerType.WHOLESALER);
    setRuleRetailerId('');
    setRuleBasePriceINR('');
    setRuleDiscountPercent('');
    setRuleMinQuantity(1);
    setRuleTierPricing([]);
    setRuleIsActive(true);
    setRuleFormError(null);
    setIsRuleModalOpen(true);
  };

  const openEditRuleModal = (rule: any) => {
    setEditingRule(rule);
    setRuleProductId(rule.productId?._id || rule.productId || '');
    if (rule.retailerId) {
      setRuleTarget('retailer');
      setRuleRetailerId(rule.retailerId?._id || rule.retailerId || '');
    } else if (rule.pricingGroupId) {
      setRuleTarget('pricingGroup');
      setRulePricingGroupId(rule.pricingGroupId?._id || rule.pricingGroupId || '');
    } else {
      setRuleTarget('customerType');
      setRuleCustomerType(rule.customerType || CustomerType.WHOLESALER);
    }
    setRuleBasePriceINR(rule.customPricePaise ? rule.customPricePaise / 100 : '');
    setRuleDiscountPercent(rule.discountPercent ?? '');
    setRuleMinQuantity(rule.minOrderQuantity || 1);
    setRuleTierPricing(
      (rule.tierPricing || []).map((t: any) => ({
        minQuantity: t.minQuantity,
        maxQuantity: t.maxQuantity,
        unitPriceINR: (t.unitPricePaise || 0) / 100,
      }))
    );
    setRuleIsActive(rule.isActive !== false);
    setRuleFormError(null);
    setIsRuleModalOpen(true);
  };

  const handleAddTierSlab = () => {
    const lastTier = ruleTierPricing[ruleTierPricing.length - 1];
    const nextMin = lastTier ? (lastTier.maxQuantity ? lastTier.maxQuantity + 1 : lastTier.minQuantity + 20) : 10;
    setRuleTierPricing([
      ...ruleTierPricing,
      { minQuantity: nextMin, maxQuantity: nextMin + 39, unitPriceINR: 0 },
    ]);
  };

  const handleRemoveTierSlab = (idx: number) => {
    setRuleTierPricing(ruleTierPricing.filter((_, i) => i !== idx));
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleFormError(null);

    if (!ruleProductId) {
      setRuleFormError('Please select a product');
      return;
    }

    // Validate tier pricing bounds
    for (let i = 0; i < ruleTierPricing.length; i++) {
      const current = ruleTierPricing[i];
      if (current.minQuantity <= 0) {
        setRuleFormError(`Tier slab ${i + 1} minimum quantity must be at least 1`);
        return;
      }
      if (current.maxQuantity && current.maxQuantity <= current.minQuantity) {
        setRuleFormError(`Tier slab ${i + 1} maximum quantity (${current.maxQuantity}) must be greater than minimum quantity (${current.minQuantity})`);
        return;
      }
      if (i > 0) {
        const prev = ruleTierPricing[i - 1];
        if (prev.maxQuantity && current.minQuantity <= prev.maxQuantity) {
          setRuleFormError(`Tier slab ${i + 1} min quantity (${current.minQuantity}) must be strictly greater than previous max quantity (${prev.maxQuantity}) to prevent overlapping ranges.`);
          return;
        }
      }
    }

    const payload: any = {
      productId: ruleProductId,
      customPricePaise: ruleBasePriceINR !== '' ? inrToPaise(Number(ruleBasePriceINR)) : undefined,
      discountPercent: ruleDiscountPercent !== '' ? Number(ruleDiscountPercent) : undefined,
      minOrderQuantity: ruleMinQuantity !== '' ? Number(ruleMinQuantity) : 1,
      tierPricing: ruleTierPricing.map((t) => ({
        minQuantity: Number(t.minQuantity),
        maxQuantity: t.maxQuantity ? Number(t.maxQuantity) : undefined,
        unitPricePaise: inrToPaise(Number(t.unitPriceINR)),
      })),
      isActive: ruleIsActive,
      pricingGroupId: ruleTarget === 'pricingGroup' ? rulePricingGroupId || undefined : null,
      customerType: ruleTarget === 'customerType' ? ruleCustomerType : null,
      retailerId: ruleTarget === 'retailer' ? ruleRetailerId || undefined : null,
    };

    try {
      if (editingRule) {
        await apiClient.patch(`/pricing/rules/${editingRule.id || editingRule._id}`, payload);
      } else {
        await apiClient.post('/pricing/rules', payload);
      }
      setIsRuleModalOpen(false);
      fetchPricingRules();
    } catch (err: any) {
      setRuleFormError(err.response?.data?.error?.message || err.message || 'Failed to save pricing rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this pricing rule?')) return;
    try {
      await apiClient.delete(`/pricing/rules/${id}`);
      fetchPricingRules();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to delete rule');
    }
  };

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
            <span>Commercial Policy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#292929] tracking-tight">
            Wholesale Pricing & Volume Offers
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            Configure dealer wholesale rates, tiered customer discounts (New vs Established retailers), and quantity slab offers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchProducts}
            className="p-2 text-[#737373] bg-white hover:bg-[#FFF8F3] hover:text-[#F47732] border border-[#F0E0D5] rounded-xl shadow-sm transition-all"
            title="Refresh Pricing"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            to="/admin/products"
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#292929] bg-white hover:bg-[#FFF8F3] hover:text-[#F47732] border border-[#F0E0D5] rounded-xl shadow-sm transition-all"
          >
            Catalogue View
          </Link>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex border-b border-[#F0E0D5] gap-4">
        <button
          type="button"
          onClick={() => setActiveView('matrix')}
          className={`pb-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeView === 'matrix'
            ? 'border-[#F47732] text-[#F47732]'
            : 'border-transparent text-[#737373] hover:text-[#292929]'
            }`}
        >
          <Tag className="h-4 w-4" />
          Product Catalog Base Matrix
        </button>
        <button
          type="button"
          onClick={() => setActiveView('groups')}
          className={`pb-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeView === 'groups'
            ? 'border-[#F47732] text-[#F47732]'
            : 'border-transparent text-[#737373] hover:text-[#292929]'
            }`}
        >
          <Layers className="h-4 w-4" />
          Reusable Pricing Groups & Tier Rules
        </button>
      </div>

      {activeView === 'matrix' ? (
        <>
          {/* Wholesale Commercial Strategy Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 !my-3">
            {/* Tier Card 1 */}
            <div className="bg-white border border-[#F0E0D5] rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-[#F47732]">
                <Tag className="h-5 w-5" />
                <h3 className="text-sm font-bold text-[#292929] uppercase tracking-wider">Wholesale Base Rate</h3>
              </div>
              <p className="text-xs text-[#737373] leading-relaxed">
                Standard dealer price applied to verified B2B retail partners. Displayed exclusively after retailer account activation.
              </p>
              <div className="pt-2 text-xs font-semibold text-[#E95B2A] flex items-center gap-1">
                <span>Exclusive of GST</span>
              </div>
            </div>

            {/* Tier Card 2 */}
            <div className="bg-white border border-[#F0E0D5] rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-[#F47732]">
                <Zap className="h-5 w-5" />
                <h3 className="text-sm font-bold text-[#292929] uppercase tracking-wider">Account Tiers</h3>
              </div>
              <p className="text-xs text-[#737373] leading-relaxed">
                Automatic tiered pricing incentives for established wholesale clients vs initial probationary orders.
              </p>
              <div className="pt-2 text-xs font-semibold text-[#E95B2A]">
                <span>Configurable per account category</span>
              </div>
            </div>

            {/* Tier Card 3 */}
            <div className="bg-white border border-[#F0E0D5] rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-[#F47732]">
                <Sparkles className="h-5 w-5" />
                <h3 className="text-sm font-bold text-[#292929] uppercase tracking-wider">Quantity Slabs</h3>
              </div>
              <p className="text-xs text-[#737373] leading-relaxed">
                Automated volume breaks triggered when order quantities reach or exceed specific volume milestones.
              </p>
              <div className="pt-2 text-xs font-semibold text-[#E95B2A]">
                <span>Visualized dynamically in mobile ordering app</span>
              </div>
            </div>
          </div>

          {/* Main Pricing Table */}
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white border border-[#F0E0D5] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#737373]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search product name or SKU..."
                  className="w-full pl-9 pr-4 py-2 border border-[#F0E0D5] rounded-xl text-xs sm:text-sm bg-white text-[#292929] focus:outline-none focus:border-[#F47732] focus:ring-1 focus:ring-[#F47732]"
                />
              </div>
              <span className="text-xs font-medium text-[#737373]">
                Showing {products.length} of {totalProducts} products
              </span>
            </div>

            {/* Table */}
            <div className="bg-white border border-[#F0E0D5] rounded-2xl shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="py-16 text-center text-[#737373] flex flex-col items-center justify-center gap-2 text-sm">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#F47732]" />
                  Loading commercial matrix...
                </div>
              ) : products.length === 0 ? (
                <div className="py-16 text-center text-[#737373]">
                  <Tag className="h-10 w-10 text-[#F0E0D5] mx-auto mb-2" />
                  <p className="font-semibold text-[#292929]">No products found</p>
                </div>
              ) : (
                <div className="overflow-x-auto touch-scroll">
                  <table className="min-w-[780px] w-full divide-y divide-[#F0E0D5] text-center text-xs sm:text-sm">
                    <thead className="bg-[#FFF8F3] text-[#292929] font-bold uppercase tracking-wider text-[11px] border-b border-[#F0E0D5]">
                      <tr>
                        <th className="py-3 px-4 text-center">SKU / Item</th>
                        <th className="py-3 px-4 text-center">Category & Brand</th>
                        <th className="py-3 px-4 text-center">MRP (₹)</th>
                        <th className="py-3 px-4 text-center">Wholesale Price (₹)</th>
                        <th className="py-3 px-4 text-center">Retailer Price Difference</th>
                        <th className="py-3 px-4 text-center">Volume Slabs</th>
                        <th className="py-3 px-4 text-center">Account Tiers</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0E0D5]/60 bg-white">
                      {products.map((p) => {
                        const mrp = p.mrpPaise / 100;
                        const dealer = p.dealerPricePaise / 100;
                        const priceDiff = Math.max(0, mrp - dealer);
                        const diffPercent = mrp > 0 ? ((priceDiff / mrp) * 100).toFixed(2) : '0.00';

                        return (
                          <tr key={p.id} className="hover:bg-[#FFF8F3]/50 transition-colors">
                            <td className="py-3 px-4 text-center">
                              <div className="font-bold text-[#292929]">{p.name}</div>
                              <span className="font-mono text-xs text-[#737373]">{p.sku}</span>
                            </td>
                            <td className="py-3 px-4 text-xs text-[#737373] text-center">
                              <div>{p.categoryName || '—'}</div>
                              <div className="text-[#737373]/80 font-medium">{p.brand}</div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-[#737373]">
                              ₹{mrp.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-[#292929]">
                              ₹{dealer.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-semibold text-[#E95B2A]">
                              {diffPercent}% (₹{priceDiff.toFixed(2)})
                            </td>
                            <td className="py-3 px-4 text-center">
                              {p.offers && p.offers.length > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF1E8] text-[#E95B2A] border border-[#F0E0D5]">
                                  {p.offers.length} active slab{p.offers.length > 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="text-[#737373] text-xs">Standard</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {p.wholesaleTiers && p.wholesaleTiers.length > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF8F3] text-[#F47732] border border-[#F0E0D5]">
                                  {p.wholesaleTiers.length} tier{p.wholesaleTiers.length > 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="text-[#737373] text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(p)}
                                className="px-2.5 py-1 text-xs font-semibold text-[#E95B2A] bg-[#FFF1E8] hover:bg-[#F47732] hover:text-white border border-[#F0E0D5] rounded-lg transition-colors inline-flex items-center justify-center gap-1"
                              >
                                <Sliders className="h-3 w-3" />
                                Configure
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="py-3 px-4 border-t border-[#F0E0D5] bg-[#FFF8F3]/40 flex items-center justify-between text-xs text-[#737373]">
                  <span>Page {page} of {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 bg-white border border-[#F0E0D5] text-[#292929] rounded-lg disabled:opacity-50 hover:bg-[#FFF8F3] hover:text-[#F47732]"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1 bg-white border border-[#F0E0D5] text-[#292929] rounded-lg disabled:opacity-50 hover:bg-[#FFF8F3] hover:text-[#F47732]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* EDIT PRICING & OFFERS MODAL */}
          {editingProduct && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center !m-0">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden border border-[#F0E0D5] my-8">
                <div className="bg-[#FFF8F3] border-b border-[#F0E0D5] p-5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#F47732]">
                      Commercial Configuration
                    </span>
                    <h3 className="text-lg font-black mt-0.5 text-[#292929]">{editingProduct.name}</h3>
                    <div className="text-xs text-[#737373] font-mono">
                      SKU: {editingProduct.sku}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="text-[#737373] hover:text-[#292929] p-1 rounded-lg hover:bg-white border border-transparent hover:border-[#F0E0D5] transition-all"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveProductPricing} className="p-5 space-y-6 max-h-[75vh] overflow-y-auto bg-white">
                  {modalError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                      {modalError}
                    </div>
                  )}

                  {saveSuccess && (
                    <div className="p-3 bg-[#FFF1E8] border border-[#F0E0D5] rounded-xl text-xs text-[#E95B2A] flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#F47732]" />
                      Pricing & Offers updated successfully!
                    </div>
                  )}

                  {/* Base Prices */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#292929] mb-3 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-[#F47732]" />
                      Base Prices (Exclusive of GST)
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#292929] mb-1">MRP (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={mrpInput}
                          onChange={(e) => setMrpInput(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-[#F0E0D5] rounded-xl text-sm font-mono text-[#292929] bg-white focus:outline-none focus:border-[#F47732] focus:ring-1 focus:ring-[#F47732]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#292929] mb-1">
                          Wholesale Dealer Price (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={dealerPriceInput}
                          onChange={(e) =>
                            setDealerPriceInput(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-[#F0E0D5] rounded-xl text-sm font-mono font-bold text-[#292929] bg-white focus:outline-none focus:border-[#F47732] focus:ring-1 focus:ring-[#F47732]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Volume Discount Slabs */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#292929] flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-[#F47732]" />
                        Volume Slab Discounts
                      </h4>
                      <button
                        type="button"
                        onClick={handleAddOfferRow}
                        className="text-xs font-bold text-[#F47732] hover:text-[#E95B2A] flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Volume Slab
                      </button>
                    </div>

                    {offers.length === 0 ? (
                      <p className="text-xs text-[#737373] italic bg-[#FFF8F3]/50 p-3 rounded-xl border border-dashed border-[#F0E0D5]">
                        No volume slabs active. Retailers will pay standard wholesale price regardless of order size.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {offers.map((offer, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#FFF8F3]/40 p-2.5 rounded-xl border border-[#F0E0D5] text-xs"
                          >
                            <div className="w-full sm:w-24">
                              <label className="text-[10px] text-[#737373] font-bold block">Min Units</label>
                              <input
                                type="number"
                                min="1"
                                value={offer.minQuantity}
                                onChange={(e) => {
                                  const updated = [...offers];
                                  updated[idx].minQuantity = parseInt(e.target.value, 10) || 1;
                                  setOffers(updated);
                                }}
                                className="w-full px-2 py-1 border border-[#F0E0D5] rounded-lg font-mono bg-white text-[#292929] focus:outline-none focus:border-[#F47732]"
                              />
                            </div>
                            <div className="w-full sm:w-24">
                              <label className="text-[10px] text-[#737373] font-bold block">Discount %</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={offer.discountPercent}
                                onChange={(e) => {
                                  const updated = [...offers];
                                  updated[idx].discountPercent = parseFloat(e.target.value) || 0;
                                  setOffers(updated);
                                }}
                                className="w-full px-2 py-1 border border-[#F0E0D5] rounded-lg font-mono font-bold text-[#E95B2A] bg-white focus:outline-none focus:border-[#F47732]"
                              />
                            </div>
                            <div className="flex-1 w-full">
                              <label className="text-[10px] text-[#737373] font-bold block">Banner Tag / Label</label>
                              <input
                                type="text"
                                value={offer.label}
                                onChange={(e) => {
                                  const updated = [...offers];
                                  updated[idx].label = e.target.value;
                                  setOffers(updated);
                                }}
                                placeholder="e.g. Bulk Volume Bonus (50+ units)"
                                className="w-full px-2 py-1 border border-[#F0E0D5] rounded-lg bg-white text-[#292929] focus:outline-none focus:border-[#F47732]"
                              />
                            </div>
                            <div className="flex justify-end sm:block">
                              <button
                                type="button"
                                onClick={() => handleRemoveOfferRow(idx)}
                                className="text-[#737373] hover:text-rose-600 p-1.5 sm:mt-3"
                                title="Remove slab"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Wholesale Customer Account Tiers */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#292929] flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-[#F47732]" />
                        Account Tiers (New vs Old Retailers)
                      </h4>
                      <button
                        type="button"
                        onClick={handleAddTierRow}
                        className="text-xs font-bold text-[#F47732] hover:text-[#E95B2A] flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Account Tier
                      </button>
                    </div>

                    {wholesaleTiers.length === 0 ? (
                      <p className="text-xs text-[#737373] italic bg-[#FFF8F3]/50 p-3 rounded-xl border border-dashed border-[#F0E0D5]">
                        No account-specific overrides. All customer types use standard dealer rate.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {wholesaleTiers.map((tier, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#FFF8F3]/40 p-2.5 rounded-xl border border-[#F0E0D5] text-xs"
                          >
                            <div className="w-full sm:w-48">
                              <label className="text-[10px] text-[#737373] font-bold block mb-1">Customer Type</label>
                              <CustomSelect
                                value={tier.customerType}
                                onChange={(val) => {
                                  const updated = [...wholesaleTiers];
                                  updated[idx].customerType = val;
                                  setWholesaleTiers(updated);
                                }}
                                options={[
                                  { value: 'NEW_RETAILER', label: 'New Retailer (Probation)' },
                                  { value: 'OLD_RETAILER', label: 'Established Wholesale' },
                                  { value: 'VIP_DISTRIBUTOR', label: 'VIP / Master Distributor' },
                                ]}
                              />
                            </div>
                            <div className="w-full sm:w-28">
                              <label className="text-[10px] text-[#737373] font-bold block">Extra Disc %</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={tier.discountPercent || ''}
                                onChange={(e) => {
                                  const updated = [...wholesaleTiers];
                                  updated[idx].discountPercent = parseFloat(e.target.value) || 0;
                                  setWholesaleTiers(updated);
                                }}
                                className="w-full px-2 py-1 border border-[#F0E0D5] rounded-lg font-mono font-bold text-[#E95B2A] bg-white focus:outline-none focus:border-[#F47732]"
                              />
                            </div>
                            <div className="w-full sm:w-28">
                              <label className="text-[10px] text-[#737373] font-bold block">Min Order Qty</label>
                              <input
                                type="number"
                                min="1"
                                value={tier.minQuantity || 1}
                                onChange={(e) => {
                                  const updated = [...wholesaleTiers];
                                  updated[idx].minQuantity = parseInt(e.target.value, 10) || 1;
                                  setWholesaleTiers(updated);
                                }}
                                className="w-full px-2 py-1 border border-[#F0E0D5] rounded-lg font-mono bg-white text-[#292929] focus:outline-none focus:border-[#F47732]"
                              />
                            </div>
                            <div className="flex justify-end sm:block">
                              <button
                                type="button"
                                onClick={() => handleRemoveTierRow(idx)}
                                className="text-[#737373] hover:text-rose-600 p-1.5 sm:mt-3"
                                title="Remove tier"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F0E0D5]">
                    <button
                      type="button"
                      onClick={() => setEditingProduct(null)}
                      className="px-4 py-2 border border-[#F0E0D5] text-[#292929] hover:bg-[#FFF8F3] rounded-xl text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white font-bold rounded-xl text-xs shadow-sm shadow-[#F47732]/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Saving Commercials...
                        </>
                      ) : (
                        'Save Commercial Rates'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Reusable Pricing Groups & Rules View */
        <div className="space-y-6">
          {/* Pricing Engine 4-Level Precedence Hierarchy Card */}
          <div className="bg-[#FFF8F3] border border-[#F0E0D5] rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-5 w-5 text-[#F47732]" />
              <h3 className="text-sm font-bold text-[#292929] uppercase tracking-wider">
                Wholesale Pricing Engine — 4-Level Resolution Hierarchy
              </h3>
            </div>
            <p className="text-xs text-[#737373] mb-3">
              When a verified customer browses products or calculates a wholesale order, the engine resolves price rules in strict sequential precedence so prices are never miscalculated or double-discounted:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white p-3 rounded-xl border border-[#F0E0D5]">
                <div className="font-bold text-[#F47732] text-[11px] uppercase">1. Customer Override</div>
                <div className="font-semibold text-slate-800 mt-0.5">Direct Retailer Rule</div>
                <p className="text-[10px] text-slate-500 mt-1">Specific product override negotiated exclusively for one customer account.</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#F0E0D5]">
                <div className="font-bold text-[#F47732] text-[11px] uppercase">2. Pricing Group</div>
                <div className="font-semibold text-slate-800 mt-0.5">Assigned Group Rule</div>
                <p className="text-[10px] text-slate-500 mt-1">Product rule configured for the customer's assigned pricing group (e.g. Distributor Tier A).</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#F0E0D5]">
                <div className="font-bold text-[#F47732] text-[11px] uppercase">3. Customer Type</div>
                <div className="font-semibold text-slate-800 mt-0.5">Classification Rule</div>
                <p className="text-[10px] text-slate-500 mt-1">Default rule configured for Wholesaler, Distributor, or Retailer classification.</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#F0E0D5]">
                <div className="font-bold text-[#F47732] text-[11px] uppercase">4. Product Default</div>
                <div className="font-semibold text-slate-800 mt-0.5">Base Dealer Rate</div>
                <p className="text-[10px] text-slate-500 mt-1">Standard product dealer price configured on the catalogue item.</p>
              </div>
            </div>
          </div>

          {/* Pricing Groups Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#292929] flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#F47732]" />
                  Reusable Pricing Groups ({pricingGroups.length})
                </h2>
                <p className="text-xs text-[#737373]">
                  Assign groups to customer accounts to unlock customized wholesale price lists and quantity breaks.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateGroupModal}
                className="px-3.5 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Pricing Group
              </button>
            </div>

            {loadingGroups ? (
              <div className="py-8 text-center text-xs text-[#737373] flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-[#F47732]" />
                Loading pricing groups...
              </div>
            ) : pricingGroups.length === 0 ? (
              <div className="bg-white border border-dashed border-[#F0E0D5] p-6 rounded-2xl text-center text-xs text-[#737373]">
                No custom pricing groups created yet. Click "New Pricing Group" to add one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {pricingGroups.map((group) => (
                  <div
                    key={group.id || group._id}
                    className="bg-white border border-[#F0E0D5] rounded-2xl p-4 shadow-xs space-y-2 relative hover:border-[#F47732] transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{group.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400">{group.code}</span>
                      </div>
                      {group.isDefault && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">{group.description || 'No description provided'}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                        {group.customerTypeDefault || 'Wholesaler'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditGroupModal(group)}
                          className="p-1 text-slate-400 hover:text-[#F47732] hover:bg-[#FFF8F3] rounded"
                          title="Edit Group"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id || group._id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete Group"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Pricing Rules Table */}
          <div className="space-y-3 pt-4 border-t border-[#F0E0D5]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#292929] flex items-center gap-2">
                  <Tag className="h-4 w-4 text-[#F47732]" />
                  Configured Product Pricing Rules ({pricingRules.length})
                </h2>
                <p className="text-xs text-[#737373]">
                  Product-specific pricing rules, volume tier breaks, and negotiated customer overrides.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateRuleModal}
                className="px-3.5 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Product Rule
              </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border border-[#F0E0D5] rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#737373] font-semibold whitespace-nowrap">Filter by Group:</span>
                <div className="w-48">
                  <CustomSelect
                    value={groupFilter}
                    onChange={(val) => setGroupFilter(val)}
                    options={[
                      { value: 'all', label: 'All Groups' },
                      ...pricingGroups.map((g) => ({ value: g.id || g._id, label: g.name })),
                    ]}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[#737373] font-semibold whitespace-nowrap">Customer Type:</span>
                <div className="w-44">
                  <CustomSelect
                    value={customerTypeFilter}
                    onChange={(val) => setCustomerTypeFilter(val)}
                    options={[
                      { value: 'all', label: 'All Types' },
                      { value: CustomerType.RETAILER, label: 'Retailer' },
                      { value: CustomerType.WHOLESALER, label: 'Wholesaler' },
                      { value: CustomerType.DISTRIBUTOR, label: 'Distributor' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Rules Table */}
            <div className="bg-white border border-[#F0E0D5] rounded-2xl shadow-xs overflow-hidden">
              {loadingRules ? (
                <div className="py-12 text-center text-xs text-[#737373] flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#F47732]" />
                  Loading rules...
                </div>
              ) : pricingRules.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#737373] p-6">
                  <Tag className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No product pricing rules configured yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Click "Add Product Rule" above to create price overrides or quantity slabs.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-xs divide-y divide-[#F0E0D5]">
                    <thead className="bg-[#FFF8F3] text-[#292929] font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4 text-center">Product / SKU</th>
                        <th className="py-3 px-4 text-center">Applied Scope</th>
                        <th className="py-3 px-4 text-center">Base Override / Disc</th>
                        <th className="py-3 px-4 text-center">MOQ</th>
                        <th className="py-3 px-4 text-center">Quantity Slabs / Tiers</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pricingRules.map((rule) => {
                        const prod = rule.productId || {};
                        const scopeLabel = rule.retailerId
                          ? `Customer: ${rule.retailerId.businessName || rule.retailerId}`
                          : rule.pricingGroupId
                            ? `Group: ${rule.pricingGroupId.name || 'Pricing Group'}`
                            : rule.customerType
                              ? `Type: ${rule.customerType.toUpperCase()}`
                              : 'Global';

                        return (
                          <tr key={rule.id || rule._id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 text-center">
                              <div className="font-bold text-slate-900">{prod.name || 'Product'}</div>
                              <div className="text-[11px] font-mono text-slate-500">{prod.sku}</div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${rule.retailerId
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : rule.pricingGroupId
                                  ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                                }`}>
                                {scopeLabel}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {rule.customPricePaise ? (
                                <span className="font-bold text-slate-900">
                                  {formatPaiseToINR(rule.customPricePaise)}
                                </span>
                              ) : rule.discountPercent ? (
                                <span className="font-bold text-emerald-700">
                                  {rule.discountPercent}% Off
                                </span>
                              ) : (
                                <span className="text-slate-400">Catalogue Base</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-semibold text-slate-700">
                              {rule.minOrderQuantity || 1} units
                            </td>
                            <td className="py-3 px-4 text-center">
                              {rule.tierPricing && rule.tierPricing.length > 0 ? (
                                <div className="space-y-1">
                                  {rule.tierPricing.map((tp: any, tIdx: number) => (
                                    <div key={tIdx} className="text-[11px] text-slate-600 flex items-center gap-1.5 font-mono">
                                      <span className="font-semibold text-slate-800">
                                        {tp.minQuantity}{tp.maxQuantity ? `–${tp.maxQuantity}` : '+'} units:
                                      </span>
                                      <span className="text-[#E95B2A] font-bold">
                                        {formatPaiseToINR(tp.unitPricePaise)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">No volume tiers</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${rule.isActive !== false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                                }`}>
                                {rule.isActive !== false ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditRuleModal(rule)}
                                  className="p-1 text-slate-400 hover:text-[#F47732] hover:bg-[#FFF8F3] rounded"
                                  title="Edit Rule"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRule(rule.id || rule._id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                  title="Delete Rule"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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

          {/* Modal: Create/Edit Pricing Group */}
          <Modal
            isOpen={isGroupModalOpen}
            onClose={() => setIsGroupModalOpen(false)}
            title={editingGroup ? `Edit Pricing Group: ${editingGroup.name}` : 'Create New Pricing Group'}
          >
            <form onSubmit={handleSaveGroup} className="space-y-4 text-xs">
              {groupFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
                  {groupFormError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wholesale Tier A, Distributor National"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#F0E0D5] rounded-lg text-slate-900 focus:ring-1 focus:ring-[#F47732]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Group Code</label>
                <input
                  type="text"
                  placeholder="e.g. wholesale-tier-a (auto-generated if empty)"
                  value={groupCode}
                  onChange={(e) => setGroupCode(e.target.value)}
                  className="w-full px-3 py-2 border border-[#F0E0D5] rounded-lg font-mono text-slate-900 focus:ring-1 focus:ring-[#F47732]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe who qualifies for this pricing group..."
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-[#F0E0D5] rounded-lg text-slate-900 focus:ring-1 focus:ring-[#F47732]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Default Customer Type</label>
                  <CustomSelect
                    value={groupCustomerType}
                    onChange={(val) => setGroupCustomerType(val as CustomerType)}
                    options={[
                      { value: CustomerType.RETAILER, label: 'Retailer' },
                      { value: CustomerType.WHOLESALER, label: 'Wholesaler' },
                      { value: CustomerType.DISTRIBUTOR, label: 'Distributor' },
                    ]}
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupIsDefault}
                      onChange={(e) => setGroupIsDefault(e.target.checked)}
                      className="rounded text-[#F47732] focus:ring-[#F47732]"
                    />
                    <span className="font-semibold text-slate-700">Set as default group</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F0E0D5]">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 border border-[#F0E0D5] text-slate-700 rounded-lg hover:bg-[#FFF8F3]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white font-bold rounded-lg shadow-xs"
                >
                  Save Group
                </button>
              </div>
            </form>
          </Modal>

          {/* Modal: Create/Edit Pricing Rule */}
          <Modal
            isOpen={isRuleModalOpen}
            onClose={() => setIsRuleModalOpen(false)}
            title={editingRule ? 'Edit Product Pricing Rule' : 'Create Product Pricing Rule & Tiers'}
          >
            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              {ruleFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
                  {ruleFormError}
                </div>
              )}

              {/* Product Selector */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Select Product *</label>
                <CustomSelect
                  value={ruleProductId}
                  onChange={(val) => setRuleProductId(val)}
                  placeholder="-- Choose Catalogue Product --"
                  options={[
                    { value: '', label: '-- Choose Catalogue Product --' },
                    ...products.map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.sku}) — Base: ₹${(p.dealerPricePaise / 100).toFixed(2)}`,
                    })),
                  ]}
                />
              </div>

              {/* Scope Target */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1.5">Apply Rule Scope *</label>
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={`flex items-center gap-1.5 p-2 rounded-lg border cursor-pointer ${ruleTarget === 'pricingGroup' ? 'border-[#F47732] bg-[#FFF8F3] font-bold text-[#292929]' : 'border-slate-200 bg-white'
                      }`}
                  >
                    <input
                      type="radio"
                      name="ruleScope"
                      checked={ruleTarget === 'pricingGroup'}
                      onChange={() => setRuleTarget('pricingGroup')}
                      className="text-[#F47732]"
                    />
                    <span>Pricing Group</span>
                  </label>

                  <label
                    className={`flex items-center gap-1.5 p-2 rounded-lg border cursor-pointer ${ruleTarget === 'customerType' ? 'border-[#F47732] bg-[#FFF8F3] font-bold text-[#292929]' : 'border-slate-200 bg-white'
                      }`}
                  >
                    <input
                      type="radio"
                      name="ruleScope"
                      checked={ruleTarget === 'customerType'}
                      onChange={() => setRuleTarget('customerType')}
                      className="text-[#F47732]"
                    />
                    <span>Customer Type</span>
                  </label>

                  <label
                    className={`flex items-center gap-1.5 p-2 rounded-lg border cursor-pointer ${ruleTarget === 'retailer' ? 'border-[#F47732] bg-[#FFF8F3] font-bold text-[#292929]' : 'border-slate-200 bg-white'
                      }`}
                  >
                    <input
                      type="radio"
                      name="ruleScope"
                      checked={ruleTarget === 'retailer'}
                      onChange={() => setRuleTarget('retailer')}
                      className="text-[#F47732]"
                    />
                    <span>Customer ID</span>
                  </label>
                </div>

                {/* Sub selector according to target */}
                <div className="mt-2.5">
                  {ruleTarget === 'pricingGroup' && (
                    <CustomSelect
                      value={rulePricingGroupId}
                      onChange={(val) => setRulePricingGroupId(val)}
                      placeholder="Select Pricing Group..."
                      options={[
                        { value: '', label: 'Select Pricing Group...' },
                        ...pricingGroups.map((g) => ({ value: g.id || g._id, label: g.name })),
                      ]}
                    />
                  )}

                  {ruleTarget === 'customerType' && (
                    <CustomSelect
                      value={ruleCustomerType}
                      onChange={(val) => setRuleCustomerType(val as CustomerType)}
                      options={[
                        { value: CustomerType.WHOLESALER, label: 'Wholesaler (Default)' },
                        { value: CustomerType.DISTRIBUTOR, label: 'Distributor' },
                        { value: CustomerType.RETAILER, label: 'Retailer' },
                      ]}
                    />
                  )}

                  {ruleTarget === 'retailer' && (
                    <input
                      type="text"
                      placeholder="Enter customer retailer ID (from Customer Management)"
                      value={ruleRetailerId}
                      onChange={(e) => setRuleRetailerId(e.target.value)}
                      className="w-full px-3 py-2 border border-[#F0E0D5] rounded-lg font-mono"
                    />
                  )}
                </div>
              </div>

              {/* Price Override & MOQ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Fixed Override (₹ INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 180.00"
                    value={ruleBasePriceINR}
                    onChange={(e) => setRuleBasePriceINR(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-[#F0E0D5] rounded-lg font-semibold"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Fixed unit price</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">OR Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 5"
                    value={ruleDiscountPercent}
                    onChange={(e) => setRuleDiscountPercent(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-[#F0E0D5] rounded-lg font-semibold"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">% off base dealer rate</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Min Order Qty (MOQ)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={ruleMinQuantity}
                    onChange={(e) => setRuleMinQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-[#F0E0D5] rounded-lg font-semibold"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Minimum units required</p>
                </div>
              </div>

              {/* Quantity Tier Pricing Slabs */}
              <div className="pt-2 border-t border-[#F0E0D5]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700 uppercase tracking-wider">
                    Volume Tier Pricing Slabs (e.g. 10–49: ₹180, 50+: ₹170)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddTierSlab}
                    className="text-xs font-bold text-[#F47732] hover:text-[#E95B2A] flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Volume Slab
                  </button>
                </div>

                {ruleTierPricing.length === 0 ? (
                  <p className="text-slate-400 italic bg-[#FFF8F3]/50 p-2.5 rounded-lg border border-dashed border-[#F0E0D5]">
                    No volume slabs configured. The rule will apply flat across all eligible order quantities.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ruleTierPricing.map((slab, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-center gap-2 bg-[#FFF8F3]/40 p-2 rounded-lg border border-[#F0E0D5]"
                      >
                        <div className="w-24">
                          <label className="text-[9px] text-slate-500 font-bold block">Min Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={slab.minQuantity}
                            onChange={(e) => {
                              const updated = [...ruleTierPricing];
                              updated[sIdx].minQuantity = parseInt(e.target.value, 10) || 1;
                              setRuleTierPricing(updated);
                            }}
                            className="w-full px-2 py-1 border border-[#F0E0D5] rounded font-mono font-bold"
                          />
                        </div>
                        <div className="w-24">
                          <label className="text-[9px] text-slate-500 font-bold block">Max Qty (Opt)</label>
                          <input
                            type="number"
                            placeholder="∞"
                            value={slab.maxQuantity ?? ''}
                            onChange={(e) => {
                              const updated = [...ruleTierPricing];
                              updated[sIdx].maxQuantity = e.target.value ? parseInt(e.target.value, 10) : undefined;
                              setRuleTierPricing(updated);
                            }}
                            className="w-full px-2 py-1 border border-[#F0E0D5] rounded font-mono"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[9px] text-slate-500 font-bold block">Slab Price (₹ INR)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="180.00"
                            value={slab.unitPriceINR || ''}
                            onChange={(e) => {
                              const updated = [...ruleTierPricing];
                              updated[sIdx].unitPriceINR = parseFloat(e.target.value) || 0;
                              setRuleTierPricing(updated);
                            }}
                            className="w-full px-2 py-1 border border-[#F0E0D5] rounded font-mono font-bold text-[#E95B2A]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTierSlab(sIdx)}
                          className="text-slate-400 hover:text-rose-600 p-1 mt-3"
                          title="Remove slab"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#F0E0D5]">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 border border-[#F0E0D5] text-slate-700 rounded-lg hover:bg-[#FFF8F3]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white font-bold rounded-lg shadow-xs"
                >
                  Save Pricing Rule
                </button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </div>
  );
};
