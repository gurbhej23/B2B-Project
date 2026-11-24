import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { mobileApi, extractErrorMessage, getMediaUrl } from '../../../lib/api';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { formatPaiseToINR } from '@necessity/shared';
import { Product, Category } from '../../types/models';
import { colors } from '../../theme/colors';
import { Icon } from '../../components/common/Icon';
import { ProductCardSkeleton } from '../../components/common/Skeleton';
import { FilterModal } from './components/FilterModal';

const SORT_OPTIONS = [
  { label: 'Popular / Newest', sortBy: 'createdAt', sortOrder: 'desc' },
  { label: 'Price: Low to High', sortBy: 'dealerPricePaise', sortOrder: 'asc' },
  { label: 'Price: High to Low', sortBy: 'dealerPricePaise', sortOrder: 'desc' },
  { label: 'Name: A-Z', sortBy: 'name', sortOrder: 'asc' },
];

export const CatalogueScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { addToCart } = useCart();
  const { isPendingApproval, isWholesaler, isDistributor, isRetailer } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    route.params?.categoryId || null
  );
  const [searchQuery, setSearchQuery] = useState<string>(route.params?.searchQuery || '');
  const [sortIndex, setSortIndex] = useState<number>(0);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState<boolean>(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  // Sync route params changes
  useEffect(() => {
    if (route.params?.categoryId !== undefined) {
      setSelectedCategoryId(route.params.categoryId);
    }
    if (route.params?.searchQuery !== undefined) {
      setSearchQuery(route.params.searchQuery);
    }
  }, [route.params]);

  // Load categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await mobileApi.get('/products/categories');
        if (res.success) {
          const mapped = (res.data || []).map((c: any) => ({
            ...c,
            id: c.id || c._id,
          }));
          setCategories(mapped);
        }
      } catch {
        // ignore category load errors
      }
    }
    loadCategories();
  }, []);

  const fetchProducts = useCallback(
    async (targetPage = 1, shouldAppend = false) => {
      setError(null);
      if (targetPage === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const currentSort = SORT_OPTIONS[sortIndex];
        const params: Record<string, any> = {
          page: targetPage,
          limit: 14,
          sortBy: currentSort.sortBy,
          sortOrder: currentSort.sortOrder,
        };

        if (selectedCategoryId) {
          params.categoryId = selectedCategoryId;
        }

        const cleanSearch = searchQuery.trim();
        if (cleanSearch) {
          params.search = cleanSearch;
        }

        if (inStockOnly) {
          params.inStock = 'true';
        }

        const queryStr = Object.entries(params)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&');

        const res = await mobileApi.get(`/products?${queryStr}`);
        const items: Product[] = res.data || [];
        const pagination = (res as any).pagination || {};

        if (shouldAppend) {
          setProducts((prev) => [...prev, ...items]);
        } else {
          setProducts(items);
        }

        setPage(targetPage);
        setHasMore(items.length === 14 && (!pagination.pages || targetPage < pagination.pages));
      } catch (err: any) {
        setError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    },
    [selectedCategoryId, searchQuery, sortIndex, inStockOnly]
  );

  useEffect(() => {
    fetchProducts(1, false);
  }, [fetchProducts]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchProducts(1, false);
  };

  const onEndReached = () => {
    if (!isLoading && !isLoadingMore && hasMore) {
      fetchProducts(page + 1, true);
    }
  };

  const handleAddToCart = (product: Product) => {
    const prodId = product.id || (product as any)._id;
    if ((product as any).isPriceLocked || isPendingApproval) {
      navigation.navigate('PendingApproval');
      return;
    }
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      navigation.navigate('ProductDetails', { productId: prodId });
    } else {
      addToCart(product, product.minOrderQuantity || 1);
      setAddedProductId(prodId);
      setTimeout(() => {
        setAddedProductId((curr) => (curr === prodId ? null : curr));
      }, 1500);
    }
  };

  const activeFilterCount =
    (selectedCategoryId ? 1 : 0) + (inStockOnly ? 1 : 0) + (sortIndex > 0 ? 1 : 0);

  const renderProductItem = ({ item }: { item: Product }) => {
    const prodId = item.id || (item as any)._id;
    const primaryImg = item.images?.find((img) => img.isPrimary) || item.images?.[0];
    const availableStock = Math.max(0, (item.stockOnHand || 0) - (item.stockReserved || 0));
    const isLowStock = availableStock > 0 && availableStock <= (item.lowStockThreshold || 10);
    const isOutOfStock = availableStock <= 0;
    const isPriceLocked = (item as any).isPriceLocked || isPendingApproval;
    const isAddedJustNow = addedProductId === prodId;

    const dealerPrice = item.activeDiscount
      ? item.activeDiscount.discountedPricePaise
      : (item as any).effectiveBuyerPricePaise || item.dealerPricePaise;
    const mrp = item.mrpPaise;
    const marginPercent = mrp > dealerPrice ? Math.round(((mrp - dealerPrice) / mrp) * 100) : 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('ProductDetails', { productId: prodId })}
      >
        <View style={styles.imageBox}>
          {primaryImg?.url ? (
            <Image
              source={{ uri: getMediaUrl(primaryImg.url) }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImageBox}>
              <Icon name="box" size={32} color={colors.textSecondary} strokeWidth={1.5} />
            </View>
          )}

          {/* Stock Badge */}
          <View
            style={[
              styles.stockBadge,
              isOutOfStock
                ? styles.outOfStockBadge
                : isLowStock
                ? styles.lowStockBadge
                : styles.inStockBadge,
            ]}
          >
            <Text
              style={[
                styles.stockBadgeText,
                isOutOfStock
                  ? styles.outOfStockText
                  : isLowStock
                  ? styles.lowStockText
                  : styles.inStockText,
              ]}
            >
              {isOutOfStock ? 'Sold Out' : isLowStock ? `Low: ${availableStock}` : 'In Stock'}
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.brand} numberOfLines={1}>
            {item.brand || 'NECESSITY INDIA'}
          </Text>

          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>

          <Text style={styles.sku}>SKU: {item.sku}</Text>

          {isPriceLocked ? (
            <View style={styles.lockedPriceContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="lock" size={12} color={colors.primary} strokeWidth={1.5} />
                <Text style={styles.lockedPriceBadge}> Prices Locked</Text>
              </View>
              <Text style={styles.lockedPriceSubtext}>Pending admin verification</Text>
            </View>
          ) : (
            <View style={styles.priceContainer}>
              <View>
                <Text style={styles.priceLabel}>
                  {(item as any).buyerCustomerType
                    ? `WHOLESALE (${String((item as any).buyerCustomerType).toUpperCase()})`
                    : 'WHOLESALE RATE'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
                  <Text style={styles.dealerPrice}>{formatPaiseToINR(dealerPrice)}</Text>
                  {item.activeDiscount && (
                    <Text style={styles.strikeWholesalePrice}>
                      {formatPaiseToINR(
                        (item as any).effectiveBuyerPricePaise || item.dealerPricePaise
                      )}
                    </Text>
                  )}
                </View>
              </View>

              {mrp > dealerPrice && (
                <View style={styles.mrpContainer}>
                  <Text style={styles.mrpLabel}>MRP</Text>
                  <Text style={styles.mrp}>{formatPaiseToINR(mrp)}</Text>
                </View>
              )}
            </View>
          )}

          {marginPercent > 0 && !isPriceLocked && (
            <View style={styles.marginTag}>
              <Text style={styles.marginTagText}>{marginPercent}% Retail Margin</Text>
            </View>
          )}

          <View style={styles.specsRow}>
            <Text style={styles.specBadge}>
              MOQ: {item.minOrderQuantity || 1} {item.uom || 'PCS'}
            </Text>
            {item.packSize > 1 && <Text style={styles.specBadge}>Pack: {item.packSize}</Text>}
            {item.hasVariants && item.variants && item.variants.length > 0 && (
              <Text style={styles.variantSpecBadge}>{item.variants.length} Options</Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.addBtn,
              (isPriceLocked || isOutOfStock) && styles.disabledAddBtn,
              isAddedJustNow && styles.addedBtn,
            ]}
            disabled={isPriceLocked || isOutOfStock}
            onPress={(e) => {
              e.stopPropagation();
              handleAddToCart(item);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.addBtnText, isAddedJustNow && styles.addedBtnText]}>
              {isAddedJustNow
                ? '✓ Added'
                : isPriceLocked
                ? 'Approval Required'
                : isOutOfStock
                ? 'Sold Out'
                : item.hasVariants && item.variants && item.variants.length > 0
                ? 'Select Options'
                : '+ Add to Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search & Filter Header Strip */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Icon name="search" size={17} color={colors.textSecondary} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by SKU, product name, brand..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => fetchProducts(1, false)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Icon name="close" size={13} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Trigger Button with Active Count Badge */}
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.activeFilterBtn]}
          onPress={() => setIsFilterModalVisible(true)}
          activeOpacity={0.75}
        >
          <Icon
            name="filter"
            size={18}
            color={activeFilterCount > 0 ? colors.white : colors.textPrimary}
            strokeWidth={2}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Pricing Verification Status Banner */}
      {isPendingApproval ? (
        <TouchableOpacity
          style={styles.pendingBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PendingApproval')}
        >
          <View style={styles.pendingDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingTitle}>Account Pending Admin Verification</Text>
            <Text style={styles.pendingSubtitle}>
              Browsing in preview mode. Live rates & checkout unlock upon approval.
            </Text>
          </View>
          <Icon name="chevron-right" size={12} color={colors.primary} strokeWidth={2} />
        </TouchableOpacity>
      ) : (
        <View style={styles.verifiedBanner}>
          <View style={styles.verifiedDot}>
            <Icon name="check" size={8} color={colors.white} strokeWidth={2} />
          </View>
          <Text style={styles.verifiedBannerText}>
            {isDistributor
              ? 'Distributor Account: Direct supply pricing active'
              : isWholesaler
              ? 'Wholesaler Account: Bulk volume tier rates active'
              : 'Verified wholesale rates are active for your account'}
          </Text>
        </View>
      )}

      {/* Categories Horizontal Chip Selector */}
      <View style={styles.categoryBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: null, name: 'All Products' }, ...categories]}
          keyExtractor={(item, index) => {
            const catId = item.id || (item as any)._id;
            return catId ? String(catId) : `cat-pill-${index}`;
          }}
          renderItem={({ item }) => {
            const catId = (item.id || (item as any)._id || null) as string | null;
            const isSelected = selectedCategoryId === catId;
            return (
              <TouchableOpacity
                style={[styles.catPill, isSelected && styles.selectedCatPill]}
                onPress={() => setSelectedCategoryId(catId)}
              >
                <Text style={[styles.catPillText, isSelected && styles.selectedCatPillText]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.catPillsList}
        />
      </View>

      {/* Main Product Content */}
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
        </View>
      ) : error ? (
        <View style={styles.centerError}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchProducts(1, false)}>
            <Text style={styles.retryBtnText}>Retry Loading</Text>
          </TouchableOpacity>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyView}>
          <Icon name="box" size={44} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No Products Found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? `No wholesale items matched "${searchQuery}".`
              : 'No products match the selected filters.'}
          </Text>
          <TouchableOpacity
            style={styles.clearFilterBtn}
            onPress={() => {
              setSelectedCategoryId(null);
              setSearchQuery('');
              setInStockOnly(false);
              setSortIndex(0);
            }}
          >
            <Text style={styles.clearFilterBtnText}>Reset Filters & Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item, index) => String(item.id || (item as any)._id || index)}
          renderItem={renderProductItem}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={isFilterModalVisible}
        onClose={() => setIsFilterModalVisible(false)}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={(id) => setSelectedCategoryId(id)}
        inStockOnly={inStockOnly}
        onToggleInStockOnly={(val) => setInStockOnly(val)}
        sortIndex={sortIndex}
        onSelectSortIndex={(idx) => setSortIndex(idx)}
        sortOptions={SORT_OPTIONS}
        onApply={() => {
          setIsFilterModalVisible(false);
          fetchProducts(1, false);
        }}
        onClearAll={() => {
          setSelectedCategoryId(null);
          setInStockOnly(false);
          setSortIndex(0);
          setIsFilterModalVisible(false);
          fetchProducts(1, false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    marginLeft: 8,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 6,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeFilterBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primaryDark,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  filterBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  pendingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  pendingSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.successBorder,
    paddingHorizontal: 16,
    paddingVertical: 7,
    gap: 8,
  },
  verifiedDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
    flex: 1,
  },
  categoryBar: {
    backgroundColor: colors.white,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  catPillsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedCatPill: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  selectedCatPillText: {
    color: colors.white,
    fontWeight: '700',
  },
  skeletonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 12,
  },
  centerError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  clearFilterBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  clearFilterBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    padding: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  card: {
    width: '48.5%',
    backgroundColor: colors.white,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  imageBox: {
    height: 125,
    backgroundColor: colors.highlightBg,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noImageBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  stockBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  inStockBadge: {
    backgroundColor: colors.successBg,
    borderWidth: 0.5,
    borderColor: colors.successBorder,
  },
  inStockText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: '700',
  },
  lowStockBadge: {
    backgroundColor: colors.warningBg,
    borderWidth: 0.5,
    borderColor: colors.warningBorder,
  },
  lowStockText: {
    color: colors.warning,
    fontSize: 9,
    fontWeight: '700',
  },
  outOfStockBadge: {
    backgroundColor: colors.dangerBg,
    borderWidth: 0.5,
    borderColor: colors.dangerBorder,
  },
  outOfStockText: {
    color: colors.danger,
    fontSize: 9,
    fontWeight: '700',
  },
  infoBox: {
    padding: 10,
  },
  brand: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
    minHeight: 34,
    lineHeight: 17,
  },
  sku: {
    fontSize: 10,
    color: colors.slate400,
    marginTop: 2,
  },
  lockedPriceContainer: {
    marginTop: 6,
    backgroundColor: colors.primaryBg,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  lockedPriceBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
    marginLeft: 3,
  },
  lockedPriceSubtext: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  dealerPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  strikeWholesalePrice: {
    fontSize: 10,
    color: colors.slate400,
    textDecorationLine: 'line-through',
    marginLeft: 5,
    fontWeight: '600',
  },
  mrpContainer: {
    alignItems: 'flex-end',
  },
  mrpLabel: {
    fontSize: 8,
    color: colors.slate400,
    fontWeight: '600',
  },
  mrp: {
    fontSize: 10,
    color: colors.slate400,
    textDecorationLine: 'line-through',
  },
  marginTag: {
    backgroundColor: colors.successBg,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 5,
    borderWidth: 0.5,
    borderColor: colors.successBorder,
  },
  marginTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.success,
  },
  specsRow: {
    flexDirection: 'row',
    marginTop: 6,
    flexWrap: 'wrap',
    gap: 4,
  },
  specBadge: {
    fontSize: 10,
    color: colors.textSecondary,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  variantSpecBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  addBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addedBtn: {
    backgroundColor: colors.success,
  },
  disabledAddBtn: {
    backgroundColor: colors.slate300,
    opacity: 0.6,
  },
  addBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  addedBtnText: {
    color: colors.white,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
