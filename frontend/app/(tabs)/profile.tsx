import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, tierColors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';

const TIERS = [
  { key: 'bronze', name: 'Bronze', price: 0, multiplier: '1.0x' },
  { key: 'silver', name: 'Silver', price: 29, multiplier: '1.2x' },
  { key: 'gold', name: 'Gold', price: 79, multiplier: '1.5x' },
  { key: 'platinum', name: 'Platinum', price: 199, multiplier: '2.0x' },
  { key: 'black', name: 'Black', price: 499, multiplier: '3.0x' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [statsData, redemptionsData] = await Promise.all([
        api.getPointsStats(),
        api.getRedemptions(),
      ]);
      setStats(statsData);
      setRedemptions(redemptionsData);
    } catch (e) {
      console.error('Failed to fetch profile data:', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    // Refresh user data
    try {
      const userData = await api.getMe();
      useAuthStore.getState().setUser(userData);
    } catch (e) {
      console.error('Failed to refresh user:', e);
    }
    setRefreshing(false);
  };

  const handleUpgrade = async (tier: string) => {
    Alert.alert(
      'Upgrade Membership',
      `Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upgrade',
          onPress: async () => {
            try {
              const result = await api.upgradeMembership(tier);
              Alert.alert('Success', result.message);
              useAuthStore.getState().updateTier(tier);
              useAuthStore.getState().updatePoints(
                (user?.points_balance || 0) + result.bonus_points
              );
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Upgrade failed');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const tierColor = tierColors[user?.tier || 'bronze'] || colors.textPrimary;
  const currentTierIndex = TIERS.findIndex((t) => t.key === user?.tier);

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
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={40} color={colors.textMuted} />
              </View>
            )}
            <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
              <Text style={styles.tierBadgeText}>{user?.tier?.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Stats Grid */}
        {stats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>YOUR STATS</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total_earned}</Text>
                <Text style={styles.statLabel}>Total Earned</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total_spent}</Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.checkin_count}</Text>
                <Text style={styles.statLabel}>Check-ins</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.missions_completed}</Text>
                <Text style={styles.statLabel}>Missions</Text>
              </View>
            </View>
          </View>
        )}

        {/* Membership Tiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MEMBERSHIP TIERS</Text>
          {TIERS.map((tier, index) => {
            const isCurrentTier = tier.key === user?.tier;
            const isLowerTier = index <= currentTierIndex;
            const tierBgColor = tierColors[tier.key] || colors.textPrimary;

            return (
              <View
                key={tier.key}
                style={[
                  styles.tierCard,
                  isCurrentTier && { borderColor: tierBgColor },
                ]}
              >
                <View style={styles.tierHeader}>
                  <View style={[styles.tierIcon, { backgroundColor: tierBgColor + '30' }]}>
                    <Ionicons name="diamond" size={20} color={tierBgColor} />
                  </View>
                  <View style={styles.tierInfo}>
                    <Text style={styles.tierName}>{tier.name}</Text>
                    <Text style={styles.tierPrice}>
                      {tier.price === 0 ? 'Free' : `$${tier.price}/mo`}
                    </Text>
                  </View>
                  <View style={styles.tierMultiplier}>
                    <Text style={[styles.multiplierText, { color: tierBgColor }]}>
                      {tier.multiplier}
                    </Text>
                    <Text style={styles.multiplierLabel}>points</Text>
                  </View>
                </View>
                {isCurrentTier ? (
                  <View style={[styles.currentBadge, { backgroundColor: tierBgColor }]}>
                    <Text style={styles.currentBadgeText}>Current Tier</Text>
                  </View>
                ) : !isLowerTier ? (
                  <TouchableOpacity
                    style={styles.upgradeButton}
                    onPress={() => handleUpgrade(tier.key)}
                  >
                    <Text style={styles.upgradeButtonText}>Upgrade</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Recent Redemptions */}
        {redemptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RECENT REDEMPTIONS</Text>
            {redemptions.slice(0, 5).map((redemption) => (
              <View key={redemption.id} style={styles.redemptionCard}>
                <View style={styles.redemptionInfo}>
                  <Text style={styles.redemptionName}>{redemption.reward_name}</Text>
                  <Text style={styles.redemptionCode}>Code: {redemption.validation_code}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    redemption.status === 'validated' && styles.statusValidated,
                    redemption.status === 'expired' && styles.statusExpired,
                  ]}
                >
                  <Text style={styles.statusText}>{redemption.status.toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  tierCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tierPrice: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tierMultiplier: {
    alignItems: 'center',
  },
  multiplierText: {
    fontSize: 18,
    fontWeight: '700',
  },
  multiplierLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  currentBadge: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  currentBadgeText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  upgradeButton: {
    marginTop: 12,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  redemptionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  redemptionInfo: {
    flex: 1,
  },
  redemptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  redemptionCode: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusValidated: {
    backgroundColor: colors.success + '20',
  },
  statusExpired: {
    backgroundColor: colors.error + '20',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
