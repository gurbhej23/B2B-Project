import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, getMediaUrl } from '../../lib/api';
import { useCart } from '../../lib/cart-context';
import { useAuth } from '../../lib/auth-context';
import { IProduct, formatPaiseToINR } from '@necessity/shared';
import {
  Search,
  Filter,
  ShoppingCart,
  Plus,
  Minus,
  Check,
  Package,
  Lock,
  Clock,
  AlertCircle,
} from 'lucide-react';

export const ProductCatalogueScreen: React.FC = () => {
  const { addItem, openCart } = useCart();
  const { retailer, user } = useAuth();
  const isPending = user?.accountStatus === 'pending' || (retailer && (retailer as any).accountStatus === 'pending');

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [addedItemIds, setAddedItemIds] = useState<Record<string, boolean>>({});

  // 1. Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await apiClient.get('/products/categories');
      return res.data.data;
    },
  });

  // 2. Fetch Products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', search, selectedCategory, inStockOnly],
    queryFn: async () => {
      const params: any = {};
      if (search) params.search = search;
      if (selectedCategory) params.categoryId = selectedCategory;
      if (inStockOnly) params.inStockOnly = true;

      const res = await apiClient.get('/products', { params });
      return res.data;
    },
  });

  const products: IProduct[] = productsData?.data || [];

  const getQuantityForProduct = (product: IProduct) => {
    return selectedQuantities[product.id] || product.minOrderQuantity || 1;
  };

  const handleStepQuantity = (product: IProduct, delta: number) => {
    const current = getQuantityForProduct(product);
    const step = product.orderQuantityMultiple || 1;
    const min = product.minOrderQuantity || 1;
    const next = Math.max(min, current + delta * step);

    setSelectedQuantities((prev) => ({
      ...prev,
      [product.id]: next,
    }));
  };

  const handleAddToCart = (product: IProduct) => {
    if (isPending || (product as any).isPriceLocked) return;
    const qty = getQuantityForProduct(product);
    addItem(product, qty);

    setAddedItemIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedItemIds((prev) => ({ ...prev, [product.id]: false }));
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Pending Account Notice Banner */}
      {isPending && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded">
                  Pending Verification
                </span>
                <span className="text-xs font-semibold text-amber-900">Catalogue Preview Mode</span>
              </div>
              <p className="text-xs text-amber-700 mt-0.5">
                Your wholesale account is currently under administrator review. Pricing and ordering are locked until business details and GST are verified.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-800 bg-white/80 border border-amber-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
            <Lock className="h-3.5 w-3.5" />
            <span>Prices & Cart Restricted</span>
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white text-[#292929] rounded-2xl p-6 shadow-sm border border-[#F0E0D5]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="hidden lg:block">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs bg-[#FFF1E8] text-[#E95B2A] border border-[#F0E0D5] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Wholesale Catalogue
              </span>
              <span className="text-xs text-[#737373]">GST-Registered B2B Pricing</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[#292929]">
              Institutional Linens, Napkins & Sanitation Supplies
            </h1>
            <p className="text-xs text-[#737373] mt-1 max-w-2xl">
              Authoritative dealer prices in integer paise. Minimum order quantities and
              pack size multiples are enforced at checkout.
            </p>
          </div>

          {retailer && !isPending && (
            <button
              onClick={openCart}
              className="px-4 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white font-bold rounded-lg transition-colors flex items-center space-x-2 shadow-sm shadow-[#F47732]/20 text-xs sm:text-sm"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>View Cart</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-xl border border-[#F0E0D5] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="w-full text-xs pl-9 pr-4 py-2 border border-[#F0E0D5] rounded-lg bg-white text-[#292929] focus:outline-none focus:border-[#F47732] focus:ring-1 focus:ring-[#F47732]"
            />
          </div>

          <label className="flex items-center space-x-2 text-xs font-medium text-[#292929] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="rounded text-[#F47732] focus:ring-[#F47732] border-[#F0E0D5]"
            />
            <span>In-Stock Only</span>
          </label>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto touch-scroll no-scrollbar pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap ${selectedCategory === ''
              ? 'bg-[#F47732] text-white shadow-sm'
              : 'bg-[#FFF8F3] text-[#737373] hover:text-[#F47732] border border-[#F0E0D5]'
              }`}
          >
            All Categories ({products.length})
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat._id}
              onClick={() => setSelectedCategory(cat._id)}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap ${selectedCategory === cat._id
                ? 'bg-[#F47732] text-white shadow-sm'
                : 'bg-[#FFF8F3] text-[#737373] hover:text-[#F47732] border border-[#F0E0D5]'
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-[#F0E0D5] p-4 space-y-3 animate-pulse"
            >
              <div className="h-44 bg-[#FFF8F3] rounded-lg" />
              <div className="h-4 bg-[#FFF1E8] rounded w-3/4" />
              <div className="h-3 bg-[#FFF8F3] rounded w-1/2" />
              <div className="h-8 bg-[#FFF1E8] rounded mt-4" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#F0E0D5] p-12 text-center">
          <Package className="h-12 w-12 text-[#F0E0D5] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#292929]">No products found</h3>
          <p className="text-xs text-[#737373] mt-1 max-w-sm mx-auto">
            Try adjusting your search query or selecting a different category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const availableStock = product.availableStock ?? 0;
            const isOutOfStock = availableStock <= 0;
            const isLowStock = availableStock > 0 && availableStock <= product.lowStockThreshold;
            const quantity = getQuantityForProduct(product);
            const isAdded = addedItemIds[product.id];
            const isPriceLocked = isPending || (product as any).isPriceLocked;
            const effectivePrice = (product as any).effectiveBuyerPricePaise || product.dealerPricePaise;
            const tierDiscount = (product as any).appliedTierDiscountPercent || 0;

            return (
              <div
                key={product.id}
                className="bg-white rounded-xl border border-[#F0E0D5] hover:border-[#F47732] shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group"
              >
                {/* Image Container */}
                <div className="relative h-48 bg-[#FFF8F3]/50 overflow-hidden">
                  <img
                    src={
                      getMediaUrl(product.images?.[0]?.url) ||
                      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=600&auto=format&fit=crop'
                    }
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=600&auto=format&fit=crop';
                    }}
                  />
                  {/* Category Pill */}
                  <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm text-[#292929] border border-[#F0E0D5] text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                    {product.categoryName || 'General Supply'}
                  </div>

                  {/* Stock Badge */}
                  <div className="absolute top-2 right-2">
                    {isOutOfStock ? (
                      <span className="bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        Out of Stock
                      </span>
                    ) : isLowStock ? (
                      <span className="bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        Low: {availableStock} left
                      </span>
                    ) : (
                      <span className="bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        {availableStock} In Stock
                      </span>
                    )}
                  </div>

                  {/* Video Badge if available */}
                  {(product as any).videos && (product as any).videos.length > 0 && (
                    <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs">
                      <span>🎬</span>
                      <span>{(product as any).videos.length} {(product as any).videos.length === 1 ? 'Video' : 'Videos'}</span>
                    </div>
                  )}
                </div>

                {/* Card Details */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center space-x-2 text-[11px] text-[#737373] mb-1">
                    <span className="font-mono font-medium text-[#292929]">{product.sku}</span>
                  </div>

                  <h3 className="text-sm font-bold text-[#292929] line-clamp-2 leading-snug group-hover:text-[#F47732] transition-colors">
                    {product.name}
                  </h3>

                  <p className="text-xs text-[#737373] line-clamp-2 mt-1 mb-3">
                    {product.description}
                  </p>

                  <div className="mt-auto pt-3 border-t border-[#F0E0D5]/60">
                    {/* Packaging specs */}
                    <div className="flex items-center justify-between text-[11px] text-[#737373] mb-2">
                      <span>Pack: {product.packSize} {product.uom}</span>
                    </div>

                    {/* Pricing */}
                    {isPriceLocked ? (
                      <div className="mb-3">
                        <div className="flex items-center space-x-1.5 py-1 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 rounded-lg text-xs font-semibold">
                          <Lock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                          <span>Price Locked (Pending Verification)</span>
                        </div>
                        <p className="text-[10px] text-[#737373] mt-1">Wholesale pricing visible after approval</p>
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-between mb-3">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-base font-bold text-[#292929]">
                              {formatPaiseToINR(effectivePrice)}
                            </span>
                            {tierDiscount > 0 && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                                {tierDiscount}% Off
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#737373]"> / {product.uom}</span>
                        </div>
                        {product.mrpPaise > effectivePrice && (
                          <span className="text-xs text-[#737373] line-through">
                            MRP: {formatPaiseToINR(product.mrpPaise)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Quantity Selector & Add Button */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-[#FFF8F3]/60 p-1.5 rounded-lg border border-[#F0E0D5]">
                        <span className="text-[11px] text-[#737373] pl-1 font-medium">
                          Min: {product.minOrderQuantity}
                        </span>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleStepQuantity(product, -1)}
                            disabled={isPriceLocked || quantity <= product.minOrderQuantity}
                            className="p-1 rounded bg-white hover:bg-[#FFF8F3] hover:text-[#F47732] border border-[#F0E0D5] disabled:opacity-40 text-[#292929] shadow-sm transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2 text-xs font-bold text-[#292929] min-w-[28px] text-center">
                            {quantity}
                          </span>
                          <button
                            onClick={() => handleStepQuantity(product, 1)}
                            disabled={isPriceLocked || isOutOfStock || quantity >= availableStock}
                            className="p-1 rounded bg-white hover:bg-[#FFF8F3] hover:text-[#F47732] border border-[#F0E0D5] disabled:opacity-40 text-[#292929] shadow-sm transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {isPriceLocked ? (
                        <button
                          disabled
                          className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 cursor-not-allowed flex items-center justify-center space-x-1.5 shadow-sm"
                        >
                          <Lock className="h-3.5 w-3.5 text-amber-600" />
                          <span>Approval Required to Order</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={isOutOfStock}
                          className={`w-full py-2 px-3 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5 ${isAdded
                            ? 'bg-emerald-600 text-white'
                            : isOutOfStock
                              ? 'bg-[#F0E0D5]/40 text-[#737373] cursor-not-allowed'
                              : 'bg-[#F47732] hover:bg-[#E95B2A] text-white shadow-sm shadow-[#F47732]/20'
                            }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Added to Cart!</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="h-3.5 w-3.5" />
                              <span>Add {quantity} {product.uom} to Cart</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
