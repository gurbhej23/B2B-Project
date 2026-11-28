import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { mobileApi, extractErrorMessage, getBaseUrl } from '../../../lib/api';
import { formatPaiseToINR, OrderStatus } from '@necessity/shared';
import { Order } from '../../types/models';
import { colors } from '../../theme/colors';
import { Icon } from '../../components/common/Icon';
import { useAuth } from '../../context/AuthContext';
import RazorpayCheckout from 'react-native-razorpay';

export const OrderDetailsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user, retailer } = useAuth();
  const orderId = route.params?.orderId;

  const [order, setOrder] = useState<Order | null>(null);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPayingOnline, setIsPayingOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await mobileApi.get(`/invoices?orderId=${orderId}`);
      if (res.success && res.data) {
        const inv = res.data.items?.[0] || (Array.isArray(res.data) ? res.data[0] : null);
        if (inv) setInvoice(inv);
      }
    } catch {
      // ignore invoice fetch error if not yet issued
    }
  }, [orderId]);

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      const pdfUrl = `${getBaseUrl()}/invoices/${invoice.id || invoice._id}/pdf`;
      const supported = await Linking.canOpenURL(pdfUrl);
      if (supported) {
        await Linking.openURL(pdfUrl);
      } else {
        Alert.alert('PDF Viewer', 'Please open this URL in your device browser: ' + pdfUrl);
      }
    } catch (err: any) {
      Alert.alert('Download Error', extractErrorMessage(err) || 'Could not open invoice PDF.');
    }
  };

  const fetchOrder = useCallback(async () => {
    setError(null);
    try {
      const res = await mobileApi.get(`/orders/${orderId}`);
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        throw new Error('Order details not found');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
      fetchInvoice();
    }
  }, [orderId, fetchOrder, fetchInvoice]);

  const canCancel =
    order &&
    (order.status === OrderStatus.SUBMITTED || order.status === OrderStatus.PENDING);

  const getTimelineStepIndex = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
      case OrderStatus.SUBMITTED:
        return 0;
      case OrderStatus.APPROVED:
        return 1;
      case OrderStatus.PROCESSING:
        return 2;
      case OrderStatus.DISPATCHED:
        return 3;
      case OrderStatus.PICKED_UP:
      case OrderStatus.DELIVERED:
        return 4;
      default:
        return -1;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'successful':
        return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0', label: 'PAID' };
      case 'partially_paid':
        return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', label: 'PARTIALLY PAID' };
      default:
        return { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA', label: 'UNPAID' };
    }
  };

  const handleOnlinePayment = async () => {
    if (!order) return;
    setIsPayingOnline(true);
    try {
      const intentRes = await mobileApi.post('/payments/intent', {
        orderId: order.id || (order as any)._id,
      });

      if (!intentRes.success || !intentRes.data) {
        throw new Error(intentRes.message || 'Failed to initialize payment gateway');
      }

      const { keyId, providerOrderId, amountPaise } = intentRes.data;

      if (!keyId || !providerOrderId) {
        throw new Error('Razorpay Gateway is not configured on the server. Missing Key ID or Order ID.');
      }

      const cleanContact = (user?.phone || '').replace(/\D/g, '').slice(-10);

      const options = {
        description: `Necessity Order #${order.orderNumber} Settlement`,
        currency: 'INR',
        key: keyId,
        amount: amountPaise,
        name: 'Necessity India',
        order_id: providerOrderId,
        prefill: {
          email: user?.email || (retailer as any)?.email || '',
          contact: cleanContact,
          name: user?.name || retailer?.businessName || order.retailerName || '',
        },
        theme: { color: colors.primary },
      };

      const paymentData = await RazorpayCheckout.open(options);

      const verifyRes = await mobileApi.post('/payments/verify', {
        providerOrderId: paymentData.razorpay_order_id,
        providerPaymentId: paymentData.razorpay_payment_id,
        signature: paymentData.razorpay_signature,
      });

      if (verifyRes.success) {
        Alert.alert('Payment Successful', 'Your payment has been verified and settled successfully.');
        await fetchOrder();
      } else {
        throw new Error(verifyRes.message || 'Signature verification failed');
      }
    } catch (err: any) {
      if (err?.code !== 2) {
        Alert.alert(
          'Payment Incomplete',
          err?.description || extractErrorMessage(err) || 'Payment was cancelled or could not be completed.'
        );
      }
    } finally {
      setIsPayingOnline(false);
    }
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Wholesale Order',
      `Are you sure you want to cancel Order #${order?.orderNumber}? Credit reservations will be automatically restored.`,
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Confirm Cancellation',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              await mobileApi.patch(`/orders/${orderId}/status`, {
                status: OrderStatus.CANCELLED,
                cancellationReason: 'Cancelled by customer via mobile app',
              });
              Alert.alert('Order Cancelled', 'Your order was successfully cancelled.');
              fetchOrder();
            } catch (err: any) {
              Alert.alert('Cancellation Failed', extractErrorMessage(err));
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading order details & invoices...</Text>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.errorText}>{error || 'Order not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back to Orders</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const dateFormatted = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalPaid = order.totalPaidPaise || 0;
  const remainingDue =
    order.remainingBalancePaise !== undefined
      ? order.remainingBalancePaise
      : Math.max(0, order.grandTotalPaise - totalPaid);

  const activeStep = getTimelineStepIndex(order.status);
  const isCancelledOrRejected =
    order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REJECTED;

  const paymentBadge = getPaymentBadge(order.paymentStatus as any);

  const timelineSteps = [
    { title: 'Placed' },
    { title: 'Approved' },
    { title: 'Processing' },
    { title: 'Dispatched' },
    { title: 'Delivered' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Header Card */}
        <View style={styles.card}>
          <View style={styles.orderHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
              <Text style={styles.orderDate}>{dateFormatted}</Text>
            </View>
            <View style={styles.statusPillGroup}>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{order.status.toUpperCase()}</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: paymentBadge.bg,
                    borderColor: paymentBadge.border,
                    marginLeft: 6,
                  },
                ]}
              >
                <Text style={[styles.statusPillText, { color: paymentBadge.text }]}>
                  {paymentBadge.label}
                </Text>
              </View>
            </View>
          </View>

          {order.cancellationReason && (
            <View style={styles.cancellationBox}>
              <Text style={styles.cancellationLabel}>Cancellation Reason:</Text>
              <Text style={styles.cancellationText}>{order.cancellationReason}</Text>
            </View>
          )}
        </View>

        {/* Order Progress Timeline Stepper */}
        {!isCancelledOrRejected && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Order Progress Timeline</Text>
            <View style={styles.timelineRow}>
              {timelineSteps.map((step, idx) => {
                const isPassed = activeStep > idx;
                const isCurrent = activeStep === idx;
                const isUpcoming = activeStep < idx;

                return (
                  <React.Fragment key={idx}>
                    <View style={styles.timelineStep}>
                      <View
                        style={[
                          styles.timelineCircle,
                          isPassed && styles.timelineCirclePassed,
                          isCurrent && styles.timelineCircleCurrent,
                          isUpcoming && styles.timelineCircleUpcoming,
                        ]}
                      >
                        {isPassed ? (
                          <Icon name="check" size={10} color={colors.white} strokeWidth={2.5} />
                        ) : (
                          <View
                            style={[
                              styles.timelineDot,
                              isCurrent && { backgroundColor: colors.primary },
                              isUpcoming && { backgroundColor: '#CBD5E1' },
                            ]}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.timelineLabel,
                          isCurrent && styles.timelineLabelCurrent,
                          isPassed && styles.timelineLabelPassed,
                        ]}
                        numberOfLines={1}
                      >
                        {step.title}
                      </Text>
                    </View>
                    {idx < timelineSteps.length - 1 && (
                      <View
                        style={[
                          styles.timelineConnector,
                          isPassed ? styles.timelineConnectorPassed : styles.timelineConnectorUpcoming,
                        ]}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* Commercial & Payment Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Payment & Billing Balance</Text>
            <View
              style={[
                styles.badgePill,
                { backgroundColor: paymentBadge.bg, borderColor: paymentBadge.border },
              ]}
            >
              <Text style={[styles.badgePillText, { color: paymentBadge.text }]}>
                {paymentBadge.label}
              </Text>
            </View>
          </View>

          <View style={styles.balancesGrid}>
            <View style={styles.balanceBox}>
              <Text style={styles.balanceBoxLabel}>Order Total</Text>
              <Text style={styles.balanceBoxValue} numberOfLines={1} adjustsFontSizeToFit>{formatPaiseToINR(order.grandTotalPaise)}</Text>
            </View>
            <View style={[styles.balanceBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
              <Text style={[styles.balanceBoxLabel, { color: '#047857' }]}>Amount Paid</Text>
              <Text style={[styles.balanceBoxValue, { color: '#047857' }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatPaiseToINR(totalPaid)}
              </Text>
            </View>
            <View
              style={[
                styles.balanceBox,
                remainingDue > 0
                  ? { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }
                  : { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
              ]}
            >
              <Text
                style={[
                  styles.balanceBoxLabel,
                  remainingDue > 0 ? { color: '#B91C1C' } : { color: '#047857' },
                ]}
              >
                Balance Due
              </Text>
              <Text
                style={[
                  styles.balanceBoxValue,
                  remainingDue > 0 ? { color: '#B91C1C' } : { color: '#047857' },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatPaiseToINR(remainingDue)}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Payment Mode</Text>
              <Text style={styles.metaValue}>{order.paymentMethod?.replace(/_/g, ' ')}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Payment Settlement</Text>
              <Text style={styles.metaValue}>
                {remainingDue <= 0 ? 'Full Payment Settled' : 'Awaiting Offline Receipt'}
              </Text>
            </View>
          </View>

          {remainingDue > 0 && !isCancelledOrRejected && (
            <TouchableOpacity
              style={styles.payNowBtn}
              onPress={handleOnlinePayment}
              disabled={isPayingOnline}
              activeOpacity={0.85}
            >
              {isPayingOnline ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <View style={styles.payNowRow}>
                  <Icon name="check" size={14} color={colors.white} strokeWidth={2.5} />
                  <Text style={styles.payNowBtnText}>
                    Pay Balance via Razorpay ({formatPaiseToINR(remainingDue)})
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Payment History Transactions Ledger */}
        {order.payments && order.payments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Payment History Ledger ({order.payments.length})
            </Text>
            {order.payments.map((pm, pIdx) => (
              <View key={pIdx} style={styles.paymentTxRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentTxMethod}>
                    {pm.paymentMethod?.replace(/_/g, ' ')} • Ref: {pm.referenceNumber}
                  </Text>
                  <Text style={styles.paymentTxDate}>
                    {pm.verifiedAt ? new Date(pm.verifiedAt).toLocaleString('en-IN') : 'Verified'}
                    {pm.verifiedByName ? ` by ${pm.verifiedByName}` : ''}
                  </Text>
                  {pm.notes ? <Text style={styles.paymentTxNotes}>Note: {pm.notes}</Text> : null}
                </View>
                <Text style={styles.paymentTxAmount}>{formatPaiseToINR(pm.amountPaise)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Dispatch & Consignment Tracking Card */}
        {order.dispatchDetails && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Consignment Dispatch & Tracking</Text>
            <View style={styles.dispatchRow}>
              <Text style={styles.dispatchLabel}>Courier Partner:</Text>
              <Text style={styles.dispatchValue}>
                {order.dispatchDetails.courierName || 'Surface Transport'}
              </Text>
            </View>
            {order.dispatchDetails.trackingNumber && (
              <View style={styles.dispatchRow}>
                <Text style={styles.dispatchLabel}>Docket / Ref #:</Text>
                <Text
                  style={[styles.dispatchValue, { fontFamily: 'monospace', color: colors.primaryDark }]}
                >
                  {order.dispatchDetails.trackingNumber}
                </Text>
              </View>
            )}
            {order.dispatchDetails.dispatchedAt && (
              <View style={styles.dispatchRow}>
                <Text style={styles.dispatchLabel}>Dispatched On:</Text>
                <Text style={styles.dispatchValue}>
                  {new Date(order.dispatchDetails.dispatchedAt).toLocaleString('en-IN')}
                </Text>
              </View>
            )}
            {order.dispatchDetails.transportDetails && (
              <Text style={styles.transportDetailsText}>
                {order.dispatchDetails.transportDetails}
              </Text>
            )}
            {order.dispatchDetails.trackingUrl && (
              <TouchableOpacity
                style={styles.trackConsignmentBtn}
                onPress={() => Linking.openURL(order.dispatchDetails?.trackingUrl || '')}
                activeOpacity={0.85}
              >
                <Text style={styles.trackConsignmentBtnText}>Track Shipment Online</Text>
                <Icon
                  name="arrow-right"
                  size={12}
                  color={colors.white}
                  strokeWidth={2}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Line Items Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Itemized Products ({order.items?.length || 0})</Text>

          {order.items?.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemMain}>
                <Text style={styles.itemName}>{item.productNameSnapshot}</Text>
                {item.variantNameSnapshot && (
                  <View style={styles.itemVariantBadge}>
                    <Text style={styles.itemVariantBadgeText}>
                      Variant: {item.variantNameSnapshot}
                    </Text>
                  </View>
                )}
                <Text style={styles.itemSku}>
                  SKU: {item.variantSkuSnapshot || item.skuSnapshot}
                </Text>
                <Text style={styles.itemQtyRate}>
                  {item.quantity} units × {formatPaiseToINR(item.unitPricePaiseSnapshot)}
                </Text>
                {item.tierAppliedSnapshot && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <Icon name="star" size={10} color={colors.primaryDark} strokeWidth={2} style={{ marginRight: 4 }} />
                    <Text style={styles.itemTierText}>
                      Quantity Tier Applied (Min {item.tierMinQuantitySnapshot}+ units)
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.itemTotalCol}>
                <Text style={styles.itemLineTotal}>{formatPaiseToINR(item.lineTotalPaise)}</Text>
                <Text style={styles.itemTaxDetail}>GST {item.gstRatePercentSnapshot}%</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Financial Breakdown Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Commercial Tax & Billing</Text>

          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Wholesale Subtotal</Text>
            <Text style={styles.calcValue}>{formatPaiseToINR(order.subtotalPaise)}</Text>
          </View>

          {order.totalDiscountPaise > 0 && (
            <View style={styles.calcRow}>
              <Text style={[styles.calcLabel, { color: colors.primaryDark }]}>Discount</Text>
              <Text style={[styles.calcValue, { color: colors.primaryDark }]}>
                −{formatPaiseToINR(order.totalDiscountPaise)}
              </Text>
            </View>
          )}

          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Taxable Base</Text>
            <Text style={styles.calcValue}>{formatPaiseToINR(order.taxableAmountPaise)}</Text>
          </View>

          {order.totalCgstPaise > 0 && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>CGST (9%)</Text>
              <Text style={styles.calcValue}>{formatPaiseToINR(order.totalCgstPaise)}</Text>
            </View>
          )}

          {order.totalSgstPaise > 0 && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>SGST (9%)</Text>
              <Text style={styles.calcValue}>{formatPaiseToINR(order.totalSgstPaise)}</Text>
            </View>
          )}

          {order.totalIgstPaise > 0 && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>IGST (18%)</Text>
              <Text style={styles.calcValue}>{formatPaiseToINR(order.totalIgstPaise)}</Text>
            </View>
          )}

          <View style={styles.calcDivider} />

          <View style={styles.calcRow}>
            <Text style={styles.grandTotalLabel}>Grand Total (Incl. GST)</Text>
            <Text style={styles.grandTotalValue}>{formatPaiseToINR(order.grandTotalPaise)}</Text>
          </View>
        </View>

        {/* Official Tax Invoice & PDF Document Card */}
        {invoice ? (
          <View style={styles.card}>
            <View style={styles.invoiceHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Tax Invoice #{invoice.invoiceNumber}</Text>
                <Text style={styles.invoiceDateText}>
                  Issued: {new Date(invoice.issueDate).toLocaleDateString('en-IN')} • Due: {new Date(invoice.dueDate).toLocaleDateString('en-IN')}
                </Text>
              </View>
              <View style={[styles.invoiceStatusBadge, invoice.status === 'PAID' ? styles.invoicePaidBadge : styles.invoicePendingBadge]}>
                <Text style={[styles.invoiceStatusText, invoice.status === 'PAID' ? styles.invoicePaidText : styles.invoicePendingText]}>
                  {invoice.status}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.downloadPdfBtn}
              onPress={handleDownloadPdf}
              activeOpacity={0.85}
            >
              <Text style={styles.downloadPdfText}>View / Download Tax Invoice (PDF)</Text>
              <Icon name="arrow-right" size={12} color={colors.white} strokeWidth={2} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Delivery Address Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Facility Address</Text>
          <Text style={styles.addressLine}>{order.deliveryAddress?.street}</Text>
          <Text style={styles.addressLine}>
            {order.deliveryAddress?.city}, {order.deliveryAddress?.state} - {order.deliveryAddress?.pincode}
          </Text>

          {order.customerNotes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Customer Instructions:</Text>
              <Text style={styles.notesText}>{order.customerNotes}</Text>
            </View>
          ) : null}
        </View>

        {/* Cancellation Action if eligible */}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelOrderBtn}
            onPress={handleCancelOrder}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text style={styles.cancelOrderBtnText}>Cancel This Order</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
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
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.slate500,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
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
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate900,
  },
  orderDate: {
    fontSize: 12,
    color: colors.slate400,
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  statusPillText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  cancellationBox: {
    backgroundColor: colors.dangerBg,
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  cancellationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  cancellationText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.slate500,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemMain: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate900,
  },
  itemSku: {
    fontSize: 11,
    color: colors.slate400,
    marginTop: 2,
  },
  itemQtyRate: {
    fontSize: 12,
    color: colors.slate600,
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
  itemTierText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    marginTop: 2,
  },
  itemTotalCol: {
    alignItems: 'flex-end',
  },
  itemLineTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.slate900,
  },
  itemTaxDetail: {
    fontSize: 10,
    color: colors.slate400,
    marginTop: 2,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  calcLabel: {
    fontSize: 12,
    color: colors.slate600,
  },
  calcValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate800,
  },
  calcDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.slate900,
  },
  grandTotalValue: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  addressLine: {
    fontSize: 13,
    color: colors.slate700,
    lineHeight: 18,
  },
  notesBox: {
    backgroundColor: colors.highlightBg,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate500,
  },
  notesText: {
    fontSize: 12,
    color: colors.slate700,
    marginTop: 2,
  },
  cancelOrderBtn: {
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.dangerBg,
  },
  cancelOrderBtnText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  invoiceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  invoiceDateText: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
  },
  invoiceStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  invoicePaidBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  invoicePendingBadge: {
    backgroundColor: '#FFF1E8',
    borderColor: '#F0E0D5',
  },
  invoiceStatusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  invoicePaidText: {
    color: '#059669',
  },
  invoicePendingText: {
    color: '#E95B2A',
  },
  downloadPdfBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  downloadPdfText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  statusPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  balancesGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  balanceBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  balanceBoxLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.slate500,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  balanceBoxValue: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.slate900,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  timelineStep: {
    alignItems: 'center',
    width: 52,
  },
  timelineCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 6,
    backgroundColor: colors.white,
  },
  timelineCirclePassed: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timelineCircleCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  timelineCircleUpcoming: {
    borderColor: '#CBD5E1',
    backgroundColor: colors.white,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.slate400,
    textAlign: 'center',
  },
  timelineLabelCurrent: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  timelineLabelPassed: {
    fontWeight: '700',
    color: colors.slate700,
  },
  timelineConnector: {
    flex: 1,
    height: 2,
    marginTop: -18,
    marginHorizontal: -4,
  },
  timelineConnectorPassed: {
    backgroundColor: colors.primary,
  },
  timelineConnectorUpcoming: {
    backgroundColor: '#E2E8F0',
  },
  paymentTxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentTxMethod: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate800,
  },
  paymentTxDate: {
    fontSize: 10,
    color: colors.slate500,
    marginTop: 2,
  },
  paymentTxNotes: {
    fontSize: 10,
    color: colors.slate400,
    fontStyle: 'italic',
    marginTop: 1,
  },
  paymentTxAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  dispatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dispatchLabel: {
    fontSize: 12,
    color: colors.slate500,
  },
  dispatchValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate800,
  },
  transportDetailsText: {
    fontSize: 11,
    color: colors.slate600,
    marginTop: 6,
    fontStyle: 'italic',
  },
  trackConsignmentBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  trackConsignmentBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  payNowBtn: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  payNowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payNowBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
});
