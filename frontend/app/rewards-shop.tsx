import React, { useState, useEffect } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { AppBackground } from '../src/components/AppBackground';
import { useAuthStore } from '../src/store/authStore';
import { RedemptionQRModal } from '../src/components/modals/RedemptionQRModal';

const { width } = Dimensions.get('window');

export default function RewardsShopPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  
  const [refreshing, setRefreshing] = useState(false);
  const [rewards, setRewards] = useState<any[]>([]);
  const [myRedemptions, setMyRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [selectedRedemption, setSelectedRedemption] = useState<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  const handleHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rewardsData, redemptionsData, userData] = await Promise.all([
        api.getRewards(),
        api.getMyRedemptions(),
        api.getMe()
      ]);
      // Rewards API returns an array directly
      setRewards(Array.isArray(rewardsData) ? rewardsData : rewardsData.rewards || []);
      setMyRedemptions(redemptionsData.redemptions || []);
      useAuthStore.getState().setUser(userData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRedeem = async (reward: any) => {
    const currentPoints = user?.points_balance || 0;
    
    if (currentPoints < reward.points_cost) {
      Alert.alert(
        'Not Enough Points',
        `You need ${reward.points_cost - currentPoints} more points to redeem this reward.`
      );
      return;
    }

    Alert.alert(
      'Redeem Reward?',
      `Use ${reward.points_cost} points to get ${reward.name}?\n\nYou'll receive a one-time use QR code.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            setRedeeming(reward.id);
            handleHaptic();
            
            try {
              const result = await api.redeemRewardWithQR(reward.id);
              
              Alert.alert(
                '🎉 Reward Redeemed!',
                'Your QR code is ready. Show it to venue staff to claim your reward.',
                [
                  {
                    text: 'View QR Code',
                    onPress: () => {
                      setSelectedRedemption({
                        id: result.redemption.id,
                        reward_name: result.redemption.reward_name,
                        reward_description: reward.description,
                        qr_code: result.redemption.qr_code,
                        expires_at: result.redemption.expires_at,
                        status: result.redemption.status
                      });
                      setShowQRModal(true);
                    }
                  }
                ]
              );
              
              loadData(); // Refresh data
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to redeem reward');
            } finally {
              setRedeeming(null);
            }
          }
        }
      ]
    );
  };

  const handleViewQR = (redemption: any) => {
    handleHaptic();
    setSelectedRedemption(redemption);
    setShowQRModal(true);
  };

  const currentPoints = user?.points_balance || 0;

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Rewards Shop</Text>
            <Text style={styles.headerSubtitle}>Redeem your points</Text>
          </View>
        </View>

        {/* Points Balance */}
        <View style={styles.pointsCard}>
          <LinearGradient
            colors={[colors.gold + '40', colors.gold + '20']}
            style={styles.pointsGradient}
          >
            <Ionicons name="star" size={32} color={colors.gold} />
            <View style={styles.pointsInfo}>
              <Text style={styles.pointsLabel}>YOUR POINTS</Text>
              <Text style={styles.pointsValue}>{currentPoints.toLocaleString()}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* My Active Redemptions */}
        {myRedemptions.filter(r => r.status === 'pending').length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVE REWARDS</Text>
            {myRedemptions
              .filter(r => r.status === 'pending')
              .map((redemption) => (
                <TouchableOpacity
                  key={redemption.id}
                  style={styles.redemptionCard}
                  onPress={() => handleViewQR(redemption)}
                >
                  <View style={styles.redemptionIcon}>
                    <Ionicons name="gift" size={24} color={colors.accent} />
                  </View>
                  <View style={styles.redemptionInfo}>
                    <Text style={styles.redemptionName}>{redemption.reward_name}</Text>
                    <Text style={styles.redemptionExpiry}>
                      Expires {new Date(redemption.expires_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.qrIcon}>
                    <Ionicons name="qr-code" size={28} color={colors.accent} />
                  </View>
                </TouchableOpacity>
              ))}
          </View>
        )}

        {/* Available Rewards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AVAILABLE REWARDS</Text>
          {loading ? (
            <Text style={styles.loadingText}>Loading rewards...</Text>
          ) : rewards.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="gift-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyText}>No rewards available</Text>
              <Text style={styles.emptySubtext}>Check back soon for new rewards!</Text>
            </View>
          ) : (
            rewards.map((reward) => {
              const canAfford = currentPoints >= reward.points_cost;
              const isRedeeming = redeeming === reward.id;
              
              return (
                <View key={reward.id} style={styles.rewardCard}>
                  <View style={styles.rewardHeader}>
                    <View style={styles.rewardIconContainer}>
                      <LinearGradient
                        colors={[colors.accent + '40', colors.accent + '20']}
                        style={styles.rewardIconGradient}
                      >
                        <Ionicons 
                          name={reward.icon || 'gift'} 
                          size={28} 
                          color={colors.accent} 
                        />
                      </LinearGradient>
                    </View>
                    
                    <View style={styles.rewardContent}>
                      <Text style={styles.rewardName}>{reward.name}</Text>
                      {reward.description && (
                        <Text style={styles.rewardDescription}>{reward.description}</Text>
                      )}
                      
                      {reward.venue_restriction && (
                        <View style={styles.venueRestriction}>
                          <Ionicons name="location" size={12} color={colors.textMuted} />
                          <Text style={styles.venueRestrictionText}>
                            Only at {reward.venue_restriction}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.rewardFooter}>
                    <View style={styles.pointsCost}>
                      <Ionicons name="star" size={16} color={colors.gold} />
                      <Text style={styles.pointsCostText}>{reward.points_cost}</Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.redeemButton,
                        !canAfford && styles.redeemButtonDisabled
                      ]}
                      onPress={() => handleRedeem(reward)}
                      disabled={!canAfford || isRedeeming}
                    >
                      <Text style={[
                        styles.redeemButtonText,
                        !canAfford && styles.redeemButtonTextDisabled
                      ]}>
                        {isRedeeming ? 'Redeeming...' : canAfford ? 'REDEEM' : 'Not Enough Points'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* QR Modal */}
      <RedemptionQRModal
        visible={showQRModal}
        onClose={() => setShowQRModal(false)}
        redemption={selectedRedemption}
      />
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  pointsCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  pointsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  pointsInfo: {
    flex: 1,
  },
  pointsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.gold,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  redemptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  redemptionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  redemptionInfo: {
    flex: 1,
  },
  redemptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  redemptionExpiry: {
    fontSize: 12,
    color: colors.textMuted,
  },
  qrIcon: {
    marginLeft: spacing.sm,
  },
  rewardCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  rewardHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  rewardIconContainer: {
    marginRight: spacing.md,
  },
  rewardIconGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardContent: {
    flex: 1,
  },
  rewardName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  rewardDescription: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  venueRestriction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  venueRestrictionText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  rewardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointsCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  pointsCostText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gold,
  },
  redeemButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  redeemButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  redeemButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  redeemButtonTextDisabled: {
    color: colors.textMuted,
  },
});
