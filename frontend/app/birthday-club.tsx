import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppBackground } from '../src/components/AppBackground';
import { PageHeader } from '../src/components/PageHeader';
import { useRouter } from 'expo-router';

interface BirthdayReward {
  id: string;
  name: string;
  description: string;
  type: string;
  value: number | string;
  icon: string;
  claimed?: boolean;
}

interface ClaimedReward {
  id: string;
  reward_id: string;
  reward_name: string;
  reward_type: string;
  reward_value: number;
  year: number;
  claimed_at: string;
  redeemed: boolean;
  redeemed_at?: string;
  expires_at?: string;
}

const REWARD_ICONS: Record<string, string> = {
  ticket: 'ticket-outline',
  wine: 'wine-outline',
  star: 'star-outline',
  sparkles: 'sparkles-outline',
  gift: 'gift-outline',
};

const REWARD_COLORS: Record<string, string> = {
  entry: '#FF6B6B',
  drink: '#9B59B6',
  points: '#FFD700',
  multiplier: '#00D4AA',
};

export default function BirthdayClubScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [birthdayStatus, setBirthdayStatus] = useState<any>(null);
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  const [redeemingReward, setRedeemingReward] = useState<string | null>(null);

  const fetchBirthdayData = useCallback(async () => {
    try {
      const status = await api.getBirthdayStatus();
      setBirthdayStatus(status);
    } catch (e) {
      console.error('Failed to fetch birthday status:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBirthdayData();
  }, [fetchBirthdayData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBirthdayData();
    setRefreshing(false);
  };

  const handleClaimReward = async (rewardId: string) => {
    setClaimingReward(rewardId);
    try {
      const result = await api.claimBirthdayReward(rewardId);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Reward Claimed!', result.message);
      await fetchBirthdayData(); // Refresh data
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to claim reward');
    } finally {
      setClaimingReward(null);
    }
  };

  const handleRedeemReward = async (claimId: string) => {
    setRedeemingReward(claimId);
    try {
      const result = await api.redeemBirthdayReward(claimId);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Reward Redeemed!', result.message);
      await fetchBirthdayData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to redeem reward');
    } finally {
      setRedeemingReward(null);
    }
  };

  const getDaysText = (days: number | null) => {
    if (days === null) return '';
    if (days === 0) return "It's your birthday! 🎂";
    if (days === 1) return '1 day until your birthday';
    return `${days} days until your birthday`;
  };

  const renderRewardCard = (reward: BirthdayReward, isClaimed: boolean = false) => {
    const iconName = REWARD_ICONS[reward.icon] || 'gift-outline';
    const rewardColor = REWARD_COLORS[reward.type] || colors.accent;
    const isClaimedReward = reward.claimed || isClaimed;
    
    return (
      <View key={reward.id} style={styles.rewardCard}>
        <LinearGradient
          colors={[colors.backgroundCard, colors.backgroundElevated]}
          style={styles.rewardGradient}
        >
          <View style={[styles.rewardIconContainer, { backgroundColor: rewardColor + '20' }]}>
            <Ionicons name={iconName as any} size={28} color={rewardColor} />
          </View>
          
          <View style={styles.rewardContent}>
            <Text style={styles.rewardName}>{reward.name}</Text>
            <Text style={styles.rewardDescription}>{reward.description}</Text>
            
            <View style={styles.rewardValue}>
              {reward.type === 'points' && (
                <Text style={[styles.rewardValueText, { color: rewardColor }]}>
                  +{reward.value} pts
                </Text>
              )}
              {reward.type === 'multiplier' && (
                <Text style={[styles.rewardValueText, { color: rewardColor }]}>
                  {reward.value}x points
                </Text>
              )}
              {(reward.type === 'entry' || reward.type === 'drink') && (
                <Text style={[styles.rewardValueText, { color: rewardColor }]}>
                  FREE
                </Text>
              )}
            </View>
          </View>
          
          {!isClaimedReward ? (
            <TouchableOpacity
              style={[styles.claimButton, { backgroundColor: rewardColor }]}
              onPress={() => handleClaimReward(reward.id.replace('birthday_', ''))}
              disabled={claimingReward === reward.id}
            >
              {claimingReward === reward.id ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.claimButtonText}>CLAIM</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.claimedBadge, { borderColor: rewardColor }]}>
              <Ionicons name="checkmark" size={16} color={rewardColor} />
              <Text style={[styles.claimedText, { color: rewardColor }]}>CLAIMED</Text>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  const renderClaimedRewardCard = (claim: ClaimedReward) => {
    const rewardColor = REWARD_COLORS[claim.reward_type] || colors.accent;
    const isExpired = claim.expires_at && new Date(claim.expires_at) < new Date();
    
    return (
      <View key={claim.id} style={styles.claimedCard}>
        <LinearGradient
          colors={[colors.backgroundCard, '#0A0A0A']}
          style={styles.claimedGradient}
        >
          <View style={styles.claimedHeader}>
            <Text style={styles.claimedName}>{claim.reward_name}</Text>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: claim.redeemed ? colors.success + '20' : isExpired ? colors.error + '20' : colors.accent + '20' }
            ]}>
              <Text style={[
                styles.statusText, 
                { color: claim.redeemed ? colors.success : isExpired ? colors.error : colors.accent }
              ]}>
                {claim.redeemed ? 'REDEEMED' : isExpired ? 'EXPIRED' : 'ACTIVE'}
              </Text>
            </View>
          </View>
          
          <View style={styles.claimedInfo}>
            <Text style={styles.claimedYear}>Birthday {claim.year}</Text>
            {claim.expires_at && !claim.redeemed && !isExpired && (
              <Text style={styles.expiresText}>
                Expires: {new Date(claim.expires_at).toLocaleDateString()}
              </Text>
            )}
          </View>
          
          {!claim.redeemed && !isExpired && (
            <TouchableOpacity
              style={[styles.redeemButton, { borderColor: rewardColor }]}
              onPress={() => handleRedeemReward(claim.id)}
              disabled={redeemingReward === claim.id}
            >
              {redeemingReward === claim.id ? (
                <ActivityIndicator size="small" color={rewardColor} />
              ) : (
                <>
                  <Ionicons name="qr-code-outline" size={18} color={rewardColor} />
                  <Text style={[styles.redeemButtonText, { color: rewardColor }]}>
                    REDEEM AT VENUE
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading Birthday Club...</Text>
        </View>
      </View>
    );
  }

  const { 
    has_birthday_set, 
    is_birthday_today, 
    is_birthday_week, 
    days_until_birthday, 
    available_rewards = [], 
    claimed_rewards = [],
    message 
  } = birthdayStatus || {};

  return (
    <View style={styles.container}>
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
            data-testid="back-button"
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Birthday Club</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Birthday Status Hero */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={is_birthday_week ? ['#FF6B6B30', '#9B59B620'] : ['#1A1A1A', '#0D0D0D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            {is_birthday_today ? (
              <Text style={styles.heroEmoji}>🎂</Text>
            ) : is_birthday_week ? (
              <Text style={styles.heroEmoji}>🎁</Text>
            ) : (
              <Ionicons name="gift" size={48} color={colors.accent} />
            )}
            
            <Text style={styles.heroTitle}>
              {is_birthday_today ? 'Happy Birthday!' : is_birthday_week ? 'Birthday Week!' : 'Birthday Club'}
            </Text>
            
            {has_birthday_set ? (
              <Text style={styles.heroSubtitle}>{message || getDaysText(days_until_birthday)}</Text>
            ) : (
              <Text style={styles.heroSubtitle}>
                Set your birthday in Profile to unlock rewards!
              </Text>
            )}

            {!has_birthday_set && (
              <TouchableOpacity
                style={styles.setbirthdayBtn}
                onPress={() => router.push('/profile')}
                data-testid="set-birthday-btn"
              >
                <Ionicons name="calendar" size={18} color="#000" />
                <Text style={styles.setBirthdayText}>SET MY BIRTHDAY</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>

        {/* Available Rewards Section */}
        {(is_birthday_week || is_birthday_today) && available_rewards.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="sparkles" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>AVAILABLE REWARDS</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Claim your birthday rewards below!
            </Text>
            {available_rewards.map((reward: BirthdayReward) => renderRewardCard(reward))}
          </View>
        )}

        {/* Rewards Preview (when not birthday week) */}
        {!is_birthday_week && !is_birthday_today && has_birthday_set && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="gift-outline" size={18} color={colors.textMuted} />
              <Text style={styles.sectionTitle}>YOUR BIRTHDAY REWARDS</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              These rewards will unlock during your birthday week
            </Text>
            
            <View style={styles.previewList}>
              {[
                { icon: 'ticket-outline', name: 'Free Entry', description: 'Free entry to any venue', color: '#FF6B6B' },
                { icon: 'wine-outline', name: 'Free Drink', description: 'Complimentary birthday drink', color: '#9B59B6' },
                { icon: 'star-outline', name: '250 Bonus Points', description: 'Added to your balance', color: '#FFD700' },
                { icon: 'sparkles-outline', name: '2x Points Week', description: 'Double points all week', color: '#00D4AA' },
              ].map((item, index) => (
                <View key={index} style={styles.previewItem}>
                  <View style={[styles.previewIcon, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <View style={styles.previewContent}>
                    <Text style={styles.previewName}>{item.name}</Text>
                    <Text style={styles.previewDesc}>{item.description}</Text>
                  </View>
                  <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Claimed Rewards History */}
        {claimed_rewards.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={18} color={colors.textMuted} />
              <Text style={styles.sectionTitle}>CLAIMED REWARDS</Text>
            </View>
            {claimed_rewards.map((claim: ClaimedReward) => renderClaimedRewardCard(claim))}
          </View>
        )}

        {/* How It Works Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.sectionTitle}>HOW IT WORKS</Text>
          </View>
          
          <View style={styles.howItWorks}>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Set Your Birthday</Text>
                <Text style={styles.stepDesc}>Add your date of birth in your profile settings</Text>
              </View>
            </View>
            
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Wait for Your Week</Text>
                <Text style={styles.stepDesc}>Rewards unlock 3 days before and after your birthday</Text>
              </View>
            </View>
            
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Claim & Redeem</Text>
                <Text style={styles.stepDesc}>Claim rewards in the app, redeem at any Luna venue</Text>
              </View>
            </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 60,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  heroSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroGradient: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  setbirthdayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  setBirthdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 1,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  rewardCard: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rewardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  rewardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardContent: {
    flex: 1,
  },
  rewardName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  rewardDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  rewardValue: {
    flexDirection: 'row',
  },
  rewardValueText: {
    fontSize: 14,
    fontWeight: '800',
  },
  claimButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  claimButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  claimedText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  claimedCard: {
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  claimedGradient: {
    padding: spacing.md,
  },
  claimedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  claimedName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  claimedInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  claimedYear: {
    fontSize: 12,
    color: colors.textMuted,
  },
  expiresText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  redeemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  redeemButtonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  previewList: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    flex: 1,
  },
  previewName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  previewDesc: {
    fontSize: 11,
    color: colors.textMuted,
  },
  howItWorks: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
