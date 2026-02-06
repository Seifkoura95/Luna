import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, tierColors, tierGlows } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { QRCode } from '../../src/components/QRCode';
import { QueueStatus } from '../../src/components/QueueStatus';
import { MissionCard } from '../../src/components/MissionCard';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function TonightScreen() {
  const user = useAuthStore((state) => state.user);
  const [missions, setMissions] = useState<any[]>([]);
  const [boosts, setBoosts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [missionsData, boostsData] = await Promise.all([
        api.getMissions(),
        api.getActiveBoosts(),
      ]);
      setMissions(missionsData);
      setBoosts(boostsData);
    } catch (e) {
      console.error('Failed to fetch data:', e);
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

  const tierColor = tierColors[user?.tier || 'bronze'] || colors.gold;
  const tierGlow = tierGlows[user?.tier || 'bronze'] || colors.goldGlow;

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
        {/* Active Boost Banner */}
        {boosts.length > 0 && (
          <View style={styles.boostBanner}>
            <LinearGradient
              colors={[colors.warningGlow, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.boostGradient}
            />
            <View style={styles.boostContent}>
              <View style={styles.boostIconContainer}>
                <Ionicons name="flash" size={18} color={colors.warning} />
              </View>
              <View style={styles.boostTextContainer}>
                <Text style={styles.boostTitle}>{boosts[0].name}</Text>
                <Text style={styles.boostMultiplier}>{boosts[0].multiplier}x Points Active!</Text>
              </View>
            </View>
          </View>
        )}

        {/* Premium Hero Card */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#1A1A1A', '#111111', '#0A0A0A']}
            style={styles.heroCard}
          >
            {/* Top Info */}
            <View style={styles.heroHeader}>
              <View>
                <Text style={styles.heroGreeting}>Welcome back,</Text>
                <Text style={styles.heroName}>{user?.name?.split(' ')[0]}</Text>
              </View>
              <View style={styles.tierContainer}>
                <View style={[styles.tierGlow, { backgroundColor: tierGlow }]} />
                <View style={[styles.tierBadge, { borderColor: tierColor }]}>
                  <Ionicons name="diamond" size={14} color={tierColor} />
                  <Text style={[styles.tierText, { color: tierColor }]}>
                    {user?.tier?.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* QR Code Section */}
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>TONIGHT PASS</Text>
              <Text style={styles.qrSubtitle}>Show this at the door for instant entry</Text>
              <View style={styles.qrWrapper}>
                <View style={styles.qrGlow} />
                <QRCode size={200} />
              </View>
            </View>

            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <View style={styles.quickStatItem}>
                <View style={styles.quickStatIcon}>
                  <Ionicons name="star" size={16} color={colors.gold} />
                </View>
                <Text style={styles.quickStatValue}>{user?.points_balance || 0}</Text>
                <Text style={styles.quickStatLabel}>Points</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <View style={styles.quickStatIcon}>
                  <Ionicons name="trophy" size={16} color={colors.accent} />
                </View>
                <Text style={styles.quickStatValue}>
                  {missions.filter(m => m.completed).length}
                </Text>
                <Text style={styles.quickStatLabel}>Missions</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <View style={styles.quickStatIcon}>
                  <Ionicons name="flame" size={16} color={colors.warning} />
                </View>
                <Text style={styles.quickStatValue}>
                  {boosts.length > 0 ? `${boosts[0].multiplier}x` : '1x'}
                </Text>
                <Text style={styles.quickStatLabel}>Boost</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Queue Status */}
        <View style={styles.section}>
          <QueueStatus />
        </View>

        {/* Active Missions */}
        {missions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>ACTIVE MISSIONS</Text>
              </View>
              <TouchableOpacity style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>See All</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.missionsScroll}
            >
              {missions.filter(m => !m.completed).slice(0, 4).map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </ScrollView>
          </View>
        )}
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
  boostBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  boostGradient: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 100,
  },
  boostContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  boostIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  boostTextContainer: {
    flex: 1,
  },
  boostTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  boostMultiplier: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  heroSection: {
    padding: spacing.md,
  },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  heroGreeting: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  heroName: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 2,
  },
  tierContainer: {
    position: 'relative',
  },
  tierGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: radius.full,
    opacity: 0.6,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginLeft: spacing.xs,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  qrLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  qrSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  qrWrapper: {
    position: 'relative',
  },
  qrGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: colors.accentGlow,
    borderRadius: radius.xl,
    opacity: 0.3,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  quickStatValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  quickStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  missionsScroll: {
    paddingRight: spacing.md,
  },
});
