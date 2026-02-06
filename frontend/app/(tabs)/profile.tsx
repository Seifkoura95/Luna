import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StarfieldBackground } from '../../src/components/StarfieldBackground';
import { PageHeader } from '../../src/components/PageHeader';

const { width } = Dimensions.get('window');
const LUNAR_MOON_IMAGE = 'https://customer-assets.emergentagent.com/job_cluboscenexus/artifacts/ekzz65x8_lunar%20moon.PNG';

const TIER_CONFIG: Record<string, { color: string; icon: string; next: string; pointsNeeded: number }> = {
  bronze: { color: '#CD7F32', icon: 'shield', next: 'Silver', pointsNeeded: 1000 },
  silver: { color: '#C0C0C0', icon: 'shield-half', next: 'Gold', pointsNeeded: 5000 },
  gold: { color: '#FFD700', icon: 'shield-checkmark', next: 'Platinum', pointsNeeded: 15000 },
  platinum: { color: '#E5E4E2', icon: 'diamond', next: 'Diamond', pointsNeeded: 50000 },
  diamond: { color: '#B9F2FF', icon: 'diamond-outline', next: 'Max', pointsNeeded: 100000 },
};

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [reservations, setReservations] = useState<any>(null);
  const [showQRPass, setShowQRPass] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [showSafety, setShowSafety] = useState(false);
  const [showCrewPlan, setShowCrewPlan] = useState(false);
  const [crews, setCrews] = useState<any[]>([]);
  const [newCrewName, setNewCrewName] = useState('');
  const [showCreateCrew, setShowCreateCrew] = useState(false);

  const fetchData = async () => {
    try {
      const [statsData, reservationsData, crewsData] = await Promise.all([
        api.getUserStats().catch(() => null),
        api.getMyReservations().catch(() => null),
        api.getCrews().catch(() => []),
      ]);
      setStats(statsData);
      setReservations(reservationsData);
      setCrews(crewsData || []);
    } catch (e) {
      console.error('Failed to fetch profile data:', e);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await api.getMe();
      useAuthStore.getState().setUser(userData);
    } catch (e) {
      console.error('Failed to refresh user:', e);
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

  const handleGetQR = async () => {
    try {
      const data = await api.getQRData('eclipse'); // Default venue
      setQrData(data);
      setShowQRPass(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate QR code');
    }
  };

  const handleCreateCrew = async () => {
    if (!newCrewName.trim()) {
      Alert.alert('Error', 'Please enter a crew name');
      return;
    }
    try {
      await api.createCrew(newCrewName.trim());
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Success', 'Crew created!');
      setShowCreateCrew(false);
      setNewCrewName('');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create crew');
    }
  };

  const handleEmergencyCall = () => {
    Alert.alert(
      'Emergency Services',
      'This will call 000. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call 000', style: 'destructive', onPress: () => Linking.openURL('tel:000') },
      ]
    );
  };

  const handleRideshare = async (service: 'uber' | 'didi') => {
    try {
      const links = await api.getRideshareLinks('eclipse');
      const url = service === 'uber' ? links.uber_web : links.didi;
      Linking.openURL(url);
    } catch (e) {
      Alert.alert('Error', 'Failed to open rideshare app');
    }
  };

  const tierConfig = TIER_CONFIG[user?.tier || 'bronze'];
  const currentPoints = user?.points_balance || 0;
  const progressToNext = Math.min((currentPoints / tierConfig.pointsNeeded) * 100, 100);

  const quickActions = [
    {
      id: 'qr',
      icon: 'qr-code',
      title: "Tonight's Pass",
      subtitle: 'Show at entrance',
      color: colors.accent,
      onPress: handleGetQR,
    },
    {
      id: 'crew',
      icon: 'people',
      title: 'Crew Plan',
      subtitle: `${crews.length} crews`,
      color: '#8B00FF',
      onPress: () => setShowCrewPlan(true),
    },
    {
      id: 'safety',
      icon: 'shield-checkmark',
      title: 'Safety',
      subtitle: 'Help & Support',
      color: colors.success,
      onPress: () => setShowSafety(true),
    },
    {
      id: 'rewards',
      icon: 'gift',
      title: 'Rewards',
      subtitle: 'Redeem points',
      color: colors.gold,
      onPress: () => router.push('/(tabs)/rewards'),
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
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Consistent Header with Points shown */}
        <PageHeader title="PROFILE" showPoints={true} />

        {/* User Info Section */}
        <View style={styles.userInfoSection}>
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
        </View>

        {/* Membership Tier Card */}
        <View style={styles.tierCardContainer}>
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
            {quickActions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.actionCard}
                onPress={item.onPress}
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

      {/* QR Pass Modal */}
      <Modal
        visible={showQRPass}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQRPass(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Tonight's Pass</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowQRPass(false)}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.qrSection}>
                <View style={styles.qrCodeLarge}>
                  <Ionicons name="qr-code" size={180} color={colors.textPrimary} />
                </View>
                <Text style={styles.qrVenue}>{qrData?.venue_name || 'Luna Group'}</Text>
                <Text style={styles.qrHelp}>Show this QR code at the entrance</Text>
                <Text style={styles.qrExpiry}>Valid for 60 seconds</Text>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Safety Modal */}
      <Modal
        visible={showSafety}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSafety(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Safety</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowSafety(false)}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Emergency Button */}
              <TouchableOpacity
                style={styles.emergencyButton}
                onPress={handleEmergencyCall}
              >
                <Ionicons name="call" size={24} color={colors.textPrimary} />
                <Text style={styles.emergencyText}>Emergency Call (000)</Text>
              </TouchableOpacity>

              {/* Rideshare Links */}
              <View style={styles.safetySection}>
                <Text style={styles.safetySectionTitle}>GET A RIDE HOME</Text>
                <View style={styles.rideshareRow}>
                  <TouchableOpacity
                    style={styles.rideshareButton}
                    onPress={() => handleRideshare('uber')}
                  >
                    <Text style={styles.rideshareText}>Uber</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rideshareButton}
                    onPress={() => handleRideshare('didi')}
                  >
                    <Text style={styles.rideshareText}>DiDi</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Report Options */}
              <View style={styles.safetySection}>
                <Text style={styles.safetySectionTitle}>REPORT</Text>
                <TouchableOpacity style={styles.reportButton}>
                  <Ionicons name="alert-circle" size={20} color={colors.error} />
                  <Text style={styles.reportText}>Report an Incident</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.reportButton}>
                  <Ionicons name="search" size={20} color={colors.textSecondary} />
                  <Text style={styles.reportText}>Lost Property</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Helplines */}
              <View style={styles.safetySection}>
                <Text style={styles.safetySectionTitle}>HELPLINES</Text>
                <Text style={styles.helplineText}>Lifeline: 13 11 14</Text>
                <Text style={styles.helplineText}>Police Non-Emergency: 131 444</Text>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Crew Plan Modal */}
      <Modal
        visible={showCrewPlan}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCrewPlan(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Crew Plan</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowCrewPlan(false)}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.createCrewButton}
                onPress={() => setShowCreateCrew(true)}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  style={styles.createCrewGradient}
                >
                  <Ionicons name="add" size={20} color={colors.textPrimary} />
                  <Text style={styles.createCrewText}>Create New Crew</Text>
                </LinearGradient>
              </TouchableOpacity>

              <ScrollView style={styles.crewList}>
                {crews.length > 0 ? (
                  crews.map((crew) => (
                    <TouchableOpacity key={crew.id} style={styles.crewCard}>
                      <View style={styles.crewInfo}>
                        <Text style={styles.crewName}>{crew.name}</Text>
                        <Text style={styles.crewMembers}>
                          {crew.members?.length || 1} members
                        </Text>
                      </View>
                      <View style={styles.crewCode}>
                        <Text style={styles.crewCodeText}>{crew.invite_code}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noCrews}>No crews yet. Create one to start planning!</Text>
                )}
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Create Crew Modal */}
      <Modal
        visible={showCreateCrew}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateCrew(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '40%' }]}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              <Text style={styles.modalTitle}>Create Crew</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>CREW NAME</Text>
                <TextInput
                  style={styles.input}
                  value={newCrewName}
                  onChangeText={setNewCrewName}
                  placeholder="e.g., Saturday Squad"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowCreateCrew(false);
                    setNewCrewName('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleCreateCrew}
                >
                  <LinearGradient
                    colors={[colors.accent, colors.accentDark]}
                    style={styles.confirmButtonGradient}
                  >
                    <Text style={styles.confirmButtonText}>Create</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  userInfoSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  qrCodeLarge: {
    backgroundColor: colors.textPrimary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  qrVenue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  qrHelp: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  qrExpiry: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  emergencyText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  safetySection: {
    marginBottom: spacing.lg,
  },
  safetySectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  rideshareRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rideshareButton: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rideshareText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  reportText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  helplineText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  createCrewButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  createCrewGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  createCrewText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  crewList: {
    maxHeight: 300,
  },
  crewCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  crewInfo: {},
  crewName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  crewMembers: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  crewCode: {
    backgroundColor: colors.accent + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  crewCodeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  noCrews: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    padding: spacing.md,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
