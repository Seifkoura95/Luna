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
import { Icon } from '../../src/components/Icon';
import * as Haptics from 'expo-haptics';
import { AppBackground } from '../../src/components/AppBackground';
import { PageHeader } from '../../src/components/PageHeader';
import { CardSkeleton, ListSkeleton } from '../../src/components/Shimmer';
import { FierySun } from '../../src/components/FierySun';
import { LunaIcon } from '../../src/components/LunaIcons';
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
  // Leaderboard state
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  // Rewards state
  const [rewards, setRewards] = useState<any[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  // Live missions from API
  const [liveMissions, setLiveMissions] = useState<any[]>([]);
  // Entry tickets (gifted free entries + future milestone QR tickets)
  const [entryTickets, setEntryTickets] = useState<any[]>([]);
  const [entryTicketsLoading, setEntryTicketsLoading] = useState(true);

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
      const [ticketsData, eventsData, pointsRes, subRes, entryRes] = await Promise.all([
        api.getTickets().catch(() => null),
        api.getEvents(),
        api.getPointsBalance().catch(() => null),
        api.getMySubscription().catch(() => null),
        api.getMyEntryTickets().catch(() => null),
      ]);
      // Show only active + scheduled in the wallet preview (user wants actionable tickets)
      const visible = (entryRes?.tickets || []).filter((t: any) =>
        t.live_status === 'active' || t.live_status === 'scheduled'
      );
      setEntryTickets(visible);
      setEntryTicketsLoading(false);
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

      // Fetch live missions from admin dashboard
      try {
        const missionsRes = await apiFetch<any[]>('/api/missions');
        setLiveMissions(missionsRes || []);
      } catch (e) {
        console.log('Failed to fetch missions:', e);
      }
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

  // Apple/Google Wallet integration — handled by loyalty.member-card endpoint (not yet wired)
  const handleAddToWallet = async () => {
    Alert.alert(
      'Coming Soon',
      'Adding your Luna Pass to Apple/Google Wallet will be available in the next update.'
    );
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
            <Icon name="calendar" size={16} color={colors.textSecondary} />
            <Text style={styles.ticketDetailText}>{formatEventDate(ticket.event_date)}</Text>
          </View>
          <View style={styles.ticketDetailItem}>
            <Icon name="ticket" size={16} color={colors.textSecondary} />
            <Text style={styles.ticketDetailText}>{ticket.ticket_type?.toUpperCase() || 'GENERAL'}</Text>
          </View>
          {ticket.guests?.length > 0 && (
            <View style={styles.ticketDetailItem}>
              <Icon name="people" size={16} color={colors.accent} />
              <Text style={[styles.ticketDetailText, { color: colors.accent }]}>
                +{ticket.guests.length} guests
              </Text>
            </View>
          )}
        </View>

        {/* Tap to view QR hint */}
        <View style={styles.tapHint}>
          <Icon name="hand-left-outline" size={14} color={colors.textMuted} />
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
              <Icon name="trophy" size={18} color={colors.gold} />
              <Text style={styles.leaderboardTitle}>LEADERBOARD</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/leaderboard')} style={styles.fullRankingsBtn}>
              <Text style={styles.fullRankingsText}>See All</Text>
              <Icon name="chevron-forward" size={14} color={colors.accent} />
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
                const rankIcons: Array<{name: string; color: string} | null> = [
                  { name: 'crown', color: '#FFD700' },
                  { name: 'silver', color: '#C0C0C0' },
                  { name: 'bronze', color: '#CD7F32' },
                  null, null
                ];
                
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
                      {index < 3 && rankIcons[index] ? (
                        <LunaIcon name={rankIcons[index]!.name as any} size={20} color={rankIcons[index]!.color} />
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
                  <Icon name="trending-up" size={14} color={colors.gold} />
                  <Text style={styles.gapText}>
                    <Text style={styles.gapValue}>{leaderboardData.gap_to_first.toLocaleString()}</Text> pts to reach #1
                  </Text>
                </View>
              ) : (
                <View style={styles.gapIndicator}>
                  <View style={styles.championRow}>
                    <LunaIcon name="leaderboard" size={16} color={colors.gold} />
                    <Text style={styles.championText}> You're the champion!</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyLeaderboard}>
              <Icon name="trophy-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyLeaderboardText}>Loading leaderboard...</Text>
            </View>
          )}
        </View>

        {/* =============== REDEEM REWARDS SECTION =============== */}
        <View style={styles.redeemSection}>
          <View style={styles.redeemHeader}>
            <View style={styles.redeemTitleRow}>
              <Icon name="gift" size={18} color={colors.gold} />
              <Text style={styles.redeemTitle}>REDEEM REWARDS</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/rewards-shop')} 
              style={styles.viewAllRewardsBtn}
            >
              <Text style={styles.viewAllRewardsText}>View All</Text>
              <Icon name="chevron-forward" size={14} color={colors.accent} />
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
                onPress={() => router.push('/how-points-work')}
                data-testid="wallet-how-points-btn"
              >
                <LinearGradient
                  colors={[colors.gold, '#B8960D']}
                  style={styles.redeemNowGradient}
                >
                  <Icon name="information-circle-outline" size={16} color={colors.bg} />
                  <Text style={styles.redeemNowText}>How Points Work</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Featured Rewards */}
          {rewardsLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <TouchableOpacity style={styles.viewAllRewardsFullBtn} onPress={() => router.push('/claim-reward')}>
                <Icon name="ticket" size={20} color={colors.gold} />
                <Text style={styles.viewAllRewardsFullText}>Claim a Reward</Text>
                <Icon name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewAllRewardsFullBtn}
                onPress={() => router.push('/my-entry-tickets')}
                data-testid="wallet-free-entries-btn"
              >
                <Icon name="sparkles" size={20} color={colors.gold} />
                <Text style={styles.viewAllRewardsFullText}>My Free Entries</Text>
                <Icon name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* My QR Tickets — gifted free entries + milestone reward tickets */}
        <View style={styles.ticketsSection}>
          <View style={styles.ticketsSectionHeader}>
            <Icon name="qr-code-outline" size={18} color={colors.gold} />
            <Text style={styles.redeemTitle}>MY QR TICKETS</Text>
            <TouchableOpacity
              onPress={() => router.push('/my-entry-tickets')}
              style={{ marginLeft: 'auto' }}
              data-testid="wallet-qr-tickets-see-all"
            >
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          {entryTicketsLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 20 }} />
          ) : entryTickets.length > 0 ? (
            <View style={styles.ticketsList}>
              {entryTickets.slice(0, 3).map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.qrTicketCard}
                  onPress={() => router.push('/my-entry-tickets')}
                  data-testid={`wallet-qr-ticket-${t.id}`}
                >
                  <View style={styles.qrTicketIconWrap}>
                    <Icon name="ticket" size={20} color={colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.qrTicketTitle} numberOfLines={1}>
                      Free Entry · {t.venue_name}
                    </Text>
                    <Text style={styles.qrTicketSubtitle} numberOfLines={1}>
                      {t.live_status === 'scheduled'
                        ? `Starts ${new Date(t.valid_from).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}`
                        : t.live_status === 'active'
                        ? `Expires ${new Date(t.valid_until).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                        : t.live_status.toUpperCase()}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="qr-code-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No QR tickets yet</Text>
              <Text style={styles.emptySubtitle}>
                Complete Missions and unlock Milestones to earn free-entry QR tickets.
              </Text>
              <View style={styles.emptyCtaRow}>
                <TouchableOpacity
                  style={styles.emptyCtaBtn}
                  onPress={() => router.push('/missions')}
                  data-testid="wallet-cta-missions"
                >
                  <Icon name="flash" size={14} color={colors.accent} />
                  <Text style={styles.emptyCtaText}>Missions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.emptyCtaBtn}
                  onPress={() => router.push('/milestones')}
                  data-testid="wallet-cta-milestones"
                >
                  <Icon name="trophy" size={14} color={colors.accent} />
                  <Text style={styles.emptyCtaText}>Milestones</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Active Missions */}
        <View style={styles.missionsSection}>
          <View style={styles.missionHeader}>
            <Text style={styles.redeemTitle}>MISSIONS</Text>
            <TouchableOpacity onPress={() => router.push('/missions')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {(liveMissions.length > 0 ? liveMissions.slice(0, 3) : [
            { id: 'm1', title: 'Weekend Warrior', description: 'Visit 3 venues this weekend', current_progress: 1, target: 3, points_reward: 50, icon: 'flash', color: colors.accent },
            { id: 'm2', title: 'First Timer', description: 'Buy your first ticket', current_progress: 0, target: 1, points_reward: 25, icon: 'ticket', color: '#8B5CF6' },
            { id: 'm3', title: 'Social Butterfly', description: 'Refer 2 friends', current_progress: 0, target: 2, points_reward: 100, icon: 'people', color: '#00D4AA' },
          ]).map((mission: any, idx: number) => {
            const missionColors = [colors.accent, '#8B5CF6', '#00D4AA', '#FF6B35', '#E31837', '#10B981', '#F59E0B'];
            const mColor = mission.color || missionColors[idx % missionColors.length];
            const progress = mission.current_progress || mission.progress || 0;
            const total = mission.target || mission.target_value || 1;
            // Smart icon picker
            const title = (mission.title || mission.name || '').toLowerCase();
            let mIcon = mission.icon || 'flag';
            if (title.includes('check in') || title.includes('visit')) mIcon = 'location';
            else if (title.includes('drink') || title.includes('cocktail') || title.includes('happy hour')) mIcon = 'wine';
            else if (title.includes('refer') || title.includes('friend')) mIcon = 'people';
            else if (title.includes('spend') || title.includes('buy')) mIcon = 'card';
            else if (title.includes('event') || title.includes('party')) mIcon = 'musical-notes';
            else if (title.includes('weekend') || title.includes('warrior')) mIcon = 'flash';
            else if (title.includes('photo') || title.includes('selfie')) mIcon = 'camera';
            else if (title.includes('food') || title.includes('dine')) mIcon = 'restaurant';
            else if (title.includes('early') || title.includes('bird')) mIcon = 'sunny';
            else if (title.includes('social') || title.includes('share')) mIcon = 'share';
            return (
              <View key={mission.id || idx} style={styles.missionCard}>
                <View style={[styles.missionIcon, { backgroundColor: mColor + '20' }]}>
                  <Icon name={mIcon as any} size={20} color={mColor} />
                </View>
                <View style={styles.missionContent}>
                  <Text style={styles.missionTitle}>{mission.title || mission.name}</Text>
                  <Text style={styles.missionDescription}>{mission.description}</Text>
                  <View style={styles.missionProgress}>
                    <View style={styles.missionProgressBar}>
                      <View style={[styles.missionProgressFill, { width: `${(progress / total) * 100}%`, backgroundColor: mColor }]} />
                    </View>
                    <Text style={styles.missionProgressText}>{progress}/{total}</Text>
                  </View>
                </View>
                <View style={[styles.missionPoints, { backgroundColor: mColor + '20' }]}>
                  <Text style={[styles.missionPointsText, { color: mColor }]}>+{mission.points_reward || mission.points || 0}</Text>
                </View>
              </View>
            );
          })}
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

        {/* =============== MILESTONES SECTION =============== */}
        <View style={styles.redeemSection}>
          <View style={styles.redeemHeader}>
            <Text style={styles.redeemTitle}>MILESTONES</Text>
            <TouchableOpacity onPress={() => router.push('/milestones')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {[
            { points: 500, title: 'Rising Star', icon: 'star' as const, color: '#10B981', rewards: '5 Free Drinks' },
            { points: 1000, title: 'VIP Status', icon: 'flash' as const, color: '#2563EB', rewards: '10 Drinks + 4 Entries' },
            { points: 5000, title: 'Luna Elite', icon: 'diamond' as const, color: '#D4A832', rewards: 'VIP Booth + 20 Drinks + 5 Entries' },
          ].map((m) => {
            const pts = pointsData?.points_balance || user?.points_balance || 0;
            const reached = pts >= m.points;
            const progress = Math.min(1, pts / m.points);
            return (
              <TouchableOpacity key={m.points} style={styles.milestoneCard} onPress={() => router.push('/milestones')}>
                <LinearGradient
                  colors={reached ? [m.color + '12', colors.glass] : [colors.glass, colors.glass]}
                  style={styles.milestoneGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={[styles.milestoneIcon, { backgroundColor: reached ? m.color + '20' : colors.glassMid }]}>
                    <Icon name={reached ? 'checkmark-circle' : m.icon} size={20} color={reached ? m.color : colors.textMuted} />
                  </View>
                  <View style={styles.milestoneInfo}>
                    <View style={styles.milestoneTop}>
                      <Text style={[styles.milestoneTitle, reached && { color: m.color }]}>{m.title}</Text>
                      <Text style={[styles.milestonePts, reached && { color: m.color }]}>{m.points.toLocaleString()} pts</Text>
                    </View>
                    <View style={styles.milestoneBarBg}>
                      <View style={[styles.milestoneBarFill, { width: `${progress * 100}%`, backgroundColor: m.color }]} />
                    </View>
                    <Text style={styles.milestoneReward}>{m.rewards}</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 8 }} />
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
                  <Icon name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {selectedTicket && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Event Info */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalEventTitle}>{selectedTicket.event_title}</Text>
                    <Text style={styles.modalEventVenue}>{selectedTicket.venue_name}</Text>
                    <View style={styles.modalDetailRow}>
                      <Icon name="calendar" size={18} color={colors.accent} />
                      <Text style={styles.modalDetailText}>{formatEventDate(selectedTicket.event_date)}</Text>
                    </View>
                  </View>

                  {/* QR Code */}
                  <View style={styles.modalQRSection}>
                    <View style={styles.modalQRCode}>
                      {Platform.OS === 'web' ? (
                        <Icon name="qr-code" size={120} color={colors.textPrimary} />
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
                        <Icon name="add" size={18} color={colors.accent} />
                        <Text style={styles.addGuestText}>Add Guest</Text>
                      </TouchableOpacity>
                    </View>

                    {selectedTicket.guests?.length > 0 ? (
                      selectedTicket.guests.map((guest: any) => (
                        <View key={guest.id} style={styles.guestItem}>
                          <View style={styles.guestInfo}>
                            <Icon name="person" size={18} color={colors.textSecondary} />
                            <Text style={styles.guestName}>{guest.name}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRemoveGuest(selectedTicket.id, guest.id, guest.name)}
                          >
                            <Icon name="close-circle" size={22} color={colors.error} />
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
  legacyLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  legacyLogoutText: {
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
  missionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ticketsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  ticketsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  ticketsList: {
    // Container for tickets
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
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },
  emptyCtaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212,168,50,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,50,0.35)',
  },
  emptyCtaText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  qrTicketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,50,0.25)',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  qrTicketIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212,168,50,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrTicketTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  qrTicketSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
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
  championRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  linkLunaButton: {
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
    fontSize: 11,
    fontWeight: '800',
    color: '#D4AF5A',
    letterSpacing: 2.5,
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
  viewAllRewardsFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.glassBorderSubtle,
    marginTop: spacing.sm,
  },
  viewAllRewardsFullText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.gold,
  },
  milestonesSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  milestoneCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorderSubtle,
  },
  milestoneGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  milestoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  milestoneTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  milestonePts: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  milestoneBarBg: {
    height: 4,
    backgroundColor: colors.glass,
    borderRadius: 2,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  milestoneBarFill: {
    height: 4,
    borderRadius: 2,
  },
  milestoneReward: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});
