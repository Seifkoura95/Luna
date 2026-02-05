import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
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
    const interval = setInterval(fetchQueueStatus, 30000); // Refresh every 30s
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

  const statusColors = {
    low: colors.queueLow,
    medium: colors.queueMedium,
    high: colors.queueHigh,
  };

  const statusLabels = {
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
  };

  const statusColor = statusColors[queueData.status];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Queue Status</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusLabels[queueData.status]}
          </Text>
        </View>
      </View>
      
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="people" size={20} color={colors.textSecondary} />
          <Text style={styles.statValue}>{queueData.people_inside}</Text>
          <Text style={styles.statLabel}>Inside</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Ionicons name="time" size={20} color={colors.textSecondary} />
          <Text style={styles.statValue}>{queueData.queue_length}</Text>
          <Text style={styles.statLabel}>In Queue</Text>
        </View>
      </View>
      
      <View style={styles.bestTime}>
        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        <Text style={styles.bestTimeText}>
          Best arrival: {queueData.best_arrival_time}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 50,
    backgroundColor: colors.border,
  },
  bestTime: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '10',
    padding: 10,
    borderRadius: 8,
  },
  bestTimeText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
  },
});
