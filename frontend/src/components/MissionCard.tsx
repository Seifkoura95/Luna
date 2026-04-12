import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { LunaIcon } from './LunaIcons';

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

// Map mission types to icons and colors
const missionConfig: Record<string, { 
  ionIcon: string;
  color: string;
  glowColor: string;
}> = {
  early_bird: { ionIcon: 'sunny', color: colors.gold, glowColor: colors.goldGlow },
  cross_venue: { ionIcon: 'globe', color: colors.hot, glowColor: colors.hotGlow },
  venue_specific: { ionIcon: 'location', color: colors.accent, glowColor: colors.accentGlow },
  consistency: { ionIcon: 'refresh', color: colors.success, glowColor: colors.successGlow },
  social: { ionIcon: 'people', color: colors.warning, glowColor: colors.warningGlow },
  spending: { ionIcon: 'card', color: colors.success, glowColor: colors.successGlow },
  check_in_streak: { ionIcon: 'flame', color: colors.orange, glowColor: colors.warningGlow },
  default: { ionIcon: 'flag', color: colors.accent, glowColor: colors.accentGlow },
};

export const MissionCard: React.FC<MissionCardProps> = ({ mission }) => {
  const progress = Math.min(mission.current_value / mission.requirement_value, 1);
  const config = missionConfig[mission.mission_type] || missionConfig.default;

  return (
    <View style={[styles.container, mission.completed && styles.containerCompleted]}>
      <LinearGradient
        colors={mission.completed 
          ? [colors.successGlow, colors.backgroundCard] 
          : [colors.backgroundCard, colors.backgroundElevated]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: config.glowColor }]}>
            {mission.completed ? (
              <Ionicons name="checkmark" size={26} color={colors.success} />
            ) : (
              <Ionicons name={config.ionIcon as any} size={26} color={config.color} />
            )}
          </View>
          <View style={styles.rewardBadge}>
            <Ionicons name="star" size={12} color={colors.gold} />
            <Text style={styles.rewardText}>+{mission.points_reward}</Text>
          </View>
        </View>
        
        {/* Content */}
        <Text style={styles.name} numberOfLines={1}>{mission.name}</Text>
        <Text style={styles.description} numberOfLines={2}>{mission.description}</Text>
        
        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={mission.completed 
                ? [colors.success, colors.success] 
                : [config.color, config.color + '80']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {mission.current_value}/{mission.requirement_value}
          </Text>
        </View>
        
        {/* Completed Badge */}
        {mission.completed && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.completedText}>COMPLETED</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 180,
    borderRadius: radius.lg,
    marginRight: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerCompleted: {
    borderColor: colors.success + '40',
  },
  gradient: {
    padding: spacing.md,
    minHeight: 180,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldGlow,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  rewardText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: spacing.md,
    flex: 1,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    minWidth: 35,
    textAlign: 'right',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  completedText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 4,
  },
});
