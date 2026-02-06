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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { RewardCard } from '../../src/components/RewardCard';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { StarfieldBackground } from '../../src/components/StarfieldBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const CATEGORIES = ['all', 'drinks', 'bottles', 'vip', 'merch', 'dining'];

export default function RewardsScreen() {
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
  const [rewards, setRewards] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [redemptionModal, setRedemptionModal] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [rewardsData, venuesData] = await Promise.all([
        api.getRewards(
          selectedCategory === 'all' ? undefined : selectedCategory,
          selectedVenueId || undefined
        ),
        api.getVenues(),
      ]);
      setRewards(rewardsData);
      setVenues(venuesData);
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCategory, selectedVenueId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
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

  const handleVenueSelect = (venueId: string | null) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedVenueId(selectedVenueId === venueId ? null : venueId);
  };

  const selectedVenue = venues.find(v => v.id === selectedVenueId);

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={60} shootingStarCount={2} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>REWARDS</Text>
            <View style={styles.headerUnderline} />
          </View>
          <View style={styles.pointsBadge}>
            <Ionicons name="star" size={14} color={colors.gold} />
            <Text style={styles.pointsText}>{user?.points_balance?.toLocaleString() || 0}</Text>
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

        {/* Venue Quick Filter - Horizontal Scroll */}
        <View style={styles.venueFilterSection}>
          <Text style={styles.filterLabel}>FILTER BY VENUE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.venueFilterContainer}
          >
            {/* All Venues Option */}
            <TouchableOpacity
              style={[
                styles.venueChip,
                !selectedVenueId && styles.venueChipActive,
              ]}
              onPress={() => handleVenueSelect(null)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="globe-outline" 
                size={16} 
                color={!selectedVenueId ? colors.textPrimary : colors.textMuted} 
              />
              <Text style={[
                styles.venueChipText,
                !selectedVenueId && styles.venueChipTextActive,
              ]}>
                All Venues
              </Text>
            </TouchableOpacity>

            {/* Individual Venues */}
            {venues.map((venue) => (
              <TouchableOpacity
                key={venue.id}
                style={[
                  styles.venueChip,
                  selectedVenueId === venue.id && styles.venueChipActive,
                  selectedVenueId === venue.id && { borderColor: venue.accent_color },
                ]}
                onPress={() => handleVenueSelect(venue.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.venueChipDot, { backgroundColor: venue.accent_color }]} />
                <Text 
                  style={[
                    styles.venueChipText,
                    selectedVenueId === venue.id && styles.venueChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {venue.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>
              {selectedVenue ? selectedVenue.name.toUpperCase() : 'ALL REWARDS'}
            </Text>
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
              <Text style={styles.emptyText}>
                {selectedVenueId 
                  ? 'Try selecting a different venue or category'
                  : 'Check back soon for exciting rewards!'
                }
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  headerUnderline: {
    width: 40,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: spacing.xs,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldGlow,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: 6,
  },
  pointsText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 14,
  },
  categoriesContainer: {
    paddingHorizontal: spacing.lg,
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
  venueFilterSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  venueFilterContainer: {
    gap: spacing.sm,
  },
  venueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    marginRight: spacing.sm,
  },
  venueChipActive: {
    backgroundColor: colors.backgroundCard,
    borderColor: colors.accent,
  },
  venueChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  venueChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    maxWidth: 120,
  },
  venueChipTextActive: {
    color: colors.textPrimary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
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
    paddingHorizontal: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
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
    textAlign: 'center',
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
    backgroundColor: '#000000',
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
