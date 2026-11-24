import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

export const AccountDisabledScreen: React.FC = () => {
  const { disabledReason, logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>✕</Text>
        </View>

        <Text style={styles.title}>Account Deactivated</Text>
        <Text style={styles.subtitle}>
          {disabledReason ||
            'Your Necessity India customer ordering account has been deactivated or suspended by administration.'}
        </Text>

        <View style={styles.supportBox}>
          <Text style={styles.supportTitle}>Need Assistance?</Text>
          <Text style={styles.supportText}>
            If you believe this is in error or wish to reactivate your trade account, please contact our commercial accounts team:
          </Text>
          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Commercial Accounts Desk:</Text>
            <Text style={styles.contactValue}>accounts@necessityindia.com</Text>
          </View>
          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Support Helpline:</Text>
            <Text style={styles.contactValue}>+91 22 6123 4567</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutButtonText}>Sign Out</Text>
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
    backgroundColor: colors.dangerBg,
    borderWidth: 2,
    borderColor: colors.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 32,
    color: colors.danger,
    fontWeight: '800',
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
  supportBox: {
    width: '100%',
    backgroundColor: colors.highlightBg,
    borderRadius: 12,
    padding: 16,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 6,
  },
  supportText: {
    fontSize: 12,
    color: colors.slate600,
    lineHeight: 18,
    marginBottom: 12,
  },
  contactItem: {
    marginTop: 6,
  },
  contactLabel: {
    fontSize: 11,
    color: colors.slate500,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  contactValue: {
    fontSize: 13,
    color: colors.primaryDark,
    fontWeight: '700',
    marginTop: 1,
  },
  logoutButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
