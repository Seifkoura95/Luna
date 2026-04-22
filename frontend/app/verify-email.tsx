/**
 * Email OTP verification screen.
 *
 * Shown immediately after signup when the backend returns
 * `verification_required: true`. User enters the 6-digit code from their
 * email to activate the account.
 *
 * UX details
 * ----------
 * - Six individual input cells styled like classic OTP boxes. Auto-advance
 *   on keystroke, auto-backspace to previous cell on delete.
 * - Paste support: if the user pastes a 6-digit string into any cell, it
 *   populates all six cells at once and fires verification.
 * - "Resend code" is gated by a 30-second cooldown to discourage spam and
 *   stay within Resend free-tier rate limits.
 * - Auto-verify on completion — no submit button needed.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../src/components/Icon';
import { AppBackground } from '../src/components/AppBackground';
import { api } from '../src/utils/api';
import { useAuthStore } from '../src/store/authStore';
import { colors, spacing, radius } from '../src/theme/colors';

const CELL_COUNT = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const user = useAuthStore((s) => s.user);

  const [digits, setDigits] = useState<string[]>(Array(CELL_COUNT).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cellRefs = useRef<Array<TextInput | null>>(Array(CELL_COUNT).fill(null));
  const autoSubmitted = useRef(false);

  const displayEmail = (params.email || (user as any)?.email || 'your email') as string;

  // Start initial 30s cooldown — discourages "tap resend first" behaviour
  useEffect(() => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Autofocus first cell on mount
  useEffect(() => {
    const t = setTimeout(() => cellRefs.current[0]?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  const code = useMemo(() => digits.join(''), [digits]);

  const handleChange = (text: string, index: number) => {
    setError(null);
    const onlyDigits = text.replace(/\D/g, '');

    // Paste detection — any cell receiving >1 digit floods all six
    if (onlyDigits.length > 1) {
      const pasted = onlyDigits.slice(0, CELL_COUNT).padEnd(CELL_COUNT, '');
      const next = pasted.split('');
      while (next.length < CELL_COUNT) next.push('');
      setDigits(next);
      const lastFilled = Math.min(pasted.replace(/\s/g, '').length - 1, CELL_COUNT - 1);
      if (lastFilled >= 0) cellRefs.current[lastFilled]?.focus();
      Keyboard.dismiss();
      return;
    }

    const next = [...digits];
    next[index] = onlyDigits;
    setDigits(next);

    // Advance focus if user typed
    if (onlyDigits && index < CELL_COUNT - 1) {
      cellRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      cellRefs.current[index - 1]?.focus();
    }
  };

  // Auto-verify once all 6 cells are filled
  useEffect(() => {
    if (code.length === CELL_COUNT && !autoSubmitted.current && !loading) {
      autoSubmitted.current = true;
      verify();
    }
    if (code.length < CELL_COUNT) {
      autoSubmitted.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const verify = async () => {
    if (code.length !== CELL_COUNT) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.verifyEmail(code);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Update the cached auth user so downstream screens see the flipped
      // email_verified flag without needing a re-fetch.
      const current = useAuthStore.getState().user as any;
      if (current) {
        useAuthStore.setState({
          user: { ...current, email_verified: true },
        });
      }

      if ((result as any).referral_bonus) {
        Alert.alert('🎉 Welcome Bonus!', (result as any).referral_bonus);
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setError(e?.message || 'Invalid code. Please try again.');
      // Clear cells so the user can re-enter without backspacing 6 times
      setDigits(Array(CELL_COUNT).fill(''));
      cellRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await api.resendVerificationEmail();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setError(null);
      setDigits(Array(CELL_COUNT).fill(''));
      cellRefs.current[0]?.focus();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Code sent', `We just sent a new code to ${displayEmail}. Check your inbox.`);
    } catch (e: any) {
      Alert.alert('Could not resend', e?.message || 'Try again in a moment.');
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <AppBackground intensity={30} tint="dark" overlayOpacity={0.5} />

        <View style={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            data-testid="verify-email-back-btn"
          >
            <Icon name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.hero}>
            <View style={styles.iconCircle}>
              <Icon name="mail" size={32} color={colors.accent} />
            </View>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.emailHighlight}>{displayEmail}</Text>
            </Text>
          </View>

          <View style={styles.cellRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { cellRefs.current[i] = r; }}
                value={d}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={CELL_COUNT}
                textContentType={i === 0 ? 'oneTimeCode' : 'none'}
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                style={[
                  styles.cell,
                  d && styles.cellFilled,
                  error && styles.cellError,
                ]}
                editable={!loading}
                selectTextOnFocus
                data-testid={`verify-email-cell-${i}`}
              />
            ))}
          </View>

          {error && <Text style={styles.errorText} data-testid="verify-email-error">{error}</Text>}

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingText}>Verifying...</Text>
            </View>
          )}

          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't get it?</Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={cooldown > 0 || resending}
              data-testid="verify-email-resend-btn"
            >
              <Text
                style={[
                  styles.resendBtn,
                  (cooldown > 0 || resending) && styles.resendBtnDisabled,
                ]}
              >
                {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.helperText}>
            Wrong email?{' '}
            <Text
              style={styles.helperLink}
              onPress={() => router.replace('/login')}
              data-testid="verify-email-change-email"
            >
              Start over
            </Text>
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.xl * 2,
    marginBottom: spacing.xl * 1.5,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212,168,50,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,50,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailHighlight: {
    color: colors.text,
    fontWeight: '600',
  },
  cellRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  cell: {
    width: 48,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  cellFilled: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(212,168,50,0.08)',
  },
  cellError: {
    borderColor: '#FF5555',
  },
  errorText: {
    color: '#FF7777',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  resendLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  resendBtn: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  resendBtnDisabled: {
    color: colors.textMuted,
    opacity: 0.6,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  helperLink: {
    color: colors.text,
    fontWeight: '600',
  },
});
