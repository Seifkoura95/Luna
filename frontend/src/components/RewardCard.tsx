import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
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

const categoryConfig: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  drinks: { icon: 'wine', color: colors.accent },
  bottles: { icon: 'beer', color: colors.gold },
  vip: { icon: 'diamond', color: colors.platinum },
  merch: { icon: 'shirt', color: colors.success },
};

export const RewardCard: React.FC<RewardCardProps> = ({ reward, userPoints, onRedeem }) => {
  const canAfford = userPoints >= reward.points_cost;
  const config = categoryConfig[reward.category] || { icon: 'gift', color: colors.accent };

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
      <LinearGradient
        colors={[colors.backgroundCard, colors.backgroundElevated]}
        style={styles.gradient}
      >
        {/* Icon */}
        <View style={styles.iconSection}>
          <View style={[styles.iconGlow, { backgroundColor: config.color + '15' }]} />
          <View style={[styles.iconContainer, { borderColor: config.color + '40' }]}>
            <Ionicons name={config.icon} size={28} color={config.color} />
          </View>
        </View>
        
        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>{reward.name}</Text>
          <Text style={styles.description} numberOfLines={2}>{reward.description}</Text>
          
          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.pointsCost}>
              <Ionicons name="star" size={14} color={colors.gold} />
              <Text style={styles.pointsText}>{reward.points_cost.toLocaleString()}</Text>
            </View>
            
            <TouchableOpacity
              style={[styles.redeemButton, !canAfford && styles.redeemButtonDisabled]}
              onPress={handleRedeem}
              disabled={!canAfford}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={canAfford ? [colors.accent, colors.accentDark] : [colors.border, colors.border]}
                style={styles.redeemGradient}
              >
                <Text style={[styles.redeemText, !canAfford && styles.redeemTextDisabled]}>
                  {canAfford ? 'Redeem' : 'Need more'}
                </Text>
                {canAfford && (
                  <Ionicons name="arrow-forward" size={14} color={colors.textPrimary} style={styles.redeemIcon} />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  gradient: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  iconSection: {
    position: 'relative',
    marginRight: spacing.md,
  },
  iconGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 40,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsCost: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldGlow,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.full,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
    marginLeft: spacing.xs,
  },
  redeemButton: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  redeemButtonDisabled: {
    opacity: 0.7,
  },
  redeemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  redeemText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  redeemTextDisabled: {
    color: colors.textMuted,
  },
  redeemIcon: {
    marginLeft: spacing.xs,
  },
});
