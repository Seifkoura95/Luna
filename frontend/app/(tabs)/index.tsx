import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Icon } from '../../src/components/Icon';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../src/theme/colors';
import { api } from '../../src/utils/api';
import { useAuthStore } from '../../src/store/authStore';
import { AppBackground } from '../../src/components/AppBackground';
import { SectionTitle } from '../../src/components/SectionTitle';
import { EmptyState } from '../../src/components/EmptyState';
import { CardSkeleton, ListSkeleton } from '../../src/components/Shimmer';

const { width } = Dimensions.get('window');
const VENUE_CARD_WIDTH = width * 0.72;

// ─── PulsingFeaturedPill: subtle glow on the FEATURED pill ─
const PulsingFeaturedPill: React.FC = () => {
  const pulse = useSharedValue(0);
  React.useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);
  const pillStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(pulse.value, [0, 1], [0.25, 0.7]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.04]) }],
  }));
  return (
    <Animated.View style={[styles.heroBadge, pillStyle]}>
      <Text style={styles.heroBadgeText}>FEATURED</Text>
    </Animated.View>
  );
};

// Luna Group Logo
const LUNA_LOGO = 'https://customer-assets.emergentagent.com/job_c826baa4-6640-40ce-9e0d-38132d9944fc/artifacts/2k76js5m_luna-group-logo-2.webp';

// Venue order
const VENUE_ORDER = ['eclipse', 'after_dark', 'su_casa_brisbane', 'su_casa_gold_coast', 'juju', 'ember_and_ash', 'night_market'];

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [tonightEvents, setTonightEvents] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [featuredEvent, setFeaturedEvent] = useState<any>(null);
  const [tonightPicks, setTonightPicks] = useState<any[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<any[]>([]);
  const [hotAuctions, setHotAuctions] = useState<Set<string>>(new Set());
  const [publicConfig, setPublicConfig] = useState<any>(null);

  // Pulse animation for hot auctions
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    pulseAnim.value = withRepeat(withTiming(1.3, { duration: 1200 }), -1, true);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: interpolate(pulseAnim.value, [1, 1.3], [1, 0.4]),
  }));

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch events feed from Eventfinda (real-time data)
      const [eventsFeed, venuesData, auctionsData, cfg] = await Promise.all([
        api.getEventsFeed(30),
        api.getVenues(),
        api.getAuctions(undefined, 'active'),
        api.getPublicConfig().catch(() => null),
      ]);

      if (cfg) setPublicConfig(cfg);
      
      // Safely access event arrays with fallback to empty arrays
      const tonightList = Array.isArray(eventsFeed?.tonight) ? eventsFeed.tonight : [];
      const upcomingList = Array.isArray(eventsFeed?.upcoming) ? eventsFeed.upcoming : [];
      const featuredList = Array.isArray(eventsFeed?.featured) ? eventsFeed.featured : [];
      
      // Set tonight's events
      setTonightEvents(tonightList);
      
      // Set all upcoming events
      setEvents(upcomingList);
      
      // Set featured event (first featured or first upcoming)
      const featured = featuredList[0] || upcomingList[0] || null;
      setFeaturedEvent(featured);
      
      // Sort venues
      const sortedVenues = (venuesData || []).sort((a: any, b: any) => {
        const aIndex = VENUE_ORDER.indexOf(a.id);
        const bIndex = VENUE_ORDER.indexOf(b.id);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
      setVenues(sortedVenues);
      
      // Set active auctions
      setActiveAuctions(auctionsData || []);
      
      // Check which auctions are "hot" (high bidding activity)
      if (auctionsData && auctionsData.length > 0) {
        const hotSet = new Set<string>();
        await Promise.all(
          auctionsData.slice(0, 5).map(async (auction: any) => {
            try {
              const activity = await api.getAuctionActivity(auction.id);
              if (activity?.is_hot || activity?.activity_level === 'hot') {
                hotSet.add(auction.id);
              }
            } catch (e) {
              // Ignore activity fetch errors
            }
          })
        );
        setHotAuctions(hotSet);
      }
      
      // Fetch AI personalized picks if we have events
      if (upcomingList.length > 0) {
        try {
          const picksResponse = await api.aiPersonalizedEvents(upcomingList.slice(0, 10));
          if (picksResponse?.events) {
            setTonightPicks(picksResponse.events.slice(0, 3));
          }
        } catch (pickError) {
          console.log('AI picks not available:', pickError);
          // Fallback to first 3 events
          setTonightPicks(upcomingList.slice(0, 3));
        }
      }
    } catch (e) {
      console.error('Failed to fetch data:', e);
      // Set empty arrays on error to prevent crashes
      setEvents([]);
      setTonightEvents([]);
      setFeaturedEvent(null);
      setTonightPicks([]);
      setActiveAuctions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const formatDate = (event: any) => {
    const dateStr = event?.event_date || event?.date || event?.datetime_start;
    if (!dateStr) return 'Upcoming';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Upcoming';
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDay = new Date(date);
      eventDay.setHours(0, 0, 0, 0);
      if (eventDay.getTime() === today.getTime()) return 'Tonight';
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (eventDay.getTime() === tomorrow.getTime()) return 'Tomorrow';
      return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return 'Upcoming';
    }
  };

  const getTime = (event: any) => {
    if (event?.time) return event.time;
    // Parse time from datetime_start if available
    if (event?.datetime_start) {
      try {
        const parts = event.datetime_start.split(' ');
        if (parts.length > 1) {
          const timePart = parts[1];
          const [hour, min] = timePart.split(':');
          const h = parseInt(hour);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          return `${h12}:${min} ${ampm}`;
        }
      } catch {}
    }
    return '8:00 PM';
  };

  const getStatusMode = (): 'open' | 'closed' | 'opening_soon' => {
    // Lovable can force a mode from the portal (status_pill.force_mode)
    const forced = publicConfig?.status_pill?.force_mode;
    if (forced === 'open' || forced === 'closed' || forced === 'opening_soon') {
      return forced;
    }
    const brisbaneTime = new Date().toLocaleString('en-US', { timeZone: 'Australia/Brisbane' });
    const now = new Date(brisbaneTime);
    const hour = now.getHours();
    if (hour >= 20 || hour < 4) return 'open';
    if (hour >= 17 && hour < 20) return 'opening_soon';
    return 'closed';
  };

  const isOpen = () => getStatusMode() === 'open';

  const getClosedMessage = () => {
    // If Lovable set a custom_message, always prefer it
    const custom = publicConfig?.status_pill?.custom_message;
    if (custom && typeof custom === 'string' && custom.trim()) return custom;
    const mode = getStatusMode();
    const sp = publicConfig?.status_pill;
    if (mode === 'opening_soon') return sp?.opening_soon_text || 'Opening Soon';
    return sp?.closed_text || 'Opens Tonight at 8PM';
  };

  const getOpenText = () => publicConfig?.status_pill?.open_text || 'LIVE NOW';

  return (
    <View style={styles.container}>
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
      
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Status */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <Image source={{ uri: LUNA_LOGO }} style={styles.logo} contentFit="contain" />

          {/* Blue accent divider under logo (matches PageHeader on every other screen) */}
          <View style={styles.accentContainer}>
            <LinearGradient
              colors={['transparent', colors.accent, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.accentLine}
            />
          </View>

          <View style={styles.statusRow}>
            {isOpen() ? (
              <View style={styles.liveStatus}>
                <Animated.View style={[styles.liveDot, pulseStyle]} />
                <Text style={styles.liveText}>{getOpenText()}</Text>
              </View>
            ) : (
              <View style={styles.closedStatus}>
                <Icon name="time-outline" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={styles.closedText}>{getClosedMessage()}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Hero Event */}
        {featuredEvent && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.heroWrapper}>
            <TouchableOpacity
              onPress={() => { handleHaptic(); router.push(`/event/${featuredEvent.id}`); }}
              activeOpacity={0.9}
              style={[styles.heroCardAnimated, styles.heroCardInner]}
            >
              <Image source={{ uri: featuredEvent.image || featuredEvent.image_url }} style={styles.heroImage} contentFit="cover" />
              <LinearGradient 
                colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']} 
                locations={[0, 0.4, 1]}
                style={styles.heroOverlay}
              >
                <PulsingFeaturedPill />
                <View style={styles.heroContent}>
                  <Text style={styles.heroVenue}>{featuredEvent.venue_name || featuredEvent.location}</Text>
                  <Text style={styles.heroTitle} numberOfLines={2}>{featuredEvent.title}</Text>
                  <Text style={styles.heroMeta}>{formatDate(featuredEvent)} · {getTime(featuredEvent)}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Tonight's Pick - AI Personalized */}
        {tonightPicks.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.section}>
            <View style={styles.tonightPickHeader}>
              <Text style={styles.tonightPickLabel}>FOR YOU</Text>
              <Text style={styles.tonightPickSub}>Personalized picks</Text>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tonightPickScroll}
            >
              {tonightPicks.map((event, index) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.tonightPickCard}
                  onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                  activeOpacity={0.85}
                  data-testid={`tonight-pick-${index}`}
                >
                  <Image 
                    source={{ uri: event.image || event.image_url }} 
                    style={styles.tonightPickImage}
                    contentFit="cover"
                  />
                  <LinearGradient 
                    colors={['transparent', 'rgba(0,0,0,0.9)']} 
                    style={styles.tonightPickOverlay}
                  >
                    {event.ai_recommended && (
                      <View style={styles.aiPickBadge}>
                        <Text style={styles.aiPickBadgeText}>AI PICK</Text>
                      </View>
                    )}
                    <Text style={styles.tonightPickEventTitle} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <Text style={styles.tonightPickVenue}>
                      {event.venue_name || event.location}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Live Auctions Carousel */}
        {activeAuctions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(175).duration(400)} style={styles.section}>
            <SectionTitle 
              title="Live Auctions" 
              onSeeAll={() => router.push('/auctions')}
              icon="flash"
              iconColor={colors.gold}
              liveDot
            />
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.auctionScroll}
            >
              {activeAuctions.slice(0, 5).map((auction, index) => {
                const isHot = hotAuctions.has(auction.id);
                return (
                  <TouchableOpacity
                    key={auction.id}
                    style={[styles.auctionCard, isHot && styles.auctionCardHot]}
                    onPress={() => { handleHaptic(); router.push(`/auctions?id=${auction.id}`); }}
                    activeOpacity={0.85}
                    data-testid={`auction-card-${index}`}
                  >
                    <Image 
                      source={{ uri: auction.image_url || 'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=400' }} 
                      style={styles.auctionImage}
                      contentFit="cover"
                    />
                    {isHot && (
                      <View style={styles.auctionHotGlow} />
                    )}
                    <LinearGradient 
                      colors={['transparent', 'rgba(0,0,0,0.95)']} 
                      style={styles.auctionOverlay}
                    >
                      <View style={styles.auctionBadgeRow}>
                        <View style={styles.auctionLiveBadge}>
                          <View style={styles.auctionLiveDot} />
                          <Text style={styles.auctionLiveText}>LIVE</Text>
                        </View>
                        {isHot && (
                          <View style={styles.auctionHotBadge}>
                            <Icon name="flame" size={12} color="#FF6B35" />
                            <Text style={styles.auctionHotText}>BIDDING WAR!</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.auctionTitle} numberOfLines={2}>
                        {auction.title}
                      </Text>
                      <Text style={styles.auctionVenue}>
                        {auction.venue_name}
                      </Text>
                      <View style={styles.auctionBidRow}>
                        <Text style={styles.auctionBidLabel}>Current Bid</Text>
                        <Text style={[styles.auctionBidValue, isHot && styles.auctionBidValueHot]}>${auction.current_bid?.toLocaleString() || auction.starting_bid?.toLocaleString()}</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* Trending */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <SectionTitle 
            title="Trending" 
            onSeeAll={() => router.push('/events')}
            icon="flame"
            iconColor={colors.orange}
          />

          {loading ? (
            <View>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.trendingListRow}>
                  <CardSkeleton style={{ marginBottom: 0, height: 72 }} />
                </View>
              ))}
            </View>
          ) : events.length > 0 ? (
            <View style={styles.trendingList}>
              {events.slice(0, 6).map((event, index) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.trendingListRow}
                  onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                  activeOpacity={0.75}
                  data-testid={`trending-event-${index}`}
                >
                  <Text style={styles.trendingListRank}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Image
                    source={{ uri: event.image || event.image_url }}
                    style={styles.trendingListImage}
                    contentFit="cover"
                  />
                  <View style={styles.trendingListText}>
                    <Text style={styles.trendingListTitle} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <Text style={styles.trendingListVenue} numberOfLines={1}>
                      {event.venue_name || event.location}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="No events tonight"
              subtitle="Check back later for exciting happenings at Luna venues"
              actionText="Browse All Events"
              onAction={() => router.push('/events')}
              iconColor={colors.accent}
            />
          )}
        </Animated.View>

        <View style={{ height: 20 }} />
      </ScrollView>
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
    paddingHorizontal: 20,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 260,
    height: 75,
    marginBottom: 10,
  },
  accentContainer: {
    marginTop: spacing.sm,
    width: 100,
    alignItems: 'center',
  },
  accentLine: {
    width: '100%',
    height: 2,
    borderRadius: 1,
  },
  statusRow: {
    alignItems: 'center',
    marginTop: 12,
    minHeight: 36,
  },
  liveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.greenDim,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.green,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  closedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  closedText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },

  // Hero - Tall, atmospheric, fills top 40% of screen
  heroWrapper: {
    marginBottom: 28,
  },
  heroCardAnimated: {
    height: 420,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroCardInner: {
    flex: 1,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
    paddingTop: 56,
  },
  heroBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(212, 175, 90, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 6,
    shadowColor: '#D4AF5A',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#08080E',
    letterSpacing: 1.5,
  },
  heroContent: {
    gap: 6,
  },
  heroVenue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D4AF5A',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 30,
  },
  heroMeta: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.70)',
    marginTop: 4,
    fontWeight: '500',
  },

  // Sections - Warmer, more spacious
  section: {
    marginBottom: 36,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: '#D4AF5A',
    textTransform: 'uppercase',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  seeAllText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(240, 240, 248, 0.45)',
    textTransform: 'uppercase',
  },

  // Events List
  eventsList: {
    gap: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    gap: 14,
  },
  eventThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  eventInfo: {
    flex: 1,
    gap: 2,
  },
  eventDate: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentVibrant,
    letterSpacing: 0.5,
  },
  eventName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  eventVenue: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Venues - Glass cards with warm accents
  venueScroll: {
    paddingRight: 20,
  },
  venueCard: {
    width: VENUE_CARD_WIDTH,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  venueImage: {
    ...StyleSheet.absoluteFillObject,
  },
  venueOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  venueType: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D4AF5A',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  venueName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  venueLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.60)',
    marginTop: 4,
    fontWeight: '500',
  },

  // Trending - Glass pill card (matches wallet tile style)
  trendingList: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  trendingListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorderSubtle,
  },
  trendingListRank: {
    width: 40,
    fontSize: 24,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.18)',
    letterSpacing: -0.5,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  trendingListImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  trendingListText: {
    flex: 1,
  },
  trendingListTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  trendingListVenue: {
    color: 'rgba(240,240,248,0.55)',
    fontSize: 12,
    marginTop: 3,
  },
  // Trending - Clean, borderless cards
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  trendingCard: {
    flexBasis: '50%',
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  trendingCardInner: {
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  trendingImage: {
    ...StyleSheet.absoluteFillObject,
  },
  trendingOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  trendingRank: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  trendingTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  trendingVenue: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Tonight's Pick styles
  tonightPickHeader: {
    marginBottom: spacing.md,
  },
  tonightPickLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D4AF5A',
    letterSpacing: 2.5,
  },
  tonightPickSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
  },
  tonightPickScroll: {
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  tonightPickCard: {
    width: 200,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#12121E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tonightPickImage: {
    width: '100%',
    height: '100%',
  },
  tonightPickOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    paddingTop: spacing.lg,
  },
  aiPickBadge: {
    backgroundColor: 'rgba(212, 175, 90, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  aiPickBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#08080E',
    letterSpacing: 1.5,
  },
  tonightPickEventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  tonightPickVenue: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Auction carousel styles
  auctionScroll: {
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  auctionCard: {
    width: 220,
    height: 170,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#12121E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  auctionImage: {
    width: '100%',
    height: '100%',
  },
  auctionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    paddingTop: spacing.xl,
  },
  auctionLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(227, 24, 55, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  auctionLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  auctionLiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  auctionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
  },
  auctionCardHot: {
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  auctionHotGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    zIndex: 1,
  },
  auctionHotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 107, 53, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  auctionHotEmoji: {
    fontSize: 10,
  },
  auctionHotText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  auctionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  auctionVenue: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  auctionBidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  auctionBidLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  auctionBidValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
  },
  auctionBidValueHot: {
    color: '#FF6B35',
  },
});
