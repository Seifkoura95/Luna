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
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StarfieldBackground } from '../src/components/StarfieldBackground';
import { GoldStarIcon } from '../src/components/GoldStarIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    title: 'Luna Elite',
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

// Active Missions
const ACTIVE_MISSIONS = [
  {
    id: 'm1',
    title: 'Leave a Review',
    description: 'Rate us on Google or Facebook',
    points: 50,
    icon: 'star',
    color: '#FFD700',
    type: 'review',
    progress: 0,
    target: 1,
  },
  {
    id: 'm2',
    title: 'Instagram Tag',
    description: 'Tag us in a story or post',
    points: 25,
    icon: 'camera',
    color: '#E4405F',
    type: 'social',
    progress: 0,
    target: 1,
  },
  {
    id: 'm3',
    title: 'Squad Night',
    description: 'Check in with 3+ friends',
    points: 100,
    icon: 'people',
    color: '#8B5CF6',
    type: 'group',
    progress: 0,
    target: 3,
  },
  {
    id: 'm4',
    title: 'Venue Explorer',
    description: 'Visit 3 different Luna venues',
    points: 75,
    icon: 'compass',
    color: '#00D4AA',
    type: 'exploration',
    progress: 1,
    target: 3,
  },
  {
    id: 'm5',
    title: 'Weekly Regular',
    description: 'Visit same venue 3 weeks in a row',
    points: 50,
    icon: 'calendar',
    color: '#4ECDC4',
    type: 'loyalty',
    progress: 2,
    target: 3,
  },
  {
    id: 'm6',
    title: 'VIP Experience',
    description: 'Book a VIP table',
    points: 150,
    icon: 'diamond',
    color: colors.gold,
    type: 'booking',
    progress: 0,
    target: 1,
  },
  {
    id: 'm7',
    title: 'Photo Star',
    description: 'Get tagged in 5 venue photos',
    points: 40,
    icon: 'images',
    color: '#FF6B6B',
    type: 'photos',
    progress: 2,
    target: 5,
  },
  {
    id: 'm8',
    title: 'Promo Champion',
    description: 'Refer 5 friends who sign up',
    points: 200,
    icon: 'megaphone',
    color: colors.accent,
    type: 'referral',
    progress: 1,
    target: 5,
  },
];

// Point Packages for Purchase
const POINT_PACKAGES = [
  { id: 'p1', points: 100, price: 10, bonus: 0, popular: false },
  { id: 'p2', points: 500, price: 45, bonus: 50, popular: true },
  { id: 'p3', points: 1000, price: 80, bonus: 150, popular: false },
  { id: 'p4', points: 2500, price: 180, bonus: 500, popular: false },
];

export default function RewardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const user = useAuthStore((state) => state.user);
  
  const [refreshing, setRefreshing] = useState(false);
  const [claimedMilestones, setClaimedMilestones] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'missions' | 'milestones' | 'shop'>('missions');
  const [promoCode, setPromoCode] = useState('');
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<typeof POINT_PACKAGES[0] | null>(null);
  
  const currentPoints = user?.points_balance || 0;

  const onRefresh = async () => {
    setRefreshing(true);
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
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
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

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      Alert.alert('Error', 'Please enter a promo code');
      return;
    }
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Simulate promo code validation
    if (promoCode.toUpperCase() === 'LUNA50' || promoCode.toUpperCase() === 'WELCOME') {
      Alert.alert('🎉 Success!', 'Promo code applied! 50 bonus points added to your account.');
      setPromoCode('');
      setShowPromoModal(false);
    } else {
      Alert.alert('Invalid Code', 'This promo code is not valid or has expired.');
    }
  };

  const handleBuyPoints = (pkg: typeof POINT_PACKAGES[0]) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedPackage(pkg);
    setShowBuyModal(true);
  };

  const confirmPurchase = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert(
      '✅ Purchase Complete',
      `${selectedPackage?.points} points${selectedPackage?.bonus ? ` + ${selectedPackage.bonus} bonus` : ''} added to your account!`,
      [{ text: 'Great!', onPress: () => setShowBuyModal(false) }]
    );
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
          <Text style={[styles.headerTitle, ]}>REWARDS</Text>
          <TouchableOpacity style={styles.promoButton} onPress={() => setShowPromoModal(true)}>
            <Ionicons name="gift" size={20} color={colors.gold} />
          </TouchableOpacity>
        </View>

        {/* Current Points Card */}
        <View style={styles.pointsCard}>
          <LinearGradient
            colors={['#1A1A1A', '#0D0D0D']}
            style={styles.pointsCardGradient}
          >
            <View style={[styles.accentBorder, { borderColor: colors.gold }]} />
            
            <View style={styles.pointsRow}>
              <GoldStarIcon size={48} />
              <View>
                <Text style={[styles.pointsValue, ]}>
                  {currentPoints.toLocaleString()}
                </Text>
                <Text style={styles.pointsLabel}>LUNA POINTS</Text>
              </View>
              <TouchableOpacity 
                style={styles.buyPointsButton}
                onPress={() => setActiveTab('shop')}
              >
                <LinearGradient
                  colors={[colors.gold, colors.goldDark]}
                  style={styles.buyPointsGradient}
                >
                  <Ionicons name="add" size={16} color="#000" />
                  <Text style={styles.buyPointsText}>Buy</Text>
                </LinearGradient>
              </TouchableOpacity>
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

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'missions' && styles.tabActive]}
            onPress={() => setActiveTab('missions')}
          >
            <Ionicons name="flag" size={16} color={activeTab === 'missions' ? colors.accent : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'missions' && styles.tabTextActive]}>Missions</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'milestones' && styles.tabActive]}
            onPress={() => setActiveTab('milestones')}
          >
            <Ionicons name="trophy" size={16} color={activeTab === 'milestones' ? colors.accent : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'milestones' && styles.tabTextActive]}>Milestones</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'shop' && styles.tabActive]}
            onPress={() => setActiveTab('shop')}
          >
            <Ionicons name="cart" size={16} color={activeTab === 'shop' ? colors.gold : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'shop' && { color: colors.gold }]}>Buy Points</Text>
          </TouchableOpacity>
        </View>

        {/* Missions Tab */}
        {activeTab === 'missions' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, ]}>ACTIVE MISSIONS</Text>
            <Text style={styles.sectionSubtitle}>Complete quests to earn bonus points</Text>
            
            {ACTIVE_MISSIONS.map((mission) => {
              const isComplete = mission.progress >= mission.target;
              const progressPercent = (mission.progress / mission.target) * 100;
              
              return (
                <TouchableOpacity
                  key={mission.id}
                  style={[styles.missionCard, isComplete && styles.missionComplete]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.missionIcon, { backgroundColor: mission.color + '20' }]}>
                    {isComplete ? (
                      <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                    ) : (
                      <Ionicons name={mission.icon as any} size={24} color={mission.color} />
                    )}
                  </View>
                  
                  <View style={styles.missionContent}>
                    <View style={styles.missionHeader}>
                      <Text style={[styles.missionTitle, ]}>
                        {mission.title}
                      </Text>
                      <View style={[styles.missionPoints, { backgroundColor: mission.color + '20' }]}>
                        <Text style={[styles.missionPointsText, { color: mission.color }]}>
                          +{mission.points} pts
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.missionDescription}>{mission.description}</Text>
                    
                    {/* Progress bar */}
                    <View style={styles.missionProgressContainer}>
                      <View style={styles.missionProgressBar}>
                        <View 
                          style={[
                            styles.missionProgressFill, 
                            { width: `${progressPercent}%`, backgroundColor: mission.color }
                          ]} 
                        />
                      </View>
                      <Text style={styles.missionProgressText}>
                        {mission.progress}/{mission.target}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Milestones Tab */}
        {activeTab === 'milestones' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, ]}>POINT MILESTONES</Text>
            
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

                    <View style={styles.milestoneContent}>
                      <View style={styles.milestoneHeader}>
                        <Text style={[
                          styles.milestoneTitle,
                          { color: isUnlocked ? milestone.color : colors.textMuted },
                          
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
        )}

        {/* Shop Tab - Buy Points */}
        {activeTab === 'shop' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, ]}>BUY LUNA POINTS</Text>
            <Text style={styles.sectionSubtitle}>Boost your rewards instantly</Text>
            
            {POINT_PACKAGES.map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                style={[styles.packageCard, pkg.popular && styles.packagePopular]}
                onPress={() => handleBuyPoints(pkg)}
                activeOpacity={0.8}
              >
                {pkg.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>BEST VALUE</Text>
                  </View>
                )}
                
                <View style={styles.packageContent}>
                  <View style={styles.packageLeft}>
                    <GoldStarIcon size={32} />
                    <View>
                      <Text style={[styles.packagePoints, ]}>
                        {pkg.points.toLocaleString()} pts
                      </Text>
                      {pkg.bonus > 0 && (
                        <Text style={styles.packageBonus}>+{pkg.bonus} bonus</Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.packageRight}>
                    <Text style={[styles.packagePrice, ]}>
                      ${pkg.price}
                    </Text>
                    <Text style={styles.packagePer}>
                      ${(pkg.price / (pkg.points + pkg.bonus) * 100).toFixed(1)}¢/pt
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.cherryHubNote}>
              <Ionicons name="information-circle" size={16} color={colors.textMuted} />
              <Text style={styles.cherryHubNoteText}>
                Points are synced with CherryHub rewards system
              </Text>
            </View>
          </View>
        )}

        {/* How to Earn Points */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, ]}>HOW TO EARN POINTS</Text>
          
          <View style={styles.earnGrid}>
            {[
              { icon: 'wallet', label: 'Spend $1', points: '1 pt', color: colors.gold },
              { icon: 'star', label: 'Leave Review', points: '50 pts', color: '#FFD700' },
              { icon: 'camera', label: 'Tag on IG', points: '25 pts', color: '#E4405F' },
              { icon: 'person-add', label: 'Refer Friend', points: '100 pts', color: '#00D4AA' },
              { icon: 'flag', label: 'Mission', points: '25-200 pts', color: '#FF6B6B' },
              { icon: 'people', label: 'Squad Night', points: '100 pts', color: '#8B5CF6' },
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

      {/* Promo Code Modal */}
      <Modal
        visible={showPromoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPromoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalClose}
              onPress={() => setShowPromoModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            
            <View style={styles.modalIcon}>
              <Ionicons name="gift" size={40} color={colors.gold} />
            </View>
            
            <Text style={[styles.modalTitle, ]}>
              Enter Promo Code
            </Text>
            <Text style={styles.modalSubtitle}>
              Got a promo code? Enter it below for bonus points!
            </Text>
            
            <TextInput
              style={styles.promoInput}
              value={promoCode}
              onChangeText={setPromoCode}
              placeholder="Enter code..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
            
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={handleApplyPromo}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark]}
                style={styles.applyButtonGradient}
              >
                <Text style={styles.applyButtonText}>Apply Code</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Buy Points Confirmation Modal */}
      <Modal
        visible={showBuyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBuyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalClose}
              onPress={() => setShowBuyModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            
            <GoldStarIcon size={48} />
            
            <Text style={[styles.modalTitle, ]}>
              Confirm Purchase
            </Text>
            
            {selectedPackage && (
              <>
                <View style={styles.purchaseSummary}>
                  <Text style={styles.purchasePoints}>
                    {selectedPackage.points.toLocaleString()} points
                  </Text>
                  {selectedPackage.bonus > 0 && (
                    <Text style={styles.purchaseBonus}>
                      + {selectedPackage.bonus} bonus points
                    </Text>
                  )}
                  <Text style={styles.purchaseTotal}>
                    Total: {(selectedPackage.points + selectedPackage.bonus).toLocaleString()} points
                  </Text>
                </View>
                
                <Text style={styles.purchasePrice}>
                  ${selectedPackage.price} AUD
                </Text>
              </>
            )}
            
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={confirmPurchase}
            >
              <LinearGradient
                colors={[colors.success, '#00A855']}
                style={styles.confirmButtonGradient}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.confirmButtonText}>Confirm Purchase</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <Text style={styles.paymentNote}>
              Powered by CherryHub • Secure Payment
            </Text>
          </View>
        </View>
      </Modal>
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
    letterSpacing: 3,
  },
  promoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.goldGlow,
    alignItems: 'center',
    justifyContent: 'center',
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
  buyPointsButton: {
    marginLeft: 'auto',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  buyPointsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  buyPointsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
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
  // Tab Container
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.accent + '20',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.accent,
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
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  // Mission Cards
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  missionComplete: {
    opacity: 0.6,
    borderColor: colors.success + '40',
  },
  missionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionContent: {
    flex: 1,
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  missionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  missionPoints: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  missionPointsText: {
    fontSize: 11,
    fontWeight: '700',
  },
  missionDescription: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  missionProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  missionProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  missionProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  missionProgressText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  // Milestone Cards
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
  // Package Cards
  packageCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  packagePopular: {
    borderColor: colors.gold,
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  popularText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
  packageContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  packagePoints: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  packageBonus: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
  },
  packageRight: {
    alignItems: 'flex-end',
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.gold,
  },
  packagePer: {
    fontSize: 10,
    color: colors.textMuted,
  },
  cherryHubNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  cherryHubNoteText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  // Earn Grid
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    padding: spacing.xs,
  },
  modalIcon: {
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  promoInput: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  applyButton: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  applyButtonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  purchaseSummary: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  purchasePoints: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  purchaseBonus: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  purchaseTotal: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  purchasePrice: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.gold,
    marginBottom: spacing.md,
  },
  confirmButton: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  paymentNote: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
