import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
import { Icon } from './Icon';
import { api } from '../utils/api';

interface QueueData {
  status: 'low' | 'medium' | 'high';
  people_inside: number;
  queue_length: number;
  best_arrival_time: string;
}

export const QueueStatus: React.FC = () => {
  const [queueData, setQueueData] = useState<QueueData | null>(null);

  useEffect(() => {
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueueStatus = async () => {
    try {
      const data = await api.getQueueStatus();
      setQueueData(data);
    } catch (e) {
      console.error('Failed to fetch queue status:', e);
    }
  };

  if (!queueData) return null;

  const statusConfig = {
    low: {
      color: colors.success,
      glow: colors.successGlow,
      label: 'LOW',
      message: 'Perfect time to arrive!',
      icon: 'checkmark-circle' as const,
    },
    medium: {
      color: colors.warning,
      glow: colors.warningGlow,
      label: 'MODERATE',
      message: 'Slight wait expected',
      icon: 'time' as const,
    },
    high: {
      color: colors.error,
      glow: colors.errorGlow,
      label: 'BUSY',
      message: 'Longer wait times',
      icon: 'alert-circle' as const,
    },
  };

  const config = statusConfig[queueData.status];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.backgroundCard, colors.backgroundElevated]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <View style={styles.titleAccent} />
            <Text style={styles.title}>LIVE QUEUE</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.glow }]}>
            <View style={[styles.statusDot, { backgroundColor: config.color }]} />
            <Text style={[styles.statusLabel, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Icon name="people" size={20} color={colors.accent} />
            </View>
            <Text style={styles.statValue}>{queueData.people_inside}</Text>
            <Text style={styles.statLabel}>Inside</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Icon name="hourglass" size={20} color={colors.gold} />
            </View>
            <Text style={styles.statValue}>{queueData.queue_length}</Text>
            <Text style={styles.statLabel}>In Queue</Text>
          </View>
        </View>

        {/* Best Time Banner */}
        <View style={[styles.bestTimeBanner, { backgroundColor: config.glow }]}>
          <Icon name={config.icon} size={18} color={config.color} />
          <View style={styles.bestTimeContent}>
            <Text style={[styles.bestTimeMessage, { color: config.color }]}>
              {config.message}
            </Text>
            <Text style={styles.bestTimeValue}>
              Best arrival: {queueData.best_arrival_time}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  gradient: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleAccent: {
    width: 3,
    height: 16,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 60,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  bestTimeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  bestTimeContent: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  bestTimeMessage: {
    fontSize: 13,
    fontWeight: '600',
  },
  bestTimeValue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
