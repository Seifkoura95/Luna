import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StarfieldBackground } from '../src/components/StarfieldBackground';
import { LunaMoonIcon } from '../src/components/LunaMoonIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, fonts } from '../src/hooks/useFonts';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// Points milestones with rewards
const POINT_MILESTONES = [
  {
    id: 'milestone_250',
    points: 250,
    title: 'Rising Star',
    icon: 'star-outline',
    color: '#00D4AA',
    rewards: [
      { type: 'drinks', amount: 5, label: '5 Free Drinks' },
    ],
    badge: '⭐',
  },
  {
    id: 'milestone_500',
    points: 500,
    title: 'VIP Status',
    icon: 'flash',
    color: '#8B5CF6',
    rewards: [
      { type: 'drinks', amount: 10, label: '10 Free Drinks' },
      { type: 'entries', amount: 5, label: '5 Free Entries' },
    ],
    badge: '💜',
  },
  {
    id: 'milestone_1000',
    points: 1000,
    title: 'Lunar Elite',
    icon: 'diamond',
    color: colors.gold,
    rewards: [
      { type: 'booth', amount: 1, label: 'Free VIP Booth' },
      { type: 'drinks', amount: 20, label: '20 Free Drinks' },
      { type: 'entries', amount: 10, label: '10 Free Entries' },
    ],
    badge: '👑',
  },
  {
    id: 'milestone_2500',
    points: 2500,
    title: 'Supernova',
    icon: 'star',
    color: '#E31837',
    rewards: [
      { type: 'booth', amount: 3, label: '3 Free VIP Booths' },
      { type: 'drinks', amount: 50, label: '50 Free Drinks' },
      { type: 'entries', amount: -1, label: 'Unlimited Entries' },
      { type: 'fastlane', amount: -1, label: 'Permanent Fast Lane' },
    ],
    badge: '🌟',
  },
  {
    id: 'milestone_5000',
    points: 5000,
    title: 'Legend',
    icon: 'ribbon',
    color: '#FFD700',
    rewards: [
      { type: 'vip_card', amount: 1, label: 'Gold VIP Card' },
      { type: 'booth', amount: 5, label: '5 Free VIP Booths' },
      { type: 'concierge', amount: 1, label: 'Personal Concierge' },
    ],
    badge: '🏆',
  },
];

export default function RewardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fontsLoaded = useFonts();
  const user = useAuthStore((state) => state.user);
  
  const [refreshing, setRefreshing] = useState(false);
  const [claimedMilestones, setClaimedMilestones] = useState<string[]>([]);
  
  const currentPoints = user?.points_balance || 0;

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh user data
    try {
      const userData = await api.getMe();
      useAuthStore.getState().setUser(userData);
    } catch (e) {
      console.error('Failed to refresh:', e);
    }
    setRefreshing(false);
  };

  const handleClaimReward = async (milestone: typeof POINT_MILESTONES[0]) => {
    if (currentPoints < milestone.points) {
      Alert.alert('Not Enough Points', `You need ${milestone.points - currentPoints} more points to unlock this reward.`);
      return;
    }
    
    if (claimedMilestones.includes(milestone.id)) {
      Alert.alert('Already Claimed', 'You have already claimed this reward!');
      return;
    }

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // In production, this would call an API to claim the reward
      setClaimedMilestones([...claimedMilestones, milestone.id]);
      Alert.alert(
        '🎉 Reward Claimed!',
        `You've unlocked ${milestone.title}!\n\n${milestone.rewards.map(r => r.label).join('\n')}`,
        [{ text: 'Awesome!', style: 'default' }]
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to claim reward. Please try again.');
    }
  };

  const getProgressToNext = () => {
    const nextMilestone = POINT_MILESTONES.find(m => m.points > currentPoints);
    if (!nextMilestone) return { progress: 100, pointsNeeded: 0, milestone: POINT_MILESTONES[POINT_MILESTONES.length - 1] };
    
    const previousMilestone = POINT_MILESTONES.filter(m => m.points <= currentPoints).pop();
    const startPoints = previousMilestone?.points || 0;
    const range = nextMilestone.points - startPoints;
    const progress = ((currentPoints - startPoints) / range) * 100;
    
    return { 
      progress: Math.min(progress, 100), 
      pointsNeeded: nextMilestone.points - currentPoints,
      milestone: nextMilestone 
    };
  };

  const progressInfo = getProgressToNext();

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={50} shootingStarCount={2} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: fonts.striker }]}>REWARDS</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Current Points Card */}
        <View style={styles.pointsCard}>
          <LinearGradient
            colors={['#1A1A1A', '#0D0D0D']}
            style={styles.pointsCardGradient}
          >
            <View style={[styles.accentBorder, { borderColor: colors.gold }]} />
            
            <View style={styles.pointsRow}>
              <FierySun size={48} />
              <View>
                <Text style={[styles.pointsValue, fontsLoaded && { fontFamily: fonts.bold }]}>
                  {currentPoints.toLocaleString()}
                </Text>
                <Text style={styles.pointsLabel}>LUNAR POINTS</Text>
              </View>
            </View>

            {/* Progress to next milestone */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Next: {progressInfo.milestone.title}</Text>
                <Text style={styles.progressPoints}>{progressInfo.pointsNeeded} pts to go</Text>
              </View>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={[progressInfo.milestone.color, progressInfo.milestone.color + '80']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progressInfo.progress}%` }]}
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Milestones */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>POINT MILESTONES</Text>
          
          {POINT_MILESTONES.map((milestone, index) => {
            const isUnlocked = currentPoints >= milestone.points;
            const isClaimed = claimedMilestones.includes(milestone.id);
            
            return (
              <TouchableOpacity
                key={milestone.id}
                style={[
                  styles.milestoneCard,
                  isUnlocked && styles.milestoneUnlocked,
                  isClaimed && styles.milestoneClaimed,
                ]}
                onPress={() => handleClaimReward(milestone)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isUnlocked ? [milestone.color + '20', '#0D0D0D'] : ['#1A1A1A', '#0D0D0D']}
                  style={styles.milestoneGradient}
                >
                  {/* Badge/Icon */}
                  <View style={[
                    styles.milestoneIcon,
                    { backgroundColor: isUnlocked ? milestone.color + '30' : colors.border }
                  ]}>
                    {isUnlocked ? (
                      <Text style={styles.milestoneBadge}>{milestone.badge}</Text>
                    ) : (
                      <Ionicons name="lock-closed" size={24} color={colors.textMuted} />
                    )}
                  </View>

                  {/* Content */}
                  <View style={styles.milestoneContent}>
                    <View style={styles.milestoneHeader}>
                      <Text style={[
                        styles.milestoneTitle,
                        { color: isUnlocked ? milestone.color : colors.textMuted },
                        fontsLoaded && { fontFamily: fonts.semiBold }
                      ]}>
                        {milestone.title}
                      </Text>
                      <Text style={[
                        styles.milestonePoints,
                        { color: isUnlocked ? colors.textPrimary : colors.textMuted }
                      ]}>
                        {milestone.points.toLocaleString()} pts
                      </Text>
                    </View>
                    
                    {/* Rewards */}
                    <View style={styles.milestoneRewards}>
                      {milestone.rewards.map((reward, rIndex) => (
                        <View key={rIndex} style={styles.rewardTag}>
                          <Ionicons 
                            name={reward.type === 'drinks' ? 'wine' : 
                                  reward.type === 'entries' ? 'ticket' : 
                                  reward.type === 'booth' ? 'people' : 
                                  reward.type === 'fastlane' ? 'flash' : 'gift'}
                            size={12}
                            color={isUnlocked ? milestone.color : colors.textMuted}
                          />
                          <Text style={[
                            styles.rewardText,
                            { color: isUnlocked ? colors.textSecondary : colors.textMuted }
                          ]}>
                            {reward.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Status */}
                  <View style={styles.milestoneStatus}>
                    {isClaimed ? (
                      <View style={[styles.statusBadge, { backgroundColor: colors.success + '30' }]}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={[styles.statusText, { color: colors.success }]}>Claimed</Text>
                      </View>
                    ) : isUnlocked ? (
                      <View style={[styles.statusBadge, { backgroundColor: milestone.color + '30' }]}>
                        <Ionicons name="gift" size={16} color={milestone.color} />
                        <Text style={[styles.statusText, { color: milestone.color }]}>Claim</Text>
                      </View>
                    ) : (
                      <View style={styles.lockedBadge}>
                        <Text style={styles.lockedText}>
                          {(milestone.points - currentPoints).toLocaleString()} pts
                        </Text>
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* How to Earn Points */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>HOW TO EARN POINTS</Text>
          
          <View style={styles.earnGrid}>
            {[
              { icon: 'wallet', label: 'Spend $1', points: '1 pt', color: colors.gold },
              { icon: 'ticket', label: 'Buy Ticket', points: '50 pts', color: colors.accent },
              { icon: 'people', label: 'Book Booth', points: '200 pts', color: '#8B5CF6' },
              { icon: 'person-add', label: 'Refer Friend', points: '100 pts', color: '#00D4AA' },
              { icon: 'checkmark-circle', label: 'Complete Mission', points: '25-100 pts', color: '#FF6B6B' },
              { icon: 'calendar', label: 'Weekly Visit', points: '10 pts', color: '#4ECDC4' },
            ].map((item, index) => (
              <View key={index} style={styles.earnCard}>
                <View style={[styles.earnIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <Text style={styles.earnLabel}>{item.label}</Text>
                <Text style={[styles.earnPoints, { color: item.color }]}>{item.points}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  pointsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pointsCardGradient: {
    padding: spacing.lg,
    position: 'relative',
  },
  accentBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopWidth: 3,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  progressSection: {
    marginTop: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  progressPoints: {
    fontSize: 12,
    color: colors.gold,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  milestoneCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  milestoneUnlocked: {
    borderColor: 'transparent',
  },
  milestoneClaimed: {
    opacity: 0.7,
  },
  milestoneGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  milestoneIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneBadge: {
    fontSize: 28,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  milestonePoints: {
    fontSize: 12,
    fontWeight: '600',
  },
  milestoneRewards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  rewardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  rewardText: {
    fontSize: 10,
    fontWeight: '500',
  },
  milestoneStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lockedBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  lockedText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  earnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  earnCard: {
    width: (width - spacing.lg * 2 - spacing.sm * 2) / 3,
    backgroundColor: '#0A0A0A',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  earnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  earnLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  earnPoints: {
    fontSize: 12,
    fontWeight: '700',
  },
});
