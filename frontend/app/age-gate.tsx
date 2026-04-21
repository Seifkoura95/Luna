import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../src/theme/colors';
import { ONBOARDING_KEY } from './onboarding';

export const AGE_GATE_KEY = '@luna_age_gate_passed';
export const AGE_GATE_DOB_KEY = '@luna_age_gate_dob';

const LUNA_LOGO =
  'https://customer-assets.emergentagent.com/job_c826baa4-6640-40ce-9e0d-38132d9944fc/artifacts/2k76js5m_luna-group-logo-2.webp';
const MIN_AGE = 18;

function calcAge(day: number, month: number, year: number): number {
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() + 1 - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) age--;
  return age;
}

function isValidDate(day: number, month: number, year: number): boolean {
  if (!day || !month || !year) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

export default function AgeGateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [underAge, setUnderAge] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const handleDayChange = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 2);
    setDay(clean);
    setError(null);
    if (clean.length === 2) monthRef.current?.focus();
  };

  const handleMonthChange = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 2);
    setMonth(clean);
    setError(null);
    if (clean.length === 2) yearRef.current?.focus();
  };

  const handleYearChange = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 4);
    setYear(clean);
    setError(null);
  };

  const handleConfirm = async () => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (!isValidDate(d, m, y)) {
      setError('Please enter a valid date of birth (DD / MM / YYYY).');
      return;
    }

    const age = calcAge(d, m, y);

    if (age < MIN_AGE) {
      setUnderAge(true);
      return;
    }

    setVerifying(true);
    try {
      const iso = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      await AsyncStorage.setItem(AGE_GATE_KEY, 'true');
      await AsyncStorage.setItem(AGE_GATE_DOB_KEY, iso);
    } catch {
      /* storage failure still lets us proceed */
    }

    // Continue to onboarding (or login if already seen)
    const seenOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY).catch(() => null);
    router.replace(seenOnboarding ? '/login' : '/onboarding');
  };

  if (underAge) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#1a0a0a', '#000000']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.blockedContent}>
          <Text style={styles.blockedIcon}>🔒</Text>
          <Text style={styles.blockedTitle} data-testid="age-gate-blocked-title">
            SORRY
          </Text>
          <Text style={styles.blockedLine}>
            Luna Group is for adults aged 18 and over, the legal drinking age in
            Queensland.
          </Text>
          <Text style={styles.blockedLineSmall}>
            You can't create an account at this time.
          </Text>
          <TouchableOpacity
            style={styles.blockedLearnMore}
            onPress={() =>
              Linking.openURL('https://lunagroupapp.com.au/terms').catch(
                () => {},
              )
            }
          >
            <Text style={styles.blockedLearnMoreText}>Read our Terms</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#0a0a12', '#000000']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + spacing.xl }]}>
        <Image
          source={{ uri: LUNA_LOGO }}
          style={styles.logo}
          contentFit="contain"
        />

        <Text style={styles.eyebrow} data-testid="age-gate-eyebrow">
          AGE VERIFICATION
        </Text>
        <Text style={styles.title}>Confirm your date of birth</Text>
        <Text style={styles.subtitle}>
          Luna Group is for adults 18+. We only use this to verify your age.
        </Text>

        <View style={styles.dobRow}>
          <View style={styles.dobBox}>
            <Text style={styles.dobLabel}>DAY</Text>
            <TextInput
              style={styles.dobInput}
              placeholder="DD"
              placeholderTextColor="#555"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={2}
              value={day}
              onChangeText={handleDayChange}
              data-testid="age-gate-dob-day"
            />
          </View>
          <View style={styles.dobBox}>
            <Text style={styles.dobLabel}>MONTH</Text>
            <TextInput
              ref={monthRef}
              style={styles.dobInput}
              placeholder="MM"
              placeholderTextColor="#555"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={2}
              value={month}
              onChangeText={handleMonthChange}
              data-testid="age-gate-dob-month"
            />
          </View>
          <View style={[styles.dobBox, { flex: 1.3 }]}>
            <Text style={styles.dobLabel}>YEAR</Text>
            <TextInput
              ref={yearRef}
              style={styles.dobInput}
              placeholder="YYYY"
              placeholderTextColor="#555"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={4}
              value={year}
              onChangeText={handleYearChange}
              onSubmitEditing={handleConfirm}
              data-testid="age-gate-dob-year"
            />
          </View>
        </View>

        {error && (
          <Text style={styles.errorText} data-testid="age-gate-error">
            {error}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.ctaButton,
            (!day || !month || year.length !== 4 || verifying) &&
              styles.ctaButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!day || !month || year.length !== 4 || verifying}
          activeOpacity={0.85}
          data-testid="age-gate-confirm-btn"
        >
          {verifying ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.ctaText}>CONTINUE</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.fine}>
          By continuing you confirm you are 18 years or older and agree to
          Luna Group's{' '}
          <Text
            style={styles.fineLink}
            onPress={() =>
              Linking.openURL('https://lunagroupapp.com.au/terms').catch(
                () => {},
              )
            }
          >
            Terms
          </Text>{' '}
          and{' '}
          <Text
            style={styles.fineLink}
            onPress={() =>
              Linking.openURL('https://lunagroupapp.com.au/privacy').catch(
                () => {},
              )
            }
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 58,
    marginBottom: spacing.xl,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 4,
    color: colors.accent,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: spacing.xl,
  },
  dobRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    maxWidth: 380,
    marginBottom: spacing.md,
  },
  dobBox: {
    flex: 1,
  },
  dobLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textMuted,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  dobInput: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    fontSize: 22,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  ctaButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  ctaButtonDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
  },
  fine: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    maxWidth: 340,
    lineHeight: 17,
  },
  fineLink: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  blockedContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  blockedIcon: {
    fontSize: 56,
    marginBottom: spacing.lg,
  },
  blockedTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF6B6B',
    letterSpacing: 6,
    marginBottom: spacing.md,
  },
  blockedLine: {
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
    marginBottom: spacing.md,
  },
  blockedLineSmall: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  blockedLearnMore: {
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: radius.full,
  },
  blockedLearnMoreText: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 2,
    fontWeight: '700',
  },
});
