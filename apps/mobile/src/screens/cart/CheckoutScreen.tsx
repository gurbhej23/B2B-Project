import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { mobileApi, extractErrorMessage } from '../../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { formatPaiseToINR, PaymentMethod } from '@necessity/shared';
import RazorpayCheckout from 'react-native-razorpay';
import { colors } from '../../theme/colors';

export const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { retailer, user } = useAuth();
  const {
    items,
    summary,
    cartSubtotalPaise,
    clearCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const [street, setStreet] = useState(
    retailer?.shippingAddress?.street || retailer?.billingAddress?.street || ''
  );
  const [city, setCity] = useState(
    retailer?.shippingAddress?.city || retailer?.billingAddress?.city || ''
  );
  const [state, setState] = useState(
    retailer?.shippingAddress?.state || retailer?.billingAddress?.state || 'Maharashtra'
  );
  const [pincode, setPincode] = useState(
    retailer?.shippingAddress?.pincode || retailer?.billingAddress?.pincode || ''
  );
  const [customerNotes, setCustomerNotes] = useState('');
  const paymentMethod = PaymentMethod.PAYMENT_GATEWAY;

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);

  const totalPaise = summary ? summary.grandTotalPaise : cartSubtotalPaise * 1.18;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }
    setCouponApplying(true);
    setCouponError(null);
    setCouponSuccess(null);
    const result = await applyCoupon(couponInput.trim());
    setCouponApplying(false);
    if (result.success) {
      setCouponSuccess(result.message);
      setCouponInput('');
    } else {
      setCouponError(result.message);
    }
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponSuccess(null);
    setCouponError(null);
  };

  const handlePlaceOrder = async () => {
    if (!street.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      Alert.alert('Incomplete Address', 'Please provide complete delivery street, city, state, and pincode.');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Empty Cart', 'There are no items in your order.');
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const payload = {
        items: items.map((i) => ({
          productId: i.product.id || (i.product as any)._id,
          variantId: i.variant?.id || (i.variant as any)?._id,
          quantity: i.quantity,
        })),
        paymentMethod,
        deliveryAddress: {
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          stateCode:
            (retailer?.shippingAddress as any)?.stateCode ||
            (retailer?.billingAddress as any)?.stateCode ||
            '27',
        },
        couponCode: appliedCoupon || undefined,
        customerNotes: customerNotes.trim() || undefined,
        idempotencyKey,
      };

      const res = await mobileApi.post('/orders/checkout', payload);
      if (res.success && res.data) {
        clearCart();
        const createdOrder = res.data;

        // If Payment Gateway selected, trigger Razorpay Checkout flow
        if (paymentMethod === PaymentMethod.PAYMENT_GATEWAY) {
          try {
            const intentRes = await mobileApi.post('/payments/intent', {
              orderId: createdOrder.id || createdOrder._id,
            });

            if (intentRes.success && intentRes.data) {
              const { keyId, providerOrderId, amountPaise } = intentRes.data;

              const cleanContact = (user?.phone || '').replace(/\D/g, '').slice(-10);

              const options = {
                description: `Necessity Order #${createdOrder.orderNumber}`,
                currency: 'INR',
                key: keyId,
                amount: amountPaise,
                name: 'Necessity India',
                order_id: providerOrderId,
                prefill: {
                  email: user?.email || (retailer as any)?.email || '',
                  contact: cleanContact,
                  name: user?.name || retailer?.businessName || '',
                },
                theme: { color: colors.primary },
              };

              const paymentData = await RazorpayCheckout.open(options);

              // Verify payment on backend
              const verifyRes = await mobileApi.post('/payments/verify', {
                providerOrderId: paymentData.razorpay_order_id,
                providerPaymentId: paymentData.razorpay_payment_id,
                signature: paymentData.razorpay_signature,
              });

              if (verifyRes.success) {
                createdOrder.paymentStatus = 'paid';
              }
            }
          } catch (payErr: any) {
            // User cancelled or payment failed - inform user, order is preserved
            const msg = payErr?.description || payErr?.message || 'Payment not completed';
            Alert.alert(
              'Payment Pending',
              `Your order #${createdOrder.orderNumber} was saved, but online payment was not completed (${msg}). You can complete payment anytime from Order Details.`
            );
          }
        }

        setPlacedOrder(createdOrder);
      } else {
        throw new Error(res.message || 'Failed to place order');
      }
    } catch (err: any) {
      Alert.alert('Order Submission Error', extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Order Success Screen View
  if (placedOrder) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successCard}>
          <View style={styles.successBadge}>
            <Text style={styles.successBadgeIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Order Confirmed!</Text>
          <Text style={styles.successOrderNumber}>Order #{placedOrder.orderNumber}</Text>
          <Text style={styles.successDesc}>
            Your wholesale institutional supply order has been received by our central warehouse team.
          </Text>

          <View style={styles.successSummaryBox}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Grand Total</Text>
              <Text style={styles.successValue}>{formatPaiseToINR(placedOrder.grandTotalPaise)}</Text>
            </View>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Payment Terms</Text>
              <Text style={styles.successValue}>
                {placedOrder.paymentMethod === PaymentMethod.PAYMENT_GATEWAY
                  ? 'Razorpay Online Settlement'
                  : placedOrder.paymentMethod}
              </Text>
            </View>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Delivery Location</Text>
              <Text style={styles.successValue} numberOfLines={1}>
                {placedOrder.deliveryAddress?.city}, {placedOrder.deliveryAddress?.state}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.viewOrderBtn}
            onPress={() => {
              const orderId = placedOrder.id || placedOrder._id;
              navigation.replace('OrderDetails', { orderId });
            }}
          >
            <Text style={styles.viewOrderBtnText}>View Order Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => navigation.navigate('HomeTab')}
          >
            <Text style={styles.homeBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Order Items Review Strip */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary ({items.length} Lines)</Text>
          <View style={styles.checkoutItemsList}>
            {items.map((i, idx) => {
              const price =
                i.variant?.dealerPricePaise !== undefined
                  ? i.variant.dealerPricePaise
                  : i.product.dealerPricePaise;
              return (
                <View key={idx} style={styles.checkoutItemRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.checkoutItemName} numberOfLines={1}>
                      {i.product.name}
                    </Text>
                    {i.variant && (
                      <Text style={styles.checkoutItemVariant}>
                        Variant: {i.variant.name || i.variant.sku}
                      </Text>
                    )}
                    <Text style={styles.checkoutItemQty}>
                      Qty: {i.quantity} {i.product.uom || 'units'}
                    </Text>
                  </View>
                  <Text style={styles.checkoutItemPrice}>
                    {formatPaiseToINR(price * i.quantity)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Promotional Coupon Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Promotional Coupon</Text>
          {appliedCoupon ? (
            <View style={styles.appliedCouponContainer}>
              <View style={styles.appliedCouponBadge}>
                <Text style={styles.appliedCouponCode}>✓ COUPON: {appliedCoupon}</Text>
                {summary?.couponDiscountPaise ? (
                  <Text style={styles.appliedCouponSavings}>
                    Saved {formatPaiseToINR(summary.couponDiscountPaise)} on this order
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={handleRemoveCoupon}
                style={styles.removeCouponBtn}
              >
                <Text style={styles.removeCouponBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.couponInputRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder="ENTER COUPON CODE"
                  placeholderTextColor={colors.slate400}
                  value={couponInput}
                  onChangeText={(val) => {
                    setCouponInput(val.toUpperCase());
                    setCouponError(null);
                  }}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[
                    styles.applyCouponBtn,
                    (!couponInput.trim() || couponApplying) && styles.disabledCouponBtn,
                  ]}
                  onPress={handleApplyCoupon}
                  disabled={!couponInput.trim() || couponApplying}
                >
                  {couponApplying ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.applyCouponBtnText}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
              {couponError ? (
                <Text style={styles.couponErrorText}>{couponError}</Text>
              ) : null}
              {couponSuccess ? (
                <Text style={styles.couponSuccessText}>{couponSuccess}</Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Itemized Financial Totals Breakdown Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tax & Invoicing Breakdown</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Subtotal (Catalogue Rate)</Text>
            <Text style={styles.breakdownValue}>
              {formatPaiseToINR(summary?.subtotalPaise || cartSubtotalPaise)}
            </Text>
          </View>

          {summary?.totalProductDiscountPaise ? (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: '#059669' }]}>
                Product Discounts
              </Text>
              <Text style={[styles.breakdownValue, { color: '#059669', fontWeight: '800' }]}>
                - {formatPaiseToINR(summary.totalProductDiscountPaise)}
              </Text>
            </View>
          ) : null}

          {summary?.couponDiscountPaise ? (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: '#059669' }]}>
                Coupon Discount ({summary.couponCode || appliedCoupon})
              </Text>
              <Text style={[styles.breakdownValue, { color: '#059669', fontWeight: '800' }]}>
                - {formatPaiseToINR(summary.couponDiscountPaise)}
              </Text>
            </View>
          ) : null}

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Discounted Taxable Amount</Text>
            <Text style={styles.breakdownValue}>
              {formatPaiseToINR(summary?.taxableAmountPaise || cartSubtotalPaise)}
            </Text>
          </View>

          {summary?.totalCgstPaise ? (
            <>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Central GST (CGST)</Text>
                <Text style={styles.breakdownValue}>
                  {formatPaiseToINR(summary.totalCgstPaise)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>State GST (SGST)</Text>
                <Text style={styles.breakdownValue}>
                  {formatPaiseToINR(summary.totalSgstPaise)}
                </Text>
              </View>
            </>
          ) : summary?.totalIgstPaise ? (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Integrated GST (IGST)</Text>
              <Text style={styles.breakdownValue}>
                {formatPaiseToINR(summary.totalIgstPaise)}
              </Text>
            </View>
          ) : (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Applicable GST (Estimated 18%)</Text>
              <Text style={styles.breakdownValue}>
                {formatPaiseToINR(Math.round(cartSubtotalPaise * 0.18))}
              </Text>
            </View>
          )}

          <View style={styles.checkoutDivider} />

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Final Amount Payable</Text>
            <Text style={styles.grandTotalValue}>{formatPaiseToINR(totalPaise)}</Text>
          </View>
          <Text style={styles.inclusiveText}>Includes All Applicable GST Taxes</Text>
        </View>

        {/* Delivery Address */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery & Facility Location</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Building / Street / Dock Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="Facility address"
              value={street}
              onChangeText={setStreet}
            />
          </View>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>City *</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} />
            </View>
            <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>State *</Text>
              <TextInput style={styles.input} value={state} onChangeText={setState} />
            </View>
            <View style={[styles.field, { width: 90 }]}>
              <Text style={styles.label}>Pincode *</Text>
              <TextInput
                style={styles.input}
                value={pincode}
                onChangeText={setPincode}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        {/* Payment Method - Exclusively Razorpay */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Method</Text>

          <View style={[styles.paymentOption, styles.selectedPaymentOption]}>
            <View style={styles.radioDot}>
              <View style={styles.radioInner} />
            </View>
            <View style={styles.paymentDetails}>
              <Text style={styles.paymentName}>Online Payment (Razorpay)</Text>
              <Text style={styles.paymentSub}>
                Instant Settlement • UPI (GPay, PhonePe, Paytm), Cards, Netbanking & Wallets
              </Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Instructions (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g. Loading dock open 9am - 5pm, Gate pass required..."
            placeholderTextColor={colors.slate400}
            value={customerNotes}
            onChangeText={setCustomerNotes}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      {/* Place Order CTA Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.totalCol}>
          <Text style={styles.totalLabel}>TOTAL TO DISPATCH</Text>
          <Text style={styles.finalTotalValue}>{formatPaiseToINR(totalPaise)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, isSubmitting && styles.disabledBtn]}
          onPress={handlePlaceOrder}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.confirmBtnText}>Confirm & Pay with Razorpay</Text>
          )}
        </TouchableOpacity>
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
    padding: 16,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  checkoutItemsList: {
    marginBottom: 10,
  },
  checkoutItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checkoutItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate900,
  },
  checkoutItemVariant: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: 1,
  },
  checkoutItemQty: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 1,
  },
  checkoutItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.slate900,
  },
  checkoutDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.slate600,
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 13,
    color: colors.slate900,
    fontWeight: '700',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.slate900,
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.slate900,
  },
  inclusiveText: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
  },
  appliedCouponContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 12,
  },
  appliedCouponBadge: {
    flex: 1,
    marginRight: 8,
  },
  appliedCouponCode: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  appliedCouponSavings: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  removeCouponBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  removeCouponBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  couponInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate900,
    marginRight: 8,
    letterSpacing: 0.5,
  },
  applyCouponBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledCouponBtn: {
    opacity: 0.5,
    backgroundColor: colors.slate400,
  },
  applyCouponBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  couponErrorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 6,
  },
  couponSuccessText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: 6,
  },
  field: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.slate900,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  selectedPaymentOption: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightBg,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.slate400,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  paymentDetails: {
    flex: 1,
  },
  paymentName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
  },
  paymentSub: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
  },
  creditWarning: {
    backgroundColor: colors.dangerBg,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    marginTop: 4,
  },
  creditWarningText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
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
  },
  totalCol: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate500,
  },
  finalTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.slate900,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 14,
    elevation: 2,
  },
  disabledBtn: {
    backgroundColor: colors.slate400,
  },
  confirmBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.slate50,
  },
  successCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 3,
  },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.primaryBorder,
  },
  successBadgeIcon: {
    fontSize: 30,
    color: colors.primary,
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.slate900,
  },
  successOrderNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: 4,
  },
  successDesc: {
    fontSize: 13,
    color: colors.slate600,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  successSummaryBox: {
    width: '100%',
    backgroundColor: colors.highlightBg,
    borderRadius: 12,
    padding: 14,
    marginVertical: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  successLabel: {
    fontSize: 12,
    color: colors.slate500,
  },
  successValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
  },
  viewOrderBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  viewOrderBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  homeBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  homeBtnText: {
    color: colors.slate600,
    fontSize: 14,
    fontWeight: '600',
  },
});
