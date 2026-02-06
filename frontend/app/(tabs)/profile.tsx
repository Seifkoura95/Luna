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
import { RotatingMoon } from '../../src/components/RotatingMoon';
import { FierySun } from '../../src/components/FierySun';
import { SafetyAlert } from '../../src/components/SafetyAlert';
import { CrewMap } from '../../src/components/CrewMap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

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
  const insets = useSafeAreaInsets();
  const navRouter = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [reservations, setReservations] = useState<any>(null);
  const [showQRPass, setShowQRPass] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [showSafety, setShowSafety] = useState(false);
  const [showCrewPlan, setShowCrewPlan] = useState(false);
  const [crews, setCrews] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [newCrewName, setNewCrewName] = useState('');
  const [showCreateCrew, setShowCreateCrew] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [showCrewMap, setShowCrewMap] = useState(false);
  const [selectedCrewForMap, setSelectedCrewForMap] = useState<any>(null);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [selectedCrewForInvite, setSelectedCrewForInvite] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showCrewDetails, setShowCrewDetails] = useState(false);
  const [selectedCrewForDetails, setSelectedCrewForDetails] = useState<any>(null);

  // Helper function to capitalize name properly
  const formatName = (name: string | undefined) => {
    if (!name) return 'Luna Member';
    return name.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const fetchData = async () => {
    try {
      const [statsData, reservationsData, crewsData, subData, venuesData] = await Promise.all([
        api.getUserStats().catch(() => null),
        api.getMyReservations().catch(() => null),
        api.getCrews().catch(() => []),
        api.getMySubscription().catch(() => null),
        api.getVenues().catch(() => []),
      ]);
      setStats(statsData);
      setReservations(reservationsData);
      setCrews(crewsData || []);
      setSubscriptionData(subData);
      setVenues(venuesData || []);
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

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    if (!selectedCrewForInvite) {
      Alert.alert('Error', 'No crew selected');
      return;
    }
    
    setIsInviting(true);
    try {
      const result = await api.sendCrewInviteEmail(
        selectedCrewForInvite.id,
        inviteEmail.trim(),
        inviteName.trim() || undefined,
        inviteMessage.trim() || undefined
      );
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert(
        'Invite Sent! 🎉',
        `An invitation has been sent to ${inviteEmail}.\n\n${result.mock ? '(Demo mode - no actual email sent)' : ''}`,
        [{ text: 'OK', onPress: () => {
          setShowInviteMember(false);
          setInviteEmail('');
          setInviteName('');
          setInviteMessage('');
          setSelectedCrewForInvite(null);
          fetchData();
        }}]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const openInviteModal = (crew: any) => {
    setSelectedCrewForInvite(crew);
    setShowCrewPlan(false);
    setShowInviteMember(true);
  };

  const openCrewDetails = (crew: any) => {
    setSelectedCrewForDetails(crew);
    setShowCrewPlan(false);
    setShowCrewDetails(true);
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
      title: 'Get Help',
      subtitle: 'Safety Alert',
      color: colors.success,
      onPress: () => setShowSafety(true),
    },
    {
      id: 'wallet',
      icon: 'wallet',
      title: 'Wallet',
      subtitle: 'Tickets & Rewards',
      color: colors.gold,
      onPress: () => router.push('/(tabs)/wallet'),
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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header - Minimalist with just name and moon */}
        <View style={styles.profileHeader}>
          <RotatingMoon size={80} rotationDuration={30000} />
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{formatName(user?.name)}</Text>
        </View>

        {/* Membership Tier Card - Same design as Wallet */}
        <View style={styles.tierCardContainer}>
          <View style={styles.tierCard}>
            <LinearGradient
              colors={['#1A1A1A', '#0D0D0D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tierCardGradient}
            >
              {/* Accent top border */}
              <View style={[styles.tierAccentBorder, { borderColor: tierConfig.color }]} />
              
              <View style={styles.tierHeader}>
                <View style={styles.tierPointsDisplay}>
                  <FierySun size={32} />
                  <View>
                    <Text style={styles.tierPointsValue}>{currentPoints.toLocaleString()}</Text>
                    <Text style={styles.tierPointsLabel}>LUNAR POINTS</Text>
                  </View>
                </View>
                
                <View style={[styles.tierBadge, { backgroundColor: tierConfig.color }]}>
                  <Ionicons name="moon" size={14} color="#000" />
                  <Text style={styles.tierBadgeText}>{(user?.tier || 'bronze').toUpperCase()}</Text>
                </View>
              </View>

              {/* Stats Row */}
              <View style={styles.tierStatsRow}>
                <View style={styles.tierStat}>
                  <Text style={styles.tierStatValue}>{progressToNext}%</Text>
                  <Text style={styles.tierStatLabel}>To {tierConfig.next}</Text>
                </View>
                <View style={styles.tierStatDivider} />
                <View style={styles.tierStat}>
                  <Text style={styles.tierStatValue}>2x</Text>
                  <Text style={styles.tierStatLabel}>Points</Text>
                </View>
                <View style={styles.tierStatDivider} />
                <View style={styles.tierStat}>
                  <Text style={styles.tierStatValue}>VIP</Text>
                  <Text style={styles.tierStatLabel}>Access</Text>
                </View>
              </View>

              {/* Progress to next tier */}
              <TouchableOpacity 
                style={[styles.tierUpgradeButton, { borderColor: tierConfig.color }]}
                onPress={() => router.push('/subscriptions')}
              >
                <Ionicons name="arrow-up-circle" size={18} color={tierConfig.color} />
                <Text style={[styles.tierUpgradeText, { color: tierConfig.color }]}>
                  {tierConfig.pointsNeeded - currentPoints} POINTS TO {tierConfig.next?.toUpperCase()}
                </Text>
              </TouchableOpacity>
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

        {/* Subscription Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MEMBERSHIP</Text>
          <TouchableOpacity
            style={styles.subscriptionCard}
            onPress={() => navRouter.push('/subscriptions')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[subscriptionData?.tier?.color || colors.gold, '#0A0A0A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.subscriptionGradient}
            >
              <View style={styles.subscriptionHeader}>
                <View style={[styles.subscriptionIcon, { backgroundColor: (subscriptionData?.tier?.color || colors.gold) + '30' }]}>
                  <Ionicons 
                    name={subscriptionData?.tier?.id === 'supernova' ? 'star' : subscriptionData?.tier?.id === 'eclipse' ? 'flash' : 'moon'} 
                    size={24} 
                    color={subscriptionData?.tier?.color || colors.gold} 
                  />
                </View>
                <View style={styles.subscriptionInfo}>
                  <Text style={[styles.subscriptionTier, { color: subscriptionData?.tier?.color || colors.gold }]}>
                    {subscriptionData?.tier?.name?.toUpperCase() || 'LUNAR'}
                  </Text>
                  <Text style={styles.subscriptionPrice}>
                    {subscriptionData?.tier?.price > 0 
                      ? `$${subscriptionData?.tier?.price}/month` 
                      : 'Free Plan'}
                  </Text>
                </View>
                <View style={styles.subscriptionArrow}>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </View>
              
              <View style={styles.subscriptionPerks}>
                <View style={styles.subscriptionPerk}>
                  <Text style={styles.subscriptionPerkValue}>{subscriptionData?.tier?.points_multiplier || 1}x</Text>
                  <Text style={styles.subscriptionPerkLabel}>Points</Text>
                </View>
                <View style={styles.subscriptionPerk}>
                  <Text style={styles.subscriptionPerkValue}>
                    {subscriptionData?.subscription?.free_entries_remaining === -1 ? '∞' : subscriptionData?.subscription?.free_entries_remaining || 0}
                  </Text>
                  <Text style={styles.subscriptionPerkLabel}>Free Entry</Text>
                </View>
                <View style={styles.subscriptionPerk}>
                  <Text style={styles.subscriptionPerkValue}>
                    {subscriptionData?.tier?.benefits?.free_drinks_before_10pm || 0}
                  </Text>
                  <Text style={styles.subscriptionPerkLabel}>Free Drinks</Text>
                </View>
              </View>
              
              {!subscriptionData?.is_subscribed && (
                <View style={[styles.upgradePrompt, { backgroundColor: colors.accent + '20' }]}>
                  <Ionicons name="arrow-up-circle" size={16} color={colors.accent} />
                  <Text style={[styles.upgradePromptText, { color: colors.accent }]}>
                    Upgrade for more perks!
                  </Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

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

      {/* Safety Alert Component - Advanced Safety System with Confirmation */}
      <SafetyAlert
        visible={showSafety}
        onClose={() => setShowSafety(false)}
        crews={crews}
        venues={venues}
      />

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
                    <View key={crew.id} style={styles.crewCard}>
                      <TouchableOpacity 
                        style={styles.crewInfo}
                        onPress={() => openCrewDetails(crew)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.crewName}>{crew.name}</Text>
                        <Text style={styles.crewMembers}>
                          {crew.members?.length || 1} members
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.crewActions}>
                        <TouchableOpacity 
                          style={styles.inviteButton}
                          onPress={() => openInviteModal(crew)}
                        >
                          <Ionicons name="person-add" size={16} color={colors.success} />
                          <Text style={styles.inviteButtonText}>Invite</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.trackButton}
                          onPress={() => {
                            setShowCrewPlan(false);
                            setSelectedCrewForMap(crew);
                            setShowCrewMap(true);
                          }}
                        >
                          <Ionicons name="location" size={16} color={colors.accent} />
                          <Text style={styles.trackButtonText}>Track</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.noCrewsContainer}>
                    <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.noCrews}>No crews yet</Text>
                    <Text style={styles.noCrewsSubtitle}>Create one to start planning with friends!</Text>
                  </View>
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

      {/* Invite Member Modal */}
      <Modal
        visible={showInviteMember}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowInviteMember(false);
          setInviteEmail('');
          setInviteName('');
          setInviteMessage('');
          setSelectedCrewForInvite(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Invite to Crew</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowInviteMember(false);
                    setInviteEmail('');
                    setInviteName('');
                    setInviteMessage('');
                    setSelectedCrewForInvite(null);
                  }}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {selectedCrewForInvite && (
                <View style={styles.inviteCrewBadge}>
                  <Ionicons name="people" size={16} color={colors.accent} />
                  <Text style={styles.inviteCrewName}>{selectedCrewForInvite.name}</Text>
                </View>
              )}

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS *</Text>
                  <TextInput
                    style={styles.input}
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    placeholder="friend@example.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>THEIR NAME (OPTIONAL)</Text>
                  <TextInput
                    style={styles.input}
                    value={inviteName}
                    onChangeText={setInviteName}
                    placeholder="Enter their name"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>PERSONAL MESSAGE (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.input, styles.messageInput]}
                    value={inviteMessage}
                    onChangeText={setInviteMessage}
                    placeholder="Can't wait to party together!"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inviteInfoBox}>
                  <Ionicons name="information-circle" size={20} color={colors.accent} />
                  <Text style={styles.inviteInfoText}>
                    An email invitation will be sent with a link to join your crew
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowInviteMember(false);
                    setInviteEmail('');
                    setInviteName('');
                    setInviteMessage('');
                    setSelectedCrewForInvite(null);
                  }}
                  disabled={isInviting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, isInviting && styles.buttonDisabled]}
                  onPress={handleInviteMember}
                  disabled={isInviting}
                >
                  <LinearGradient
                    colors={[colors.success, '#1e7e34']}
                    style={styles.confirmButtonGradient}
                  >
                    {isInviting ? (
                      <Text style={styles.confirmButtonText}>Sending...</Text>
                    ) : (
                      <>
                        <Ionicons name="send" size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
                        <Text style={styles.confirmButtonText}>Send Invite</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Crew Details Modal */}
      <Modal
        visible={showCrewDetails}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCrewDetails(false);
          setSelectedCrewForDetails(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '75%' }]}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedCrewForDetails?.name || 'Crew Details'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowCrewDetails(false);
                    setSelectedCrewForDetails(null);
                  }}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {selectedCrewForDetails && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Invite Code Section */}
                  <View style={styles.crewDetailSection}>
                    <Text style={styles.crewDetailLabel}>INVITE CODE</Text>
                    <View style={styles.inviteCodeContainer}>
                      <Text style={styles.inviteCodeLarge}>{selectedCrewForDetails.invite_code}</Text>
                      <Text style={styles.inviteCodeHint}>Share this code with friends</Text>
                    </View>
                  </View>

                  {/* Members Section */}
                  <View style={styles.crewDetailSection}>
                    <Text style={styles.crewDetailLabel}>
                      CREW MEMBERS ({selectedCrewForDetails.members?.length || 1})
                    </Text>
                    {selectedCrewForDetails.members?.map((member: any, index: number) => (
                      <View key={member.user_id || index} style={styles.memberCard}>
                        <View style={styles.memberAvatar}>
                          <Ionicons 
                            name={member.role === 'owner' ? 'star' : 'person'} 
                            size={20} 
                            color={member.role === 'owner' ? colors.gold : colors.accent} 
                          />
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          <Text style={styles.memberRole}>
                            {member.role === 'owner' ? 'Crew Owner' : 
                             member.status === 'pending' ? 'Pending...' : 'Member'}
                          </Text>
                        </View>
                        {member.status === 'confirmed' && (
                          <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                          </View>
                        )}
                        {member.status === 'pending' && (
                          <View style={[styles.statusBadge, { backgroundColor: colors.gold + '20' }]}>
                            <Ionicons name="time" size={14} color={colors.gold} />
                          </View>
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.crewDetailActions}>
                    <TouchableOpacity
                      style={styles.crewDetailActionButton}
                      onPress={() => {
                        setShowCrewDetails(false);
                        openInviteModal(selectedCrewForDetails);
                      }}
                    >
                      <LinearGradient
                        colors={[colors.success, '#1e7e34']}
                        style={styles.crewDetailActionGradient}
                      >
                        <Ionicons name="person-add" size={18} color={colors.textPrimary} />
                        <Text style={styles.crewDetailActionText}>Invite Member</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.crewDetailActionButton}
                      onPress={() => {
                        setShowCrewDetails(false);
                        setSelectedCrewForMap(selectedCrewForDetails);
                        setShowCrewMap(true);
                      }}
                    >
                      <LinearGradient
                        colors={[colors.accent, colors.accentDark]}
                        style={styles.crewDetailActionGradient}
                      >
                        <Ionicons name="location" size={18} color={colors.textPrimary} />
                        <Text style={styles.crewDetailActionText}>Track Crew</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Safety Alert Component */}
      <SafetyAlert
        visible={showSafety}
        onClose={() => setShowSafety(false)}
        crews={crews}
        venues={venues}
      />

      {/* Crew Map Modal */}
      {showCrewMap && selectedCrewForMap && (
        <Modal visible={showCrewMap} animationType="slide">
          <CrewMap
            crewId={selectedCrewForMap.id}
            crewName={selectedCrewForMap.name}
            onClose={() => {
              setShowCrewMap(false);
              setSelectedCrewForMap(null);
            }}
          />
        </Modal>
      )}
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
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  welcomeText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.md,
    letterSpacing: 1,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  tierCard: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierCardContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tierCardGradient: {
    padding: spacing.lg,
    position: 'relative',
  },
  tierAccentBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 3,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tierPointsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tierPointsValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  tierPointsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 4,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
  tierStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  tierStat: {
    alignItems: 'center',
  },
  tierStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tierStatLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tierStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  tierUpgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
    borderWidth: 1,
  },
  tierUpgradeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
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
    justifyContent: 'center',
  },
  actionCard: {
    width: (width - spacing.lg * 2 - spacing.sm * 2) / 2,
    backgroundColor: '#0A0A0A',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
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
  subscriptionCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  subscriptionGradient: {
    padding: spacing.lg,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  subscriptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscriptionInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  subscriptionTier: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  subscriptionPrice: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subscriptionArrow: {
    padding: spacing.sm,
  },
  subscriptionPerks: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  subscriptionPerk: {
    alignItems: 'center',
  },
  subscriptionPerkValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subscriptionPerkLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  upgradePromptText: {
    fontSize: 12,
    fontWeight: '700',
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
    alignSelf: 'center',
    width: '100%',
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
  crewInfo: {
    flex: 1,
  },
  crewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    gap: 4,
  },
  trackButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
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
  // Invite Button Styles
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    gap: 4,
  },
  inviteButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Invite Modal Styles
  inviteCrewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  inviteCrewName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  messageInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  inviteInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.accent + '10',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  inviteInfoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  // No Crews Empty State
  noCrewsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  noCrewsSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // Crew Details Modal Styles
  crewDetailSection: {
    marginBottom: spacing.xl,
  },
  crewDetailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  inviteCodeContainer: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  inviteCodeLarge: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  inviteCodeHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  memberRole: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crewDetailActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  crewDetailActionButton: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  crewDetailActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  crewDetailActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
