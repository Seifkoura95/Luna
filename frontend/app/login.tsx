import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, radius } from '../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/utils/api';
import { useAuthStore } from '../src/store/authStore';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

type AuthMode = 'login' | 'register';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setLoading(true);
    try {
      let result;
      if (mode === 'register') {
        result = await api.register(email.trim(), password, name.trim());
      } else {
        result = await api.login(email.trim(), password);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await login(
        {
          user_id: result.user_id,
          email: result.email,
          name: result.name,
          tier: result.tier,
          points_balance: result.points_balance,
        },
        result.token
      );

      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setMode(mode === 'login' ? 'register' : 'login');
    setPassword('');
  };

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#000000', '#0A0A0A', '#111111']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Decorative Elements */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Premium Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoGlow} />
            <Text style={styles.logoText}>ECLIPSE</Text>
            <View style={styles.locationBadge}>
              <View style={styles.locationDot} />
              <Text style={styles.locationText}>BRISBANE</Text>
            </View>
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <View style={styles.dividerDiamond} />
              <View style={styles.dividerLine} />
            </View>
            <Text style={styles.tagline}>Premium VIP Experience</Text>
          </View>

          {/* Auth Card */}
          <View style={styles.authCard}>
            <LinearGradient
              colors={['#1A1A1A', '#111111']}
              style={styles.authCardGradient}
            >
              <Text style={styles.formTitle}>
                {mode === 'login' ? 'Welcome Back' : 'Join the Elite'}
              </Text>
              <Text style={styles.formSubtitle}>
                {mode === 'login'
                  ? 'Sign in to access exclusive VIP benefits'
                  : 'Create your account and start earning rewards'}
              </Text>

              {mode === 'register' && (
                <View style={[
                  styles.inputContainer,
                  focusedInput === 'name' && styles.inputContainerFocused
                ]}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons name="person" size={18} color={focusedInput === 'name' ? colors.gold : colors.textMuted} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor={colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    onFocus={() => setFocusedInput('name')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </View>
              )}

              <View style={[
                styles.inputContainer,
                focusedInput === 'email' && styles.inputContainerFocused
              ]}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="mail" size={18} color={focusedInput === 'email' ? colors.gold : colors.textMuted} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={[
                styles.inputContainer,
                focusedInput === 'password' && styles.inputContainerFocused
              ]}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="lock-closed" size={18} color={focusedInput === 'password' ? colors.gold : colors.textMuted} />
                </View>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                />
                <TouchableOpacity
                  style={styles.showPasswordBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Premium Submit Button */}
              <TouchableOpacity
                style={styles.submitButtonContainer}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={loading ? ['#333', '#222'] : [colors.accent, colors.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitButton}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textPrimary} />
                  ) : (
                    <>
                      <Text style={styles.submitButtonText}>
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                      </Text>
                      <View style={styles.submitArrow}>
                        <Ionicons name="arrow-forward" size={18} color={colors.textPrimary} />
                      </View>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Toggle Mode */}
              <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
                <Text style={styles.toggleText}>
                  {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <Text style={styles.toggleTextAccent}>
                    {mode === 'login' ? 'Sign Up' : 'Sign In'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Premium Features */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <LinearGradient
                colors={[colors.accentGlow, 'transparent']}
                style={styles.featureGlow}
              />
              <View style={styles.featureIcon}>
                <Ionicons name="qr-code" size={24} color={colors.accent} />
              </View>
              <Text style={styles.featureLabel}>VIP Pass</Text>
            </View>
            <View style={styles.featureItem}>
              <LinearGradient
                colors={[colors.goldGlow, 'transparent']}
                style={styles.featureGlow}
              />
              <View style={[styles.featureIcon, styles.featureIconGold]}>
                <Ionicons name="star" size={24} color={colors.gold} />
              </View>
              <Text style={styles.featureLabel}>Rewards</Text>
            </View>
            <View style={styles.featureItem}>
              <LinearGradient
                colors={[colors.warningGlow, 'transparent']}
                style={styles.featureGlow}
              />
              <View style={[styles.featureIcon, styles.featureIconWarning]}>
                <Ionicons name="flash" size={24} color={colors.warning} />
              </View>
              <Text style={styles.featureLabel}>Auctions</Text>
            </View>
            <View style={styles.featureItem}>
              <LinearGradient
                colors={[colors.successGlow, 'transparent']}
                style={styles.featureGlow}
              />
              <View style={[styles.featureIcon, styles.featureIconSuccess]}>
                <Ionicons name="images" size={24} color={colors.success} />
              </View>
              <Text style={styles.featureLabel}>Photos</Text>
            </View>
          </View>

          {/* Terms */}
          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.accentGlow,
    opacity: 0.3,
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -50,
    left: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.goldGlow,
    opacity: 0.2,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: height * 0.08,
    paddingBottom: spacing.xl,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoGlow: {
    position: 'absolute',
    top: -20,
    width: 200,
    height: 100,
    backgroundColor: colors.accentGlow,
    borderRadius: 100,
    opacity: 0.4,
  },
  logoText: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 12,
    textShadowColor: colors.accentGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: spacing.sm,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 3,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    width: 40,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerDiamond: {
    width: 8,
    height: 8,
    backgroundColor: colors.gold,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: spacing.sm,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  authCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  authCardGradient: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  inputContainerFocused: {
    borderColor: colors.gold,
  },
  inputIconContainer: {
    width: 50,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  passwordInput: {
    paddingRight: 50,
  },
  showPasswordBtn: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.xs,
  },
  submitButtonContainer: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
  },
  submitButtonText: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  submitArrow: {
    marginLeft: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  toggleTextAccent: {
    color: colors.gold,
    fontWeight: '600',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
  },
  featureItem: {
    alignItems: 'center',
    position: 'relative',
  },
  featureGlow: {
    position: 'absolute',
    top: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.5,
  },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  featureIconGold: {
    borderColor: colors.gold + '40',
  },
  featureIconWarning: {
    borderColor: colors.warning + '40',
  },
  featureIconSuccess: {
    borderColor: colors.success + '40',
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  termsText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
