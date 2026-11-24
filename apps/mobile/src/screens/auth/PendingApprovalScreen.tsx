import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { mobileApi, extractErrorMessage } from '../../../lib/api';
import { colors } from '../../theme/colors';

export const PendingApprovalScreen: React.FC = () => {
  const { user, retailer, refreshProfile, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const emailOrPhone = user?.email || user?.phone || (retailer as any)?.email || (retailer as any)?.phone;
      if (emailOrPhone) {
        const res = await mobileApi.get(
          `/auth/check-status?identifier=${encodeURIComponent(emailOrPhone)}`
        );
        const statusData = res.data || res;
        if (statusData.isApproved || statusData.accountStatus === 'ACTIVE') {
          try {
            await refreshProfile();
          } catch {
            // ignore session refresh error
          }
          Alert.alert(
            'Account Approved! 🎉',
            'Your account has been approved by administration. You can now login to access wholesale pricing.',
            [
              { text: 'Go to Login', onPress: logout },
            ]
          );
          return;
        } else if (statusData.accountStatus === 'REJECTED') {
          Alert.alert(
            'Application Rejected',
            statusData.rejectionReason || 'Your application was rejected by the administration. Please contact support.'
          );
          return;
        }
      }

      Alert.alert(
        'Verification Check ⏳',
        'Your account application is still under review by administration. Once approved, wholesale access will unlock automatically.'
      );
    } catch (err: any) {
      Alert.alert('Verification Check', extractErrorMessage(err) || 'Could not verify status. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const businessName = retailer?.businessName || 'Your Business';
  const email = user?.email || retailer?.billingAddress?.street || 'Registered Account';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconHourglass}>⏳</Text>
        </View>

        <Text style={styles.title}>Account Under Verification</Text>
        <Text style={styles.subtitle}>
          Your B2B customer application has been received and is being verified by Necessity India administration.
        </Text>

        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Business Name</Text>
            <Text style={styles.detailValue}>{businessName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Contact Email</Text>
            <Text style={styles.detailValue}>{email}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Approval Status</Text>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>PENDING ADMIN APPROVAL</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            Our commercial accounts team will verify your GSTIN and business credentials. Once approved, you will have instant access to wholesale dealer pricing, tiered discounts, and institutional credit terms.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.checkButton}
          onPress={handleRefresh}
          disabled={isRefreshing}
          activeOpacity={0.8}
        >
          {isRefreshing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.checkButtonText}>Check Approval Status</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutButtonText}>Go to Login Page</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.slate50,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.warningBg,
    borderWidth: 2,
    borderColor: colors.warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconHourglass: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.slate900,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.slate600,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: colors.highlightBg,
    borderRadius: 12,
    padding: 16,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.slate500,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: colors.slate800,
    fontWeight: '700',
  },
  pendingBadge: {
    backgroundColor: colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  pendingBadgeText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '700',
  },
  infoBanner: {
    backgroundColor: colors.primaryBg,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    marginBottom: 20,
  },
  infoText: {
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  checkButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  checkButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    width: '100%',
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: colors.slate500,
    fontSize: 14,
    fontWeight: '600',
  },
});
