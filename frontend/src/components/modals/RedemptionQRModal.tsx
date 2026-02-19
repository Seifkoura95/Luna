import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { colors, spacing, radius } from '../../theme/colors';

const { width } = Dimensions.get('window');

interface RedemptionQRModalProps {
  visible: boolean;
  onClose: () => void;
  redemption: {
    id: string;
    reward_name: string;
    reward_description?: string;
    qr_code: string;
    expires_at: string;
    status: string;
  } | null;
}

export function RedemptionQRModal({ visible, onClose, redemption }: RedemptionQRModalProps) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!redemption?.expires_at) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(redemption.expires_at).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${minutes}m remaining`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [redemption]);

  if (!redemption) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1a1a1a', '#0a0a0a']}
            style={styles.modalGradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTextContainer}>
                <Text style={styles.modalTitle}>Show to Staff</Text>
                <Text style={styles.modalSubtitle}>One-time use only</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* QR Code */}
            <View style={styles.qrContainer}>
              <View style={styles.qrBackground}>
                {redemption.status === 'pending' ? (
                  <QRCode
                    value={redemption.qr_code}
                    size={width * 0.6}
                    color="#000"
                    backgroundColor="#fff"
                    logo={undefined}
                  />
                ) : (
                  <View style={styles.usedOverlay}>
                    <Ionicons name="checkmark-circle" size={80} color={colors.success} />
                    <Text style={styles.usedText}>Already Redeemed</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Reward Details */}
            <View style={styles.rewardDetails}>
              <Text style={styles.rewardName}>{redemption.reward_name}</Text>
              {redemption.reward_description && (
                <Text style={styles.rewardDesc}>{redemption.reward_description}</Text>
              )}
              
              <View style={styles.expiryBadge}>
                <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                <Text style={styles.expiryText}>{timeLeft}</Text>
              </View>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsBox}>
              <Ionicons name="information-circle" size={20} color={colors.accent} />
              <Text style={styles.instructionsText}>
                Present this QR code to venue staff. Once scanned, this code cannot be used again.
              </Text>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  headerTextContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  qrBackground: {
    padding: spacing.lg,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  usedOverlay: {
    width: width * 0.6,
    height: width * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  usedText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  rewardDetails: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  rewardName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  rewardDesc: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  expiryText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.accent + '15',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  instructionsText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
