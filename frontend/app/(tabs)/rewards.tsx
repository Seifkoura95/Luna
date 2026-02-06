import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { RewardCard } from '../../src/components/RewardCard';
import { VenueSelector } from '../../src/components/VenueSelector';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const { width } = Dimensions.get('window');
const CATEGORIES = ['all', 'drinks', 'bottles', 'vip', 'merch', 'dining'];

export default function RewardsScreen() {
  const user = useAuthStore((state) => state.user);
  const [rewards, setRewards] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [showVenueFilter, setShowVenueFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [redemptionModal, setRedemptionModal] = useState<any>(null);

  const fetchRewards = async () => {
    try {
      const data = await api.getRewards(
        selectedCategory === 'all' ? undefined : selectedCategory,
        selectedVenueId || undefined
      );
      setRewards(data);
    } catch (e) {
      console.error('Failed to fetch rewards:', e);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, [selectedCategory, selectedVenueId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRewards();
    try {
      const userData = await api.getMe();
      useAuthStore.getState().setUser(userData);
    } catch (e) {
      console.error('Failed to refresh user:', e);
    }
    setRefreshing(false);
  };

  const handleRedeem = async (rewardId: string) => {
    try {
      const result = await api.redeemReward(rewardId, selectedVenueId || undefined);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      useAuthStore.getState().updatePoints(result.new_balance);
      setRedemptionModal(result);
    } catch (e: any) {
      Alert.alert('Redemption Failed', e.message || 'Please try again');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Points Hero */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[colors.goldGlow, 'transparent']}
            style={styles.heroGlow}
          />
          <View style={styles.heroContent}>
            <Text style={styles.heroLabel}>YOUR BALANCE</Text>
            <View style={styles.pointsRow}>
              <Ionicons name="star" size={32} color={colors.gold} />
              <Text style={styles.pointsValue}>
                {user?.points_balance?.toLocaleString() || 0}
              </Text>
              <Text style={styles.pointsUnit}>pts</Text>
            </View>
          </View>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryTab,
                selectedCategory === category && styles.categoryTabActive,
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                setSelectedCategory(category);
              }}
              activeOpacity={0.7}
            >
              {selectedCategory === category && (
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              )}
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category && styles.categoryTextActive,
                ]}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Venue Filter Button */}
        <View style={styles.venueFilterContainer}>
          <TouchableOpacity
            style={styles.venueFilterButton}
            onPress={() => setShowVenueFilter(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={20} color={colors.accent} />
            <Text style={styles.venueFilterText}>
              {selectedVenueId ? 'Venue Selected' : 'Filter by Venue'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>AVAILABLE REWARDS</Text>
          </View>
          <Text style={styles.rewardCount}>{rewards.length} items</Text>
        </View>

        {/* Rewards List */}
        <View style={styles.rewardsSection}>
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              userPoints={user?.points_balance || 0}
              onRedeem={handleRedeem}
            />
          ))}
          
          {rewards.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="gift-outline" size={48} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No rewards available</Text>
              <Text style={styles.emptyText}>Check back soon for exciting rewards!</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Redemption Success Modal */}
      <Modal
        visible={!!redemptionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRedemptionModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              {/* Success Animation */}
              <View style={styles.successIconContainer}>
                <LinearGradient
                  colors={[colors.successGlow, 'transparent']}
                  style={styles.successGlow}
                />
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark" size={40} color={colors.success} />
                </View>
              </View>
              
              <Text style={styles.modalTitle}>Reward Redeemed!</Text>
              <Text style={styles.modalReward}>{redemptionModal?.reward_name}</Text>
              
              {/* Code Display */}
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>VALIDATION CODE</Text>
                <View style={styles.codeBox}>
                  <Text style={styles.codeValue}>{redemptionModal?.validation_code}</Text>
                </View>
              </View>
              
              <Text style={styles.modalNote}>
                Show this code to staff to claim your reward
              </Text>
              
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setRedemptionModal(null)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Got It</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Venue Selector Modal */}
      <VenueSelector
        visible={showVenueFilter}
        selectedVenueId={selectedVenueId}
        onSelectVenue={(venueId) => {
          setSelectedVenueId(venueId);
          setShowVenueFilter(false);
        }}
        onClose={() => setShowVenueFilter(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    margin: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.gold + '30',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  heroContent: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pointsValue: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  pointsUnit: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  categoriesContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  categoryTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundCard,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  categoryTabActive: {
    borderColor: colors.accent,
  },
  categoryText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: colors.textPrimary,
  },
  venueFilterContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  venueFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  venueFilterText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionAccent: {
    width: 3,
    height: 16,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  rewardCount: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rewardsSection: {
    paddingHorizontal: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalGradient: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  successIconContainer: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  successGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 60,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.success,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalReward: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  codeContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  codeBox: {
    backgroundColor: "#000000",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  codeValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.success,
    letterSpacing: 6,
  },
  modalNote: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  modalButton: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  modalButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
