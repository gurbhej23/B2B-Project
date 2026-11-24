import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../context/CartContext';
import { formatPaiseToINR } from '@necessity/shared';
import { getMediaUrl } from '../../../lib/api';
import { colors } from '../../theme/colors';
import { Icon } from '../../components/common/Icon';

export const CartScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    items,
    updateQuantity,
    removeFromCart,
    clearCart,
    summary,
    isCalculating,
    calculationError,
    cartSubtotalPaise,
  } = useCart();

  const handleConfirmRemove = (prodId: string, varId?: string, productName?: string) => {
    Alert.alert(
      'Remove Item',
      `Remove "${productName || 'this item'}" from your wholesale cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFromCart(prodId, varId),
        },
      ]
    );
  };

  const handleConfirmClear = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your wholesale cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearCart },
      ]
    );
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Icon name="cart" size={36} color={colors.primary} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>Your Wholesale Cart is Empty</Text>
        <Text style={styles.emptySubtitle}>
          Add institutional towels, napkins, dispenser rolls, or cleaning supplies to calculate
          wholesale volume pricing.
        </Text>
        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => navigation.navigate('CatalogueTab')}
          activeOpacity={0.85}
        >
          <Text style={styles.browseBtnText}>Browse Wholesale Catalogue</Text>
          <Icon name="arrow-right" size={12} color={colors.white} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    );
  }

  const subtotalPaise = summary ? summary.subtotalPaise : cartSubtotalPaise;
  const discountPaise = summary ? summary.totalDiscountPaise : 0;
  const taxablePaise = summary ? summary.taxableAmountPaise : subtotalPaise - discountPaise;
  const cgstPaise = summary ? summary.totalCgstPaise : 0;
  const sgstPaise = summary ? summary.totalSgstPaise : 0;
  const igstPaise = summary ? summary.totalIgstPaise : 0;
  const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;
  const grandTotalPaise = summary
    ? summary.grandTotalPaise
    : taxablePaise + Math.round(taxablePaise * 0.18);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={styles.cartTitle}>Wholesale Order ({items.length} Lines)</Text>
          <TouchableOpacity onPress={handleConfirmClear}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        {/* Calculation error banner */}
        {calculationError && (
          <View style={styles.errorNotice}>
            <Icon name="info" size={16} color={colors.warning} strokeWidth={1.5} />
            <Text style={styles.errorNoticeText}>{calculationError}</Text>
          </View>
        )}

        {/* Items List */}
        <View style={styles.itemsList}>
          {items.map((cartItem, idx) => {
            const product = cartItem.product;
            const variant = cartItem.variant;
            const prodId = product.id || (product as any)._id;
            const varId = variant?.id || (variant as any)?._id;
            const primaryImg =
              variant?.images?.find((i) => i.isPrimary) ||
              variant?.images?.[0] ||
              product.images?.find((i) => i.isPrimary) ||
              product.images?.[0];

            const moq = product.minOrderQuantity || 1;
            const step = product.orderQuantityMultiple || 1;

            const calculatedItem = summary?.items?.find(
              (si) => si.productId === prodId && (varId ? si.variantId === varId : true)
            );

            const effectiveUnitPrice = calculatedItem
              ? calculatedItem.unitPricePaiseSnapshot
              : variant?.dealerPricePaise !== undefined
              ? variant.dealerPricePaise
              : product.dealerPricePaise;

            const lineTotal = calculatedItem
              ? calculatedItem.lineTotalPaise
              : effectiveUnitPrice * cartItem.quantity;

            return (
              <View key={`${prodId}_${varId || idx}`} style={styles.itemCard}>
                <View style={styles.itemRow}>
                  {/* Thumbnail */}
                  <View style={styles.itemImageBox}>
                    {primaryImg?.url ? (
                      <Image
                        source={{ uri: getMediaUrl(primaryImg.url) }}
                        style={styles.itemImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Icon name="box" size={26} color={colors.textSecondary} strokeWidth={1.5} />
                    )}
                  </View>

                  {/* Details */}
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemBrand}>{product.brand || 'NECESSITY INDIA'}</Text>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {product.name}
                    </Text>

                    {variant && (
                      <View style={styles.itemVariantBadge}>
                        <Text style={styles.itemVariantBadgeText}>
                          Variant:{' '}
                          {variant.name ||
                            Object.values(variant.attributes || {}).join(' • ') ||
                            variant.sku}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.itemSku}>SKU: {variant?.sku || product.sku}</Text>

                    <Text style={styles.itemRate}>
                      {formatPaiseToINR(effectiveUnitPrice)} / {product.uom || 'PCS'}
                    </Text>

                    {calculatedItem?.tierAppliedSnapshot && (
                      <View style={styles.itemTierBadge}>
                        <Text style={styles.itemTierBadgeText}>
                          ⚡ Qty Tier Applied ({calculatedItem.tierMinQuantitySnapshot}+ pcs)
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Remove Button */}
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleConfirmRemove(prodId, varId, product.name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="trash" size={16} color={colors.slate400} strokeWidth={1.5} />
                  </TouchableOpacity>
                </View>

                {/* Bottom Row: Quantity Controls & Line Total */}
                <View style={styles.itemBottomRow}>
                  <View style={styles.qtyContainer}>
                    <Text style={styles.qtyLabel}>QTY (MOQ: {moq})</Text>
                    <View style={styles.qtyControls}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          if (cartItem.quantity - step < moq) {
                            handleConfirmRemove(prodId, varId, product.name);
                          } else {
                            updateQuantity(prodId, cartItem.quantity - step, varId);
                          }
                        }}
                      >
                        <Icon name="minus" size={12} color={colors.textPrimary} strokeWidth={2} />
                      </TouchableOpacity>

                      <Text style={styles.qtyText}>{cartItem.quantity}</Text>

                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => updateQuantity(prodId, cartItem.quantity + step, varId)}
                      >
                        <Icon name="plus" size={12} color={colors.textPrimary} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.lineTotalCol}>
                    <Text style={styles.lineTotalLabel}>LINE TOTAL</Text>
                    <Text style={styles.lineTotalValue}>{formatPaiseToINR(lineTotal)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Totals & Tax Summary Breakdown Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTitleRow}>
            <Text style={styles.summaryTitle}>Tax & Totals Breakdown</Text>
            {isCalculating && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal (Dealer Wholesale Rate)</Text>
            <Text style={styles.summaryValue}>{formatPaiseToINR(subtotalPaise)}</Text>
          </View>

          {summary?.totalProductDiscountPaise ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.success }]}>Product Discounts</Text>
              <Text style={[styles.summaryValue, { color: colors.success, fontWeight: '800' }]}>
                −{formatPaiseToINR(summary.totalProductDiscountPaise)}
              </Text>
            </View>
          ) : discountPaise > 0 && !summary?.couponDiscountPaise ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.primaryDark }]}>
                Promotional Discount
              </Text>
              <Text style={[styles.summaryValue, { color: colors.primaryDark }]}>
                −{formatPaiseToINR(discountPaise)}
              </Text>
            </View>
          ) : null}

          {summary?.couponDiscountPaise ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.success }]}>
                Coupon ({summary.couponCode})
              </Text>
              <Text style={[styles.summaryValue, { color: colors.success, fontWeight: '800' }]}>
                −{formatPaiseToINR(summary.couponDiscountPaise)}
              </Text>
            </View>
          ) : null}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxable Base Amount</Text>
            <Text style={styles.summaryValue}>{formatPaiseToINR(taxablePaise)}</Text>
          </View>

          {cgstPaise > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>CGST (Intra-state)</Text>
              <Text style={styles.summaryValue}>{formatPaiseToINR(cgstPaise)}</Text>
            </View>
          )}

          {sgstPaise > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>SGST (Intra-state)</Text>
              <Text style={styles.summaryValue}>{formatPaiseToINR(sgstPaise)}</Text>
            </View>
          )}

          {igstPaise > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>IGST (Inter-state)</Text>
              <Text style={styles.summaryValue}>{formatPaiseToINR(igstPaise)}</Text>
            </View>
          )}

          {totalTaxPaise === 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Estimated GST (18%)</Text>
              <Text style={styles.summaryValue}>
                {formatPaiseToINR(Math.round(taxablePaise * 0.18))}
              </Text>
            </View>
          )}

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.grandTotalLabel}>Grand Total (Incl. GST)</Text>
            <Text style={styles.grandTotalValue}>{formatPaiseToINR(grandTotalPaise)}</Text>
          </View>

          <View style={styles.gstComplianceNote}>
            <Icon name="info" size={14} color={colors.primary} strokeWidth={1.5} />
            <Text style={styles.gstComplianceText}>
              Tax invoice with full tax breakdown will be generated upon order dispatch for
              100% GST input tax credit.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Floating Checkout Bottom Bar */}
      <View style={[styles.checkoutBar, { paddingBottom: Math.max(12, insets.bottom + 6) }]}>
        <View style={styles.checkoutTotalCol}>
          <Text style={styles.checkoutTotalLabel}>TOTAL PAYABLE</Text>
          <Text style={styles.checkoutTotalValue}>{formatPaiseToINR(grandTotalPaise)}</Text>
        </View>

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => navigation.navigate('Checkout')}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
          <Icon name="arrow-right" size={13} color={colors.white} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: colors.white,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  browseBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  clearText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '700',
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    gap: 8,
  },
  errorNoticeText: {
    color: colors.warning,
    fontSize: 12,
    flex: 1,
  },
  itemsList: {
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemImageBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.highlightBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemBrand: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 1,
  },
  itemSku: {
    fontSize: 10,
    color: colors.slate400,
    marginTop: 2,
  },
  itemRate: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },
  itemVariantBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  itemVariantBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  itemTierBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  itemTierBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  removeBtn: {
    padding: 6,
  },
  itemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    minWidth: 28,
    textAlign: 'center',
  },
  lineTotalCol: {
    alignItems: 'flex-end',
  },
  lineTotalLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  lineTotalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  grandTotalValue: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  gstComplianceNote: {
    flexDirection: 'row',
    backgroundColor: colors.primaryBg,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    gap: 8,
  },
  gstComplianceText: {
    fontSize: 11,
    color: colors.primaryDark,
    lineHeight: 16,
    flex: 1,
  },
  checkoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  checkoutTotalCol: {
    flex: 1,
  },
  checkoutTotalLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  checkoutTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 6,
  },
  checkoutBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
