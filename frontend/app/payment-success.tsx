import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../src/components/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors, spacing, radius } from '../src/theme/colors';
import { AppBackground } from '../src/components/AppBackground';
import { api } from '../src/utils/api';
import { TouchableOpacity } from 'react-native';

export default function PaymentSuccess() {
  const insets = useSafeAreaInsets();
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (session_id) {
      pollPaymentStatus();
    }
  }, [session_id]);

  const pollPaymentStatus = async () => {
    if (pollCount >= 5) {
      setStatus('failed');
      return;
    }

    try {
      const result = await api.getPaymentStatus(session_id as string);
      setPaymentDetails(result);

      if (result.payment_status === 'paid') {
        setStatus('success');
      } else if (result.status === 'expired') {
        setStatus('failed');
      } else {
        // Keep polling
        setPollCount(prev => prev + 1);
        setTimeout(pollPaymentStatus, 2000);
      }
    } catch (error) {
      console.error('Payment status error:', error);
      setStatus('failed');
    }
  };

  return (
    <View style={styles.container}>
      <AppBackground />
      
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {status === 'loading' && (
          <Animated.View entering={FadeIn} style={styles.statusContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.statusTitle}>Processing Payment...</Text>
            <Text style={styles.statusSubtitle}>Please wait while we confirm your payment</Text>
          </Animated.View>
        )}

        {status === 'success' && (
          <Animated.View entering={FadeInDown} style={styles.statusContainer}>
            <View style={styles.successIcon}>
              <LinearGradient
                colors={[colors.green, '#059669']}
                style={styles.iconGradient}
              >
                <Icon name="checkmark" size={48} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.statusSubtitle}>
              {paymentDetails?.package_name || 'Your purchase'} has been confirmed
            </Text>
            
            {paymentDetails && (
              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount</Text>
                  <Text style={styles.detailValue}>
                    ${paymentDetails.amount?.toFixed(2)} {paymentDetails.currency?.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>PAID</Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/(tabs)')}
              data-testid="payment-success-home"
            >
              <LinearGradient
                colors={[colors.accent, colors.accentDark]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Back to Home</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {status === 'failed' && (
          <Animated.View entering={FadeInDown} style={styles.statusContainer}>
            <View style={styles.failedIcon}>
              <Icon name="close-circle" size={64} color={colors.red} />
            </View>
            <Text style={styles.failedTitle}>Payment Failed</Text>
            <Text style={styles.statusSubtitle}>
              Something went wrong with your payment. Please try again.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.back()}
              data-testid="payment-failed-retry"
            >
              <LinearGradient
                colors={[colors.accent, colors.accentDark]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Try Again</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
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
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  successIcon: {
    marginBottom: spacing.md,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.green,
    marginTop: spacing.lg,
  },
  failedIcon: {
    marginBottom: spacing.md,
  },
  failedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.red,
    marginTop: spacing.lg,
  },
  detailsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusBadge: {
    backgroundColor: colors.green + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.green,
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
});
