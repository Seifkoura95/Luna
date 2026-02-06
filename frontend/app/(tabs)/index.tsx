import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, tierColors, tierGlows } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { QRCode } from '../../src/components/QRCode';
import { MissionCard } from '../../src/components/MissionCard';
import { VenueSelector } from '../../src/components/VenueSelector';
import { FeaturedContent } from '../../src/components/FeaturedContent';
import { VenueStatusCard } from '../../src/components/VenueStatusCard';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function TonightScreen() {
  const user = useAuthStore((state) => state.user);
  const [selectedVenueId, setSelectedVenueId] = useState('eclipse');
  const [missions, setMissions] = useState<any[]>([]);
  const [boosts, setBoosts] = useState<any[]>([]);
  const [venue, setVenue] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [missionsData, boostsData, venueData] = await Promise.all([
        api.getMissions(selectedVenueId),
        api.getActiveBoosts(selectedVenueId),
        api.getVenue(selectedVenueId),
      ]);
      setMissions(missionsData);
      setBoosts(boostsData);
      setVenue(venueData);
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedVenueId]);

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
        {/* Venue Selector */}
        <View style={styles.section}>
          <VenueSelector
            selectedVenueId={selectedVenueId}
            onSelectVenue={setSelectedVenueId}
          />
        </View>

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

        {/* Premium Hero Card - Tonight Pass */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#1A1A1A', '#111111', '#0A0A0A']}
            style={styles.heroCard}
          >
            {/* Top Info */}
            <View style={styles.heroHeader}>
              <View>
                <Text style={styles.heroGreeting}>Tonight Pass</Text>
                <Text style={styles.heroName}>{venue?.name || 'Luna Group'}</Text>
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
              <Text style={styles.qrLabel}>ENTRY QR CODE</Text>
              <Text style={styles.qrSubtitle}>Show this at the door for instant entry</Text>
              <View style={styles.qrWrapper}>
                <View style={styles.qrGlow} />
                <QRCode size={200} venueId={selectedVenueId} />
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

        {/* Featured Content - Artist/DJ/Promo */}
        <View style={styles.section}>
          <FeaturedContent
            type="artist"
            title="DJ SODA"
            subtitle="Tonight's Headliner"
            description="International sensation bringing K-Pop and EDM vibes to the venue"
            image="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800"
            cta="View Event"
          />
        </View>

        {/* Venue Status */}
        {venue?.type === 'nightclub' && (
          <View style={styles.section}>
            <VenueStatusCard
              venueName={venue.name}
              status={venue.status || 'open'}
              capacity={venue.status === 'busy' ? 75 : 45}
              estimatedWait={venue.status === 'busy' ? '15 min' : '5 min'}
            />
          </View>
        )}

        {/* VIP Perks Spotlight */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>YOUR VIP PERKS</Text>
            </View>
          </View>
          <View style={styles.perksCard}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.backgroundElevated]}
              style={styles.perksGradient}
            >
              <View style={styles.perkItem}>
                <Ionicons name="flash" size={20} color={colors.accent} />
                <Text style={styles.perkText}>Fast Lane Access</Text>
                <View style={styles.perkBadge}>
                  <Text style={styles.perkBadgeText}>2 left</Text>
                </View>
              </View>
              <View style={styles.perkDivider} />
              <View style={styles.perkItem}>
                <Ionicons name="people" size={20} color={colors.accent} />
                <Text style={styles.perkText}>Guest List Priority</Text>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
              <View style={styles.perkDivider} />
              <View style={styles.perkItem}>
                <Ionicons name="gift" size={20} color={colors.accent} />
                <Text style={styles.perkText}>Birthday Perks Active</Text>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Active Missions */}
        {missions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>ACTIVE MISSIONS</Text>
              </View>
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
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
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
    fontSize: 22,
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
  perksCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  perksGradient: {
    padding: spacing.md,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  perkText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: spacing.md,
  },
  perkBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  perkBadgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  perkDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  missionsScroll: {
    paddingRight: spacing.md,
  },
});
