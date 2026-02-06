import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
import { api } from '../utils/api';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QRCodeProps {
  size?: number;
  venueId: string;
}

export const QRCode: React.FC<QRCodeProps> = ({ size = 200, venueId }) => {
  const [qrData, setQrData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState<string | null>(null);

  const fetchQRData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getQRData();
      setQrData(data.qr_data);
      setCountdown(data.expires_in);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQRData();
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      fetchQRData();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const isUrgent = countdown <= 10;

  if (loading) {
    return (
      <View style={[styles.container, { width: size + 40, height: size + 100 }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Generating your pass...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { width: size + 40, height: size + 100 }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchQRData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* QR Code Container */}
      <View style={styles.qrOuterContainer}>
        <LinearGradient
          colors={['#FFFFFF', '#F5F5F5']}
          style={[styles.qrContainer, { width: size + 32, height: size + 32 }]}
        >
          {/* Corner Accents */}
          <View style={[styles.cornerAccent, styles.cornerTopLeft]} />
          <View style={[styles.cornerAccent, styles.cornerTopRight]} />
          <View style={[styles.cornerAccent, styles.cornerBottomLeft]} />
          <View style={[styles.cornerAccent, styles.cornerBottomRight]} />
          
          {qrData && (
            <QRCodeSVG
              value={qrData}
              size={size}
              backgroundColor="transparent"
              color="#000000"
            />
          )}
        </LinearGradient>
      </View>

      {/* Timer Section */}
      <View style={[styles.timerContainer, isUrgent && styles.timerContainerUrgent]}>
        <View style={styles.timerContent}>
          <Ionicons 
            name="refresh-circle" 
            size={18} 
            color={isUrgent ? colors.warning : colors.textSecondary} 
          />
          <Text style={[styles.timerLabel, isUrgent && styles.timerLabelUrgent]}>
            Auto-refresh in
          </Text>
          <View style={[styles.timerBadge, isUrgent && styles.timerBadgeUrgent]}>
            <Text style={[styles.timerValue, isUrgent && styles.timerValueUrgent]}>
              {countdown}s
            </Text>
          </View>
        </View>
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(countdown / 60) * 100}%` },
                isUrgent && styles.progressFillUrgent
              ]} 
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  retryText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  qrOuterContainer: {
    padding: 4,
    borderRadius: radius.lg + 4,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.lg,
    position: 'relative',
  },
  cornerAccent: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: colors.accent,
  },
  cornerTopLeft: {
    top: 8,
    left: 8,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cornerTopRight: {
    top: 8,
    right: 8,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cornerBottomLeft: {
    bottom: 8,
    left: 8,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cornerBottomRight: {
    bottom: 8,
    right: 8,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },
  timerContainer: {
    marginTop: spacing.md,
    width: '100%',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerContainerUrgent: {
    borderColor: colors.warning + '50',
    backgroundColor: colors.warningGlow,
  },
  timerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timerLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    marginLeft: spacing.sm,
    flex: 1,
  },
  timerLabelUrgent: {
    color: colors.warning,
  },
  timerBadge: {
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  timerBadgeUrgent: {
    backgroundColor: colors.warning,
  },
  timerValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  timerValueUrgent: {
    color: colors.background,
  },
  progressContainer: {
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  progressFillUrgent: {
    backgroundColor: colors.warning,
  },
});
