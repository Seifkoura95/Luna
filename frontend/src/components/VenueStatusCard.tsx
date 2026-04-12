import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
import { Icon } from './Icon';

interface VenueStatusCardProps {
  venueName: string;
  status: 'open' | 'busy' | 'closed';
  capacity?: number;
  estimatedWait?: string;
}

export const VenueStatusCard: React.FC<VenueStatusCardProps> = ({
  venueName,
  status,
  capacity,
  estimatedWait,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'open':
        return colors.success;
      case 'busy':
        return colors.warning;
      case 'closed':
        return colors.textMuted;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'open':
        return 'Low Queue';
      case 'busy':
        return 'Busy Tonight';
      case 'closed':
        return 'Closed';
      default:
        return 'Unknown';
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.backgroundCard, colors.backgroundElevated]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
        
        <Text style={styles.venueName}>{venueName}</Text>
        
        {status !== 'closed' && (
          <View style={styles.details}>
            {capacity && (
              <View style={styles.detailItem}>
                <Icon name="people" size={14} color={colors.textSecondary} />
                <Text style={styles.detailText}>{capacity}% capacity</Text>
              </View>
            )}
            {estimatedWait && (
              <View style={styles.detailItem}>
                <Icon name="time" size={14} color={colors.textSecondary} />
                <Text style={styles.detailText}>{estimatedWait} wait</Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  gradient: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  details: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
});