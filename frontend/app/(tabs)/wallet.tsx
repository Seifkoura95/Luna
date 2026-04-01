import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { useDataStore } from '../../src/store/dataStore';
import { api, apiFetch } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppBackground } from '../../src/components/AppBackground';
import { PageHeader } from '../../src/components/PageHeader';
import { CardSkeleton, ListSkeleton } from '../../src/components/Shimmer';
import { FierySun } from '../../src/components/FierySun';
import { GoldStarIcon } from '../../src/components/GoldStarIcon';
import { MembershipCard } from '../../src/components/MembershipCard';
import { useRouter, useFocusEffect } from 'expo-router';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');

type TabType = 'active' | 'upcoming' | 'history';

// Mock tickets data for demonstration
const MOCK_TICKETS = {
  active: [
    {
      id: 'TKT-ECLIPSE-001',
      event_title: 'Saturday Night Takeover',
      venue_name: 'Eclipse',
      event_date: new Date().toISOString(),
      ticket_type: 'VIP',
      qr_code: 'TKT-ECLIPSE-001-DEMO',
      status: 'active',
      guests: [
        { id: 'g1', name: 'Sarah Johnson', email: 'sarah@email.com' },
        { id: 'g2', name: 'Mike Chen', email: 'mike@email.com' },
      ],
    },
    {
      id: 'TKT-AFTERDARK-002',
      event_title: 'R&B & Hip-Hop Fridays',
      venue_name: 'After Dark',
      event_date: new Date().toISOString(),
      ticket_type: 'GENERAL',
      qr_code: 'TKT-AFTERDARK-002-DEMO',
      status: 'active',
      guests: [],
    },
  ],
  upcoming: [
    {
      id: 'TKT-ECLIPSE-003',
      event_title: 'BLACK:CELL ft. BIIANCO',
      venue_name: 'Eclipse',
      event_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      ticket_type: 'VIP',
      qr_code: 'TKT-ECLIPSE-003-DEMO',
      status: 'active',
      guests: [
        { id: 'g3', name: 'Alex Rivera', email: 'alex@email.com' },
      ],
    },
    {
      id: 'TKT-JUJU-004',
      event_title: 'Sundown Social',
      venue_name: 'Juju Mermaid Beach',
      event_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      ticket_type: 'BOOTH',
      qr_code: 'TKT-JUJU-004-DEMO',
      status: 'active',
      guests: [
        { id: 'g4', name: 'Emma Wilson', email: 'emma@email.com' },
        { id: 'g5', name: 'James Park', email: 'james@email.com' },
        { id: 'g6', name: 'Olivia Brown', email: 'olivia@email.com' },
      ],
    },
    {
      id: 'TKT-SUCASA-005',
      event_title: 'Rooftop Fridays',
      venue_name: 'Su Casa Brisbane',
      event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ticket_type: 'GENERAL',
      qr_code: 'TKT-SUCASA-005-DEMO',
      status: 'active',
      guests: [],
    },
  ],
  history: [
    {
      id: 'TKT-ECLIPSE-OLD1',
      event_title: 'New Years Eve Bash',
      venue_name: 'Eclipse',
      event_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      ticket_type: 'VIP',
      qr_code: 'TKT-ECLIPSE-OLD1-DEMO',
      status: 'used',
      guests: [
        { id: 'g7', name: 'Chris Taylor', email: 'chris@email.com' },
      ],
    },
    {
      id: 'TKT-AFTERDARK-OLD2',
      event_title: 'Afrobeats Saturdays',
      venue_name: 'After Dark',
      event_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      ticket_type: 'GENERAL',
      qr_code: 'TKT-AFTERDARK-OLD2-DEMO',
      status: 'used',
      guests: [],
    },
  ],
};

export default function WalletScreen() {
  const user = useAuthStore((state) => state.user);
  const { isWalletCacheValid, getWalletData, setWalletData } = useDataStore();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [tickets, setTickets] = useState<any>({ active: [], upcoming: [], history: [] });
  const [events, setEvents] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  
  // Points & Subscription state
  const [pointsData, setPointsData] = useState<any>(null);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  // CherryHub state
  const [cherryHubStatus, setCherryHubStatus] = useState<{registered: boolean, member_key: string | null}>({registered: false, member_key: null});
  const [cherryHubPoints, setCherryHubPoints] = useState<number>(0);
  const [walletPassLoading, setWalletPassLoading] = useState(false);
  const [linkingCherryHub, setLinkingCherryHub] = useState(false);
  // Leaderboard state
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  // Rewards state
  const [rewards, setRewards] = useState<any[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(true);

  // Auto scroll to top when tab gains focus
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Check cache first (skip API calls if data is still valid)
    if (!forceRefresh && isWalletCacheValid()) {
      const cached = getWalletData();
      if (cached) {
        setLeaderboardData({ leaders: cached.leaderboard });
        setLeaderboardLoading(false);
        return;
      }
    }
    
    try {
      const [ticketsData, eventsData, pointsRes, subRes, cherryStatus] = await Promise.all([
        api.getTickets().catch(() => null),
        api.getEvents(),
        api.getPointsBalance().catch(() => null),
        api.getMySubscription().catch(() => null),
        api.cherryHubStatus().catch(() => ({registered: false, member_key: null})),
      ]);
      // Merge mock data with API data for demonstration
      if (ticketsData && (ticketsData.active?.length > 0 || ticketsData.upcoming?.length > 0 || ticketsData.history?.length > 0)) {
        setTickets(ticketsData);
      } else {
        // Use mock data if no real tickets
        setTickets(MOCK_TICKETS);
      }
      setEvents(eventsData || []);
      setPointsData(pointsRes);
      setSubscriptionData(subRes);
      setCherryHubStatus(cherryStatus);
      
      // Fetch CherryHub points if registered
      if (cherryStatus?.registered) {
        try {
          const chPoints = await api.cherryHubGetPoints();
          setCherryHubPoints(chPoints.points || 0);
        } catch (e) {
          console.log('Failed to fetch CherryHub points');
        }
      }
      
      // Fetch leaderboard data
      let leaderboard: any[] = [];
      try {
        const leaderboardRes = await apiFetch<any>('/api/leaderboard?period=all_time&category=points&limit=10');
        setLeaderboardData(leaderboardRes);
        leaderboard = leaderboardRes?.leaders || [];
      } catch (e) {
        console.log('Failed to fetch leaderboard:', e);
      }
      setLeaderboardLoading(false);
      
      // Fetch rewards
      try {
        const rewardsRes = await api.getRewards();
        setRewards(rewardsRes || []);
      } catch (e) {
        console.log('Failed to fetch rewards:', e);
      }
      setRewardsLoading(false);
      
      // Cache the data
      setWalletData({
        leaderboard,
        missions: [],
        subscriptions: subRes ? [subRes] : [],
        upcomingEvents: eventsData || [],
      });
    } catch (e) {
      console.error('Failed to fetch wallet data:', e);
      // Use mock data on error
      setTickets(MOCK_TICKETS);
      setLeaderboardLoading(false);
      setRewardsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true); // Force refresh bypasses cache
    setRefreshing(false);
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
              setCherryHubStatus({ registered: false, member_key: null });
              setCherryHubPoints(0);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              Alert.alert('Disconnected', 'Your Cherry Hub membership has been disconnected from this app.');
            } catch (e) {
              Alert.alert('Error', 'Failed to disconnect Cherry Hub membership');
            }
          },
        },
      ]
    );
  };

  // Handle adding to digital wallet (Apple/Google)
  const handleAddToWallet = async () => {
    if (!cherryHubStatus.member_key) {
      Alert.alert('Not Connected', 'Please link your CherryHub account first.');
      return;
    }

    setWalletPassLoading(true);
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const result = await api.cherryHubGetWalletPass(platform);
      
      if (Platform.OS === 'ios' && result.pass_data) {
        // For iOS, we'd need to handle the pkpass file
        // This would typically require native modules to add to Apple Wallet
        Alert.alert('Apple Wallet', 'Apple Wallet pass generated! In a production app, this would be automatically added to your Apple Wallet.');
      } else if (result.pass_url) {
        const canOpen = await Linking.canOpenURL(result.pass_url);
        if (canOpen) {
          await Linking.openURL(result.pass_url);
        } else {
          Alert.alert('Error', 'Cannot open Google Wallet on this device');
        }
      } else {
        Alert.alert('Info', 'Wallet pass feature is currently in mock mode. When CherryHub credentials are configured, your digital membership card will be available.');
      }
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to get wallet pass');
    } finally {
      setWalletPassLoading(false);
    }
  };

  // Handle linking CherryHub account
  const handleLinkCherryHub = async () => {
    setLinkingCherryHub(true);
    try {
      const result = await api.cherryHubLink(undefined, true);
      
      if (result.success) {
        setCherryHubStatus({ registered: true, member_key: result.member_key });
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        if (result.new_account) {
          Alert.alert('Account Created!', 'Your CherryHub membership has been created and linked.');
        } else {
          Alert.alert('Linked!', 'Your existing CherryHub account has been linked.');
        }
        
        // Refresh data
        fetchData(true);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to link CherryHub account');
    } finally {
      setLinkingCherryHub(false);
    }
  };

  const formatEventDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      return format(date, 'EEE, MMM d');
    } catch {
      return dateString;
    }
  };

  const handleAddGuest = async () => {
    if (!selectedTicket || !guestName.trim()) {
      Alert.alert('Error', 'Please enter a guest name');
      return;
    }

    try {
      await api.addGuestToTicket(selectedTicket.id, guestName.trim(), guestEmail.trim() || undefined);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Success', `${guestName} has been added to your ticket!`);
      setShowAddGuest(false);
      setGuestName('');
      setGuestEmail('');
      setSelectedTicket(null);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add guest');
    }
  };

  const handleRemoveGuest = async (ticketId: string, guestId: string, guestName: string) => {
    Alert.alert(
      'Remove Guest',
      `Remove ${guestName} from this ticket?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removeGuestFromTicket(ticketId, guestId);
              fetchData();
            } catch (e) {
              Alert.alert('Error', 'Failed to remove guest');
            }
          },
        },
      ]
    );
  };

  const handlePurchaseTicket = async (eventId: string) => {
    try {
      const result = await api.purchaseTicket(eventId, 1, 'general');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Ticket Purchased!', `You earned ${result.points_earned} points!`);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to purchase ticket');
    }
  };

  const currentTickets = tickets[activeTab] || [];

  const renderTicketCard = (ticket: any) => (
    <TouchableOpacity
      key={ticket.id}
      style={styles.ticketCard}
      onPress={() => setSelectedTicket(ticket)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[colors.backgroundCard, colors.backgroundElevated]}
        style={styles.ticketGradient}
      >
        <View style={styles.ticketHeader}>
          <View style={styles.ticketInfo}>
            <Text style={styles.ticketTitle} numberOfLines={1}>{ticket.event_title}</Text>
            <Text style={styles.ticketVenue}>{ticket.venue_name}</Text>
          </View>
          <View style={[
            styles.ticketStatus,
            { backgroundColor: activeTab === 'active' ? colors.success + '20' : activeTab === 'upcoming' ? colors.accent + '20' : colors.textMuted + '20' }
          ]}>
            <Text style={[
              styles.ticketStatusText,
              { color: activeTab === 'active' ? colors.success : activeTab === 'upcoming' ? colors.accent : colors.textMuted }
            ]}>
              {activeTab === 'active' ? 'TONIGHT' : activeTab === 'upcoming' ? 'UPCOMING' : 'PAST'}
            </Text>
          </View>
        </View>

        <View style={styles.ticketDetails}>
          <View style={styles.ticketDetailItem}>
            <Ionicons name="calendar" size={16} color={colors.textSecondary} />
            <Text style={styles.ticketDetailText}>{formatEventDate(ticket.event_date)}</Text>
          </View>
          <View style={styles.ticketDetailItem}>
            <Ionicons name="ticket" size={16} color={colors.textSecondary} />
            <Text style={styles.ticketDetailText}>{ticket.ticket_type?.toUpperCase() || 'GENERAL'}</Text>
          </View>
          {ticket.guests?.length > 0 && (
            <View style={styles.ticketDetailItem}>
              <Ionicons name="people" size={16} color={colors.accent} />
              <Text style={[styles.ticketDetailText, { color: colors.accent }]}>
                +{ticket.guests.length} guests
              </Text>
            </View>
          )}
        </View>

        {/* Tap to view QR hint */}
        <View style={styles.tapHint}>
          <Ionicons name="hand-left-outline" size={14} color={colors.textMuted} />
          <Text style={styles.tapHintText}>Tap to view QR code</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderEventCard = (event: any) => (
    <TouchableOpacity
      key={event.id}
      style={styles.eventCard}
      onPress={() => handlePurchaseTicket(event.id)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: event.image_url }} style={styles.eventImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.95)']}
        style={styles.eventOverlay}
      >
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
          <Text style={styles.eventVenue}>{event.venue_name}</Text>
          <View style={styles.eventMeta}>
            <Text style={styles.eventDate}>{formatEventDate(event.event_date)}</Text>
            <View style={styles.eventPrice}>
              <Text style={styles.eventPriceText}>
                {event.ticket_price > 0 ? `$${event.ticket_price}` : 'FREE'}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

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
        {/* Consistent Header - No Points */}
        <PageHeader 
          title="WALLET" 
          description="Your tickets, passes & rewards"
          showPoints={false} 
        />

        {/* Leaderboard Section - Fun Scoreboard Style */}
        <View style={styles.leaderboardSection}>
          <View style={styles.leaderboardHeader}>
            <View style={styles.leaderboardTitleRow}>
              <Ionicons name="trophy" size={18} color={colors.gold} />
              <Text style={styles.leaderboardTitle}>LEADERBOARD</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/leaderboard')} style={styles.fullRankingsBtn}>
              <Text style={styles.fullRankingsText}>See All</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </TouchableOpacity>
          </View>
          
          {leaderboardLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 20 }} />
          ) : leaderboardData?.leaders?.length > 0 ? (
            <View style={styles.scoreboardContainer}>
              {/* Scoreboard List */}
              {leaderboardData.leaders.slice(0, 5).map((leader: any, index: number) => {
                const isCurrentUser = leader.is_current_user;
                const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32', colors.textMuted, colors.textMuted];
                const rankEmojis = ['👑', '🥈', '🥉', '', ''];
                
                return (
                  <View 
                    key={leader.user_id} 
                    style={[
                      styles.scoreboardRow,
                      isCurrentUser && styles.scoreboardRowHighlight,
                      index === 0 && styles.scoreboardRowFirst
                    ]}
                  >
                    <View style={styles.scoreboardRank}>
                      {index < 3 ? (
                        <Text style={styles.rankEmoji}>{rankEmojis[index]}</Text>
                      ) : (
                        <Text style={[styles.rankNumber, { color: rankColors[index] }]}>#{index + 1}</Text>
                      )}
                    </View>
                    <View style={styles.scoreboardUser}>
                      <Text style={[
                        styles.scoreboardName, 
                        isCurrentUser && styles.scoreboardNameHighlight,
                        index === 0 && { color: '#FFD700' }
                      ]}>
                        {leader.display_name} {isCurrentUser && '(You)'}
                      </Text>
                      {leader.subscription_tier && (
                        <View style={[styles.miniTierBadge, { backgroundColor: index === 0 ? '#FFD700' : colors.accent }]}>
                          <Text style={styles.miniTierText}>{leader.subscription_tier}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.scoreboardPoints}>
                      <Text style={[
                        styles.scoreboardScore,
                        index === 0 && { color: '#FFD700' },
                        isCurrentUser && { color: colors.accent }
                      ]}>
                        {leader.points_balance?.toLocaleString()}
                      </Text>
                      <Text style={styles.scoreboardPts}>pts</Text>
                    </View>
                  </View>
                );
              })}
              
              {/* Your Position Summary if not in top 5 */}
              {!leaderboardData.leaders.slice(0, 5).some((l: any) => l.is_current_user) && leaderboardData.current_user_rank && (
                <View style={styles.yourPositionRow}>
                  <Text style={styles.yourPositionDots}>• • •</Text>
                  <View style={[styles.scoreboardRow, styles.scoreboardRowHighlight]}>
                    <View style={styles.scoreboardRank}>
                      <Text style={[styles.rankNumber, { color: colors.accent }]}>#{leaderboardData.current_user_rank}</Text>
                    </View>
                    <View style={styles.scoreboardUser}>
                      <Text style={[styles.scoreboardName, styles.scoreboardNameHighlight]}>You</Text>
                    </View>
                    <View style={styles.scoreboardPoints}>
                      <Text style={[styles.scoreboardScore, { color: colors.accent }]}>
                        {leaderboardData.current_user_score?.toLocaleString()}
                      </Text>
                      <Text style={styles.scoreboardPts}>pts</Text>
                    </View>
                  </View>
                </View>
              )}
              
              {/* Gap to #1 indicator */}
              {leaderboardData.gap_to_first > 0 ? (
                <View style={styles.gapIndicator}>
                  <Ionicons name="trending-up" size={14} color={colors.gold} />
                  <Text style={styles.gapText}>
                    <Text style={styles.gapValue}>{leaderboardData.gap_to_first.toLocaleString()}</Text> pts to reach #1
                  </Text>
                </View>
              ) : (
                <View style={styles.gapIndicator}>
                  <Text style={styles.championText}>🏆 You're the champion!</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyLeaderboard}>
              <Ionicons name="trophy-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyLeaderboardText}>Loading leaderboard...</Text>
            </View>
          )}
        </View>

        {/* =============== REDEEM REWARDS SECTION =============== */}
        <View style={styles.redeemSection}>
          <View style={styles.redeemHeader}>
            <View style={styles.redeemTitleRow}>
              <Ionicons name="gift" size={18} color={colors.gold} />
              <Text style={styles.redeemTitle}>REDEEM REWARDS</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/rewards')} 
              style={styles.viewAllRewardsBtn}
            >
              <Text style={styles.viewAllRewardsText}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Points Balance Card */}
          <View style={styles.pointsBalanceCard}>
            <LinearGradient
              colors={[colors.glass, 'rgba(212, 175, 55, 0.1)']}
              style={styles.pointsBalanceGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.pointsBalanceLeft}>
                <Text style={styles.pointsBalanceLabel}>YOUR POINTS</Text>
                <Text style={styles.pointsBalanceValue}>
                  {(pointsData?.points_balance || user?.points_balance || 0).toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.redeemNowBtn}
                onPress={() => router.push('/rewards')}
              >
                <LinearGradient
                  colors={[colors.gold, '#B8960D']}
                  style={styles.redeemNowGradient}
                >
                  <Ionicons name="gift-outline" size={16} color={colors.bg} />
                  <Text style={styles.redeemNowText}>Redeem Now</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Featured Rewards */}
          {rewardsLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 20 }} />
          ) : rewards.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rewardsScrollContainer}
            >
              {rewards.slice(0, 5).map((reward: any) => {
                const userPoints = pointsData?.points_balance || user?.points_balance || 0;
                const canAfford = userPoints >= (reward.points_cost || 0);
                
                return (
                  <TouchableOpacity
                    key={reward.id || reward.name}
                    style={[styles.rewardCard, !canAfford && styles.rewardCardDisabled]}
                    onPress={() => router.push('/rewards')}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={canAfford ? [colors.glass, 'rgba(37, 99, 235, 0.1)'] : [colors.glass, 'rgba(100,100,100,0.1)']}
                      style={styles.rewardCardGradient}
                    >
                      <View style={[styles.rewardIconWrap, { backgroundColor: canAfford ? colors.accent + '20' : colors.textMuted + '20' }]}>
                        <Ionicons 
                          name={
                            reward.name?.toLowerCase().includes('cocktail') ? 'wine' :
                            reward.name?.toLowerCase().includes('fast') ? 'flash' :
                            reward.name?.toLowerCase().includes('booth') ? 'people' :
                            reward.name?.toLowerCase().includes('bottle') ? 'beer' :
                            reward.name?.toLowerCase().includes('credit') ? 'card' :
                            reward.name?.toLowerCase().includes('dining') ? 'restaurant' :
                            reward.name?.toLowerCase().includes('merch') ? 'shirt' :
                            'gift'
                          } 
                          size={24} 
                          color={canAfford ? colors.accent : colors.textMuted} 
                        />
                      </View>
                      <Text style={[styles.rewardCardName, !canAfford && styles.rewardCardNameDisabled]} numberOfLines={2}>
                        {reward.name}
                      </Text>
                      <View style={[styles.rewardCostBadge, { backgroundColor: canAfford ? colors.gold + '20' : colors.textMuted + '20' }]}>
                        <Text style={[styles.rewardCostText, { color: canAfford ? colors.gold : colors.textMuted }]}>
                          {reward.points_cost?.toLocaleString()} pts
                        </Text>
                      </View>
                      {canAfford && (
                        <View style={styles.canAffordBadge}>
                          <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyRewards}>
              <Ionicons name="gift-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyRewardsText}>No rewards available</Text>
            </View>
          )}
        </View>

        {/* Active Missions */}
        <View style={styles.missionsSection}>
          <View style={styles.missionHeader}>
            <Text style={styles.sectionTitle}>ACTIVE MISSIONS</Text>
            <TouchableOpacity onPress={() => router.push('/rewards')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {[
            { id: 'm1', title: 'Weekend Warrior', description: 'Visit 3 venues this weekend', progress: 1, total: 3, points: 50, icon: 'location', color: colors.accent },
            { id: 'm2', title: 'First Timer', description: 'Buy your first ticket', progress: 0, total: 1, points: 25, icon: 'ticket', color: '#8B5CF6' },
            { id: 'm3', title: 'Social Butterfly', description: 'Refer 2 friends', progress: 0, total: 2, points: 100, icon: 'people', color: '#00D4AA' },
          ].map((mission) => (
            <View key={mission.id} style={styles.missionCard}>
              <View style={[styles.missionIcon, { backgroundColor: mission.color + '20' }]}>
                <Ionicons name={mission.icon as any} size={20} color={mission.color} />
              </View>
              <View style={styles.missionContent}>
                <Text style={styles.missionTitle}>{mission.title}</Text>
                <Text style={styles.missionDescription}>{mission.description}</Text>
                <View style={styles.missionProgress}>
                  <View style={styles.missionProgressBar}>
                    <View style={[styles.missionProgressFill, { width: `${(mission.progress / mission.total) * 100}%`, backgroundColor: mission.color }]} />
                  </View>
                  <Text style={styles.missionProgressText}>{mission.progress}/{mission.total}</Text>
                </View>
              </View>
              <View style={[styles.missionPoints, { backgroundColor: mission.color + '20' }]}>
                <Text style={[styles.missionPointsText, { color: mission.color }]}>+{mission.points}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          {(['active', 'upcoming', 'history'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => {
                setActiveTab(tab);
                if (Platform.OS !== 'web') Haptics.selectionAsync();
              }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'active' ? 'TONIGHT' : tab === 'upcoming' ? 'UPCOMING' : 'HISTORY'}
              </Text>
              {tickets[tab]?.length > 0 && (
                <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>
                    {tickets[tab].length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tickets List */}
        <View style={styles.section}>
          {currentTickets.length > 0 ? (
            currentTickets.map(renderTicketCard)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons 
                name={activeTab === 'active' ? 'moon' : activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'} 
                size={48} 
                color={colors.textMuted} 
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'active' 
                  ? 'No tickets for tonight' 
                  : activeTab === 'upcoming' 
                    ? 'No upcoming tickets' 
                    : 'No past tickets'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Browse events below to get tickets
              </Text>
            </View>
          )}
        </View>

        {/* Upcoming Events Section */}
        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>UPCOMING EVENTS</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.eventsContainer}
            >
              {events.slice(0, 6).map(renderEventCard)}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Ticket Detail Modal */}
      <Modal
        visible={!!selectedTicket}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTicket(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ticket Details</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedTicket(null)}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {selectedTicket && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Event Info */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalEventTitle}>{selectedTicket.event_title}</Text>
                    <Text style={styles.modalEventVenue}>{selectedTicket.venue_name}</Text>
                    <View style={styles.modalDetailRow}>
                      <Ionicons name="calendar" size={18} color={colors.accent} />
                      <Text style={styles.modalDetailText}>{formatEventDate(selectedTicket.event_date)}</Text>
                    </View>
                  </View>

                  {/* QR Code */}
                  <View style={styles.modalQRSection}>
                    <View style={styles.modalQRCode}>
                      {Platform.OS === 'web' ? (
                        <Ionicons name="qr-code" size={120} color={colors.textPrimary} />
                      ) : (
                        <QRCode
                          value={selectedTicket.qr_code || 'LUNA-TICKET'}
                          size={140}
                          backgroundColor="white"
                          color="black"
                        />
                      )}
                    </View>
                    <Text style={styles.modalQRId}>{selectedTicket.qr_code}</Text>
                    <Text style={styles.modalQRHelp}>Show this QR code at the entrance</Text>
                  </View>

                  {/* Guests */}
                  <View style={styles.modalSection}>
                    <View style={styles.guestHeader}>
                      <Text style={styles.guestTitle}>Guests</Text>
                      <TouchableOpacity
                        style={styles.addGuestButton}
                        onPress={() => setShowAddGuest(true)}
                      >
                        <Ionicons name="add" size={18} color={colors.accent} />
                        <Text style={styles.addGuestText}>Add Guest</Text>
                      </TouchableOpacity>
                    </View>

                    {selectedTicket.guests?.length > 0 ? (
                      selectedTicket.guests.map((guest: any) => (
                        <View key={guest.id} style={styles.guestItem}>
                          <View style={styles.guestInfo}>
                            <Ionicons name="person" size={18} color={colors.textSecondary} />
                            <Text style={styles.guestName}>{guest.name}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRemoveGuest(selectedTicket.id, guest.id, guest.name)}
                          >
                            <Ionicons name="close-circle" size={22} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noGuests}>No guests added yet</Text>
                    )}
                  </View>
                </ScrollView>
              )}
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Add Guest Modal */}
      <Modal
        visible={showAddGuest}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddGuest(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.addGuestModal]}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              <Text style={styles.modalTitle}>Add Guest</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>GUEST NAME *</Text>
                <TextInput
                  style={styles.input}
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="Enter guest name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>GUEST EMAIL (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={guestEmail}
                  onChangeText={setGuestEmail}
                  placeholder="Enter email for ticket copy"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowAddGuest(false);
                    setGuestName('');
                    setGuestEmail('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleAddGuest}
                >
                  <LinearGradient
                    colors={[colors.accent, colors.accentDark]}
                    style={styles.confirmButtonGradient}
                  >
                    <Text style={styles.confirmButtonText}>Add Guest</Text>
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
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
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
    color: colors.text,
    letterSpacing: 1,
  },
  pointsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
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
  rewardsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
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
  rewardsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: 6,
    borderWidth: 1,
  },
  rewardsButtonText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
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
  missionsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
  },
  seeAllText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.md,
  },
  missionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionContent: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  missionDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  missionProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  missionProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  missionProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  missionProgressText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  missionPoints: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  missionPointsText: {
    fontSize: 12,
    fontWeight: '800',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundCard,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  tabTextActive: {
    color: colors.accent,
  },
  tabBadge: {
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tabBadgeActive: {
    backgroundColor: colors.accent,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tabBadgeTextActive: {
    color: colors.textPrimary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  ticketCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ticketGradient: {
    padding: spacing.md,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  ticketInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  ticketTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  ticketVenue: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  ticketStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  ticketStatusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ticketDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  ticketDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketDetailText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  tapHintText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  eventsContainer: {
    gap: spacing.md,
  },
  eventCard: {
    width: 200,
    height: 240,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  eventOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  eventContent: {},
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  eventVenue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  eventMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  eventPrice: {
    backgroundColor: colors.accent + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  eventPriceText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '90%',
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
  modalSection: {
    marginBottom: spacing.lg,
  },
  modalEventTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalEventVenue: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalDetailText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  modalQRSection: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  modalQRCode: {
    backgroundColor: colors.textPrimary,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  modalQRId: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  modalQRHelp: {
    fontSize: 12,
    color: colors.textMuted,
  },
  guestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  guestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addGuestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addGuestText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  guestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  guestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  guestName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  noGuests: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  addGuestModal: {
    maxHeight: '50%',
  },
  inputContainer: {
    marginBottom: spacing.lg,
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
    marginTop: spacing.md,
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
  // Leaderboard styles
  leaderboardSection: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  leaderboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  leaderboardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  leaderboardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  fullRankingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  fullRankingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  scoreboardContainer: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    maxWidth: 380,
    alignSelf: 'center',
    width: '100%',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scoreboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  scoreboardRowFirst: {
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  scoreboardRowHighlight: {
    backgroundColor: colors.accent + '15',
  },
  scoreboardRank: {
    width: 36,
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: 18,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  scoreboardUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  scoreboardName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scoreboardNameHighlight: {
    color: colors.accent,
    fontWeight: '700',
  },
  miniTierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  miniTierText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#000',
    textTransform: 'uppercase',
  },
  scoreboardPoints: {
    alignItems: 'flex-end',
  },
  scoreboardScore: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  scoreboardPts: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  yourPositionRow: {
    alignItems: 'center',
  },
  yourPositionDots: {
    fontSize: 12,
    color: colors.textMuted,
    paddingVertical: spacing.xs,
  },
  gapIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  gapText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  gapValue: {
    fontWeight: '700',
    color: colors.gold,
  },
  championText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold,
  },
  emptyLeaderboard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: radius.lg,
  },
  emptyLeaderboardText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  // Wallet button styles
  walletButtonsContainer: {
    marginTop: spacing.md,
  },
  walletPassButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  linkCherryHubButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  walletPassGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  walletPassText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // =============== REDEEM REWARDS STYLES ===============
  redeemSection: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  redeemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  redeemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  redeemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  viewAllRewardsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllRewardsText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  pointsBalanceCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pointsBalanceGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  pointsBalanceLeft: {
    flex: 1,
  },
  pointsBalanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  pointsBalanceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.gold,
  },
  redeemNowBtn: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  redeemNowGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  redeemNowText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.bg,
  },
  rewardsScrollContainer: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  rewardCard: {
    width: 140,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  rewardCardDisabled: {
    opacity: 0.6,
  },
  rewardCardGradient: {
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'space-between',
  },
  rewardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  rewardCardName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  rewardCardNameDisabled: {
    color: colors.textMuted,
  },
  rewardCostBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  rewardCostText: {
    fontSize: 11,
    fontWeight: '700',
  },
  canAffordBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  emptyRewards: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: radius.lg,
  },
  emptyRewardsText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
