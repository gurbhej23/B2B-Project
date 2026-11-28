import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { mobileApi, extractErrorMessage } from '../../../lib/api';
import { colors } from '../../theme/colors';

const PHONE_REGEX = /^(\+91)?[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const INDIAN_STATES = [
  'Maharashtra',
  'Delhi',
  'Gujarat',
  'Karnataka',
  'Tamil Nadu',
  'Uttar Pradesh',
  'Rajasthan',
  'West Bengal',
  'Telangana',
  'Andhra Pradesh',
  'Kerala',
  'Madhya Pradesh',
  'Punjab',
  'Haryana',
  'Bihar',
  'Odisha',
  'Assam',
  'Jharkhand',
  'Chhattisgarh',
  'Uttarakhand',
  'Goa',
  'Himachal Pradesh',
  'Jammu & Kashmir',
  'Chandigarh',
  'Puducherry',
];

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { register } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Account Details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2: Business Details
  const [businessName, setBusinessName] = useState('');
  const [isGstRegistered, setIsGstRegistered] = useState(true);
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

  // Step 3: Business Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [pincode, setPincode] = useState('');
  const [showStateModal, setShowStateModal] = useState(false);

  // Step 4: Review & Submit
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Post Submission Screen State
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyReference = () => {
    if (submittedData?.referenceId) {
      Clipboard.setString(submittedData.referenceId);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2500);
    }
  };

  // Validation per step
  const validateStep1 = (): string | null => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      return 'Please enter your full name (contact person).';
    }
    const cleanEmail = email.trim();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return 'Please enter a valid business email address.';
    }
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!cleanPhone || !PHONE_REGEX.test(cleanPhone)) {
      return 'Please enter a valid 10-digit Indian mobile number.';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter.';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter.';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one digit.';
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Password must contain at least one special character.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!businessName.trim() || businessName.trim().length < 3) {
      return 'Please enter registered business or trade name (min 3 characters).';
    }
    if (isGstRegistered) {
      const cleanGst = gstin.trim().toUpperCase();
      if (!cleanGst || !GSTIN_REGEX.test(cleanGst)) {
        return 'Please enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).';
      }
    }
    if (pan.trim()) {
      const cleanPan = pan.trim().toUpperCase();
      if (!PAN_REGEX.test(cleanPan)) {
        return 'Please enter a valid 10-character PAN number (e.g. ABCDE1234F).';
      }
    } else if (!isGstRegistered) {
      return 'Business PAN is required for unregistered/non-GST accounts.';
    }
    return null;
  };

  const validateStep3 = (): string | null => {
    if (!addressLine1.trim() || addressLine1.trim().length < 3) {
      return 'Please enter business address line 1 (Shop/Premise/Building).';
    }
    if (!city.trim() || city.trim().length < 2) {
      return 'Please enter your city name.';
    }
    if (!state.trim()) {
      return 'Please select your state.';
    }
    const cleanPincode = pincode.trim();
    if (!cleanPincode || !PINCODE_REGEX.test(cleanPincode)) {
      return 'Please enter a valid 6-digit Indian PIN code (e.g. 400001).';
    }
    return null;
  };

  const handleNextStep = () => {
    setErrorMessage(null);
    let err: string | null = null;
    if (currentStep === 1) err = validateStep1();
    else if (currentStep === 2) err = validateStep2();
    else if (currentStep === 3) err = validateStep3();

    if (err) {
      setErrorMessage(err);
      return;
    }
    setCurrentStep((prev) => Math.min(4, prev + 1));
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmitApplication = async () => {
    setErrorMessage(null);
    if (!termsAccepted) {
      setErrorMessage('You must accept the Wholesale Trading Terms & Conditions to proceed.');
      return;
    }

    const step1Err = validateStep1();
    if (step1Err) {
      setErrorMessage(step1Err);
      setCurrentStep(1);
      return;
    }

    const step2Err = validateStep2();
    if (step2Err) {
      setErrorMessage(step2Err);
      setCurrentStep(2);
      return;
    }

    const step3Err = validateStep3();
    if (step3Err) {
      setErrorMessage(step3Err);
      setCurrentStep(3);
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanPhone = phone.trim().replace(/\s+/g, '').replace(/^\+91/, '');
      const fullStreet = addressLine2.trim()
        ? `${addressLine1.trim()}, ${addressLine2.trim()}`
        : addressLine1.trim();

      const billingAddress = {
        street: fullStreet,
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        stateCode: '27',
        isDefault: true,
      };

      const payload = {
        name: fullName.trim(),
        contactPerson: fullName.trim(),
        businessName: businessName.trim(),
        businessType: 'Retailer',
        requestedCustomerType: 'retailer',
        customerType: 'retailer',
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        address: fullStreet,
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        billingAddress,
        deliveryAddress: billingAddress,
        deliveryAddresses: [billingAddress],
        gstin: isGstRegistered && gstin.trim() ? gstin.trim().toUpperCase() : undefined,
        pan: pan.trim() ? pan.trim().toUpperCase() : undefined,
        businessDocuments: [],
        password,
        confirmPassword,
        termsAccepted: true,
      };

      const result = await register(payload);
      setSubmittedData({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        businessName: businessName.trim(),
        customerType: 'retailer',
        referenceId: result?.retailerId || result?._id || `REG-${Date.now().toString().slice(-6)}`,
      });
      setIsSubmittedSuccessfully(true);
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckLiveStatus = async () => {
    const cleanId = submittedData?.email || submittedData?.phone;
    if (!cleanId) return;
    setIsCheckingApproval(true);
    try {
      const res = await mobileApi.get(
        `/auth/check-status?identifier=${encodeURIComponent(cleanId)}`
      );
      const statusData = res.data || res;
      if (statusData.isApproved || statusData.accountStatus === 'ACTIVE') {
        Alert.alert(
          'Approved! 🎉',
          'Your wholesale trade account has been approved by administration. You can sign in right now.',
          [{ text: 'Sign In Now', onPress: () => navigation.navigate('Login') }]
        );
      } else if (statusData.accountStatus === 'REJECTED') {
        Alert.alert(
          'Application Status',
          statusData.rejectionReason || 'Your application was rejected. Please contact commercial support.'
        );
      } else {
        Alert.alert(
          'Under Verification ⏳',
          'Your documents and tax records are actively being reviewed by our commercial desk. Approvals typically take 2-4 business hours.'
        );
      }
    } catch (err: any) {
      Alert.alert('Status Check', extractErrorMessage(err) || 'Could not verify status. Please try again.');
    } finally {
      setIsCheckingApproval(false);
    }
  };

  // POST SUBMISSION SCREEN
  if (isSubmittedSuccessfully) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.successScreenContainer}>
          <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
          <ScrollView contentContainerStyle={styles.successScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.successBadgeCircle}>
              <Text style={styles.successBadgeEmoji}>✓</Text>
            </View>

            <Text style={styles.successTitle}>Registration Submitted</Text>
            <Text style={styles.successSub}>
              Your wholesale customer onboarding application has been registered with Necessity India.
            </Text>

            {/* Reference Details Box */}
            <View style={styles.summaryCard}>
              <View style={styles.referenceContainer}>
                <View style={styles.referenceHeaderRow}>
                  <Text style={styles.referenceHeaderLabel}>APPLICATION REFERENCE</Text>
                  <TouchableOpacity
                    style={[styles.copyButton, isCopied && styles.copyButtonSuccess]}
                    onPress={handleCopyReference}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.copyButtonText, isCopied && styles.copyButtonTextSuccess]}>
                      {isCopied ? '✓ Copied' : '📋 Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.referenceValueBox}>
                  <Text
                    style={styles.referenceValueText}
                    selectable={true}
                    numberOfLines={2}
                  >
                    {submittedData?.referenceId || 'N/A'}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Business Firm</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {submittedData?.businessName || '-'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Primary Contact</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {submittedData?.name || '-'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Registered Email</Text>
                <Text style={styles.summaryValue} numberOfLines={3}>
                  {submittedData?.email || '-'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Mobile</Text>
                <Text style={styles.summaryValue}>
                  +91 {submittedData?.phone || '-'}
                </Text>
              </View>
            </View>

            {/* Verification Notice */}
            <View style={styles.verificationNoticeBox}>
              <Text style={styles.noticeIcon}>🛡️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Institutional Security Verification</Text>
                <Text style={styles.noticeBody}>
                  To protect wholesale prices and trade margins, every new customer account is verified by our compliance team before unlocking institutional catalogs and credit lines.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={styles.checkStatusSuccessBtn}
              onPress={handleCheckLiveStatus}
              disabled={isCheckingApproval}
              activeOpacity={0.85}
            >
              {isCheckingApproval ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.checkStatusSuccessBtnText}>Check Approval Status Now</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backToLoginBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
            >
              <Text style={styles.backToLoginBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // MULTI-STEP WIZARD (Steps 1 to 4)
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

        {/* Fixed Sticky Header with Progress Bar */}
        <View style={styles.wizardHeader}>
          <View style={styles.wizardHeaderTop}>
            <TouchableOpacity
              onPress={currentStep === 1 ? () => navigation.goBack() : handlePrevStep}
              style={styles.headerBackBtn}
            >
              <Text style={styles.headerBackIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.wizardTitleBox}>
              <Text style={styles.wizardStepText}>Step {currentStep} of 4</Text>
              <Text style={styles.wizardHeaderTitle}>
                {currentStep === 1 && 'Account Credentials'}
                {currentStep === 2 && 'Business Details'}
                {currentStep === 3 && 'Premises Address'}
                {currentStep === 4 && 'Review & Submit'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.headerLoginShortcut}
            >
              <Text style={styles.headerLoginShortcutText}>Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* 4-Segment Progress Bar */}
          <View style={styles.stepProgressBar}>
            {[1, 2, 3, 4].map((step) => (
              <View
                key={`step-bar-${step}`}
                style={[
                  styles.stepSegment,
                  currentStep >= step && styles.stepSegmentActive,
                  currentStep === step && styles.stepSegmentCurrent,
                ]}
              />
            ))}
          </View>

          {/* Fully Responsive Step Indicator Labels */}
          <View style={styles.stepLabelsRow}>
            {[
              { id: 1, label: 'Account' },
              { id: 2, label: 'Business' },
              { id: 3, label: 'Address' },
              { id: 4, label: 'Review' },
            ].map((item) => (
              <View key={item.id} style={styles.stepLabelCol}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={[
                    styles.stepLabelItem,
                    currentStep === item.id && styles.stepLabelItemActive,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Error Notification */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* STEP 1: Account Details */}
        {currentStep === 1 && (
          <View style={styles.stepContent}>
            <View style={styles.stepInfoBox}>
              <Text style={styles.stepHeadline}>Create Wholesale Profile</Text>
              <Text style={styles.stepSubline}>Enter your primary contact info and secure login password.</Text>
            </View>

            <Text style={styles.inputLabel}>Full Name (Authorized Person) *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Rajesh Kumar"
                placeholderTextColor={colors.textSecondary}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <Text style={styles.inputLabel}>Business Email Address *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. rajesh@store.com"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.inputLabel}>Mobile Number *</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.phonePrefixBox}>
                <Text style={styles.phonePrefixText}>🇮🇳 +91</Text>
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginBottom: 0 }]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.textSecondary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Password *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Min 8 chars, 1 uppercase, 1 digit, 1 symbol"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((p) => !p)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Confirm Password *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Re-enter password"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((p) => !p)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeBtnText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 2: Business Details */}
        {currentStep === 2 && (
          <View style={styles.stepContent}>
            <View style={styles.stepInfoBox}>
              <Text style={styles.stepHeadline}>Business Verification</Text>
              <Text style={styles.stepSubline}>Enter your business name and official tax registration details.</Text>
            </View>

            <Text style={styles.inputLabel}>Registered Business Name *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Om Enterprises or Balaji Traders"
                placeholderTextColor={colors.textSecondary}
                value={businessName}
                onChangeText={setBusinessName}
              />
            </View>

            {/* GST Registered Toggle */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>GST Registered Entity?</Text>
                <Text style={styles.toggleSub}>Select Yes if your business holds a valid 15-character GSTIN</Text>
              </View>
              <View style={styles.yesNoToggleBox}>
                <TouchableOpacity
                  style={[styles.yesNoBtn, isGstRegistered && styles.yesNoBtnActive]}
                  onPress={() => setIsGstRegistered(true)}
                >
                  <Text style={[styles.yesNoText, isGstRegistered && styles.yesNoTextActive]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.yesNoBtn, !isGstRegistered && styles.yesNoBtnActive]}
                  onPress={() => setIsGstRegistered(false)}
                >
                  <Text style={[styles.yesNoText, !isGstRegistered && styles.yesNoTextActive]}>No</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* GSTIN Field */}
            {isGstRegistered && (
              <>
                <Text style={styles.inputLabel}>GSTIN Number *</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.textInput, { textTransform: 'uppercase' }]}
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    placeholderTextColor={colors.textSecondary}
                    value={gstin}
                    onChangeText={(t) => setGstin(t.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={15}
                  />
                </View>
              </>
            )}

            {/* PAN Field */}
            <Text style={styles.inputLabel}>Business / Proprietor PAN {!isGstRegistered && '*'}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, { textTransform: 'uppercase' }]}
                placeholder="e.g. ABCDE1234F"
                placeholderTextColor={colors.textSecondary}
                value={pan}
                onChangeText={(t) => setPan(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={10}
              />
            </View>
          </View>
        )}

        {/* STEP 3: Business Address */}
        {currentStep === 3 && (
          <View style={styles.stepContent}>
            <View style={styles.stepInfoBox}>
              <Text style={styles.stepHeadline}>Registered Trade Address</Text>
              <Text style={styles.stepSubline}>Where your store, warehouse, or billing entity is physically based.</Text>
            </View>

            <Text style={styles.inputLabel}>Address Line 1 (Shop / Premise / Unit) *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Shop No. 12, Sunrise Commercial Complex"
                placeholderTextColor={colors.textSecondary}
                value={addressLine1}
                onChangeText={setAddressLine1}
              />
            </View>

            <Text style={styles.inputLabel}>Address Line 2 (Street / Area / Landmark)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. M.G. Road, Near Central Market"
                placeholderTextColor={colors.textSecondary}
                value={addressLine2}
                onChangeText={setAddressLine2}
              />
            </View>

            {/* State Picker Touchable */}
            <Text style={styles.inputLabel}>State / Territory *</Text>
            <TouchableOpacity
              style={styles.selectContainer}
              onPress={() => setShowStateModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.selectValueText}>{state || 'Select State'}</Text>
              <Text style={styles.selectChevron}>▼</Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>City *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Mumbai, Pune, Nagpur"
                placeholderTextColor={colors.textSecondary}
                value={city}
                onChangeText={setCity}
              />
            </View>

            <Text style={styles.inputLabel}>PIN Code (6 digits) *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 400001"
                placeholderTextColor={colors.textSecondary}
                value={pincode}
                onChangeText={setPincode}
                keyboardType="numeric"
                maxLength={6}
              />
            </View>

            <Text style={styles.inputLabel}>Country</Text>
            <View style={[styles.inputContainer, styles.disabledInput]}>
              <Text style={styles.disabledText}>🇮🇳 India (Fixed)</Text>
            </View>
          </View>
        )}

        {/* STEP 4: Review & Submit */}
        {currentStep === 4 && (
          <View style={styles.stepContent}>
            <View style={styles.stepInfoBox}>
              <Text style={styles.stepHeadline}>Review Your Application</Text>
              <Text style={styles.stepSubline}>Please inspect all details carefully before submitting for review.</Text>
            </View>

            {/* Section 1 Review */}
            <View style={styles.reviewCard}>
              <View style={styles.reviewCardHeader}>
                <Text style={styles.reviewCardTitle}>1. Account & Contact</Text>
                <TouchableOpacity onPress={() => setCurrentStep(1)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.reviewItem}>• <Text style={styles.reviewBold}>Contact:</Text> {fullName}</Text>
              <Text style={styles.reviewItem}>• <Text style={styles.reviewBold}>Email:</Text> {email}</Text>
              <Text style={styles.reviewItem}>• <Text style={styles.reviewBold}>Phone:</Text> +91 {phone}</Text>
            </View>

            {/* Section 2 Review */}
            <View style={styles.reviewCard}>
              <View style={styles.reviewCardHeader}>
                <Text style={styles.reviewCardTitle}>2. Business & Tax</Text>
                <TouchableOpacity onPress={() => setCurrentStep(2)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.reviewItem}>• <Text style={styles.reviewBold}>Firm:</Text> {businessName}</Text>
              <Text style={styles.reviewItem}>• <Text style={styles.reviewBold}>GSTIN:</Text> {isGstRegistered ? gstin || 'Not Entered' : 'Unregistered'}</Text>
              {pan.trim() ? <Text style={styles.reviewItem}>• <Text style={styles.reviewBold}>PAN:</Text> {pan.toUpperCase()}</Text> : null}
            </View>

            {/* Section 3 Review */}
            <View style={styles.reviewCard}>
              <View style={styles.reviewCardHeader}>
                <Text style={styles.reviewCardTitle}>3. Premises Address</Text>
                <TouchableOpacity onPress={() => setCurrentStep(3)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.reviewItem}>• {addressLine1}</Text>
              {addressLine2 ? <Text style={styles.reviewItem}>• {addressLine2}</Text> : null}
              <Text style={styles.reviewItem}>• {city}, {state} - {pincode}</Text>
            </View>

            {/* Terms and Conditions Checkbox */}
            <View style={styles.termsBox}>
              <TouchableOpacity
                style={styles.termsCheckRow}
                onPress={() => setTermsAccepted((p) => !p)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
                  {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termsText}>
                  I confirm that all information provided is accurate and agree to the{' '}
                  <Text style={styles.termsLink} onPress={() => setShowTermsModal(true)}>
                    Wholesale B2B Trading Terms & Privacy Policy
                  </Text>.
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Navigation Step Buttons */}
        <View style={styles.wizardFooter}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.backStepBtn}
              onPress={handlePrevStep}
              disabled={isSubmitting}
            >
              <Text style={styles.backStepBtnText}>← Previous</Text>
            </TouchableOpacity>
          )}

          {currentStep < 4 ? (
            <TouchableOpacity
              style={[styles.nextStepBtn, currentStep === 1 && { flex: 1 }]}
              onPress={handleNextStep}
            >
              <Text style={styles.nextStepBtnText}>Next Step →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitAppBtn, isSubmitting && styles.disabledBtn]}
              onPress={handleSubmitApplication}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitAppBtnText}>Submit Application</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* State Selector Modal */}
      <Modal
        visible={showStateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.stateModalCard}>
            <View style={styles.stateModalHeader}>
              <Text style={styles.stateModalTitle}>Select State / UT</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.stateListScroll}>
              {INDIAN_STATES.map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[styles.stateItem, state === st && styles.stateItemActive]}
                  onPress={() => {
                    setState(st);
                    setShowStateModal(false);
                  }}
                >
                  <Text style={[styles.stateItemText, state === st && styles.stateItemTextActive]}>
                    {st}
                  </Text>
                  {state === st && <Text style={styles.stateCheckmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Terms and Conditions Modal */}
      <Modal
        visible={showTermsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.stateModalCard}>
            <View style={styles.stateModalHeader}>
              <Text style={styles.stateModalTitle}>B2B Wholesale Terms</Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.termsScroll}>
              <Text style={styles.termsPara}>
                1. <Text style={styles.reviewBold}>Wholesale Eligibility:</Text> Accounts on Necessity India are intended exclusively for commercial business entities, licensed retailers, wholesalers, and institutional buyers.
              </Text>
              <Text style={styles.termsPara}>
                2. <Text style={styles.reviewBold}>Minimum Order Quantities (MOQ):</Text> All products are supplied in manufacturer-sealed master cartons. Orders must meet individual SKU MOQs.
              </Text>
              <Text style={styles.termsPara}>
                3. <Text style={styles.reviewBold}>Payment & Credit Terms:</Text> Credit lines and settlement periods are subject to administrative approval, financial verification, and verified business credit exposure.
              </Text>
              <Text style={styles.termsPara}>
                4. <Text style={styles.reviewBold}>Taxation & GST Compliance:</Text> Tax invoices adhere to Indian GST laws. Valid GSTIN holders will receive GST credit on commercial supplies.
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalAcceptBtn}
              onPress={() => {
                setTermsAccepted(true);
                setShowTermsModal(false);
              }}
            >
              <Text style={styles.modalAcceptBtnText}>Accept Terms</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboardView: {
    flex: 1,
    backgroundColor: colors.white,
  },
  wizardHeader: {
    backgroundColor: colors.white,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E0D5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  wizardHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerBackBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerBackIcon: {
    fontSize: 22,
    color: colors.slate900,
    fontWeight: '700',
  },
  wizardTitleBox: {
    flex: 1,
  },
  wizardStepText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wizardHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
    marginTop: 1,
  },
  headerLoginShortcut: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFF1E8',
  },
  headerLoginShortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  stepProgressBar: {
    flexDirection: 'row',
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  stepSegment: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 1.5,
    borderRadius: 2,
  },
  stepSegmentActive: {
    backgroundColor: colors.primary,
  },
  stepSegmentCurrent: {
    backgroundColor: '#E95B2A',
  },
  stepLabelsRow: {
    flexDirection: 'row',
    marginTop: 6,
    width: '100%',
  },
  stepLabelCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  stepLabelItem: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate400,
    textAlign: 'center',
  },
  stepLabelItemActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  stepContent: {
    width: '100%',
  },
  stepInfoBox: {
    marginBottom: 16,
  },
  stepHeadline: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.slate900,
  },
  stepSubline: {
    fontSize: 13,
    color: colors.slate600,
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 6,
    marginTop: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 50,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phonePrefixBox: {
    backgroundColor: '#F1F5F9',
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  phonePrefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate800,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.slate900,
    paddingVertical: 0,
    fontWeight: '500',
  },
  eyeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  eyeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  tierSelectorGroup: {
    marginTop: 4,
    marginBottom: 12,
  },
  tierCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
  },
  tierCardActive: {
    backgroundColor: '#FFF8F3',
    borderColor: colors.primary,
  },
  tierCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.slate400,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  tierLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.slate800,
    flex: 1,
  },
  tierLabelActive: {
    color: colors.primaryDark,
  },
  tierBadge: {
    backgroundColor: '#FFF1E8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
    textTransform: 'uppercase',
  },
  tierDesc: {
    fontSize: 12,
    color: colors.slate600,
    marginTop: 6,
    marginLeft: 28,
    lineHeight: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginVertical: 12,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  toggleSub: {
    fontSize: 11,
    color: colors.slate600,
    marginTop: 2,
  },
  yesNoToggleBox: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 2,
  },
  yesNoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  yesNoBtnActive: {
    backgroundColor: colors.primary,
  },
  yesNoText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate700,
  },
  yesNoTextActive: {
    color: colors.white,
  },
  switchToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  switchToggleActive: {
    backgroundColor: colors.primary,
  },
  switchKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  switchKnobActive: {
    alignSelf: 'flex-end',
  },
  pillScroll: {
    marginTop: 6,
    marginBottom: 8,
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  pillBtnActive: {
    backgroundColor: '#FFF1E8',
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  pillTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 50,
  },
  selectValueText: {
    fontSize: 14,
    color: colors.slate900,
    fontWeight: '600',
  },
  selectChevron: {
    fontSize: 12,
    color: colors.slate500,
  },
  disabledInput: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  disabledText: {
    fontSize: 14,
    color: colors.slate600,
    fontWeight: '600',
  },
  shippingSectionBox: {
    marginTop: 8,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  reviewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
  },
  reviewCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.slate900,
  },
  editBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FFF1E8',
    borderRadius: 4,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  reviewItem: {
    fontSize: 13,
    color: colors.slate700,
    lineHeight: 20,
  },
  reviewBold: {
    fontWeight: '700',
    color: colors.slate900,
  },
  termsBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF8F3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  termsCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.slate400,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
    backgroundColor: colors.white,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  termsText: {
    fontSize: 12,
    color: colors.slate700,
    flex: 1,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  wizardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 12,
  },
  backStepBtn: {
    height: 50,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    marginRight: 12,
  },
  backStepBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate700,
  },
  nextStepBtn: {
    flex: 1,
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  nextStepBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
  submitAppBtn: {
    flex: 1,
    height: 50,
    backgroundColor: '#059669',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitAppBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.3,
  },
  disabledBtn: {
    opacity: 0.65,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  // Success Screen Styles
  successScreenContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  successScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: 'center',
  },
  successBadgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    borderWidth: 3,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successBadgeEmoji: {
    fontSize: 40,
    color: '#059669',
    fontWeight: '900',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.slate900,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 14,
    color: colors.slate600,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginTop: 20,
    overflow: 'hidden',
  },
  referenceContainer: {
    width: '100%',
  },
  referenceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  referenceHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.slate500,
    letterSpacing: 0.5,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1E8',
    borderColor: '#FED7AA',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  copyButtonSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  copyButtonTextSuccess: {
    color: '#059669',
  },
  referenceValueBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  referenceValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    flexWrap: 'wrap',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginVertical: 6,
    gap: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.slate500,
    fontWeight: '600',
    width: '38%',
    flexShrink: 0,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate900,
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  summaryValueHighlight: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  summaryValueType: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E95B2A',
    backgroundColor: '#FFF1E8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  verificationNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8F3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    padding: 14,
    marginTop: 20,
    width: '100%',
  },
  noticeIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 12,
    color: colors.slate700,
    lineHeight: 17,
  },
  checkStatusSuccessBtn: {
    width: '100%',
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  checkStatusSuccessBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
  backToLoginBtn: {
    width: '100%',
    height: 50,
    backgroundColor: colors.white,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  backToLoginBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate700,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  stateModalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  stateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  stateModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate900,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.slate400,
    fontWeight: '700',
  },
  stateListScroll: {
    marginBottom: 20,
  },
  stateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stateItemActive: {
    backgroundColor: '#FFF8F3',
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  stateItemText: {
    fontSize: 15,
    color: colors.slate800,
    fontWeight: '500',
  },
  stateItemTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  stateCheckmark: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '900',
  },
  termsScroll: {
    maxHeight: 280,
    marginBottom: 20,
  },
  termsPara: {
    fontSize: 13,
    color: colors.slate700,
    lineHeight: 20,
    marginBottom: 12,
  },
  modalAcceptBtn: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAcceptBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
});
