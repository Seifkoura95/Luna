import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface RewardCardProps {
  reward: {
    id: string;
    name: string;
    description: string;
    points_cost: number;
    category: string;
  };
  userPoints: number;
  onRedeem: (rewardId: string) => void;
}

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  drinks: 'wine',
  bottles: 'beer',
  vip: 'star',
  merch: 'shirt',
};

export const RewardCard: React.FC<RewardCardProps> = ({ reward, userPoints, onRedeem }) => {
  const canAfford = userPoints >= reward.points_cost;
  const icon = categoryIcons[reward.category] || 'gift';

  const handleRedeem = () => {
    if (canAfford) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onRedeem(reward.id);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={32} color={colors.accent} />
      </View>
      <View style={styles.content}>
        <Text style={styles.name}>{reward.name}</Text>
        <Text style={styles.description}>{reward.description}</Text>
        <View style={styles.footer}>
          <View style={styles.pointsCost}>
            <Ionicons name="star" size={14} color={colors.premiumGold} />
            <Text style={styles.pointsText}>{reward.points_cost.toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            style={[styles.redeemButton, !canAfford && styles.redeemButtonDisabled]}
            onPress={handleRedeem}
            disabled={!canAfford}
          >
            <Text style={[styles.redeemText, !canAfford && styles.redeemTextDisabled]}>
              {canAfford ? 'Redeem' : 'Not enough'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsCost: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.premiumGold,
    marginLeft: 4,
  },
  redeemButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  redeemButtonDisabled: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  redeemText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  redeemTextDisabled: {
    color: colors.textMuted,
  },
});
