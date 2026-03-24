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
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../src/theme/colors';
import { api } from '../../src/utils/api';
import { useAuthStore } from '../../src/store/authStore';
import { AppBackground } from '../../src/components/AppBackground';

const { width } = Dimensions.get('window');
const VENUE_CARD_WIDTH = width * 0.72;

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
  const [events, setEvents] = useState<any[]>([]);
  const [tonightEvents, setTonightEvents] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [featuredEvent, setFeaturedEvent] = useState<any>(null);

  // Pulse animation
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
    try {
      // Fetch events feed from Eventfinda (real-time data)
      const [eventsFeed, venuesData] = await Promise.all([
        api.getEventsFeed(30),
        api.getVenues(),
      ]);
      
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
    } catch (e) {
      console.error('Failed to fetch data:', e);
      // Set empty arrays on error to prevent crashes
      setEvents([]);
      setTonightEvents([]);
      setFeaturedEvent(null);
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

  const isOpen = () => {
    // Use Brisbane timezone (AEST/AEDT)
    const brisbaneTime = new Date().toLocaleString('en-US', { timeZone: 'Australia/Brisbane' });
    const now = new Date(brisbaneTime);
    const hour = now.getHours();
    // Open from 8PM (20:00) to 4AM
    return hour >= 20 || hour < 4;
  };

  const getClosedMessage = () => {
    const brisbaneTime = new Date().toLocaleString('en-US', { timeZone: 'Australia/Brisbane' });
    const now = new Date(brisbaneTime);
    const hour = now.getHours();
    
    if (hour >= 4 && hour < 12) {
      return 'Opens Tonight at 8PM';
    } else if (hour >= 12 && hour < 17) {
      return 'Opens Tonight at 8PM';
    } else if (hour >= 17 && hour < 20) {
      return 'Opening Soon';
    } else {
      return 'Opens Tonight at 8PM';
    }
  };

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
          
          <View style={styles.statusRow}>
            {isOpen() ? (
              <View style={styles.liveStatus}>
                <Animated.View style={[styles.liveDot, pulseStyle]} />
                <Text style={styles.liveText}>LIVE NOW</Text>
              </View>
            ) : (
              <View style={styles.closedStatus}>
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={styles.closedText}>{getClosedMessage()}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Hero Event */}
        {featuredEvent && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <TouchableOpacity 
              style={styles.heroCard}
              onPress={() => { handleHaptic(); router.push(`/event/${featuredEvent.id}`); }}
              activeOpacity={0.9}
            >
              <Image source={{ uri: featuredEvent.image || featuredEvent.image_url }} style={styles.heroImage} contentFit="cover" />
              <LinearGradient 
                colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']} 
                locations={[0, 0.4, 1]}
                style={styles.heroOverlay}
              >
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>FEATURED</Text>
                </View>
                <View style={styles.heroContent}>
                  <Text style={styles.heroVenue}>{featuredEvent.venue_name || featuredEvent.location}</Text>
                  <Text style={styles.heroTitle}>{featuredEvent.title}</Text>
                  <Text style={styles.heroMeta}>{formatDate(featuredEvent)} · {getTime(featuredEvent)}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Trending */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Trending</Text>
            <TouchableOpacity onPress={() => router.push('/events')} style={styles.seeAll}>
              <Text style={styles.seeAllText}>See All</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={styles.trendingGrid}>
            {events.slice(1, 7).map((event, index) => (
              <View key={event.id} style={styles.trendingCard}>
                <TouchableOpacity
                  style={styles.trendingCardInner}
                  onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: event.image || event.image_url }} style={styles.trendingImage} contentFit="cover" />
                  <LinearGradient 
                    colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']} 
                    locations={[0, 0.4, 1]}
                    style={styles.trendingOverlay}
                  >
                    <View style={styles.trendingRank}>
                      <Text style={styles.trendingRankText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.trendingTitle} numberOfLines={2}>{event.title}</Text>
                    <Text style={styles.trendingVenue}>{event.venue_name || event.location}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Venues */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Our Venues</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.venueScroll}
            decelerationRate="fast"
            snapToInterval={VENUE_CARD_WIDTH + 16}
          >
            {venues.map((venue) => (
              <TouchableOpacity
                key={venue.id}
                style={styles.venueCard}
                onPress={() => { handleHaptic(); router.push(`/venue/${venue.id}`); }}
                activeOpacity={0.9}
              >
                <Image source={{ uri: venue.image_url }} style={styles.venueImage} contentFit="cover" />
                <LinearGradient 
                  colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.95)']} 
                  locations={[0, 0.3, 1]}
                  style={styles.venueOverlay}
                >
                  <Text style={styles.venueType}>{venue.type?.toUpperCase()}</Text>
                  <Text style={styles.venueName}>{venue.name}</Text>
                  <Text style={styles.venueLocation}>{venue.location}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Friends */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)} style={[styles.section, { marginBottom: 40 }]}>
          <TouchableOpacity 
            style={styles.friendsCard}
            onPress={() => { handleHaptic(); router.push('/social'); }}
            activeOpacity={0.85}
          >
            <View style={styles.friendsAvatars}>
              {[1, 2, 3, 4].map((i) => (
                <Image
                  key={i}
                  source={{ uri: `https://randomuser.me/api/portraits/${i % 2 === 0 ? 'women' : 'men'}/${i + 10}.jpg` }}
                  style={[styles.friendAvatar, { marginLeft: i === 1 ? 0 : -10 }]}
                />
              ))}
              <View style={styles.friendsMore}>
                <Text style={styles.friendsMoreText}>+8</Text>
              </View>
            </View>
            <View style={styles.friendsInfo}>
              <Text style={styles.friendsText}>Friends are heading out tonight</Text>
              <Text style={styles.friendsSubtext}>See what they&apos;re up to</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 100 }} />
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

  // Hero
  heroCard: {
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  heroBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  heroContent: {
    gap: 4,
  },
  heroVenue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Sections
  section: {
    marginBottom: 32,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.textTertiary,
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
    color: colors.accent,
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

  // Venues
  venueScroll: {
    paddingRight: 20,
  },
  venueCard: {
    width: VENUE_CARD_WIDTH,
    height: 180,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    marginRight: 16,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  venueImage: {
    ...StyleSheet.absoluteFillObject,
  },
  venueOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  venueType: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  venueName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  venueLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Trending
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  trendingCard: {
    flexBasis: '50%',
    paddingHorizontal: 5,
    paddingBottom: 10,
  },
  trendingCardInner: {
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
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

  // Friends
  friendsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  friendsAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#000',
  },
  friendsMore: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    borderWidth: 2,
    borderColor: '#000',
  },
  friendsMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  friendsInfo: {
    flex: 1,
  },
  friendsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  friendsSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
});
