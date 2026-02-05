import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import { colors } from '../theme/colors';
import { api } from '../utils/api';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface QRCodeProps {
  size?: number;
}

export const QRCode: React.FC<QRCodeProps> = ({ size = 250 }) => {
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

  if (loading) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Generating QR Code...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.qrContainer, { width: size + 20, height: size + 20 }]}>
        {qrData && (
          <QRCodeSVG
            value={qrData}
            size={size}
            backgroundColor="white"
            color="black"
          />
        )}
      </View>
      <View style={styles.timerContainer}>
        <View style={styles.timerRow}>
          <Text style={styles.timerLabel}>Refreshes in</Text>
          <Text style={[styles.timerValue, countdown <= 10 && styles.timerWarning]}>
            {countdown}s
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(countdown / 60) * 100}%` },
              countdown <= 10 && styles.progressWarning
            ]} 
          />
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
    backgroundColor: colors.card,
    borderRadius: 16,
  },
  qrContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 10,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  timerContainer: {
    marginTop: 16,
    width: '100%',
    paddingHorizontal: 20,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  timerValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  timerWarning: {
    color: colors.warning,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.card,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  progressWarning: {
    backgroundColor: colors.warning,
  },
});
