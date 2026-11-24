 import React, { useState, useEffect } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { mobileApi, extractErrorMessage } from '../../../lib/api';
import { SecureSession } from '../../../lib/secure-store';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const REMEMBER_KEY = 'necessity_remembered_email';

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status check modal & forgot password modal
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Load remembered email on mount
  useEffect(() => {
    (async () => {
      try {
        const savedEmail = (await SecureSession.getItem(REMEMBER_KEY)) || (await SecureSession.getItem('necessity_remembered_identifier'));
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch {
        // ignore storage read error
      }
    })();
  }, []);

  const handleLogin = async () => {
    setErrorMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your business email.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Save or clear remembered email
      if (rememberMe) {
        await SecureSession.setItem(REMEMBER_KEY, cleanEmail);
      } else {
        await SecureSession.removeItem(REMEMBER_KEY);
      }

      await login(cleanEmail, password);
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckApprovalStatus = async () => {
    const cleanEmail = (email || forgotEmail).trim().toLowerCase();
    if (!cleanEmail) {
      Alert.alert('Email Required', 'Please enter your registered business email address first.');
      return;
    }
    setIsCheckingStatus(true);
    try {
      const res = await mobileApi.get(
        `/auth/check-status?identifier=${encodeURIComponent(cleanEmail)}`
      );
      const statusData = res.data || res;
      if (statusData.isApproved || statusData.accountStatus === 'ACTIVE') {
        Alert.alert(
          'Account Approved! 🎉',
          'Your account has been approved by administration. You can now sign in using your credentials.'
        );
        setErrorMessage(null);
      } else if (statusData.accountStatus === 'REJECTED') {
        Alert.alert(
          'Registration Rejected',
          statusData.rejectionReason || 'Your registration was rejected by administrator. Please contact support.'
        );
      } else {
        Alert.alert(
          'Approval Pending ⏳',
          'Your wholesale account is currently under review by our commercial operations team. Once verified, access to wholesale catalog and credit pricing will be activated.'
        );
      }
    } catch (err: any) {
      Alert.alert('Status Check', extractErrorMessage(err) || 'Could not verify status. Please try again.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleForgotSubmit = () => {
    const cleanForgot = forgotEmail.trim().toLowerCase();
    if (!cleanForgot) {
      Alert.alert('Missing Field', 'Please enter your registered business email.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanForgot)) {
      Alert.alert('Invalid Email', 'Please enter a valid business email address.');
      return;
    }
    setForgotSubmitted(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Logo Card */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/img.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Heading & Supporting Text */}
        <View style={styles.headerTextSection}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to manage your business orders</Text>
        </View>

        {/* Error Notification */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <View style={styles.errorRow}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
            {errorMessage.toLowerCase().includes('approval') && (
              <TouchableOpacity
                style={styles.checkApprovalBannerBtn}
                onPress={handleCheckApprovalStatus}
                disabled={isCheckingStatus}
                activeOpacity={0.8}
              >
                {isCheckingStatus ? (
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                ) : (
                  <Text style={styles.checkApprovalBannerBtnText}>
                    Check Verification Status →
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Form Inputs */}
        <View style={styles.formSection}>
          {/* Business Email Field */}
          <Text style={styles.inputLabel}>Business Email</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. dealer@necessity.in"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!isSubmitting}
            />
          </View>

          {/* Password Field with Show/Hide Toggle */}
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
              secureTextEntry={!showPassword}
              editable={!isSubmitting}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((prev) => !prev)}
              style={styles.eyeBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.eyeBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          {/* Remember Me & Forgot Password Row */}
          <View style={styles.metaRow}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setForgotEmail(email);
                setForgotSubmitted(false);
                setShowForgotModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Primary Orange Sign In Button */}
          <TouchableOpacity
            style={[styles.loginBtn, isSubmitting && styles.disabledBtn]}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Secondary Action: Create Business Account */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.createAccountBtn}
            onPress={() => navigation.navigate('Register')}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <Text style={styles.createAccountBtnText}>Create Business Account</Text>
          </TouchableOpacity>

          {/* Fast Status Verification Button for applicants */}
          <TouchableOpacity
            style={styles.checkStatusBtn}
            onPress={handleCheckApprovalStatus}
            disabled={isCheckingStatus}
            activeOpacity={0.7}
          >
            {isCheckingStatus ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.checkStatusBtnText}>
                ⏳ Applied already? Check Application Status
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Password Recovery</Text>
              <TouchableOpacity
                onPress={() => setShowForgotModal(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {!forgotSubmitted ? (
              <>
                <Text style={styles.modalSubtitle}>
                  Enter your registered business email to receive a secure recovery verification link.
                </Text>

                <View style={styles.modalInputBox}>
                  <Text style={styles.inputLabel}>Registered Business Email</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. dealer@necessity.in"
                    placeholderTextColor={colors.textSecondary}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>

                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={handleForgotSubmit}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalPrimaryBtnText}>Send Reset Link</Text>
                </TouchableOpacity>

                <View style={styles.supportNoteBox}>
                  <Text style={styles.supportNoteTitle}>Need instant commercial support?</Text>
                  <Text style={styles.supportNoteBody}>
                    Wholesale account managers can assist you directly at accounts@necessityindia.com or +91 98760 76067.
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.submittedBox}>
                <Text style={styles.successEmoji}>📬</Text>
                <Text style={styles.submittedTitle}>Reset Instructions Requested</Text>
                <Text style={styles.submittedBody}>
                  If an approved wholesale account is associated with <Text style={styles.boldText}>{forgotEmail}</Text>, our commercial security desk has sent verification instructions.
                </Text>
                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={() => setShowForgotModal(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalPrimaryBtnText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 36,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 250,
    height: 80,
    maxWidth: '85%',
  },
  headerTextSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.slate900,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.slate600,
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    lineHeight: 18,
  },
  checkApprovalBannerBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  checkApprovalBannerBtnText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  formSection: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 6,
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.slate900,
    paddingVertical: 0,
    fontWeight: '500',
  },
  eyeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  eyeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.slate400,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: colors.white,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  rememberText: {
    fontSize: 13,
    color: colors.slate700,
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },
  loginBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledBtn: {
    opacity: 0.65,
  },
  loginBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate400,
    marginHorizontal: 12,
  },
  createAccountBtn: {
    backgroundColor: colors.white,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  createAccountBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  checkStatusBtn: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkStatusBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate600,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.slate900,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.slate400,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.slate600,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalInputBox: {
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.slate900,
  },
  modalPrimaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  modalPrimaryBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  supportNoteBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#FFF8F3',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  supportNoteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 4,
  },
  supportNoteBody: {
    fontSize: 12,
    color: colors.slate700,
    lineHeight: 16,
  },
  submittedBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  submittedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate900,
    marginBottom: 8,
  },
  submittedBody: {
    fontSize: 13,
    color: colors.slate600,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  boldText: {
    fontWeight: '700',
    color: colors.slate900,
  },
});
