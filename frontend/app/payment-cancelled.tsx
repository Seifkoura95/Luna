import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../src/components/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, radius } from '../src/theme/colors';
import { AppBackground } from '../src/components/AppBackground';

export default function PaymentCancelled() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <AppBackground />
      
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        <Animated.View entering={FadeInDown} style={styles.statusContainer}>
          <View style={styles.cancelledIcon}>
            <Icon name="close-circle-outline" size={64} color={colors.textMuted} />
          </View>
          <Text style={styles.cancelledTitle}>Payment Cancelled</Text>
          <Text style={styles.statusSubtitle}>
            You cancelled the payment. No charges were made.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.back()}
            data-testid="payment-cancelled-back"
          >
            <LinearGradient
              colors={[colors.accent, colors.accentDark]}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Go Back</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace('/(tabs)')}
            data-testid="payment-cancelled-home"
          >
            <Text style={styles.secondaryButtonText}>Return to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  statusContainer: {
    alignItems: 'center',
  },
  cancelledIcon: {
    marginBottom: spacing.md,
  },
  cancelledTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  statusSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  primaryButton: {
    width: '100%',
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
