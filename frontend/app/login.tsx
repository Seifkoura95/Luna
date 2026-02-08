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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarfieldBackground } from '../src/components/StarfieldBackground';
import { RotatingMoon } from '../src/components/RotatingMoon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, fonts } from '../src/hooks/useFonts';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const fontsLoaded = useFonts();

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
        {/* Starfield Background */}
        <StarfieldBackground starCount={100} shootingStarCount={3} />
        
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
                {/* Lunar Moon Logo - No border */}
                <View style={styles.logoContainer}>
                  <RotatingMoon size={100} rotationDuration={25000} />
                </View>

                {/* Brand Title - Using Victory Striker font like other pages */}
                <Text style={[styles.brandTitle, fontsLoaded && { fontFamily: fonts.striker }]}>LUNA GROUP</Text>
                <View style={styles.brandUnderline} />

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
    backgroundColor: '#000000',
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
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  brandUnderline: {
    width: 60,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#111111',
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: '#222222',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  toggleTextActive: {
    color: colors.textPrimary,
  },
  formSection: {
    gap: spacing.lg,
  },
  inputWrapper: {
    gap: spacing.sm,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginLeft: spacing.xs,
  },
  optionalLabel: {
    color: colors.textMuted,
    fontWeight: '400',
    letterSpacing: 0,
  },
  referralHint: {
    fontSize: 11,
    color: '#00D4AA',
    marginTop: 4,
    marginLeft: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#1F1F1F',
    paddingHorizontal: spacing.md,
    height: 56,
  },
  inputContainerFocused: {
    borderColor: colors.accent,
    backgroundColor: '#111111',
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
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
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
