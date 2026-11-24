import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi, extractErrorMessage, getMediaUrl } from '../../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { formatPaiseToINR } from '@necessity/shared';
import { Product, Category } from '../../types/models';
import { colors } from '../../theme/colors';
import { Icon } from '../../components/common/Icon';
import { ProductCardSkeleton } from '../../components/common/Skeleton';

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { retailer, user, isWholesaler, isDistributor, isRetailer, refreshProfile } = useAuth();
  const { addToCart, itemCount } = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [catRes, prodRes] = await Promise.all([
        mobileApi.get('/products/categories'),
        mobileApi.get('/products?limit=10&sortBy=createdAt&sortOrder=desc'),
        refreshProfile().catch(() => { }),
      ]);

      if (catRes.success) {
        const mappedCats = (catRes.data || []).map((c: any) => ({
          ...c,
          id: c.id || c._id,
        }));
        setCategories(mappedCats);
      }
      if (prodRes.success) {
        setFeaturedProducts(prodRes.data || []);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [refreshProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleSearchSubmit = () => {
    const q = searchQuery.trim();
    if (q) {
      navigation.navigate('CatalogueTab', { searchQuery: q });
    }
  };

  const handleAddToCart = (product: Product) => {
    const prodId = product.id || (product as any)._id;
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      navigation.navigate('ProductDetails', { productId: prodId });
    } else {
      addToCart(product, product.minOrderQuantity || 1);
      setAddedProductId(prodId);
      setTimeout(() => {
        setAddedProductId((current) => (current === prodId ? null : current));
      }, 1500);
    }
  };

  const customerCode =
    (retailer as any)?.retailerCode ||
    (retailer as any)?.customerCode ||
    (retailer?.id ? `CUST-${retailer.id.slice(-5).toUpperCase()}` : 'CUST-B2B');

  const customerTypeLabel = isDistributor
    ? 'Distributor'
    : isWholesaler
      ? 'Wholesaler'
      : 'Retailer';
  return (
    <View style={[styles.screenContainer, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Top Application Header */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../../assets/img.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.brandTextGroup}>
            <Text style={styles.brandName}>NECESSITY INDIA</Text>
            <Text style={styles.brandSub}>Wholesale B2B Marketplace</Text>
          </View>
        </View>

        {/* Live Cart Action */}
        <TouchableOpacity
          style={styles.cartHeaderBtn}
          onPress={() => navigation.navigate('CartTab')}
          activeOpacity={0.75}
          accessibilityLabel="View Cart"
        >
          <Icon name="cart" size={20} color={colors.textPrimary} strokeWidth={2} />
          {itemCount > 0 && (
            <View style={styles.cartBadgeCount}>
              <Text style={styles.cartBadgeText}>{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Customer Greeting & Verification Badge */}
        <View style={styles.greetingCard}>
          <View style={styles.greetingLeft}>
            <View style={styles.nameRow}>
              <Text style={styles.greetingTitle}>
                Hello, {user?.name ? user.name.split(' ')[0] : retailer?.businessName || 'Partner'}
              </Text>
              <View style={styles.verifiedBadge}>
                <View style={styles.verifiedDot}>
                  <Icon name="check" size={8} color={colors.white} strokeWidth={2} />
                </View>
                <Text style={styles.verifiedText}>{customerTypeLabel}</Text>
              </View>
            </View>
            <View style={styles.idRow}>
              <Text style={styles.codeText}>ID: {customerCode}</Text>
            </View>
          </View>
          {retailer?.businessName ? (
            <Text style={styles.businessNameTag} numberOfLines={1}>
              {retailer.businessName}
            </Text>
          ) : null}
        </View>

        {/* Modern Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Icon name="search" size={17} color={colors.textSecondary} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products by SKU, name, or brand..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                <Icon name="close" size={13} color={colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Hero Promotional Banner */}
        <View style={styles.promoBanner}>
          <View style={styles.promoLeft}>
            <Text style={styles.promoHeading}>Quality Products. Better Wholesale Prices.</Text>
            <Text style={styles.promoSubtext}>
              Institutional towels, dispensers, and cleaning supplies at certified dealer pricing.
            </Text>
          </View>
          <View style={styles.promoRight}>
            <Image
              source={require('../../../assets/img.png')}
              style={styles.promoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Product Categories Horizontal Strip */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Product Categories</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CatalogueTab')}
              style={styles.seeAllBtn}
            >
              <Text style={styles.seeAllText}>View All Catalogue</Text>
              <Icon name="chevron-right" size={12} color={colors.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContent}
          >
            <TouchableOpacity
              style={[styles.categoryChip, styles.activeCategoryChip]}
              onPress={() => navigation.navigate('CatalogueTab')}
            >
              <Text style={[styles.categoryChipText, styles.activeCategoryChipText]}>
                All Products
              </Text>
            </TouchableOpacity>

            {categories.map((cat, idx) => (
              <TouchableOpacity
                key={cat.id || (cat as any)._id || `cat-${idx}`}
                style={styles.categoryChip}
                onPress={() =>
                  navigation.navigate('CatalogueTab', { categoryId: cat.id || (cat as any)._id })
                }
              >
                <Text style={styles.categoryChipText}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured Products Grid */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>Featured Wholesale Products</Text>
              {featuredProducts.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{featuredProducts.length}</Text>
                </View>
              )}
            </View>
          </View>

          {isLoading ? (
            <View style={styles.gridContainer}>
              <ProductCardSkeleton />
              <ProductCardSkeleton />
              <ProductCardSkeleton />
              <ProductCardSkeleton />
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={loadData} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Retry Loading</Text>
              </TouchableOpacity>
            </View>
          ) : featuredProducts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="box" size={36} color={colors.textSecondary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No Products Found</Text>
              <Text style={styles.emptySubtitle}>Check back shortly for new catalog arrivals.</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {featuredProducts.map((product) => {
                const prodId = product.id || (product as any)._id;
                const primaryImg =
                  product.images?.find((img) => img.isPrimary) || product.images?.[0];
                const availableStock = Math.max(
                  0,
                  (product.stockOnHand || 0) - (product.stockReserved || 0)
                );
                const isLowStock =
                  availableStock > 0 && availableStock <= (product.lowStockThreshold || 10);
                const isOutOfStock = availableStock <= 0;
                const isAddedJustNow = addedProductId === prodId;

                const dealerPrice = product.dealerPricePaise;
                const mrp = product.mrpPaise;
                const marginPercent =
                  mrp > dealerPrice ? Math.round(((mrp - dealerPrice) / mrp) * 100) : 0;

                return (
                  <TouchableOpacity
                    key={prodId}
                    style={styles.productCard}
                    activeOpacity={0.9}
                    onPress={() =>
                      navigation.navigate('ProductDetails', {
                        productId: prodId,
                      })
                    }
                  >
                    {/* Image Area */}
                    <View style={styles.imageBox}>
                      {primaryImg?.url ? (
                        <Image
                          source={{ uri: getMediaUrl(primaryImg.url) }}
                          style={styles.productImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.imageFallback}>
                          <Icon name="box" size={32} color={colors.textSecondary} strokeWidth={1.5} />
                        </View>
                      )}

                      {/* Stock Pill Badge */}
                      <View
                        style={[
                          styles.stockPill,
                          isOutOfStock
                            ? styles.outOfStockPill
                            : isLowStock
                              ? styles.lowStockPill
                              : styles.inStockPill,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stockPillText,
                            isOutOfStock
                              ? styles.outOfStockText
                              : isLowStock
                                ? styles.lowStockText
                                : styles.inStockText,
                          ]}
                        >
                          {isOutOfStock
                            ? 'Sold Out'
                            : isLowStock
                              ? `Low: ${availableStock}`
                              : 'In Stock'}
                        </Text>
                      </View>
                    </View>

                    {/* Product Details */}
                    <View style={styles.productInfo}>
                      <Text style={styles.brandText} numberOfLines={1}>
                        {product.brand || 'NECESSITY INDIA'}
                      </Text>

                      <Text style={styles.nameText} numberOfLines={2}>
                        {product.name}
                      </Text>

                      <Text style={styles.skuText} numberOfLines={1}>
                        SKU: {product.sku}
                      </Text>

                      {/* Pricing Block */}
                      <View style={styles.priceContainer}>
                        <View>
                          <Text style={styles.priceLabel}>DEALER PRICE</Text>
                          <Text style={styles.dealerPriceText}>
                            {formatPaiseToINR(dealerPrice)}
                          </Text>
                        </View>
                        {mrp > dealerPrice && (
                          <View style={styles.mrpContainer}>
                            <Text style={styles.mrpLabel}>MRP</Text>
                            <Text style={styles.mrpText}>{formatPaiseToINR(mrp)}</Text>
                          </View>
                        )}
                      </View>

                      {/* Retail Margin Tag */}
                      {marginPercent > 0 && (
                        <View style={styles.marginTag}>
                          <Text style={styles.marginTagText}>
                            {marginPercent}% Retail Margin
                          </Text>
                        </View>
                      )}

                      {/* MOQ & Variants info */}
                      <View style={styles.specRow}>
                        <Text style={styles.moqText}>
                          MOQ: {product.minOrderQuantity || 1} {product.uom || 'PCS'}
                        </Text>
                        {product.hasVariants && product.variants && product.variants.length > 0 && (
                          <Text style={styles.variantBadge}>
                            {product.variants.length} Options
                          </Text>
                        )}
                      </View>

                      {/* Add to Cart CTA */}
                      <TouchableOpacity
                        style={[
                          styles.addCartBtn,
                          isOutOfStock && styles.disabledBtn,
                          isAddedJustNow && styles.addedBtn,
                        ]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        disabled={isOutOfStock}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.addCartBtnText,
                            isAddedJustNow && styles.addedBtnText,
                          ]}
                        >
                          {isAddedJustNow
                            ? '✓ Added to Cart'
                            : isOutOfStock
                              ? 'Out of Stock'
                              : product.hasVariants &&
                                product.variants &&
                                product.variants.length > 0
                                ? 'Select Options'
                                : '+ Add to Cart'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLogo: {
    width: 68,
    height: 36,
    marginRight: 8,
  },
  brandTextGroup: {
    flex: 1,
  },
  brandName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  brandSub: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  cartHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    position: 'relative',
  },
  cartBadgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  cartBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  greetingCard: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingLeft: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  greetingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 8,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successBg,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  verifiedDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  codeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  businessNameTag: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: '40%',
  },
  searchSection: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    marginLeft: 10,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 6,
  },
  promoBanner: {
    backgroundColor: colors.primaryBg,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  promoLeft: {
    flex: 1,
    paddingRight: 12,
  },
  bannerTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  bannerTagText: {
    color: colors.white,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  promoHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 18,
    marginBottom: 4,
  },
  promoSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
    marginBottom: 12,
  },
  promoRight: {
    width: 105,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoImage: {
    width: '100%',
    height: '100%',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  quickActionItem: {
    width: '23%',
    alignItems: 'center',
  },
  actionIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
    marginRight: 4,
  },
  categoryScrollContent: {
    paddingRight: 8,
  },
  categoryChip: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeCategoryChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activeCategoryChipText: {
    color: colors.white,
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
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
    height: 124,
    backgroundColor: colors.highlightBg,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  stockPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  inStockPill: {
    backgroundColor: colors.successBg,
    borderWidth: 0.5,
    borderColor: colors.successBorder,
  },
  inStockText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: '700',
  },
  lowStockPill: {
    backgroundColor: colors.warningBg,
    borderWidth: 0.5,
    borderColor: colors.warningBorder,
  },
  lowStockText: {
    color: colors.warning,
    fontSize: 9,
    fontWeight: '700',
  },
  outOfStockPill: {
    backgroundColor: colors.dangerBg,
    borderWidth: 0.5,
    borderColor: colors.dangerBorder,
  },
  outOfStockText: {
    color: colors.danger,
    fontSize: 9,
    fontWeight: '700',
  },
  productInfo: {
    padding: 10,
  },
  brandText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
    lineHeight: 17,
    minHeight: 34,
  },
  skuText: {
    fontSize: 10,
    color: colors.slate400,
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
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  dealerPriceText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  mrpContainer: {
    alignItems: 'flex-end',
  },
  mrpLabel: {
    fontSize: 8,
    color: colors.slate400,
    fontWeight: '600',
  },
  mrpText: {
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
  specRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  moqText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
    marginRight: 6,
  },
  variantBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  addCartBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCartBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  addedBtn: {
    backgroundColor: colors.success,
  },
  addedBtnText: {
    color: colors.white,
  },
  disabledBtn: {
    backgroundColor: colors.slate300,
    opacity: 0.6,
  },
  errorBox: {
    padding: 16,
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryBtn: {
    backgroundColor: colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
