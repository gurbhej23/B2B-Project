import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { mobileApi, extractErrorMessage } from '../../../lib/api';
import { formatPaiseToINR, OrderStatus } from '@necessity/shared';
import { Order } from '../../types/models';
import { colors } from '../../theme/colors';
import { Icon } from '../../components/common/Icon';

export const OrdersListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setError(null);
    try {
      const res = await mobileApi.get('/orders?limit=25');
      if (res.success) {
        setOrders(res.data || []);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  const getStatusBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.DELIVERED:
        return { bg: colors.successBg, text: colors.success, border: colors.successBorder, label: 'DELIVERED' };
      case OrderStatus.PICKED_UP:
        return { bg: '#E6FFFA', text: '#0D9488', border: '#99F6E4', label: 'PICKED UP' };
      case OrderStatus.DISPATCHED:
        return { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE', label: 'DISPATCHED' };
      case OrderStatus.PROCESSING:
        return { bg: colors.primaryBg, text: colors.primaryDark, border: colors.primaryBorder, label: 'PROCESSING' };
      case OrderStatus.APPROVED:
        return { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', label: 'APPROVED' };
      case OrderStatus.CANCELLED:
        return { bg: colors.dangerBg, text: colors.danger, border: colors.dangerBorder, label: 'CANCELLED' };
      case OrderStatus.REJECTED:
        return { bg: colors.dangerBg, text: colors.danger, border: colors.dangerBorder, label: 'REJECTED' };
      default:
        return { bg: colors.warningBg, text: colors.warning, border: colors.warningBorder, label: 'PENDING' };
    }
  };

  const getPaymentBadgeStyle = (paymentStatus: string) => {
    switch (paymentStatus?.toLowerCase()) {
      case 'paid':
      case 'successful':
        return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0', label: 'PAID' };
      case 'partially_paid':
        return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', label: 'PARTIALLY PAID' };
      default:
        return { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA', label: 'UNPAID' };
    }
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    const badgeStyle = getStatusBadgeStyle(item.status);
    const paymentBadge = getPaymentBadgeStyle(item.paymentStatus as any);
    const dateFormatted = new Date(item.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const totalPaid = item.totalPaidPaise || 0;
    const isPartiallyPaid = item.paymentStatus === ('partially_paid' as any);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={0.85}
        onPress={() => {
          const orderId = item.id || (item as any)._id;
          navigation.navigate('OrderDetails', { orderId });
        }}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
            <Text style={styles.orderDate}>{dateFormatted}</Text>
          </View>
          <View style={styles.headerBadgesRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border },
              ]}
            >
              <Text style={[styles.statusText, { color: badgeStyle.text }]}>
                {badgeStyle.label}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: paymentBadge.bg, borderColor: paymentBadge.border, marginLeft: 6 },
              ]}
            >
              <Text style={[styles.statusText, { color: paymentBadge.text }]}>
                {paymentBadge.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBody}>
          <Text style={styles.itemsCountText}>
            {item.items?.length || 0} line items • Delivery to {item.deliveryAddress?.city || 'Facility'}
          </Text>
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
              {isPartiallyPaid && (
                <Text style={styles.paidSubtext}>Paid: {formatPaiseToINR(totalPaid)}</Text>
              )}
            </View>
            <Text style={styles.totalValue}>{formatPaiseToINR(item.grandTotalPaise)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Commercial Order History</Text>
          <Text style={styles.subtitle}>Track wholesale dispatch status & GST invoices</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          disabled={isRefreshing}
          activeOpacity={0.7}
        >
          <Icon name="refresh" size={13} color={colors.primary} />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching order ledger...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchOrders}>
            <Text style={styles.retryBtnText}>Retry Loading</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Icon name="orders" size={44} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No Orders Placed Yet</Text>
          <Text style={styles.emptySubtitle}>
            When you place wholesale orders for facility supplies, they will appear here with real-time tracking.
          </Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => navigation.navigate('CatalogueTab')}
            activeOpacity={0.85}
          >
            <Text style={styles.browseBtnText}>Explore Catalogue</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id || (item as any)._id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1E7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE4D2',
    gap: 5,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  orderDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemsCountText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  totalRow: {
    alignItems: 'flex-end',
  },
  paidSubtext: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
    marginTop: 1,
  },
  totalLabel: {
    fontSize: 8,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
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
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: '700',
  },
  emptyBox: {
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
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 18,
  },
  browseBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  browseBtnText: {
    color: colors.white,
    fontWeight: '700',
  },
});
