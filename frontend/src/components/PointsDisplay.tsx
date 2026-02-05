import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, tierColors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

interface PointsDisplayProps {
  points: number;
  tier: string;
  compact?: boolean;
}

export const PointsDisplay: React.FC<PointsDisplayProps> = ({ points, tier, compact = false }) => {
  const tierColor = tierColors[tier] || colors.textPrimary;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Ionicons name="star" size={16} color={colors.premiumGold} />
        <Text style={styles.compactPoints}>{points.toLocaleString()}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.tierBadge, { backgroundColor: tierColor + '33' }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>
            {tier.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.pointsRow}>
        <Ionicons name="star" size={28} color={colors.premiumGold} />
        <Text style={styles.pointsValue}>{points.toLocaleString()}</Text>
        <Text style={styles.pointsLabel}>pts</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  pointsValue: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  pointsLabel: {
    fontSize: 20,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  compactPoints: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
});
