import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';

const { width } = Dimensions.get('window');

interface RedemptionQRModalProps {
  visible: boolean;
  onClose: () => void;
  redemption: {
    id: string;
    qr_code: string;
    reward_name: string;
    reward_description?: string;
    points_spent: number;
    status: string;
    expires_at?: string;
  } | null;
}

export const RedemptionQRModal: React.FC<RedemptionQRModalProps> = ({
  visible,
  onClose,
  redemption,
}) => {
  if (!redemption) return null;

  const isRedeemed = redemption.status === 'redeemed';
  const isExpired = redemption.status === 'expired';
  const isPending = redemption.status === 'pending';

  const formatExpiryDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Your Reward</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Reward Info */}
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardName}>{redemption.reward_name}</Text>
            {redemption.reward_description && (
              <Text style={styles.rewardDescription}>{redemption.reward_description}</Text>
            )}
            <Text style={styles.pointsSpent}>{redemption.points_spent} points</Text>
          </View>

          {/* QR Code */}
          {isPending && (
            <View style={styles.qrContainer}>
              <LinearGradient
                colors={['#1a1a1a', '#0a0a0a']}
                style={styles.qrWrapper}
              >
                <QRCode
                  value={redemption.qr_code}
                  size={200}
                  backgroundColor="transparent"
                  color="#fff"
                />
              </LinearGradient>
              <Text style={styles.qrCode}>{redemption.qr_code}</Text>
              {redemption.expires_at && (
                <Text style={styles.expiryText}>
                  Expires: {formatExpiryDate(redemption.expires_at)}
                </Text>
              )}
            </View>
          )}

          {/* Status Indicators */}
          {isRedeemed && (
            <View style={styles.statusContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#00D4AA" />
              <Text style={styles.statusText}>Already Redeemed</Text>
            </View>
          )}

          {isExpired && (
            <View style={styles.statusContainer}>
              <Ionicons name="time" size={64} color={colors.accent} />
              <Text style={styles.statusText}>Expired</Text>
            </View>
          )}

          {/* Instructions */}
          {isPending && (
            <View style={styles.instructions}>
              <Text style={styles.instructionsTitle}>How to redeem:</Text>
              <Text style={styles.instructionsText}>
                1. Show this QR code to venue staff{'\n'}
                2. They will scan it to confirm{'\n'}
                3. Enjoy your reward!
              </Text>
            </View>
          )}

          {/* Close Button */}
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>DONE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width - 40,
    backgroundColor: '#1a1a1a',
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  rewardInfo: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  rewardName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  rewardDescription: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  pointsSpent: {
    fontSize: 14,
    color: colors.gold,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  qrWrapper: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  qrCode: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  expiryText: {
    fontSize: 12,
    color: colors.accent,
    marginTop: spacing.sm,
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  instructions: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.xl,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  instructionsText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  doneButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
});

export default RedemptionQRModal;
