import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { Icon } from '../../components/common/Icon';
import { mobileApi, extractErrorMessage } from '../../../lib/api';

export const AccountScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, retailer, isWholesaler, isDistributor, logout, refreshProfile } = useAuth();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit Profile Modal State
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Address Modal State
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPincode, setAddrPincode] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Change Password Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Legal Modal (Terms / Privacy) State
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalType, setLegalType] = useState<'terms' | 'privacy'>('terms');

  // Notification Preferences State
  const [orderNotifications, setOrderNotifications] = useState(true);
  const [dispatchAlerts, setDispatchAlerts] = useState(true);
  const [priceOffers, setPriceOffers] = useState(false);

  const customerCode = retailer?.id
    ? `#NI-${retailer.id.slice(-6).toUpperCase()}`
    : user?.id
      ? `#NI-${user.id.slice(-6).toUpperCase()}`
      : '#NI-B2B';

  const customerTypeLabel = isDistributor
    ? 'Authorized Distributor'
    : isWholesaler
      ? 'Verified Wholesaler'
      : 'Verified Retailer';

  const userInitials = (user?.name || retailer?.businessName || 'NI')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } catch {
      // ignore background refresh error
    } finally {
      setIsRefreshing(false);
    }
  };

  // --- Profile Actions ---
  const openEditProfile = () => {
    setProfileName(user?.name || '');
    setProfileEmail(user?.email || '');
    setEditProfileVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim() || profileName.trim().length < 2) {
      Alert.alert('Validation Error', 'Please enter your valid contact name (at least 2 characters).');
      return;
    }
    if (profileEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    setIsSavingProfile(true);
    try {
      await mobileApi.patch('/auth/profile', {
        name: profileName.trim(),
        email: profileEmail.trim(),
      });
      await refreshProfile();
      setEditProfileVisible(false);
      Alert.alert('Profile Updated', 'Your personal details have been updated successfully.');
    } catch (err: any) {
      Alert.alert('Update Failed', extractErrorMessage(err));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- Address Actions ---
  const deliveryAddresses = retailer?.deliveryAddresses || [];

  const openAddAddress = () => {
    setEditingAddressIndex(null);
    setAddrStreet('');
    setAddrCity(retailer?.billingAddress?.city || '');
    setAddrState(retailer?.billingAddress?.state || '');
    setAddrPincode('');
    setAddrIsDefault(deliveryAddresses.length === 0);
    setAddressModalVisible(true);
  };

  const openEditAddress = (index: number) => {
    const item = deliveryAddresses[index];
    if (!item) return;
    setEditingAddressIndex(index);
    setAddrStreet(item.street || '');
    setAddrCity(item.city || '');
    setAddrState(item.state || '');
    setAddrPincode(item.pincode || '');
    setAddrIsDefault(Boolean(item.isDefault));
    setAddressModalVisible(true);
  };

  const handleDeleteAddress = (index: number) => {
    Alert.alert(
      'Delete Delivery Address',
      'Are you sure you want to remove this delivery address from your wholesale account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = deliveryAddresses.filter((_, i) => i !== index);
            try {
              await mobileApi.patch('/retailers/my-addresses', {
                deliveryAddresses: updated,
              });
              await refreshProfile();
            } catch (err: any) {
              Alert.alert('Error', extractErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  const handleSetDefaultAddress = async (index: number) => {
    const updated = deliveryAddresses.map((addr, i) => ({
      ...addr,
      isDefault: i === index,
    }));
    try {
      await mobileApi.patch('/retailers/my-addresses', {
        deliveryAddresses: updated,
      });
      await refreshProfile();
    } catch (err: any) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  const handleSaveAddress = async () => {
    if (!addrStreet.trim()) {
      Alert.alert('Validation Error', 'Please enter street / facility address.');
      return;
    }
    if (!addrCity.trim()) {
      Alert.alert('Validation Error', 'Please enter city.');
      return;
    }
    if (!addrState.trim()) {
      Alert.alert('Validation Error', 'Please enter state.');
      return;
    }
    if (!addrPincode.trim() || !/^\d{6}$/.test(addrPincode.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid 6-digit postal pincode.');
      return;
    }

    setIsSavingAddress(true);
    try {
      const newEntry = {
        street: addrStreet.trim(),
        city: addrCity.trim(),
        state: addrState.trim(),
        pincode: addrPincode.trim(),
        isDefault: addrIsDefault,
      };

      let updatedList = [...deliveryAddresses];
      if (editingAddressIndex !== null) {
        updatedList[editingAddressIndex] = newEntry;
      } else {
        updatedList.push(newEntry);
      }

      if (addrIsDefault) {
        updatedList = updatedList.map((a, idx) => ({
          ...a,
          isDefault:
            editingAddressIndex !== null
              ? idx === editingAddressIndex
              : idx === updatedList.length - 1,
        }));
      }

      await mobileApi.patch('/retailers/my-addresses', {
        deliveryAddresses: updatedList,
      });
      await refreshProfile();
      setAddressModalVisible(false);
      Alert.alert(
        'Address Saved',
        editingAddressIndex !== null
          ? 'Delivery address updated successfully.'
          : 'New delivery address added successfully.'
      );
    } catch (err: any) {
      Alert.alert('Save Failed', extractErrorMessage(err));
    } finally {
      setIsSavingAddress(false);
    }
  };

  // --- Password Actions ---
  const handleSavePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Validation Error', 'Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Validation Error', 'New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New password and confirmation do not match.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await mobileApi.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(
        'Security Updated',
        'Your password has been changed securely. Other sessions have been rotated.'
      );
    } catch (err: any) {
      Alert.alert('Change Password Failed', extractErrorMessage(err));
    } finally {
      setIsSavingPassword(false);
    }
  };

  // --- Logout Action ---
  const handleLogout = () => {
    Alert.alert(
      'Sign Out of Wholesale Account',
      'Are you sure you want to securely sign out from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  // --- External Support Links ---
  const handleCallHelpline = () => {
    Linking.openURL('tel:9876076067').catch(() => {
      Alert.alert('Contact Helpline', 'Dial +91 9876076067 for wholesale merchant support.');
    });
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:accounts@necessityindia.com?subject=Wholesale%20Merchant%20Inquiry').catch(
      () => {
        Alert.alert('Email Support', 'Contact us at accounts@necessityindia.com');
      }
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* 1. Profile Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{userInitials}</Text>
          </View>

          <View style={styles.headerDetails}>
            <View style={styles.nameVerifiedRow}>
              <Text style={styles.businessTitle} numberOfLines={1}>
                {retailer?.businessName || user?.name || 'Wholesale Partner'}
              </Text>
              <View style={styles.verifiedBadge}>
                <Icon name="check" size={11} color="#16834A" strokeWidth={2.5} />
                <Text style={styles.verifiedText}>VERIFIED</Text>
              </View>
            </View>

            <Text style={styles.contactNameSub}>
              {user?.name} • Authorized Buyer
            </Text>

            <View style={styles.codeRoleRow}>
              <View style={styles.customerCodePill}>
                <Text style={styles.customerCodeText}>{customerCode}</Text>
              </View>
              <View
                style={[
                  styles.roleBadgePill,
                  isDistributor
                    ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
                    : isWholesaler
                      ? { backgroundColor: '#F3E8FF', borderColor: '#E9D5FF' }
                      : { backgroundColor: '#FFF1E7', borderColor: '#FDE4D2' },
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    isDistributor
                      ? { color: '#B45309' }
                      : isWholesaler
                        ? { color: '#7E22CE' }
                        : { color: colors.primary },
                  ]}
                >
                  {customerTypeLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.headerActionDivider} />

        <View style={styles.headerActionsRow}>
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={openEditProfile}
            activeOpacity={0.7}
          >
            <Icon name="edit" size={14} color={colors.primary} />
            <Text style={styles.editProfileBtnText}>Edit Contact Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Icon name="refresh" size={14} color={colors.textSecondary} />
            <Text style={styles.refreshIconText}>Sync Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Quick Action: My Wholesale Orders Shortcut */}
      <TouchableOpacity
        style={styles.ordersShortcutCard}
        onPress={() => navigation.navigate('OrdersTab')}
        activeOpacity={0.8}
      >
        <View style={styles.shortcutIconBox}>
          <Icon name="orders" size={20} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={styles.shortcutTextBox}>
          <Text style={styles.shortcutTitle}>My Wholesale Orders</Text>
          <Text style={styles.shortcutSub}>
            Track active shipments, past orders & dispatch receipts
          </Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.slate400} />
      </TouchableOpacity>

      {/* 3. Personal Information Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <View style={styles.iconPill}>
              <Icon name="account" size={16} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          <TouchableOpacity onPress={openEditProfile} activeOpacity={0.7}>
            <Text style={styles.sectionEditAction}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Full Contact Name</Text>
          <Text style={styles.infoValue}>{user?.name || '—'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Registered Mobile</Text>
          <View style={styles.verifiedValRow}>
            <Text style={styles.verifiedPhoneText}>+91 {user?.phone || '—'}</Text>
            <View style={styles.phoneCheckBadge}>
              <Icon name="check" size={10} color="#16834A" strokeWidth={2.5} />
            </View>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Business Email</Text>
          <Text style={styles.infoValue}>{user?.email || 'Not specified'}</Text>
        </View>

        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Account Designation</Text>
          <Text style={styles.infoValue}>Authorized Commercial Buyer</Text>
        </View>
      </View>

      {/* 4. Business & Tax Information Card (Admin Controlled) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <View style={styles.iconPill}>
              <Icon name="box" size={16} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Business & Tax Credentials</Text>
          </View>
          <View style={styles.verifiedTagPill}>
            <Text style={styles.verifiedTagText}>Admin Verified</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Business Name</Text>
          <Text style={styles.infoValue}>{retailer?.businessName || 'Wholesale Buyer'}</Text>
        </View>

        {retailer?.tradeName ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Trade Name</Text>
            <Text style={styles.infoValue}>{retailer.tradeName}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Customer Classification</Text>
          <Text style={styles.infoValue}>{customerTypeLabel}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>GSTIN Identification</Text>
          <Text style={[styles.infoValue, { letterSpacing: 0.5, fontWeight: '700' }]}>
            {retailer?.gstin || 'Unregistered / Non-GST'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Permanent Account (PAN)</Text>
          <Text style={[styles.infoValue, { letterSpacing: 0.5 }]}>
            {retailer?.pan || 'On Verified File'}
          </Text>
        </View>

        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Account Verification Status</Text>
          <View style={styles.activeStatusPill}>
            <View style={styles.greenDot} />
            <Text style={styles.activeStatusText}>
              {user?.accountStatus === 'ACTIVE' ? 'Active & Approved' : user?.accountStatus || 'Active'}
            </Text>
          </View>
        </View>

        <View style={styles.credentialFootnoteBox}>
          <Icon name="info" size={13} color={colors.textSecondary} />
          <Text style={styles.credentialFootnoteText}>
            Tax credentials and customer tier classifications are strictly verified by Necessity India accounts desk.
          </Text>
        </View>
      </View>

      {/* 5. Address Management Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <View style={styles.iconPill}>
              <Icon name="map-pin" size={16} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Commercial Addresses</Text>
          </View>
          <TouchableOpacity
            style={styles.addAddressAction}
            onPress={openAddAddress}
            activeOpacity={0.7}
          >
            <Icon name="plus" size={12} color={colors.primary} />
            <Text style={styles.addAddressActionText}>Add Address</Text>
          </TouchableOpacity>
        </View>

        {/* Registered Billing Address */}
        <View style={styles.billingAddressBlock}>
          <View style={styles.addressTypeHeaderRow}>
            <Text style={styles.addressTypeTag}>REGISTERED BILLING ADDRESS</Text>
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>OFFICIAL</Text>
            </View>
          </View>
          <Text style={styles.addressStreetText}>
            {retailer?.billingAddress?.street || 'Facility address registered during onboarding'}
          </Text>
          <Text style={styles.addressRegionText}>
            {[
              retailer?.billingAddress?.city,
              retailer?.billingAddress?.state,
              retailer?.billingAddress?.pincode,
            ]
              .filter(Boolean)
              .join(', ') || 'Mohali, Punjab'}
          </Text>
        </View>

        {/* Shipping / Delivery Addresses List */}
        <View style={styles.deliverySection}>
          <Text style={styles.subSectionTitle}>Delivery & Dispatch Locations</Text>

          {deliveryAddresses.length === 0 ? (
            <View style={styles.emptyAddressBox}>
              <Text style={styles.emptyAddressText}>
                No secondary shipping addresses added. Wholesale shipments default to your registered billing address.
              </Text>
            </View>
          ) : (
            deliveryAddresses.map((addr, index) => (
              <View key={index} style={styles.deliveryAddressCard}>
                <View style={styles.deliveryAddressTop}>
                  <View style={styles.deliveryAddressLabelRow}>
                    <Text style={styles.deliveryAddressIndexTitle}>Location #{index + 1}</Text>
                    {addr.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>DEFAULT DELIVERY</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleSetDefaultAddress(index)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.makeDefaultText}>Set as Default</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.addressActionIcons}>
                    <TouchableOpacity
                      onPress={() => openEditAddress(index)}
                      style={styles.actionIconTouch}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="edit" size={13} color={colors.slate600} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteAddress(index)}
                      style={styles.actionIconTouch}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="trash" size={13} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.addressStreetText}>{addr.street}</Text>
                <Text style={styles.addressRegionText}>
                  {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* 6. Security Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <View style={styles.iconPill}>
              <Icon name="lock" size={16} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Account Security</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.interactiveRow}
          onPress={() => setPasswordModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.interactiveRowTextContainer}>
            <Text style={styles.interactiveRowTitle}>Change Login Password</Text>
            <Text style={styles.interactiveRowSub}>
              Update your wholesale portal access credentials
            </Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.slate400} />
        </TouchableOpacity>

        <View style={styles.sessionStatusRow}>
          <View style={styles.sessionStatusTextContainer}>
            <Text style={styles.interactiveRowTitle}>Active Mobile Session</Text>
            <Text style={styles.interactiveRowSub}>
              Authenticated device session with 256-bit token encryption
            </Text>
          </View>
          <View style={styles.secureSessionTag}>
            <Icon name="shield" size={12} color="#16834A" />
            <Text style={styles.secureSessionText}>Secured</Text>
          </View>
        </View>
      </View>

      {/* 7. Settings, Support & Policies Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <View style={styles.iconPill}>
              <Icon name="bell" size={16} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Preferences & Commercial Desk</Text>
          </View>
        </View>

        {/* Preference Toggles */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={styles.toggleTitle}>Order Status & Dispatch Alerts</Text>
            <Text style={styles.toggleSub}>Receive push updates when wholesale shipments leave</Text>
          </View>
          <Switch
            value={orderNotifications}
            onValueChange={setOrderNotifications}
            trackColor={{ false: '#EEEEEE', true: colors.primaryBg }}
            thumbColor={orderNotifications ? colors.primary : '#999'}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={styles.toggleTitle}>Wholesale Rate Card Alerts</Text>
            <Text style={styles.toggleSub}>Notifications about special tier pricing & volume deals</Text>
          </View>
          <Switch
            value={priceOffers}
            onValueChange={setPriceOffers}
            trackColor={{ false: '#EEEEEE', true: colors.primaryBg }}
            thumbColor={priceOffers ? colors.primary : '#999'}
          />
        </View>

        <View style={styles.menuDivider} />

        {/* Support actions */}
        <TouchableOpacity
          style={styles.interactiveRow}
          onPress={handleCallHelpline}
          activeOpacity={0.7}
        >
          <View style={styles.supportRowLeft}>
            <View style={styles.smallCircleIcon}>
              <Icon name="phone" size={14} color={colors.primary} />
            </View>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.interactiveRowTitle}>Customer Support Helpline</Text>
              <Text style={styles.interactiveRowSub}>Direct line: +91 9876076067</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={16} color={colors.slate400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.interactiveRow}
          onPress={handleEmailSupport}
          activeOpacity={0.7}
        >
          <View style={styles.supportRowLeft}>
            <View style={styles.smallCircleIcon}>
              <Icon name="mail" size={14} color={colors.primary} />
            </View>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.interactiveRowTitle}>Commercial Accounts Desk</Text>
              <Text style={styles.interactiveRowSub}>accounts@necessityindia.com</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={16} color={colors.slate400} />
        </TouchableOpacity>

        <View style={styles.menuDivider} />

        {/* Legal documents */}
        <TouchableOpacity
          style={styles.interactiveRow}
          onPress={() => {
            setLegalType('terms');
            setLegalModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.supportRowLeft}>
            <View style={styles.smallCircleIcon}>
              <Icon name="file-text" size={14} color={colors.textSecondary} />
            </View>
            <Text style={[styles.interactiveRowTitle, { flex: 1, paddingRight: 6 }]}>
              Terms & Conditions of Wholesale Supply
            </Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.slate400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.interactiveRow}
          onPress={() => {
            setLegalType('privacy');
            setLegalModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.supportRowLeft}>
            <View style={styles.smallCircleIcon}>
              <Icon name="shield" size={14} color={colors.textSecondary} />
            </View>
            <Text style={[styles.interactiveRowTitle, { flex: 1, paddingRight: 6 }]}>
              Privacy Policy & Merchant Data Governance
            </Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.slate400} />
        </TouchableOpacity>
      </View>

      {/* 8. Secure Logout Action */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Icon name="log-out" size={16} color={colors.danger} />
        <Text style={styles.logoutBtnText}>Secure Sign Out</Text>
      </TouchableOpacity>

      {/* 9. App Version & Copyright Footer */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerBrand}>Necessity India B2B Customer Portal</Text>
        <Text style={styles.footerVersion}>Version 1.0.0 (Build 100) • Official Mobile Release</Text>
        <Text style={styles.footerCopyright}>
          D-182 1st Floor Phase 8 B, Mohali, Punjab. All rights reserved.
        </Text>
      </View>

      {/* =========================================================================
          MODAL 1: Edit Personal Contact Details
         ========================================================================= */}
      <Modal
        visible={editProfileVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditProfileVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Contact Details</Text>
              <TouchableOpacity
                onPress={() => setEditProfileVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Update your authorized buyer name and correspondence email for wholesale dispatch notices.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Contact Name *</Text>
              <TextInput
                style={styles.input}
                value={profileName}
                onChangeText={setProfileName}
                placeholder="Enter authorized full name"
                placeholderTextColor={colors.slate400}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Registered Mobile Number</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={`+91 ${user?.phone || ''}`}
                editable={false}
              />
              <Text style={styles.inputHelperText}>
                Primary phone is registered for two-factor authentication. Contact accounts to change.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Correspondence Email Address</Text>
              <TextInput
                style={styles.input}
                value={profileEmail}
                onChangeText={setProfileEmail}
                placeholder="buyer@business.com"
                placeholderTextColor={colors.slate400}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditProfileVisible(false)}
                disabled={isSavingProfile}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =========================================================================
          MODAL 2: Add / Edit Delivery Address
         ========================================================================= */}
      <Modal
        visible={addressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAddressIndex !== null ? 'Edit Delivery Address' : 'Add Delivery Address'}
              </Text>
              <TouchableOpacity
                onPress={() => setAddressModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Enter commercial shipping or warehouse address for wholesale dispatches.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Street / Building / Area *</Text>
              <TextInput
                style={styles.input}
                value={addrStreet}
                onChangeText={setAddrStreet}
                placeholder="e.g. Plot No. 45, Phase 8 B Industrial Area"
                placeholderTextColor={colors.slate400}
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>City *</Text>
                <TextInput
                  style={styles.input}
                  value={addrCity}
                  onChangeText={setAddrCity}
                  placeholder="e.g. Mohali"
                  placeholderTextColor={colors.slate400}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>State *</Text>
                <TextInput
                  style={styles.input}
                  value={addrState}
                  onChangeText={setAddrState}
                  placeholder="e.g. Punjab"
                  placeholderTextColor={colors.slate400}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Postal Pincode (6 digits) *</Text>
              <TextInput
                style={styles.input}
                value={addrPincode}
                onChangeText={setAddrPincode}
                placeholder="e.g. 160071"
                placeholderTextColor={colors.slate400}
                keyboardType="numeric"
                maxLength={6}
              />
            </View>

            <View style={styles.defaultCheckboxRow}>
              <Switch
                value={addrIsDefault}
                onValueChange={setAddrIsDefault}
                trackColor={{ false: '#EEEEEE', true: colors.primaryBg }}
                thumbColor={addrIsDefault ? colors.primary : '#999'}
              />
              <Text style={styles.defaultCheckboxLabel}>
                Set as default delivery address for wholesale checkout
              </Text>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAddressModalVisible(false)}
                disabled={isSavingAddress}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveAddress}
                disabled={isSavingAddress}
              >
                {isSavingAddress ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingAddressIndex !== null ? 'Update Location' : 'Save Address'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =========================================================================
          MODAL 3: Change Password
         ========================================================================= */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Access Password</Text>
              <TouchableOpacity
                onPress={() => setPasswordModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              For security, changing your password revokes active tokens across any other signed-in devices.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Current Password *</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={colors.slate400}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password (min 8 chars) *</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter at least 8 characters"
                placeholderTextColor={colors.slate400}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm New Password *</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.slate400}
                secureTextEntry
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setPasswordModalVisible(false)}
                disabled={isSavingPassword}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSavePassword}
                disabled={isSavingPassword}
              >
                {isSavingPassword ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =========================================================================
          MODAL 4: Legal Terms & Privacy Policy
         ========================================================================= */}
      <Modal
        visible={legalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLegalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {legalType === 'terms'
                  ? 'Terms & Conditions of Supply'
                  : 'Privacy & Merchant Governance'}
              </Text>
              <TouchableOpacity
                onPress={() => setLegalModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator style={styles.legalScrollView}>
              {legalType === 'terms' ? (
                <>
                  <Text style={styles.legalSectionHead}>1. Wholesale Supply & Commercial Scope</Text>
                  <Text style={styles.legalBodyText}>
                    All goods supplied by Necessity India are for verified commercial distribution,
                    institutional use, or retail resale. Minimum Order Quantities (MOQ) and tiered wholesale
                    rates apply as stipulated on each product category.
                  </Text>

                  <Text style={styles.legalSectionHead}>2. Tax Compliance & Invoicing</Text>
                  <Text style={styles.legalBodyText}>
                    All prices are quoted with GST details clearly indicated. Invoices are generated electronically
                    and transmitted via registered email and the portal ledger upon dispatch.
                  </Text>

                  <Text style={styles.legalSectionHead}>3. Inspection & Returns</Text>
                  <Text style={styles.legalBodyText}>
                    Merchants must inspect wholesale consignments upon delivery. Shortages or damaged cases
                    must be notified to the Commercial Desk within 48 hours with photographic proof.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.legalSectionHead}>1. Business Data Collection</Text>
                  <Text style={styles.legalBodyText}>
                    Necessity India gathers business credentials (GSTIN, PAN, registered addresses, and buyer contact
                    details) solely for order processing, logistics routing, tax invoicing, and credit risk assessment.
                  </Text>

                  <Text style={styles.legalSectionHead}>2. Data Security & Confidentiality</Text>
                  <Text style={styles.legalBodyText}>
                    Your trade information and wholesale transaction history are protected under enterprise-grade
                    encryption and never shared or sold to third-party commercial marketing entities.
                  </Text>
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { marginTop: 14 }]}
              onPress={() => setLegalModalVisible(false)}
            >
              <Text style={styles.saveBtnText}>Close Document</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 48,
    backgroundColor: '#FAFAFA',
  },

  // 1. Profile Header Card
  headerCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF1E7',
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  headerDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  nameVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  businessTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#252525',
    maxWidth: '72%',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A6F4C5',
    gap: 3,
  },
  verifiedText: {
    color: '#16834A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  contactNameSub: {
    fontSize: 12,
    color: '#777777',
    marginTop: 2,
  },
  codeRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
    flexWrap: 'wrap',
  },
  customerCodePill: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customerCodeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.4,
  },
  roleBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headerActionDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 12,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  refreshIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  refreshIconText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777777',
  },

  // 2. Orders Shortcut Card
  ordersShortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  shortcutIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF1E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shortcutTextBox: {
    flex: 1,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#252525',
  },
  shortcutSub: {
    fontSize: 11,
    color: '#777777',
    marginTop: 2,
  },

  // Generic Section Cards
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#FFF1E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#252525',
  },
  sectionEditAction: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  verifiedTagPill: {
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#A6F4C5',
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16834A',
  },

  // Info Rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  infoLabel: {
    fontSize: 13,
    color: '#777777',
    fontWeight: '500',
    flexShrink: 0,
    marginRight: 12,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#252525',
    textAlign: 'right',
    flex: 1,
  },
  verifiedValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  verifiedPhoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#252525',
    letterSpacing: 0.2,
  },
  phoneCheckBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#A6F4C5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16834A',
  },
  activeStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16834A',
  },
  credentialFootnoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  credentialFootnoteText: {
    fontSize: 11,
    color: '#777777',
    lineHeight: 15,
    flex: 1,
  },

  // Address Section
  addAddressAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: '#FFF1E7',
    borderRadius: 6,
  },
  addAddressActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  billingAddressBlock: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 12,
  },
  addressTypeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  addressTypeTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  primaryBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4F46E5',
  },
  addressStreetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#252525',
    lineHeight: 18,
  },
  addressRegionText: {
    fontSize: 12,
    color: '#777777',
    marginTop: 3,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  deliverySection: {
    marginTop: 4,
  },
  emptyAddressBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderStyle: 'dashed',
  },
  emptyAddressText: {
    fontSize: 11,
    color: '#777777',
    lineHeight: 16,
    textAlign: 'center',
  },
  deliveryAddressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 8,
  },
  deliveryAddressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  deliveryAddressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliveryAddressIndexTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#252525',
  },
  defaultBadge: {
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16834A',
  },
  makeDefaultText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  addressActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconTouch: {
    padding: 2,
  },

  // Security & Interactive Rows
  interactiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  interactiveRowTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  interactiveRowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#252525',
  },
  interactiveRowSub: {
    fontSize: 11,
    color: '#777777',
    marginTop: 2,
    lineHeight: 15,
  },
  sessionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  sessionStatusTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  secureSessionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#A6F4C5',
  },
  secureSessionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16834A',
  },

  // Preferences & Toggles
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  toggleTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#252525',
  },
  toggleSub: {
    fontSize: 11,
    color: '#777777',
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 6,
  },
  supportRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  smallCircleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Logout Button
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 16,
    gap: 8,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.danger,
  },

  // Footer
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  footerVersion: {
    fontSize: 11,
    color: '#777777',
    marginTop: 2,
  },
  footerCopyright: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },

  // Modals Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#252525',
  },
  modalDescription: {
    fontSize: 12,
    color: '#777777',
    lineHeight: 16,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#252525',
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  inputHelperText: {
    fontSize: 11,
    color: '#777777',
    marginTop: 4,
  },
  defaultCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  defaultCheckboxLabel: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  legalScrollView: {
    paddingVertical: 8,
  },
  legalSectionHead: {
    fontSize: 13,
    fontWeight: '800',
    color: '#252525',
    marginTop: 10,
    marginBottom: 4,
  },
  legalBodyText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 8,
  },
});
