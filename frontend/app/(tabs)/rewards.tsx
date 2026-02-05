import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
} from 'react-native';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { PointsDisplay } from '../../src/components/PointsDisplay';
import { RewardCard } from '../../src/components/RewardCard';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const CATEGORIES = ['all', 'drinks', 'bottles', 'vip', 'merch'];

export default function RewardsScreen() {
  const user = useAuthStore((state) => state.user);
  const [rewards, setRewards] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [redemptionModal, setRedemptionModal] = useState<any>(null);

  const fetchRewards = async () => {
    try {
      const data = await api.getRewards(
        selectedCategory === 'all' ? undefined : selectedCategory
      );
      setRewards(data);
    } catch (e) {
      console.error('Failed to fetch rewards:', e);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, [selectedCategory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRewards();
    // Refresh user data
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
      const result = await api.redeemReward(rewardId);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      // Update user points
      useAuthStore.getState().updatePoints(result.new_balance);
      
      // Show redemption modal
      setRedemptionModal(result);
    } catch (e: any) {
      Alert.alert('Redemption Failed', e.message || 'Please try again');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
        {/* Points Display */}
        <View style={styles.pointsSection}>
          <PointsDisplay points={user?.points_balance || 0} tier={user?.tier || 'bronze'} />
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
              onPress={() => setSelectedCategory(category)}
            >
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
              <Ionicons name="gift-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No rewards available in this category</Text>
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
            <View style={styles.modalIcon}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            </View>
            <Text style={styles.modalTitle}>Reward Redeemed!</Text>
            <Text style={styles.modalReward}>{redemptionModal?.reward_name}</Text>
            
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>Validation Code</Text>
              <Text style={styles.codeValue}>{redemptionModal?.validation_code}</Text>
            </View>
            
            <Text style={styles.modalNote}>
              Show this code to staff to claim your reward
            </Text>
            
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setRedemptionModal(null)}
            >
              <Text style={styles.modalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  pointsSection: {
    padding: 16,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryTabActive: {
    backgroundColor: colors.accent,
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
  rewardsSection: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  modalReward: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  codeContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 4,
  },
  modalNote: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  modalButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
