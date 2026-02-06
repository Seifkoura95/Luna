import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, tierColors, tierGlows } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const { width } = Dimensions.get('window');

const TIERS = [
  { key: 'bronze', name: 'Bronze', price: 0, multiplier: '1.0x', icon: 'shield' },
  { key: 'silver', name: 'Silver', price: 29, multiplier: '1.2x', icon: 'shield-half' },
  { key: 'gold', name: 'Gold', price: 79, multiplier: '1.5x', icon: 'diamond' },
  { key: 'platinum', name: 'Platinum', price: 199, multiplier: '2.0x', icon: 'diamond' },
  { key: 'black', name: 'Black', price: 499, multiplier: '3.0x', icon: 'diamond' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const statsData = await api.getPointsStats();
      setStats(statsData);
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
    try {
      const userData = await api.getMe();
      useAuthStore.getState().setUser(userData);
    } catch (e) {
      console.error('Failed to refresh user:', e);
    }
    setRefreshing(false);
  };

  const handleUpgrade = async (tier: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
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
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
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
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const tierColor = tierColors[user?.tier || 'bronze'] || colors.gold;
  const tierGlow = tierGlows[user?.tier || 'bronze'] || colors.goldGlow;
  const currentTierIndex = TIERS.findIndex((t) => t.key === user?.tier);

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
        {/* Profile Hero */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[tierGlow, 'transparent']}
            style={styles.heroGlow}
          />
          <LinearGradient
            colors={[colors.backgroundCard, colors.backgroundElevated]}
            style={styles.heroCard}
          >
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarGlow, { backgroundColor: tierGlow }]} />
              {user?.picture ? (
                <Image source={{ uri: user.picture }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {user?.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={[styles.tierIndicator, { backgroundColor: tierColor }]}>
                <Ionicons name="diamond" size={12} color={colors.background} />
              </View>
            </View>

            {/* User Info */}
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>

            {/* Tier Badge */}
            <View style={[styles.tierBadge, { borderColor: tierColor }]}>
              <Text style={[styles.tierBadgeText, { color: tierColor }]}>
                {user?.tier?.toUpperCase()} MEMBER
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Stats Grid */}
        {stats && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>YOUR STATS</Text>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={[colors.goldGlow, 'transparent']}
                  style={styles.statGlow}
                />
                <Ionicons name="star" size={24} color={colors.gold} />
                <Text style={styles.statValue}>{stats.total_earned}</Text>
                <Text style={styles.statLabel}>Total Earned</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={[colors.accentGlow, 'transparent']}
                  style={styles.statGlow}
                />
                <Ionicons name="gift" size={24} color={colors.accent} />
                <Text style={styles.statValue}>{stats.total_spent}</Text>
                <Text style={styles.statLabel}>Redeemed</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={[colors.successGlow, 'transparent']}
                  style={styles.statGlow}
                />
                <Ionicons name="calendar" size={24} color={colors.success} />
                <Text style={styles.statValue}>{stats.checkin_count}</Text>
                <Text style={styles.statLabel}>Check-ins</Text>
              </View>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={[colors.warningGlow, 'transparent']}
                  style={styles.statGlow}
                />
                <Ionicons name="trophy" size={24} color={colors.warning} />
                <Text style={styles.statValue}>{stats.missions_completed}</Text>
                <Text style={styles.statLabel}>Missions</Text>
              </View>
            </View>
          </View>
        )}

        {/* Membership Tiers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>MEMBERSHIP TIERS</Text>
          </View>
          {TIERS.map((tier, index) => {
            const isCurrentTier = tier.key === user?.tier;
            const isLowerTier = index <= currentTierIndex;
            const color = tierColors[tier.key] || colors.textPrimary;
            const glow = tierGlows[tier.key] || colors.goldGlow;

            return (
              <View
                key={tier.key}
                style={[
                  styles.tierCard,
                  isCurrentTier && { borderColor: color },
                ]}
              >
                <LinearGradient
                  colors={isCurrentTier ? [glow, colors.backgroundCard] : [colors.backgroundCard, colors.backgroundElevated]}
                  style={styles.tierCardGradient}
                >
                  <View style={styles.tierCardHeader}>
                    <View style={[styles.tierIcon, { backgroundColor: color + '20' }]}>
                      <Ionicons name={tier.icon as any} size={22} color={color} />
                    </View>
                    <View style={styles.tierInfo}>
                      <Text style={styles.tierName}>{tier.name}</Text>
                      <Text style={styles.tierPrice}>
                        {tier.price === 0 ? 'Free' : `$${tier.price}/mo`}
                      </Text>
                    </View>
                    <View style={[styles.multiplierBadge, { backgroundColor: color + '20' }]}>
                      <Text style={[styles.multiplierText, { color }]}>
                        {tier.multiplier}
                      </Text>
                    </View>
                  </View>
                  
                  {isCurrentTier ? (
                    <View style={[styles.currentTierBadge, { backgroundColor: color }]}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.background} />
                      <Text style={styles.currentTierText}>Current Tier</Text>
                    </View>
                  ) : !isLowerTier ? (
                    <TouchableOpacity
                      style={styles.upgradeButton}
                      onPress={() => handleUpgrade(tier.key)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={[colors.accent, colors.accentDark]}
                        style={styles.upgradeGradient}
                      >
                        <Text style={styles.upgradeText}>Upgrade</Text>
                        <Ionicons name="arrow-forward" size={16} color={colors.textPrimary} />
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : null}
                </LinearGradient>
              </View>
            );
          })}
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
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
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    padding: spacing.md,
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatarGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 60,
    opacity: 0.5,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tierIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  tierBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
    backgroundColor: colors.background,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: (width - spacing.md * 2 - spacing.sm) / 2 - 1,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  statGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  tierCard: {
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierCardGradient: {
    padding: spacing.md,
  },
  tierCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tierPrice: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  multiplierBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  multiplierText: {
    fontSize: 14,
    fontWeight: '700',
  },
  currentTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  currentTierText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
  upgradeButton: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
  },
  upgradeText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundCard,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});
