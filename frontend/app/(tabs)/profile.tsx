import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { useDataStore } from '../../src/store/dataStore';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { AppBackground } from '../../src/components/AppBackground';
import { SafetyAlert } from '../../src/components/SafetyAlert';
import { CrewMap } from '../../src/components/CrewMap';
import { PageHeader } from '../../src/components/PageHeader';
import { MembershipCard } from '../../src/components/MembershipCard';
import { SectionTitle } from '../../src/components/SectionTitle';
import { GoldStarIcon } from '../../src/components/GoldStarIcon';
import { ActivityIndicator } from 'react-native';


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
  const { isProfileCacheValid, getProfileData, setProfileData, clearCache } = useDataStore();
  
  const scrollRef = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Auto scroll to top when tab gains focus
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );
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
  // CherryHub state
  const [cherryHubStatus, setCherryHubStatus] = useState<{registered: boolean, member_key: string | null}>({registered: false, member_key: null});
  const [cherryHubPoints, setCherryHubPoints] = useState<number>(0);
  const [walletPassLoading, setWalletPassLoading] = useState(false);
  const [linkingCherryHub, setLinkingCherryHub] = useState(false);
  const [pointsData, setPointsData] = useState<any>(null);

  // Helper function to capitalize name properly
  const formatName = (name: string | undefined) => {
    if (!name) return 'Luna Member';
    return name.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const fetchData = async (forceRefresh = false) => {
    // Check cache first (skip API calls if data is still valid)
    if (!forceRefresh && isProfileCacheValid()) {
      const cached = getProfileData();
      if (cached) {
        setCrews(cached.crews);
        setStats(cached.userStats);
        setCherryHubStatus(cached.cherryHubStatus);
        if (cached.pointsData) {
          setPointsData(cached.pointsData);
        }
        return;
      }
    }
    
    try {
      const [statsData, reservationsData, crewsData, subData, venuesData, cherryStatus, pointsRes] = await Promise.all([
        api.getUserStats().catch(() => null),
        api.getMyReservations().catch(() => null),
        api.getCrews().catch(() => []),
        api.getMySubscription().catch(() => null),
        api.getVenues().catch(() => []),
        api.cherryHubStatus().catch(() => ({registered: false, member_key: null})),
        api.getPointsBalance().catch(() => null),
      ]);
      setStats(statsData);
      setReservations(reservationsData);
      setCrews(crewsData || []);
      setSubscriptionData(subData);
      setVenues(venuesData || []);
      setCherryHubStatus(cherryStatus);
      setPointsData(pointsRes);
      
      // Cache the data
      setProfileData({
        crews: crewsData || [],
        reservations: reservationsData,
        userStats: statsData,
        cherryHubStatus: cherryStatus,
        pointsData: pointsRes,
      });
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
    await Promise.all([fetchData(true), refreshUser()]); // Force refresh bypasses cache
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
            clearCache(); // Clear data cache on logout
            await logout();
            router.replace('/login');
          } catch (e) {
            router.replace('/login');
          }
        },
      },
    ]);
  };

  const handleCherryHubLogout = () => {
    Alert.alert(
      'Disconnect Cherry Hub',
      'Are you sure you want to disconnect your Cherry Hub membership? You can reconnect anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              // Reset local Cherry Hub status
              setCherryHubStatus({ registered: false, member_key: null });
              setCherryHubPoints(0);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Disconnected', 'Your Cherry Hub membership has been disconnected from this app.');
            } catch (e) {
              Alert.alert('Error', 'Failed to disconnect Cherry Hub membership');
            }
          },
        },
      ]
    );
  };

  // Handle linking CherryHub account
  const handleLinkCherryHub = async () => {
    setLinkingCherryHub(true);
    try {
      const result = await api.cherryHubRegister(false);
      if (result.status === 'success' || result.status === 'already_registered') {
        setCherryHubStatus({ registered: true, member_key: result.member_key });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (result.status === 'success') {
          Alert.alert('Account Created!', 'Your CherryHub membership has been created and linked.');
        } else {
          Alert.alert('Linked!', 'Your existing CherryHub account has been linked.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to link CherryHub account');
    }
    setLinkingCherryHub(false);
  };

  const handleGetQR = async () => {
    // Check if user is connected to CherryHub
    if (!cherryHubStatus.registered) {
      Alert.alert(
        'Connect CherryHub',
        'You need to activate your Cherry Hub membership to get your digital pass.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Activate Now', 
            onPress: async () => {
              try {
                const result = await api.cherryHubRegister(false);
                if (result.status === 'success' || result.status === 'already_registered') {
                  setCherryHubStatus({registered: true, member_key: result.member_key});
                  // Now show the pass
                  setShowQRPass(true);
                }
              } catch (e: any) {
                Alert.alert('Error', e.message || 'Failed to activate Cherry Hub membership');
              }
            }
          }
        ]
      );
      return;
    }
    setShowQRPass(true);
  };

  const handleAddToWallet = async () => {
    if (!cherryHubStatus.registered) {
      Alert.alert('Error', 'Please activate your Cherry Hub membership first');
      return;
    }
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    
    try {
      setWalletPassLoading(true);
      const result = await api.cherryHubGetWalletPass(platform);
      
      if (platform === 'ios' && result.pass_content_base64) {
        Alert.alert(
          'Apple Wallet',
          'Your Cherry Hub membership pass is ready to be added to Apple Wallet.',
          [{ text: 'OK' }]
        );
      } else if (result.google_wallet_url) {
        const canOpen = await Linking.canOpenURL(result.google_wallet_url);
        if (canOpen) {
          await Linking.openURL(result.google_wallet_url);
        } else {
          Alert.alert(
            'Google Wallet',
            'Please install Google Wallet to add your Cherry Hub membership card.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to get wallet pass');
    } finally {
      setWalletPassLoading(false);
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

  // Safe tier config - always defaults to bronze if user or tier is missing
  const userTier = user?.tier?.toLowerCase();
  const tierConfig = (userTier && TIER_CONFIG[userTier]) ? TIER_CONFIG[userTier] : TIER_CONFIG.bronze;
  // Use CherryHub points if available, otherwise fall back to local points
  const currentPoints = pointsData?.points_balance || user?.points_balance || user?.points || 0;
  const progressToNext = tierConfig ? Math.min((currentPoints / tierConfig.pointsNeeded) * 100, 100) : 0;

  const quickActions = [
    {
      id: 'membership',
      icon: 'card',
      title: 'Membership Card',
      subtitle: 'Digital ID',
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
      id: 'wallet',
      icon: 'wallet',
      title: 'Wallet',
      subtitle: 'Tickets & Rewards',
      color: colors.gold,
      onPress: () => router.push('/(tabs)/wallet'),
    },
    {
      id: 'social',
      icon: 'chatbubbles',
      title: 'Social Feed',
      subtitle: 'Friend activity',
      color: '#00A3FF',
      onPress: () => router.push('/social'),
    },
    {
      id: 'rewards',
      icon: 'star',
      title: 'Rewards',
      subtitle: 'Earn & redeem',
      color: '#8B00FF',
      onPress: () => router.push('/rewards-shop'),
    },
    {
      id: 'auctions',
      icon: 'trophy',
      title: 'Auctions',
      subtitle: 'Bid on VIP',
      color: colors.gold,
      onPress: () => router.push('/auctions'),
    },
    {
      id: 'lost_found',
      icon: 'cube',
      title: 'Lost & Found',
      subtitle: 'Report items',
      color: '#4ECDC4',
      onPress: () => router.push('/lost-found'),
    },
    {
      id: 'refer',
      icon: 'gift',
      title: 'Refer Friends',
      subtitle: 'Earn 100 pts',
      color: '#00D4AA',
      onPress: () => router.push('/refer-friend'),
    },
    {
      id: 'birthday',
      icon: 'balloon',
      title: 'Birthday Club',
      subtitle: 'Special rewards',
      color: '#FF6B9D',
      onPress: () => router.push('/birthday-club'),
    },
    {
      id: 'safety',
      icon: 'shield-checkmark',
      title: 'Safety',
      subtitle: 'Emergency alert',
      color: '#E31837',
      onPress: () => router.push('/safety'),
    },
  ];

  const settingsItems = [
    { id: 'edit-profile', icon: 'person', title: 'Edit Profile', route: '/edit-profile' },
    { id: 'settings', icon: 'settings', title: 'Settings', route: '/settings' },
    { id: 'notifications', icon: 'notifications', title: 'Notifications', route: '/notification-settings' },
    { id: 'payment', icon: 'card', title: 'Payment Methods', route: '/payment-methods' },
    { id: 'safety-settings', icon: 'shield', title: 'Safety Settings', route: '/safety-settings' },
    { id: 'help', icon: 'help-circle', title: 'Help & Support', route: '/help-support' },
    { id: 'about', icon: 'information-circle', title: 'About Luna Group', route: '/about' },
  ];

  // Show loading state if user is not yet loaded
  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
      
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header - Same style as Home */}
        <PageHeader 
          title="PROFILE" 
          description={`Welcome back, ${formatName(user?.name)}`}
          showPoints={false}
        />

        {/* Earned Badges */}
        <View style={styles.badgesSection}>
          <View style={styles.badgeHeader}>
            <Text style={styles.sectionTitle}>EARNED BADGES</Text>
            <TouchableOpacity onPress={() => router.push('/rewards-shop')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll}>
            {[
              { id: 'b1', emoji: '🌟', title: 'First Visit', earned: true },
              { id: 'b2', emoji: '🎉', title: 'Party Starter', earned: true },
              { id: 'b3', emoji: '👑', title: 'VIP', earned: currentPoints >= 500 },
              { id: 'b4', emoji: '⭐', title: 'Rising Star', earned: currentPoints >= 250 },
              { id: 'b5', emoji: '🏆', title: 'Legend', earned: currentPoints >= 5000 },
              { id: 'b6', emoji: '🔥', title: 'On Fire', earned: stats?.current_streak >= 3 },
              { id: 'b7', emoji: '👑', title: 'Promo King', earned: stats?.referral_count >= 10 },
              { id: 'b8', emoji: '👸', title: 'Promo Queen', earned: stats?.referral_count >= 10 },
              { id: 'b9', emoji: '📣', title: 'Ambassador', earned: stats?.referral_count >= 20 },
              { id: 'b10', emoji: '⭐', title: 'Review Star', earned: stats?.reviews_count >= 5 },
              { id: 'b11', emoji: '📸', title: 'Influencer', earned: stats?.instagram_tags >= 20 },
            ].map((badge) => (
              <View key={badge.id} style={[styles.badgeItem, !badge.earned && styles.badgeItemLocked]}>
                <View style={[styles.badgeEmoji, !badge.earned && styles.badgeEmojiLocked]}>
                  <Text style={styles.badgeEmojiText}>{badge.earned ? badge.emoji : '🔒'}</Text>
                </View>
                <Text style={[styles.badgeTitle, !badge.earned && styles.badgeTitleLocked]}>{badge.title}</Text>
              </View>
            ))}
          </ScrollView>
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

        {/* Compact Points & Membership Card */}
        <View style={styles.section}>
          <SectionTitle 
            title="Rewards & Membership" 
            icon="star"
            iconColor={colors.gold}
          />
          
          {/* Compact Points Card */}
          <View style={styles.compactPointsCard}>
            <LinearGradient
              colors={[colors.glass, 'rgba(212, 175, 55, 0.08)']}
              style={styles.compactPointsGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.compactPointsLeft}>
                <View style={styles.compactPointsIconWrap}>
                  <GoldStarIcon size={20} />
                </View>
                <View>
                  <Text style={styles.compactPointsLabel}>LUNA POINTS</Text>
                  <Text style={styles.compactPointsValue}>
                    {(pointsData?.points_balance || user?.points_balance || user?.points || 0).toLocaleString()}
                  </Text>
                </View>
              </View>
              <View style={styles.compactPointsRight}>
                <View style={styles.compactTierBadge}>
                  <Ionicons 
                    name={TIER_CONFIG[pointsData?.tier_id || user?.tier || 'bronze']?.icon as any} 
                    size={14} 
                    color={TIER_CONFIG[pointsData?.tier_id || user?.tier || 'bronze']?.color} 
                  />
                  <Text style={[styles.compactTierText, { color: TIER_CONFIG[pointsData?.tier_id || user?.tier || 'bronze']?.color }]}>
                    {(pointsData?.tier_name || user?.tier || 'bronze').toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.compactRedeemBtn}
                  onPress={() => router.push('/wallet')}
                >
                  <Text style={styles.compactRedeemText}>Redeem</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.gold} />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
          
          {/* CherryHub Status */}
          {cherryHubStatus.registered ? (
            <View style={styles.cherryHubConnected}>
              <View style={styles.cherryHubConnectedLeft}>
                <View style={styles.cherryHubStatusDot} />
                <View>
                  <Text style={styles.cherryHubConnectedTitle}>CherryHub Linked</Text>
                  <Text style={styles.cherryHubConnectedSub}>Member #{cherryHubStatus.member_key?.slice(-8)}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.cherryHubDisconnectBtn}
                onPress={handleCherryHubLogout}
              >
                <Ionicons name="unlink" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.linkCherryHubBtn}
              onPress={handleLinkCherryHub}
              disabled={linkingCherryHub}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.accentDim, 'rgba(37, 99, 235, 0.15)']}
                style={styles.linkCherryHubGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {linkingCherryHub ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <>
                    <Ionicons name="link" size={18} color={colors.accent} />
                    <Text style={styles.linkCherryHubText}>Link CherryHub Account</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {/* Subscription/Upgrade Button */}
          <TouchableOpacity 
            style={styles.upgradeBtn}
            onPress={() => router.push('/subscriptions')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.gold + '20', colors.gold + '10']}
              style={styles.upgradeBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="diamond" size={16} color={colors.gold} />
              <Text style={styles.upgradeBtnText}>
                {subscriptionData?.is_subscribed ? 'Manage Subscription' : 'Upgrade Membership'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.gold} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <SectionTitle 
            title="Quick Actions" 
            icon="flash"
            iconColor={colors.accent}
          />
          
          {/* Primary CTAs - Full width */}
          <View style={styles.primaryCtaRow}>
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={handleGetQR}
              activeOpacity={0.85}
              data-testid="membership-card-cta"
            >
              <LinearGradient
                colors={[colors.accent, colors.accentDark]}
                style={styles.primaryCtaGradient}
              >
                <View style={styles.primaryCtaIcon}>
                  <Ionicons name="card" size={24} color={colors.textPrimary} />
                </View>
                <View style={styles.primaryCtaText}>
                  <Text style={styles.primaryCtaTitle}>Membership Card</Text>
                  <Text style={styles.primaryCtaSubtitle}>Digital ID</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* 3-Column Grid for secondary actions */}
          <View style={styles.actionsGrid3Col}>
            {quickActions.filter(item => !['membership'].includes(item.id)).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.actionCard3Col}
                onPress={item.onPress}
                activeOpacity={0.7}
                data-testid={`quick-action-${item.id}`}
              >
                <View style={[styles.actionIcon3Col, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <Text style={styles.actionTitle3Col} numberOfLines={1}>{item.title}</Text>
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
                  if (item.route) {
                    router.push(item.route as any);
                  }
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
          <Text style={styles.footerText}>Luna Group Hospitality App</Text>
          <Text style={styles.footerSubtext}>made by Simple Dev</Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* CherryHub Digital Pass Modal */}
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
                <Text style={styles.modalTitle}>Digital Pass</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowQRPass(false)}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.qrSection}>
                {cherryHubStatus.registered ? (
                  <>
                    {/* Member Card Display */}
                    <View style={styles.digitalPassCard}>
                      <LinearGradient
                        colors={['rgba(212, 175, 55, 0.3)', 'rgba(212, 175, 55, 0.1)']}
                        style={styles.passGradient}
                      >
                        <View style={styles.passHeader}>
                          <Ionicons name="checkmark-circle" size={24} color={colors.gold} />
                          <Text style={styles.passTitle}>LUNA GROUP MEMBER</Text>
                        </View>
                        <Text style={styles.passMemberKey}>#{cherryHubStatus.member_key}</Text>
                        <Text style={styles.passName}>{user?.name || 'Member'}</Text>
                      </LinearGradient>
                    </View>
                    
                    <Text style={styles.qrHelp}>Add to your digital wallet for easy access</Text>
                    
                    {/* Add to Wallet Button */}
                    <TouchableOpacity
                      style={styles.walletPassButton}
                      onPress={handleAddToWallet}
                      disabled={walletPassLoading}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={[colors.gold, '#B8960D']}
                        style={styles.walletPassGradient}
                      >
                        {walletPassLoading ? (
                          <Text style={styles.walletPassText}>Loading...</Text>
                        ) : (
                          <>
                            <Ionicons name="wallet" size={20} color={colors.background} />
                            <Text style={styles.walletPassText}>
                              {Platform.OS === 'ios' ? 'Add to Apple Wallet' : 'Add to Google Wallet'}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.notConnectedContainer}>
                      <Ionicons name="card-outline" size={80} color={colors.textMuted} />
                      <Text style={styles.notConnectedTitle}>No Pass Connected</Text>
                      <Text style={styles.notConnectedSubtitle}>
                        Activate your Cherry Hub membership to get your digital pass
                      </Text>
                    </View>
                  </>
                )}
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
    backgroundColor: colors.bg,
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
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: spacing.md,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
    letterSpacing: 0.5,
  },
  tierCard: {
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 0.5,
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
    height: 2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 2,
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
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 1,
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
    borderRadius: radius.pill,
    gap: 4,
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tierStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  tierStat: {
    alignItems: 'center',
  },
  tierStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  tierStatLabel: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
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
    borderRadius: radius.lg,
    gap: spacing.xs,
    borderWidth: 0.5,
  },
  tierUpgradeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  // Rewards card styles (same as wallet)
  rewardsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  rewardsGradient: {
    padding: spacing.lg,
    position: 'relative',
  },
  accentBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 2,
  },
  rewardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pointsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pointsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  rewardsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rewardsStat: {
    alignItems: 'center',
  },
  rewardsStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  rewardsStatLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rewardsDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
    borderWidth: 1,
  },
  upgradeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  // Membership Card Section
  membershipSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  membershipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cherryHubLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cherryHubLogoutText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  // Tier Perks Section
  tierPerksSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  perksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  perkCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  perkCardInactive: {
    opacity: 0.5,
  },
  perkLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  perkLabelInactive: {
    color: colors.textMuted,
  },
  // Badges Section
  badgesSection: {
    marginBottom: spacing.lg,
  },
  badgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  viewAllText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  badgesScroll: {
    paddingLeft: spacing.lg,
  },
  badgeItem: {
    alignItems: 'center',
    marginRight: spacing.md,
    width: 70,
  },
  badgeItemLocked: {
    opacity: 0.4,
  },
  badgeEmoji: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badgeEmojiLocked: {
    backgroundColor: colors.border,
  },
  badgeEmojiText: {
    fontSize: 28,
  },
  badgeTitle: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  badgeTitleLocked: {
    color: colors.textMuted,
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
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
    textAlign: 'center',
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
  // Primary CTAs
  primaryCtaRow: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  primaryCta: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  primaryCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingVertical: spacing.lg,
  },
  primaryCtaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  primaryCtaText: {
    flex: 1,
  },
  primaryCtaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  primaryCtaSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  // 3-Column Grid
  actionsGrid3Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-start',
  },
  actionCard3Col: {
    width: (width - spacing.lg * 2 - spacing.sm * 2) / 3,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon3Col: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  actionTitle3Col: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
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
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
    marginBottom: 2,
  },
  footerSubtext: {
    fontSize: 11,
    color: colors.textTertiary,
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
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  qrExpiry: {
    fontSize: 12,
    color: colors.textMuted,
  },
  // Digital Pass Styles
  digitalPassCard: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  passGradient: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  passHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  passTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 2,
  },
  passMemberKey: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  passName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  walletPassButton: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  walletPassGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  walletPassText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.background,
  },
  notConnectedContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  notConnectedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  notConnectedSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
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
  // Compact Points Card Styles
  compactPointsCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gold + '30',
  },
  compactPointsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  compactPointsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactPointsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactPointsLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gold,
    letterSpacing: 1,
  },
  compactPointsValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  compactPointsRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  compactTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactTierText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  compactRedeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  compactRedeemText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gold,
  },
  // CherryHub Status Styles
  cherryHubConnected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.glass,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cherryHubConnectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cherryHubStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  cherryHubConnectedTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cherryHubConnectedSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  cherryHubDisconnectBtn: {
    padding: spacing.xs,
  },
  linkCherryHubBtn: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  linkCherryHubGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  linkCherryHubText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  // Upgrade Button Styles
  upgradeBtn: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gold + '30',
  },
  upgradeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  upgradeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gold,
  },
});
