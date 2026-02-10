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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarfieldBackground } from '../../src/components/StarfieldBackground';
import { PageHeader } from '../../src/components/PageHeader';
import { CardSkeleton, ListSkeleton } from '../../src/components/Shimmer';
import { FierySun } from '../../src/components/FierySun';
import { GoldStarIcon } from '../../src/components/GoldStarIcon';
import { MembershipCard } from '../../src/components/MembershipCard';
import { useRouter, useFocusEffect } from 'expo-router';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

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

  // Auto scroll to top when tab gains focus
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const fetchData = useCallback(async () => {
    try {
      const [ticketsData, eventsData, pointsRes, subRes] = await Promise.all([
        api.getTickets().catch(() => null),
        api.getEvents(),
        api.getPointsBalance().catch(() => null),
        api.getMySubscription().catch(() => null),
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
    } catch (e) {
      console.error('Failed to fetch wallet data:', e);
      // Use mock data on error
      setTickets(MOCK_TICKETS);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
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
      <StarfieldBackground starCount={60} shootingStarCount={2} />
      
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

        {/* Points Card - Simplified */}
        <View style={styles.rewardsCard}>
          <LinearGradient
            colors={['#1A1A1A', '#0D0D0D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.rewardsGradient}
          >
            {/* Accent border glow */}
            <View style={[styles.accentBorder, { borderColor: colors.gold }]} />
            
            <View style={styles.rewardsHeader}>
              <View style={styles.pointsDisplay}>
                <GoldStarIcon size={32} />
                <View>
                  <Text style={styles.pointsValue}>
                    {(pointsData?.balance || user?.points_balance || 0).toLocaleString()}
                  </Text>
                  <Text style={styles.pointsLabel}>LUNA POINTS</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={[styles.rewardsButton, { backgroundColor: colors.gold + '20', borderColor: colors.gold }]}
                onPress={() => router.push('/rewards')}
              >
                <Ionicons name="gift" size={16} color={colors.gold} />
                <Text style={[styles.rewardsButtonText, { color: colors.gold }]}>REWARDS</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
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
                      <Ionicons name="qr-code" size={120} color={colors.textPrimary} />
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
    backgroundColor: '#000000',
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
    borderRadius: radius.lg,
    overflow: 'hidden',
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
    height: 3,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 3,
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
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  pointsLabel: {
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
    backgroundColor: '#0A0A0A',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
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
});
