import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StarfieldBackground } from '../../src/components/StarfieldBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const TIER_CONFIG: Record<string, { color: string; icon: string; next: string; pointsNeeded: number }> = {
  bronze: { color: '#CD7F32', icon: 'shield', next: 'Silver', pointsNeeded: 1000 },
  silver: { color: '#C0C0C0', icon: 'shield-half', next: 'Gold', pointsNeeded: 5000 },
  gold: { color: '#FFD700', icon: 'shield-checkmark', next: 'Platinum', pointsNeeded: 15000 },
  platinum: { color: '#E5E4E2', icon: 'diamond', next: 'Diamond', pointsNeeded: 50000 },
  diamond: { color: '#B9F2FF', icon: 'diamond-outline', next: 'Max', pointsNeeded: 100000 },
};

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [reservations, setReservations] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [statsData, reservationsData] = await Promise.all([
        api.getUserStats(),
        api.getMyReservations(),
      ]);
      setStats(statsData);
      setReservations(reservationsData);
    } catch (e) {
      console.error('Failed to fetch profile data:', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshUser()]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/login');
          } catch (e) {
            router.replace('/login');
          }
        },
      },
    ]);
  };

  const tierConfig = TIER_CONFIG[user?.tier || 'bronze'];
  const currentPoints = user?.points_balance || 0;
  const progressToNext = Math.min((currentPoints / tierConfig.pointsNeeded) * 100, 100);

  const menuItems = [
    {
      id: 'reservations',
      icon: 'calendar',
      title: 'My Reservations',
      subtitle: `${reservations?.bookings?.length || 0} upcoming`,
      color: colors.accent,
    },
    {
      id: 'guestlist',
      icon: 'people',
      title: 'Guestlist History',
      subtitle: `${reservations?.guestlist?.length || 0} entries`,
      color: '#8B00FF',
    },
    {
      id: 'photos',
      icon: 'images',
      title: 'My Photos',
      subtitle: 'View & purchase night photos',
      color: '#FF6B35',
    },
    {
      id: 'achievements',
      icon: 'trophy',
      title: 'Achievements',
      subtitle: `${stats?.achievements_earned || 0} unlocked`,
      color: colors.gold,
    },
  ];

  const settingsItems = [
    { id: 'notifications', icon: 'notifications', title: 'Notifications' },
    { id: 'payment', icon: 'card', title: 'Payment Methods' },
    { id: 'privacy', icon: 'lock-closed', title: 'Privacy & Security' },
    { id: 'help', icon: 'help-circle', title: 'Help & Support' },
    { id: 'about', icon: 'information-circle', title: 'About Luna Group' },
  ];

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={50} shootingStarCount={2} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: insets.top }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={[tierConfig.color + '40', tierConfig.color + '10']}
              style={styles.avatarGradient}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
            </LinearGradient>
            <View style={[styles.tierBadge, { backgroundColor: tierConfig.color }]}>
              <Ionicons name={tierConfig.icon as any} size={12} color="#000" />
            </View>
          </View>

          <Text style={styles.userName}>{user?.name || 'Luna Member'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>

          {/* Membership Tier Card */}
          <View style={styles.tierCard}>
            <LinearGradient
              colors={[tierConfig.color + '20', '#0A0A0A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tierCardGradient}
            >
              <View style={styles.tierHeader}>
                <View>
                  <Text style={styles.tierLabel}>MEMBERSHIP TIER</Text>
                  <Text style={[styles.tierName, { color: tierConfig.color }]}>
                    {(user?.tier || 'bronze').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.pointsDisplay}>
                  <Ionicons name="star" size={20} color={colors.gold} />
                  <Text style={styles.pointsValue}>{currentPoints.toLocaleString()}</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={[tierConfig.color, tierConfig.color + '80']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${progressToNext}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {tierConfig.next !== 'Max' 
                    ? `${tierConfig.pointsNeeded - currentPoints} points to ${tierConfig.next}`
                    : 'Maximum tier reached!'
                  }
                </Text>
              </View>

              {/* Tier Benefits */}
              <View style={styles.benefitsRow}>
                <View style={styles.benefitItem}>
                  <Ionicons name="flash" size={16} color={tierConfig.color} />
                  <Text style={styles.benefitText}>Priority Entry</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="gift" size={16} color={tierConfig.color} />
                  <Text style={styles.benefitText}>Exclusive Rewards</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="star" size={16} color={tierConfig.color} />
                  <Text style={styles.benefitText}>2x Points</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.total_visits || 0}</Text>
            <Text style={styles.statLabel}>Visits</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.missions_completed || 0}</Text>
            <Text style={styles.statLabel}>Missions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.current_streak || 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.auctions_won || 0}</Text>
            <Text style={styles.statLabel}>Auctions Won</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <View style={styles.actionsGrid}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.actionCard}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <Text style={styles.actionTitle}>{item.title}</Text>
                <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Upcoming Reservations Preview */}
        {reservations?.bookings?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>UPCOMING</Text>
            {reservations.bookings.slice(0, 2).map((booking: any) => (
              <View key={booking.booking_id} style={styles.reservationCard}>
                <View style={styles.reservationIcon}>
                  <Ionicons name="calendar" size={20} color={colors.accent} />
                </View>
                <View style={styles.reservationContent}>
                  <Text style={styles.reservationVenue}>{booking.venue_name}</Text>
                  <Text style={styles.reservationDetails}>
                    {booking.date} at {booking.time} • {booking.party_size} guests
                  </Text>
                </View>
                <View style={[styles.confirmationBadge, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.confirmationText, { color: colors.success }]}>
                    {booking.confirmation_code}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SETTINGS</Text>
          <View style={styles.settingsContainer}>
            {settingsItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.settingsItem,
                  index < settingsItems.length - 1 && styles.settingsItemBorder,
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.settingsLeft}>
                  <Ionicons name={item.icon as any} size={20} color={colors.textSecondary} />
                  <Text style={styles.settingsText}>{item.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sign Out Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Luna Group v1.0.0</Text>
          <Text style={styles.footerText}>Made with ♥ in Brisbane</Text>
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
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tierBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  tierCard: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierCardGradient: {
    padding: spacing.lg,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  tierLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  pointsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldGlow,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: 6,
  },
  pointsValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.gold,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  benefitText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    width: (width - spacing.lg * 2 - spacing.sm) / 2 - spacing.sm / 2,
    backgroundColor: '#0A0A0A',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionCard: {
    width: (width - spacing.lg * 2 - spacing.sm) / 2,
    backgroundColor: '#0A0A0A',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  reservationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reservationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reservationContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  reservationVenue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reservationDetails: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  confirmationBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  confirmationText: {
    fontSize: 10,
    fontWeight: '700',
  },
  settingsContainer: {
    backgroundColor: '#0A0A0A',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingsText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error + '10',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
});
