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
import { StarfieldBackground } from '../../src/components/StarfieldBackground';

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
      
      // Set tonight's events
      setTonightEvents(eventsFeed.tonight || []);
      
      // Set all upcoming events
      setEvents(eventsFeed.upcoming || []);
      
      // Set featured event (first featured or first upcoming)
      const featured = eventsFeed.featured?.[0] || eventsFeed.upcoming?.[0];
      setFeaturedEvent(featured);
      
      // Sort venues
      const sortedVenues = venuesData.sort((a: any, b: any) => {
        const aIndex = VENUE_ORDER.indexOf(a.id);
        const bIndex = VENUE_ORDER.indexOf(b.id);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
      setVenues(sortedVenues);
    } catch (e) {
      console.error('Failed to fetch data:', e);
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
      return 'Tonight';
    }
  };

  const getTime = (event: any) => {
    if (event?.time) return event.time;
    return '9:00 PM';
  };

  const isOpen = () => {
    // Use Brisbane timezone (AEST/AEDT)
    const brisbaneTime = new Date().toLocaleString('en-US', { timeZone: 'Australia/Brisbane' });
    const hour = new Date(brisbaneTime).getHours();
    return hour >= 20 || hour < 4;
  };

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={60} shootingStarCount={2} />
      
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
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
                <Text style={styles.closedText}>Opens Tonight at 8PM</Text>
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
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.heroOverlay}>
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

        {/* What's On */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>What's On</Text>
            <TouchableOpacity onPress={() => router.push('/events')} style={styles.seeAll}>
              <Text style={styles.seeAllText}>See All</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={styles.eventsList}>
            {events.slice(0, 4).map((event, index) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventRow}
                onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                activeOpacity={0.8}
              >
                <Image source={{ uri: event.image || event.image_url }} style={styles.eventThumb} contentFit="cover" />
                <View style={styles.eventInfo}>
                  <Text style={styles.eventDate}>{formatDate(event)}</Text>
                  <Text style={styles.eventName} numberOfLines={1}>{event.title}</Text>
                  <Text style={styles.eventVenue}>{event.venue_name || event.location}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
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
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.venueOverlay}>
                  <Text style={styles.venueType}>{venue.type?.toUpperCase()}</Text>
                  <Text style={styles.venueName}>{venue.name}</Text>
                  <Text style={styles.venueLocation}>{venue.location}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Trending */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Trending</Text>
          </View>

          <View style={styles.trendingGrid}>
            {events.slice(0, 4).map((event, index) => (
              <TouchableOpacity
                key={event.id}
                style={styles.trendingCard}
                onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                activeOpacity={0.85}
              >
                <Image source={{ uri: event.image_url }} style={styles.trendingImage} contentFit="cover" />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.trendingOverlay}>
                  <View style={styles.trendingRank}>
                    <Text style={styles.trendingRankText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.trendingTitle} numberOfLines={2}>{event.title}</Text>
                  <Text style={styles.trendingVenue}>{event.venue_name}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
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
              <Text style={styles.friendsSubtext}>See what they're up to</Text>
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
    backgroundColor: '#000',
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
    paddingTop: 8,
  },
  logo: {
    width: 260,
    height: 75,
  },
  statusRow: {
    alignItems: 'center',
    marginTop: 12,
    minHeight: 36,
  },
  liveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,212,170,0.15)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.3)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D4AA',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00D4AA',
    letterSpacing: 1.5,
  },
  closedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
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
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 26,
  },
  heroMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
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
  },
  eventInfo: {
    flex: 1,
    gap: 2,
  },
  eventDate: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.3,
  },
  eventName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  eventVenue: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },

  // Venues
  venueScroll: {
    paddingRight: 20,
  },
  venueCard: {
    width: VENUE_CARD_WIDTH,
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 16,
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
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  venueName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  venueLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },

  // Trending
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  trendingCard: {
    width: (width - 40 - 12) / 2,
    height: 130,
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
  },
  trendingVenue: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
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
