import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { router } from 'expo-router';
import { Icon } from '../src/components/Icon';
import * as Haptics from 'expo-haptics';
import { AppBackground } from '../src/components/AppBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal } from 'react-native';


const { width, height } = Dimensions.get('window');

// Luna Group Logo URL
const LUNA_GROUP_LOGO = 'https://customer-assets.emergentagent.com/job_c826baa4-6640-40ce-9e0d-38132d9944fc/artifacts/2k76js5m_luna-group-logo-2.webp';

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cherryHubLoading, setCherryHubLoading] = useState(false);
  const [showCherryHubLogin, setShowCherryHubLogin] = useState(false);
  const [cherryHubEmail, setCherryHubEmail] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  
  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    
    setForgotLoading(true);
    try {
      const result = await api.forgotPassword(forgotEmail);
      if (result.success) {
        // In production, the token would be sent via email
        // For testing, we show it directly
        if (result.reset_token) {
          setResetToken(result.reset_token);
          setShowResetForm(true);
          Alert.alert('Reset Link Sent', 'Enter your new password below to reset.');
        } else {
          Alert.alert('Success', result.message);
          setShowForgotPassword(false);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset link');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    setResetLoading(true);
    try {
      const result = await api.resetPassword(resetToken, newPassword);
      if (result.success) {
        Alert.alert('Success', 'Your password has been reset. You can now log in.');
        setShowForgotPassword(false);
        setShowResetForm(false);
        setForgotEmail('');
        setResetToken('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };
  

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const result = await api.login(email, password);
        useAuthStore.getState().login(result.user, result.token);
        
        // Check if user is venue staff and redirect accordingly
        if (result.user?.is_venue_staff || result.user?.role === 'venue_staff' || result.user?.role === 'venue_manager') {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          router.replace('/venue-dashboard');
          return;
        }
      } else {
        const result = await api.register(email, password, name, referralCode || undefined);
        useAuthStore.getState().login(result.user, result.token);
        
        // Show referral bonus message if applicable
        if (result.referral_bonus) {
          setTimeout(() => {
            Alert.alert('🎉 Welcome Bonus!', result.referral_bonus);
          }, 500);
        }
      }
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Authentication Failed', e.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleCherryHubLogin = async () => {
    if (!cherryHubEmail) {
      Alert.alert('Error', 'Please enter your CherryHub email');
      return;
    }

    setCherryHubLoading(true);
    try {
      const result = await api.cherryHubLogin(cherryHubEmail);
      useAuthStore.getState().login(result.user, result.token);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      // Show appropriate message based on login type
      if (result.new_user) {
        Alert.alert('Welcome to Luna!', 'Your CherryHub account has been linked. Enjoy 500 bonus points!');
      } else if (result.newly_linked) {
        Alert.alert('Account Linked!', 'Your CherryHub membership is now connected to Luna.');
      }
      
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('CherryHub Login Failed', e.message || 'Please check your email and try again');
    } finally {
      setCherryHubLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Video Background with Frosted Glass */}
        <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Main Content */}
            <View style={styles.content}>
              {/* Header Section */}
              <View style={styles.header}>
                {/* Brand Logo Image - Large and Prominent */}
                <Image 
                  source={{ uri: LUNA_GROUP_LOGO }} 
                  style={styles.brandLogo}
                  resizeMode="contain"
                />

                {/* Tagline */}
                <Text style={styles.tagline}>BRISBANE • GOLD COAST</Text>
              </View>

              {/* Auth Toggle - Fixed colors */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleButton, isLogin && styles.toggleButtonActive]}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setIsLogin(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, !isLogin && styles.toggleButtonActive]}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setIsLogin(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>
                    Join Luna
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form Section */}
              <View style={styles.formSection}>
                {!isLogin && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>FULL NAME</Text>
                    <View
                      style={[
                        styles.inputContainer,
                        focusedField === 'name' && styles.inputContainerFocused,
                      ]}
                    >
                      <Icon
                        name="person-outline"
                        size={20}
                        color={focusedField === 'name' ? colors.accent : colors.textMuted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your full name"
                        placeholderTextColor={colors.textMuted + '60'}
                        value={name}
                        onChangeText={setName}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                )}

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'email' && styles.inputContainerFocused,
                    ]}
                  >
                    <Icon
                      name="mail-outline"
                      size={20}
                      color={focusedField === 'email' ? colors.accent : colors.textMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor={colors.textMuted + '60'}
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'password' && styles.inputContainerFocused,
                    ]}
                  >
                    <Icon
                      name="lock-closed-outline"
                      size={20}
                      color={focusedField === 'password' ? colors.accent : colors.textMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your password"
                      placeholderTextColor={colors.textMuted + '60'}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry
                    />
                  </View>
                </View>

                {/* Referral Code Field (Registration Only) */}
                {!isLogin && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>REFERRAL CODE <Text style={styles.optionalLabel}>(Optional)</Text></Text>
                    <View
                      style={[
                        styles.inputContainer,
                        focusedField === 'referral' && styles.inputContainerFocused,
                      ]}
                    >
                      <Icon
                        name="gift-outline"
                        size={20}
                        color={focusedField === 'referral' ? '#00D4AA' : colors.textMuted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter friend's referral code"
                        placeholderTextColor={colors.textMuted + '60'}
                        value={referralCode}
                        onChangeText={(text) => setReferralCode(text.toUpperCase())}
                        onFocus={() => setFocusedField('referral')}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="characters"
                      />
                    </View>
                    <Text style={styles.referralHint}>Both you and your friend earn 10 bonus points!</Text>
                  </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  onPress={handleAuth}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={loading ? ['#333333', '#222222'] : [colors.accent, colors.accentDark]}
                    style={styles.submitGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.submitText}>
                      {loading ? 'PROCESSING' : isLogin ? 'ENTER LUNA' : 'JOIN LUNA'}
                    </Text>
                    {!loading && (
                      <Icon name="arrow-forward" size={20} color={colors.textPrimary} />
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Forgot Password Link - Login Mode Only */}
                {isLogin && (
                  <TouchableOpacity
                    style={styles.forgotPasswordLink}
                    onPress={() => setShowForgotPassword(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
                  </TouchableOpacity>
                )}

                {/* CherryHub Login Section - Login Mode Only */}
                {isLogin && (
                  <View style={styles.cherryHubSection}>
                    <View style={styles.dividerContainer}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>OR</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {!showCherryHubLogin ? (
                      <TouchableOpacity
                        style={styles.cherryHubButton}
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.selectionAsync();
                          setShowCherryHubLogin(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.cherryHubButtonContent}>
                          <Icon name="card-outline" size={22} color="#FF6B6B" />
                          <Text style={styles.cherryHubButtonText}>Sign in with CherryHub</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.cherryHubForm}>
                        <Text style={styles.cherryHubTitle}>CherryHub Member Login</Text>
                        <View
                          style={[
                            styles.inputContainer,
                            focusedField === 'cherryhub' && styles.inputContainerFocused,
                          ]}
                        >
                          <Icon
                            name="mail-outline"
                            size={20}
                            color={focusedField === 'cherryhub' ? '#FF6B6B' : colors.textMuted}
                            style={styles.inputIcon}
                          />
                          <TextInput
                            style={styles.input}
                            placeholder="CherryHub email address"
                            placeholderTextColor={colors.textMuted + '60'}
                            value={cherryHubEmail}
                            onChangeText={setCherryHubEmail}
                            onFocus={() => setFocusedField('cherryhub')}
                            onBlur={() => setFocusedField(null)}
                            autoCapitalize="none"
                            keyboardType="email-address"
                          />
                        </View>
                        <View style={styles.cherryHubActions}>
                          <TouchableOpacity
                            style={styles.cherryHubCancelButton}
                            onPress={() => {
                              setShowCherryHubLogin(false);
                              setCherryHubEmail('');
                            }}
                          >
                            <Text style={styles.cherryHubCancelText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.cherryHubSubmitButton, cherryHubLoading && styles.submitButtonDisabled]}
                            onPress={handleCherryHubLogin}
                            disabled={cherryHubLoading}
                          >
                            {cherryHubLoading ? (
                              <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                              <Text style={styles.cherryHubSubmitText}>Continue</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Footer Links */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>
                    By continuing, you agree to Luna Group's{'\n'}Terms & Privacy Policy
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPassword}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowForgotPassword(false);
          setShowResetForm(false);
          setForgotEmail('');
          setResetToken('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => {
                  setShowForgotPassword(false);
                  setShowResetForm(false);
                }}
              >
                <Icon name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.modalHeader}>
                <View style={styles.modalIconContainer}>
                  <Icon name={showResetForm ? "key" : "mail"} size={32} color={colors.accent} />
                </View>
                <Text style={styles.modalTitle}>
                  {showResetForm ? 'Reset Password' : 'Forgot Password'}
                </Text>
              </View>

              {!showResetForm ? (
                <>
                  <Text style={styles.modalMessage}>
                    Enter your email address and we'll send you a link to reset your password.
                  </Text>

                  <View style={styles.modalInputContainer}>
                    <Icon name="mail-outline" size={20} color={colors.textMuted} style={styles.modalInputIcon} />
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Enter your email"
                      placeholderTextColor={colors.textMuted}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.modalButton, forgotLoading && styles.modalButtonDisabled]}
                    onPress={handleForgotPassword}
                    disabled={forgotLoading}
                  >
                    <LinearGradient
                      colors={forgotLoading ? ['#333', '#222'] : [colors.accent, colors.accentDark]}
                      style={styles.modalButtonGradient}
                    >
                      <Text style={styles.modalButtonText}>
                        {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalMessage}>
                    Enter your new password below.
                  </Text>

                  <View style={styles.modalInputContainer}>
                    <Icon name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.modalInputIcon} />
                    <TextInput
                      style={styles.modalInput}
                      placeholder="New password"
                      placeholderTextColor={colors.textMuted}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.modalInputContainer}>
                    <Icon name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.modalInputIcon} />
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Confirm new password"
                      placeholderTextColor={colors.textMuted}
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      secureTextEntry
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.modalButton, resetLoading && styles.modalButtonDisabled]}
                    onPress={handleResetPassword}
                    disabled={resetLoading}
                  >
                    <LinearGradient
                      colors={resetLoading ? ['#333', '#222'] : [colors.accent, colors.accentDark]}
                      style={styles.modalButtonGradient}
                    >
                      <Text style={styles.modalButtonText}>
                        {resetLoading ? 'Resetting...' : 'Reset Password'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.modalBackLink}
                onPress={() => {
                  if (showResetForm) {
                    setShowResetForm(false);
                  } else {
                    setShowForgotPassword(false);
                  }
                }}
              >
                <Text style={styles.modalBackText}>
                  {showResetForm ? 'Back' : 'Back to Login'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.sm,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  brandLogo: {
    width: 260,
    height: 75,
    marginBottom: spacing.md,
  },
  brandUnderline: {
    width: 50,
    height: 2,
    backgroundColor: colors.accent,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: colors.borderHover,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  toggleTextActive: {
    color: colors.text,
  },
  formSection: {
    gap: spacing.lg,
  },
  inputWrapper: {
    gap: spacing.sm,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 2,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
  },
  optionalLabel: {
    color: colors.textMuted,
    fontWeight: '500',
    letterSpacing: 1,
  },
  referralHint: {
    fontSize: 11,
    color: colors.success,
    marginTop: 4,
    marginLeft: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 56,
  },
  inputContainerFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  submitButton: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 4,
    gap: spacing.sm,
  },
  submitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    fontSize: 10,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
  // CherryHub Login Styles
  cherryHubSection: {
    marginTop: spacing.md,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  cherryHubButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FF6B6B40',
    overflow: 'hidden',
  },
  cherryHubButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
  },
  cherryHubButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B6B',
    letterSpacing: 0.5,
  },
  cherryHubForm: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#FF6B6B30',
  },
  cherryHubTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  cherryHubActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cherryHubCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  cherryHubCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  cherryHubSubmitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
  },
  cherryHubSubmitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Forgot Password Styles
  forgotPasswordLink: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: spacing.lg,
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  modalInputIcon: {
    marginRight: spacing.sm,
  },
  modalInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  modalButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalBackLink: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  modalBackText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
