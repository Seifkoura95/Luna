import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

interface MissionCardProps {
  mission: {
    id: string;
    name: string;
    description: string;
    mission_type: string;
    requirement_value: number;
    points_reward: number;
    current_value: number;
    completed: boolean;
  };
}

const missionIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  check_in_streak: 'calendar',
  early_bird: 'time',
  spending: 'wallet',
};

export const MissionCard: React.FC<MissionCardProps> = ({ mission }) => {
  const progress = Math.min(mission.current_value / mission.requirement_value, 1);
  const icon = missionIcons[mission.mission_type] || 'trophy';

  return (
    <View style={[styles.container, mission.completed && styles.containerCompleted]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, mission.completed && styles.iconCompleted]}>
          <Ionicons 
            name={mission.completed ? 'checkmark' : icon} 
            size={24} 
            color={mission.completed ? colors.success : colors.accent} 
          />
        </View>
        <View style={styles.rewardBadge}>
          <Ionicons name="star" size={12} color={colors.premiumGold} />
          <Text style={styles.rewardText}>+{mission.points_reward}</Text>
        </View>
      </View>
      
      <Text style={styles.name}>{mission.name}</Text>
      <Text style={styles.description}>{mission.description}</Text>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${progress * 100}%` },
              mission.completed && styles.progressCompleted
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {mission.current_value}/{mission.requirement_value}
        </Text>
      </View>
      
      {mission.completed && (
        <View style={styles.completedBadge}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.completedText}>COMPLETED</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginRight: 16,
    width: 200,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerCompleted: {
    borderColor: colors.success + '50',
    backgroundColor: colors.success + '10',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCompleted: {
    backgroundColor: colors.success + '20',
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rewardText: {
    color: colors.premiumGold,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  progressCompleted: {
    backgroundColor: colors.success,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  completedText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 4,
  },
});
