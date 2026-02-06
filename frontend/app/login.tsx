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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, spacing, radius } from '../src/theme/colors';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

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
        const result = await api.register(email, password, name);
        useAuthStore.getState().login(result.user, result.token);
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <LinearGradient
          colors={['#000000', '#0D0D0D', '#000000']}
          style={styles.gradient}
        >
          {/* Animated Background Elements */}
          <View style={styles.backgroundEffects}>
            {/* Large gradient orbs */}
            <View style={[styles.gradientOrb, styles.orbOne]}>
              <LinearGradient
                colors={[colors.accent + '15', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <View style={[styles.gradientOrb, styles.orbTwo]}>
              <LinearGradient
                colors={[colors.gold + '10', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <View style={[styles.gradientOrb, styles.orbThree]}>
              <LinearGradient
                colors={[colors.accent + '08', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
            </View>

            {/* Subtle grid lines */}
            <View style={styles.gridContainer}>
              {[...Array(6)].map((_, i) => (
                <View key={`h-${i}`} style={[styles.gridLine, { top: `${i * 20}%` }]} />
              ))}
              {[...Array(6)].map((_, i) => (
                <View key={`v-${i}`} style={[styles.gridLineVertical, { left: `${i * 20}%` }]} />
              ))}
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.content}>
            {/* Header Section */}
            <View style={styles.header}>
              {/* Logo Mark */}
              <View style={styles.logoMark}>
                <View style={styles.logoBackground}>
                  <LinearGradient
                    colors={[colors.accent + '20', 'transparent']}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <View style={styles.logoInner}>
                  <Text style={styles.logoLetter}>L</Text>
                </View>
              </View>

              {/* Brand Title */}
              <View style={styles.brandContainer}>
                <Text style={styles.brandTitle}>LUNA GROUP</Text>
                <View style={styles.brandUnderline} />
              </View>

              {/* Tagline */}
              <Text style={styles.tagline}>QUEENSLAND'S PREMIER NIGHTLIFE COLLECTIVE</Text>

              {/* Venue Count */}
              <View style={styles.venuesBadge}>
                <View style={styles.venuesDot} />
                <Text style={styles.venuesText}>7 ELITE VENUES</Text>
                <View style={styles.venuesDot} />
              </View>
            </View>

            {/* Auth Toggle */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, isLogin && styles.toggleButtonActive]}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                  setIsLogin(true);
                }}
                activeOpacity={0.7}
              >
                {isLogin && (
                  <LinearGradient
                    colors={[colors.accent + '30', colors.accent + '10']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
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
                {!isLogin && (
                  <LinearGradient
                    colors={[colors.accent + '30', colors.accent + '10']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
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
                  By continuing, you agree to Luna Group's Terms & Privacy Policy
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  backgroundEffects: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientOrb: {
    position: 'absolute',
    borderRadius: 1000,
  },
  orbOne: {
    width: 600,
    height: 600,
    top: -200,
    right: -200,
  },
  orbTwo: {
    width: 400,
    height: 400,
    bottom: -100,
    left: -100,
  },
  orbThree: {
    width: 500,
    height: 500,
    top: height * 0.3,
    left: width * 0.1,
  },
  gridContainer: {
    flex: 1,
    opacity: 0.03,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.textPrimary,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.textPrimary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logoMark: {
    width: 90,
    height: 90,
    marginBottom: spacing.xl,
    position: 'relative',
  },
  logoBackground: {
    position: 'absolute',
    top: -15,
    left: -15,
    right: -15,
    bottom: -15,
    borderRadius: 60,
  },
  logoInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.backgroundCard,
    borderWidth: 2,
    borderColor: colors.accent + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 12,
    marginBottom: spacing.sm,
  },
  brandUnderline: {
    width: 60,
    height: 3,
    backgroundColor: colors.accent,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  venuesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  venuesDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginHorizontal: spacing.sm,
  },
  venuesText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    overflow: 'hidden',
  },
  toggleButtonActive: {
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 60,
    transition: 'all 0.2s',
  },
  inputContainerFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.backgroundElevated,
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
    elevation: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  submitButtonDisabled: {
    elevation: 0,
    shadowOpacity: 0,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 4,
    gap: spacing.sm,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 3,
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
