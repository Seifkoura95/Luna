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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient
        colors={['#000000', '#0A0A0A', '#000000']}
        style={styles.gradient}
      >
        {/* Lunar Background Effects */}
        <View style={styles.lunarBackground}>
          <View style={[styles.moonOrb, styles.moonOrbLarge]} />
          <View style={[styles.moonOrb, styles.moonOrbMedium]} />
          <View style={[styles.moonOrb, styles.moonOrbSmall]} />
          <View style={styles.starsContainer}>
            {[...Array(20)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.star,
                  {
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    opacity: 0.3 + Math.random() * 0.7,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Logo Area */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoGlow} />
              <Ionicons name="moon" size={80} color={colors.textPrimary} />
            </View>
            <Text style={styles.title}>LUNA GROUP</Text>
            <Text style={styles.subtitle}>QUEENSLAND'S PREMIER NIGHTLIFE</Text>
            <View style={styles.venueCountBadge}>
              <View style={styles.venueCountGlow} />
              <Text style={styles.venueCountText}>7 ELITE VENUES</Text>
            </View>
          </View>

          {/* Auth Form */}
          <View style={styles.formContainer}>
            <View style={styles.formCard}>
              <LinearGradient
                colors={[colors.backgroundCard, colors.backgroundElevated]}
                style={styles.formGradient}
              >
                {!isLogin && (
                  <View style={styles.inputContainer}>
                    <Ionicons name="person" size={20} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      placeholderTextColor={colors.textMuted}
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                    />
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Ionicons name="mail" size={20} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed" size={20} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={styles.authButton}
                  onPress={handleAuth}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[colors.accent, colors.accentDark]}
                    style={styles.authButtonGradient}
                  >
                    <Text style={styles.authButtonText}>
                      {loading ? 'PROCESSING...' : isLogin ? 'ENTER' : 'JOIN LUNA'}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.textPrimary} />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.switchButton}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setIsLogin(!isLogin);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.switchText}>
                    {isLogin ? "Don't have access?" : 'Already a member?'}
                  </Text>
                  <Text style={styles.switchTextBold}>
                    {isLogin ? ' Join Luna' : ' Sign In'}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  lunarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  moonOrb: {
    position: 'absolute',
    borderRadius: 1000,
    backgroundColor: colors.textPrimary,
    opacity: 0.03,
  },
  moonOrbLarge: {
    width: 400,
    height: 400,
    top: -100,
    right: -100,
  },
  moonOrbMedium: {
    width: 250,
    height: 250,
    bottom: 100,
    left: -50,
  },
  moonOrbSmall: {
    width: 150,
    height: 150,
    top: height * 0.4,
    left: width * 0.2,
  },
  starsContainer: {
    flex: 1,
  },
  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.textPrimary,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: spacing.xxxl + spacing.xl,
    paddingBottom: spacing.xxl,
  },
  logoSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: spacing.xl,
  },
  logoGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: colors.accentGlow,
    borderRadius: 100,
    opacity: 0.4,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 8,
    marginBottom: spacing.sm,
    textAlign: 'center',
    textShadowColor: colors.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  venueCountBadge: {
    position: 'relative',
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  venueCountGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    backgroundColor: colors.accentGlow,
    borderRadius: radius.full,
    opacity: 0.3,
  },
  venueCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 3,
  },
  formContainer: {
    paddingHorizontal: spacing.lg,
  },
  formCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  formGradient: {
    padding: spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 56,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  authButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  authButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  switchButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  switchText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  switchTextBold: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});