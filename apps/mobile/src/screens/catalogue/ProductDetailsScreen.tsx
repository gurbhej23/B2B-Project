import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { mobileApi, extractErrorMessage, getMediaUrl } from '../../../lib/api';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { formatPaiseToINR, resolveTierPrice, getNextTierSavings } from '@necessity/shared';
import { Product, ProductVariant, TierPrice } from '../../types/models';
import { colors } from '../../theme/colors';
import { Icon } from '../../components/common/Icon';

export const ProductDetailsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addToCart } = useCart();
  const { isPendingApproval, isWholesaler, isDistributor, isRetailer, customerType } = useAuth();
  const productId = route.params?.productId;

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddedSuccess, setIsAddedSuccess] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await mobileApi.get(`/products/${productId}`);
        if (res.success && res.data) {
          const prod: Product = res.data;
          setProduct(prod);

          // Select first active variant if variants exist
          if (prod.hasVariants && prod.variants && prod.variants.length > 0) {
            const firstActive = prod.variants.find((v) => v.isActive) || prod.variants[0];
            setSelectedVariant(firstActive);
          } else {
            setSelectedVariant(null);
          }

          const moq = prod.minOrderQuantity || 1;
          setQuantity(moq);
        } else {
          throw new Error('Product not found');
        }
      } catch (err: any) {
        setError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  if (isLoading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centerText}>Loading wholesale specifications...</Text>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.errorText}>{error || 'Product not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Return to Catalogue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const moq = product.minOrderQuantity || 1;
  const step = product.orderQuantityMultiple || 1;

  // Determine stock on hand & availability
  const availableStock = selectedVariant
    ? Math.max(0, (selectedVariant.stockOnHand || 0) - (selectedVariant.stockReserved || 0))
    : Math.max(0, (product.stockOnHand || 0) - (product.stockReserved || 0));

  const isOutOfStock = availableStock <= 0;
  const isLowStock = availableStock > 0 && availableStock <= (product.lowStockThreshold || 10);

  // Images for display (variant images if present, otherwise product images)
  const images = (selectedVariant?.images && selectedVariant.images.length > 0
    ? selectedVariant.images
    : product.images) || [];
  const currentImage = images[selectedImageIndex] || images[0] || null;
  const videos = product.videos || [];

  // Pricing calculations
  const baseDealerPrice =
    selectedVariant?.dealerPricePaise !== undefined
      ? selectedVariant.dealerPricePaise
      : product.dealerPricePaise;

  const baseMrpPrice =
    selectedVariant?.mrpPaise !== undefined ? selectedVariant.mrpPaise : product.mrpPaise;

  // Active Quantity Tier Pricing
  const activeTiers: TierPrice[] =
    selectedVariant?.isTierPricingEnabled &&
    selectedVariant.tierPricing &&
    selectedVariant.tierPricing.length > 0
      ? selectedVariant.tierPricing
      : product.isTierPricingEnabled && product.tierPricing && product.tierPricing.length > 0
      ? product.tierPricing
      : [];

  const tierResolution =
    activeTiers.length > 0
      ? resolveTierPrice(activeTiers, quantity, baseDealerPrice)
      : { unitPricePaise: baseDealerPrice };

  const currentUnitPricePaise = tierResolution.unitPricePaise;
  const productDiscount = product.activeDiscount;
  const unitDiscountPaise = productDiscount
    ? productDiscount.discountType === 'percentage'
      ? Math.round(currentUnitPricePaise * (productDiscount.discountValue / 100))
      : Math.min(productDiscount.discountValue, currentUnitPricePaise)
    : 0;
  const effectiveProductPricePaise = Math.max(0, currentUnitPricePaise - unitDiscountPaise);

  const nextTierInfo =
    activeTiers.length > 0
      ? getNextTierSavings(activeTiers, quantity, currentUnitPricePaise)
      : null;

  const lineSubtotalPaise = effectiveProductPricePaise * quantity;

  const handleDecrease = () => {
    if (quantity - step >= moq) {
      setQuantity(quantity - step);
    } else {
      Alert.alert('Minimum Order Quantity', `Minimum order for this item is ${moq} units.`);
    }
  };

  const handleIncrease = () => {
    if (availableStock > 0 && quantity + step > availableStock) {
      Alert.alert('Stock Limit', `Only ${availableStock} units available in warehouse.`);
      return;
    }
    setQuantity(quantity + step);
  };

  const handleSelectVariant = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setSelectedImageIndex(0);
  };

  const handleAddToCart = () => {
    if ((product as any).isPriceLocked || isPendingApproval) {
      Alert.alert(
        'Account Verification Required',
        'Your wholesale account is pending approval by the administrator. Ordering and cart are disabled until verified.'
      );
      return;
    }

    if (product.hasVariants && !selectedVariant) {
      Alert.alert('Select Variant', 'Please select a size or pack variant before adding to order.');
      return;
    }

    if (isOutOfStock) {
      Alert.alert('Out of Stock', 'This variant is currently out of stock.');
      return;
    }

    if (quantity < moq) {
      Alert.alert('Minimum Order Quantity', `Please order at least ${moq} units.`);
      return;
    }

    addToCart(product, quantity, selectedVariant || undefined);
    setIsAddedSuccess(true);
    setTimeout(() => setIsAddedSuccess(false), 2500);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Image Display with Tap for Enlarged Preview */}
        <TouchableOpacity
          style={styles.galleryContainer}
          activeOpacity={0.9}
          onPress={() => currentImage?.url && setIsImagePreviewOpen(true)}
        >
          {currentImage?.url ? (
            <Image
              source={{ uri: getMediaUrl(currentImage.url) }}
              style={styles.mainImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.noImageBox}>
              <Icon name="box" size={36} color={colors.textSecondary} strokeWidth={1.5} />
              <Text style={styles.noImageText}>Wholesale Institutional Packaging</Text>
            </View>
          )}

          {/* Zoom Indicator */}
          {currentImage?.url && (
            <View style={styles.zoomHint}>
              <Icon name="search" size={12} color={colors.white} strokeWidth={2} style={{ marginRight: 4 }} />
              <Text style={styles.zoomHintText}>Tap to Enlarge</Text>
            </View>
          )}

          {/* Stock Tag */}
          <View
            style={[
              styles.floatingBadge,
              isOutOfStock
                ? styles.outOfStockBadge
                : isLowStock
                  ? styles.lowStockBadge
                  : styles.inStockBadge,
            ]}
          >
            <Text
              style={[
                styles.floatingBadgeText,
                isOutOfStock
                  ? styles.outOfStockText
                  : isLowStock
                    ? styles.lowStockText
                    : styles.inStockText,
              ]}
            >
              {isOutOfStock
                ? 'Out of Stock'
                : isLowStock
                  ? `Low Stock (${availableStock} left)`
                  : `In Stock (${availableStock} available)`}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Thumbnails row if multiple images or videos */}
        {(images.length > 1 || videos.length > 0) && (
          <ScrollView horizontal style={styles.thumbnailsRow} showsHorizontalScrollIndicator={false}>
            {images.map((img, idx) => (
              <TouchableOpacity
                key={`img-${idx}`}
                onPress={() => setSelectedImageIndex(idx)}
                style={[styles.thumbnail, selectedImageIndex === idx && styles.activeThumbnail]}
              >
                <Image source={{ uri: getMediaUrl(img.url) }} style={styles.thumbImage} resizeMode="cover" />
              </TouchableOpacity>
            ))}
            {videos.map((vid, vIdx) => (
              <TouchableOpacity
                key={`vid-${vIdx}`}
                onPress={() => {
                  const fullUrl = getMediaUrl(vid.url);
                  Linking.openURL(fullUrl).catch(() => {
                    Alert.alert('Unable to Open Video', 'Please ensure a valid video player or browser is installed.');
                  });
                }}
                style={[styles.thumbnail, styles.videoThumbPill]}
              >
                <View style={styles.videoThumbContent}>
                  <Text style={styles.videoThumbPlayIcon}>▶</Text>
                  <Text style={styles.videoThumbText}>Video {vIdx + 1}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Product Details Header */}
        <View style={styles.detailsHeader}>
          <Text style={styles.brandTag}>{product.brand || 'Necessity India'}</Text>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.skuText}>
            SKU: {selectedVariant ? selectedVariant.sku : product.sku}{' '}
            {product.productCode ? `• Code: ${product.productCode}` : ''}
          </Text>

          {/* Pricing Block */}
          {(product as any).isPriceLocked || isPendingApproval ? (
            <View style={styles.lockedPriceDetailsCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Icon name="lock" size={14} color={colors.primaryDark} strokeWidth={2} style={{ marginRight: 6 }} />
                <Text style={styles.lockedPriceDetailsTitle}>Wholesale Pricing Locked</Text>
              </View>
              <Text style={styles.lockedPriceDetailsText}>
                Your wholesale buyer account is currently awaiting administrator verification. Tiered commercial rates and tax schedules will unlock once your account is verified.
              </Text>
            </View>
          ) : (
            <View style={styles.priceCard}>
              <View style={styles.dealerPriceCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.dealerPriceLabel}>
                    {isWholesaler
                      ? 'BULK WHOLESALE RATE'
                      : isDistributor
                        ? 'DISTRIBUTOR CONTRACT RATE'
                        : (product as any).buyerCustomerType
                          ? `WHOLESALE (${String((product as any).buyerCustomerType).toUpperCase()})`
                          : 'WHOLESALE RATE APPLIED'}
                  </Text>
                  {product.activeDiscount && (
                    <View style={styles.promoPill}>
                      <Text style={styles.promoPillText}>
                        {product.activeDiscount.name}: {product.activeDiscount.discountType === 'percentage'
                          ? `${product.activeDiscount.discountValue}% OFF`
                          : `₹${(product.activeDiscount.discountValue / 100).toFixed(0)} OFF`}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
                  <Text style={styles.dealerPrice}>{formatPaiseToINR(effectiveProductPricePaise)}</Text>
                  {product.activeDiscount && (
                    <Text style={styles.originalRateStruck}>
                      {formatPaiseToINR(currentUnitPricePaise)}
                    </Text>
                  )}
                </View>
                <Text style={styles.dealerPriceUnit}>
                  per {product.uom || 'unit'} {activeTiers.length > 0 ? '(Tier Discounted)' : ''}
                </Text>
              </View>

              {baseMrpPrice > effectiveProductPricePaise && (
                <View style={styles.mrpCol}>
                  <Text style={styles.mrpLabel}>MAX RETAIL PRICE</Text>
                  <Text style={styles.mrpPrice}>{formatPaiseToINR(baseMrpPrice)}</Text>
                  <View style={styles.savingsPill}>
                    <Text style={styles.savingsText}>
                      Save {Math.round(((baseMrpPrice - effectiveProductPricePaise) / baseMrpPrice) * 100)}%
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* GST & Tax Compliance Info */}
          <View style={styles.taxInfoBox}>
            <Text style={styles.taxText}>
              <Text style={styles.taxSub}>Eligible for B2B GST Input Tax Credit</Text>
            </Text>
          </View>
        </View>

        {/* PRODUCT VARIANTS SELECTION SECTION */}
        {product.hasVariants && product.variants && product.variants.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Select Variant / Specification *</Text>
              <Text style={styles.variantCountBadge}>
                {product.variants.length} Options Available
              </Text>
            </View>
            <Text style={styles.variantSubtitle}>
              Choose size, pack count, or volume configuration:
            </Text>

            <View style={styles.variantChipsContainer}>
              {product.variants.map((v, idx) => {
                const isSelected =
                  selectedVariant &&
                  (selectedVariant.sku === v.sku ||
                    (selectedVariant.id && selectedVariant.id === v.id) ||
                    (selectedVariant._id && selectedVariant._id === v._id));

                const vStock = Math.max(0, (v.stockOnHand || 0) - (v.stockReserved || 0));
                const vOutOfStock = vStock <= 0;
                const vDealerPrice = v.dealerPricePaise !== undefined ? v.dealerPricePaise : product.dealerPricePaise;

                // Format attribute summary
                const attrText = v.attributes
                  ? Object.entries(v.attributes)
                    .map(([_, val]) => String(val))
                    .join(' • ')
                  : '';

                return (
                  <TouchableOpacity
                    key={v.sku || idx}
                    onPress={() => v.isActive && handleSelectVariant(v)}
                    disabled={!v.isActive}
                    style={[
                      styles.variantChip,
                      isSelected && styles.selectedVariantChip,
                      (!v.isActive || vOutOfStock) && styles.disabledVariantChip,
                    ]}
                  >
                    <View style={styles.variantChipHeader}>
                      <Text
                        style={[
                          styles.variantChipName,
                          isSelected && styles.selectedVariantChipName,
                          !v.isActive && styles.disabledText,
                        ]}
                      >
                        {v.name || attrText || v.sku}
                      </Text>
                      {isSelected && <Text style={styles.variantSelectedCheck}>✓</Text>}
                    </View>

                    <View style={styles.variantChipFooter}>
                      <Text
                        style={[
                          styles.variantChipPrice,
                          isSelected && styles.selectedVariantChipPrice,
                        ]}
                      >
                        {formatPaiseToINR(vDealerPrice)}
                      </Text>
                      <Text
                        style={[
                          styles.variantChipStock,
                          vOutOfStock && styles.variantOutOfStockText,
                        ]}
                      >
                        {!v.isActive ? 'Inactive' : vOutOfStock ? 'Sold Out' : `${vStock} in stock`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* QUANTITY-BASED TIER PRICING TABLE & LIVE SAVINGS */}
        {activeTiers.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Wholesale Tier Pricing</Text>
              <View style={styles.tierPill}>
                <Text style={styles.tierPillText}>Volume Discount</Text>
              </View>
            </View>
            <Text style={styles.tierSubtitle}>
              Unit prices automatically adjust based on your order quantity:
            </Text>

            {/* Next Tier Savings Alert Banner */}
            {nextTierInfo && (
              <View style={styles.nextTierBanner}>
                <View style={{ marginRight: 8, marginTop: 2 }}>
                  <Icon name="star" size={14} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextTierBannerTitle}>
                    Order {nextTierInfo.quantityNeeded} more units to unlock {formatPaiseToINR(nextTierInfo.nextTier.unitPricePaise)}/unit!
                  </Text>
                  <Text style={styles.nextTierBannerSub}>
                    Reach tier {nextTierInfo.nextTier.minQuantity}+ to save {formatPaiseToINR(nextTierInfo.potentialSavingsPerUnitPaise)} per unit.
                  </Text>
                </View>
              </View>
            )}

            {/* Tiers Breakdown Grid */}
            <View style={styles.tierTable}>
              <View style={styles.tierTableHeader}>
                <Text style={[styles.tierColHeader, { flex: 1.5 }]}>Quantity Range</Text>
                <Text style={[styles.tierColHeader, { flex: 1.5, textAlign: 'right' }]}>
                  Unit Rate
                </Text>
                <Text style={[styles.tierColHeader, { flex: 1, textAlign: 'right' }]}>
                  Status
                </Text>
              </View>

              {activeTiers.map((tier, tIdx) => {
                const isCurrentActive =
                  quantity >= tier.minQuantity &&
                  (tier.maxQuantity === undefined || quantity <= tier.maxQuantity);

                const rangeLabel = tier.maxQuantity
                  ? `${tier.minQuantity} – ${tier.maxQuantity} ${product.uom || 'units'}`
                  : `${tier.minQuantity}+ ${product.uom || 'units'}`;

                return (
                  <View
                    key={tIdx}
                    style={[
                      styles.tierTableRow,
                      isCurrentActive && styles.activeTierTableRow,
                    ]}
                  >
                    <View style={{ flex: 1.5 }}>
                      <Text
                        style={[
                          styles.tierRangeText,
                          isCurrentActive && styles.activeTierText,
                        ]}
                      >
                        {rangeLabel}
                      </Text>
                    </View>
                    <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.tierPriceText,
                          isCurrentActive && styles.activeTierPriceText,
                        ]}
                      >
                        {formatPaiseToINR(tier.unitPricePaise)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      {isCurrentActive ? (
                        <View style={styles.activeRateBadge}>
                          <Text style={styles.activeRateText}>Applied</Text>
                        </View>
                      ) : (
                        <Text style={styles.tierInactiveText}>—</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Packaging & Minimum Quantities */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Packaging & Order Requirements</Text>
          <View style={styles.specGrid}>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Unit of Measure</Text>
              <Text style={styles.specVal}>{product.uom || 'PCS'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Pack Size</Text>
              <Text style={styles.specVal}>{product.packSize || 1} units</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Min Order (MOQ)</Text>
              <Text style={[styles.specVal, { color: colors.primaryDark }]}>
                {moq} {product.uom || 'units'}
              </Text>
            </View>
          </View>
          {product.orderQuantityMultiple > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Icon name="info" size={13} color={colors.warning} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={styles.multipleNotice}>
                This product must be ordered in multiples of {product.orderQuantityMultiple} units.
              </Text>
            </View>
          )}
        </View>

        {/* Volume Offers if available */}
        {product.offers && product.offers.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Institutional Volume Offers</Text>
            {product.offers.map((offer, idx) => (
              <View key={idx} style={styles.offerRow}>
                <Text style={styles.offerBadge}>BULK</Text>
                <Text style={styles.offerText}>
                  Order {offer.minQuantity}+ units: <Text style={styles.offerHighlight}>{offer.discountPercent}% Off</Text>
                  {offer.label ? ` (${offer.label})` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Product Demonstration Videos */}
        {videos.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={styles.sectionTitle}>Product Videos ({videos.length})</Text>
              <Text style={{ fontSize: 11, color: colors.slate400 }}>Tap to play showcase</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {videos.map((vid, vIdx) => (
                <TouchableOpacity
                  key={`vid-card-${vIdx}`}
                  style={styles.videoCardBox}
                  activeOpacity={0.85}
                  onPress={() => {
                    const fullUrl = getMediaUrl(vid.url);
                    Linking.openURL(fullUrl).catch(() => {
                      Alert.alert('Unable to Open Video', 'Please ensure a web browser or video player is installed.');
                    });
                  }}
                >
                  <View style={styles.videoCardThumb}>
                    <Text style={styles.videoCardPlayIcon}>▶</Text>
                    <View style={styles.videoCardIndexBadge}>
                      <Text style={styles.videoCardIndexText}>#{vIdx + 1}</Text>
                    </View>
                  </View>
                  <Text style={styles.videoCardTitle} numberOfLines={1}>
                    {vid.title || `Video ${vIdx + 1}`}
                  </Text>
                  <Text style={styles.videoCardWatchLink}>▶ Watch Video</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Product Description */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Product Description & Commercial Specs</Text>
          <Text style={styles.descriptionText}>
            {product.description ||
              'Commercial grade institutional product designed for hotels, restaurants, corporate offices, and healthcare facilities. Made with high-absorption virgin pulp fibers and standard compliance.'}
          </Text>
        </View>
      </ScrollView>

      {/* ENLARGED IMAGE PREVIEW MODAL */}
      <Modal
        visible={isImagePreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsImagePreviewOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsImagePreviewOpen(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {product.name} {selectedVariant ? `(${selectedVariant.name || selectedVariant.sku})` : ''}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsImagePreviewOpen(false)}
              >
                <Icon name="close" size={16} color={colors.white} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalImageContainer}>
              {currentImage?.url && (
                <Image
                  source={{ uri: getMediaUrl(currentImage.url) }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              )}
            </View>

            {/* Modal Thumbnails Strip */}
            {images.length > 1 && (
              <ScrollView
                horizontal
                style={styles.modalThumbnails}
                showsHorizontalScrollIndicator={false}
              >
                {images.map((img, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setSelectedImageIndex(idx)}
                    style={[
                      styles.modalThumb,
                      selectedImageIndex === idx && styles.modalActiveThumb,
                    ]}
                  >
                    <Image source={{ uri: getMediaUrl(img.url) }} style={styles.thumbImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Floating Bottom Action Bar */}
      <View style={styles.bottomBar}>
        {(product as any).isPriceLocked || isPendingApproval ? (
          <TouchableOpacity
            style={[styles.cartSubmitBtn, { backgroundColor: '#F47732', flex: 1, minHeight: 46 }]}
            onPress={() => navigation.navigate('PendingApproval')}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="lock" size={14} color={colors.white} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={styles.cartSubmitText}>
                Account Verification Pending • View Status
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.qtyContainer}>
              <Text style={styles.qtyLabel}>Quantity ({formatPaiseToINR(currentUnitPricePaise)}/pc)</Text>
              
              {/* Quick Bulk Adder Pills for Wholesalers & Distributors */}
              {(isWholesaler || isDistributor) && (
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                  {(isWholesaler ? [10, 50, 100] : [50, 100, 500]).map((addAmt) => (
                    <TouchableOpacity
                      key={addAmt}
                      onPress={() => {
                        const next = quantity + addAmt;
                        if (availableStock > 0 && next > availableStock) {
                          Alert.alert('Stock Limit', `Only ${availableStock} units available.`);
                          return;
                        }
                        setQuantity(next);
                      }}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2.5,
                        borderRadius: 6,
                        backgroundColor: '#FFF8F3',
                        borderWidth: 1,
                        borderColor: '#F0E0D5',
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#F47732' }}>
                        +{addAmt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.qtySelector}>
                <TouchableOpacity
                  style={[styles.qtyBtn, quantity <= moq && styles.disabledQtyBtn]}
                  onPress={handleDecrease}
                  disabled={quantity <= moq}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyDisplay}>{quantity}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={handleIncrease}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.calculatedSubtotal}>
                Total: {formatPaiseToINR(lineSubtotalPaise)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.cartSubmitBtn, isOutOfStock && styles.disabledCartBtn]}
              disabled={isOutOfStock}
              onPress={handleAddToCart}
              activeOpacity={0.85}
            >
              <Text style={styles.cartSubmitText}>
                {isOutOfStock ? 'Sold Out' : isAddedSuccess ? '✓ Added to Cart!' : '+ Add to Order'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.slate500,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 14,
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: colors.white,
    fontWeight: '700',
  },
  galleryContainer: {
    height: 280,
    backgroundColor: colors.white,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  mainImage: {
    width: '90%',
    height: '90%',
  },
  noImageBox: {
    alignItems: 'center',
  },
  noImageIcon: {
    fontSize: 54,
    marginBottom: 6,
  },
  noImageText: {
    fontSize: 13,
    color: colors.slate400,
  },
  floatingBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  floatingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inStockBadge: {
    backgroundColor: colors.successBg,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
  },
  inStockText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  lowStockBadge: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
  },
  lowStockText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '700',
  },
  outOfStockBadge: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
  },
  outOfStockText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  thumbnailsRow: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginRight: 10,
    overflow: 'hidden',
  },
  activeThumbnail: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  detailsHeader: {
    backgroundColor: colors.white,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  brandTag: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.slate900,
    marginTop: 4,
    lineHeight: 26,
  },
  skuText: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
  },
  priceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.slate50,
    padding: 14,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  dealerPriceCol: {
    flex: 1,
  },
  dealerPriceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate500,
    letterSpacing: 0.5,
  },
  dealerPrice: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.slate900,
    marginTop: 2,
  },
  dealerPriceUnit: {
    fontSize: 11,
    color: colors.slate500,
  },
  promoPill: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 0.5,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  promoPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  originalRateStruck: {
    fontSize: 13,
    color: colors.slate400,
    textDecorationLine: 'line-through',
    marginLeft: 8,
    fontWeight: '700',
  },
  mrpCol: {
    alignItems: 'flex-end',
  },
  mrpLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate400,
  },
  mrpPrice: {
    fontSize: 15,
    color: colors.slate400,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  savingsPill: {
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  taxInfoBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: colors.highlightBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taxText: {
    fontSize: 11,
    color: colors.slate600,
  },
  taxBold: {
    fontWeight: '700',
    color: colors.slate800,
  },
  taxSub: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: colors.white,
    marginTop: 12,
    padding: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 12,
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specItem: {
    width: '50%',
    marginBottom: 12,
  },
  specLabel: {
    fontSize: 11,
    color: colors.slate500,
    marginBottom: 2,
  },
  specVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate900,
  },
  multipleNotice: {
    fontSize: 12,
    color: colors.warning,
    backgroundColor: colors.warningBg,
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  offerBadge: {
    backgroundColor: colors.primaryBg,
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  offerText: {
    fontSize: 13,
    color: colors.slate700,
  },
  offerHighlight: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  descriptionText: {
    fontSize: 13,
    color: colors.slate600,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  qtyContainer: {
    marginRight: 14,
  },
  qtyLabel: {
    fontSize: 10,
    color: colors.slate500,
    fontWeight: '600',
    marginBottom: 2,
  },
  qtySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledQtyBtn: {
    opacity: 0.3,
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate800,
  },
  qtyDisplay: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 8,
    color: colors.slate900,
    minWidth: 32,
    textAlign: 'center',
  },
  calculatedSubtotal: {
    fontSize: 10,
    color: colors.primaryDark,
    fontWeight: '700',
    marginTop: 2,
  },
  cartSubmitBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  disabledCartBtn: {
    backgroundColor: colors.slate300,
  },
  cartSubmitText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoomHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate700,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  variantCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  variantSubtitle: {
    fontSize: 12,
    color: colors.slate500,
    marginBottom: 12,
  },
  variantChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantChip: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  selectedVariantChip: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
    borderWidth: 2,
  },
  disabledVariantChip: {
    opacity: 0.5,
    backgroundColor: colors.slate100,
  },
  variantChipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  variantChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
    flex: 1,
  },
  selectedVariantChipName: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  disabledText: {
    color: colors.slate400,
  },
  variantSelectedCheck: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    marginLeft: 4,
  },
  variantChipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  variantChipPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate900,
  },
  selectedVariantChipPrice: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  variantChipStock: {
    fontSize: 10,
    color: colors.slate500,
  },
  variantOutOfStockText: {
    color: colors.danger,
    fontWeight: '700',
  },
  tierPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tierPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  tierSubtitle: {
    fontSize: 12,
    color: colors.slate500,
    marginBottom: 10,
  },
  nextTierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  nextTierBannerIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  nextTierBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  nextTierBannerSub: {
    fontSize: 11,
    color: colors.slate600,
    marginTop: 2,
  },
  tierTable: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.highlightBg,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tierColHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.slate600,
    textTransform: 'uppercase',
  },
  tierTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    backgroundColor: colors.white,
  },
  activeTierTableRow: {
    backgroundColor: colors.primaryBg,
  },
  tierRangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  activeTierText: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  tierPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate900,
  },
  activeTierPriceText: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  activeRateBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeRateText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tierInactiveText: {
    fontSize: 12,
    color: colors.slate300,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
    flex: 1,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.slate100,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.slate600,
  },
  modalImageContainer: {
    height: 340,
    backgroundColor: colors.slate50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '95%',
    height: '95%',
  },
  modalThumbnails: {
    padding: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    overflow: 'hidden',
  },
  modalActiveThumb: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  lockedPriceDetailsCard: {
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F47732',
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
  },
  lockedPriceDetailsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E95B2A',
    marginBottom: 4,
  },
  lockedPriceDetailsText: {
    fontSize: 12,
    color: '#737373',
    lineHeight: 18,
  },
  videoThumbPill: {
    backgroundColor: '#FFF8F3',
    borderColor: '#F47732',
    borderWidth: 1.5,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoThumbContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  videoThumbPlayIcon: {
    fontSize: 14,
    color: '#F47732',
    fontWeight: '900',
  },
  videoThumbText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#E95B2A',
    marginTop: 2,
  },
  videoCardBox: {
    width: 140,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0E0D5',
    padding: 8,
  },
  videoCardThumb: {
    height: 75,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  videoCardPlayIcon: {
    fontSize: 22,
    color: '#F47732',
  },
  videoCardIndexBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  videoCardIndexText: {
    fontSize: 8,
    color: colors.white,
    fontWeight: '700',
  },
  videoCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate800,
    marginTop: 6,
  },
  videoCardWatchLink: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E95B2A',
    marginTop: 3,
  },
});
