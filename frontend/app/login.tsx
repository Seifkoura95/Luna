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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppBackground } from '../src/components/AppBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


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
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  

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
                      <Ionicons
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
                    <Ionicons
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
                    <Ionicons
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
                      <Ionicons
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
                      <Ionicons name="arrow-forward" size={20} color={colors.textPrimary} />
                    )}
                  </LinearGradient>
                </TouchableOpacity>

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
});
