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
  ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
import { GoldStarIcon } from '../../src/components/GoldStarIcon';
import { useFonts, fonts } from '../../src/hooks/useFonts';

const { width, height } = Dimensions.get('window');
const VENUE_CARD_WIDTH = width * 0.75;
const VENUE_CARD_HEIGHT = 200;

// Luna Group Logo
const LUNA_LOGO = 'https://customer-assets.emergentagent.com/job_c826baa4-6640-40ce-9e0d-38132d9944fc/artifacts/2k76js5m_luna-group-logo-2.webp';

// Venue order as specified
const VENUE_ORDER = [
  'eclipse',
  'after_dark', 
  'su_casa_brisbane',
  'su_casa_gold_coast',
  'juju',
  'ember_and_ash',
  'night_market',
];

// Crowd levels for demo
const CROWD_LEVELS = ['Quiet', 'Moderate', 'Busy', 'Packed'];

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fontsLoaded = useFonts();
  const scrollRef = useRef<ScrollView>(null);
  
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [featuredEvent, setFeaturedEvent] = useState<any>(null);
  const [trendingEvents, setTrendingEvents] = useState<any[]>([]);

  // Animation values
  const pulseAnim = useSharedValue(1);
  const liveIndicator = useSharedValue(0);

  useEffect(() => {
    // Pulse animation for live indicator
    pulseAnim.value = withRepeat(
      withTiming(1.2, { duration: 1000 }),
      -1,
      true
    );
    liveIndicator.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: interpolate(pulseAnim.value, [1, 1.2], [1, 0.6]),
  }));

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const fetchData = async () => {
    try {
      const [eventsData, venuesData] = await Promise.all([
        api.getEvents(),
        api.getVenues(),
      ]);
      
      setEvents(eventsData);
      
      // Sort venues by our preferred order
      const sortedVenues = venuesData.sort((a: any, b: any) => {
        const aIndex = VENUE_ORDER.indexOf(a.id);
        const bIndex = VENUE_ORDER.indexOf(b.id);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
      setVenues(sortedVenues);
      
      // Set featured event (Eclipse events first, or first upcoming)
      const eclipseEvent = eventsData.find((e: any) => e.venue_id === 'eclipse');
      setFeaturedEvent(eclipseEvent || eventsData[0]);
      
      // Set trending events (top 5 by interest)
      setTrendingEvents(eventsData.slice(0, 5));
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

  const isVenueOpen = () => {
    const hour = new Date().getHours();
    return hour >= 20 || hour < 4; // 8 PM to 4 AM
  };

  const getRandomCrowd = () => CROWD_LEVELS[Math.floor(Math.random() * CROWD_LEVELS.length)];
  
  const getCrowdColor = (level: string) => {
    switch (level) {
      case 'Quiet': return '#00D4AA';
      case 'Moderate': return '#FFD700';
      case 'Busy': return '#FF9500';
      case 'Packed': return '#E31837';
      default: return colors.textMuted;
    }
  };

  const formatEventDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Tonight';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getEventTime = (event: any) => {
    if (event.time) return event.time;
    if (event.event_date) {
      const date = new Date(event.event_date);
      return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return '';
  };

  const getEventDateStr = (event: any) => {
    return event.date || event.event_date || '';
  };

  const groupEventsByDate = () => {
    const grouped: { [key: string]: any[] } = {};
    events.forEach(event => {
      const dateKey = formatEventDate(getEventDateStr(event));
      if (!dateKey) return;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  };

  const groupedEvents = groupEventsByDate();

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={80} shootingStarCount={3} />
      
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Logo */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
          <Image source={{ uri: LUNA_LOGO }} style={styles.logo} contentFit="contain" />
          
          {/* Live Status */}
          {isVenueOpen() && (
            <View style={styles.liveContainer}>
              <Animated.View style={[styles.liveDot, pulseStyle]} />
              <Text style={styles.liveText}>VENUES OPEN NOW</Text>
            </View>
          )}
        </Animated.View>

        {/* ============ HERO SECTION - Tonight at Luna ============ */}
        {featuredEvent && (
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <TouchableOpacity 
              style={styles.heroSection}
              onPress={() => { handleHaptic(); router.push(`/event/${featuredEvent.id}`); }}
              activeOpacity={0.95}
            >
              <ImageBackground
                source={{ uri: featuredEvent.image_url }}
                style={styles.heroImage}
                imageStyle={{ borderRadius: radius.xl }}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
                  style={styles.heroGradient}
                >
                  {/* Tonight Badge */}
                  <View style={styles.tonightBadge}>
                    <Animated.View style={[styles.tonightDot, pulseStyle]} />
                    <Text style={styles.tonightText}>TONIGHT AT LUNA</Text>
                  </View>
                  
                  {/* Event Details */}
                  <View style={styles.heroContent}>
                    <Text style={[styles.heroVenue, { color: featuredEvent.accent_color || colors.accent }]}>
                      {featuredEvent.venue_name?.toUpperCase()}
                    </Text>
                    <Text style={[styles.heroTitle, fontsLoaded && { fontFamily: fonts.bold }]}>
                      {featuredEvent.title}
                    </Text>
                    <Text style={styles.heroMeta}>
                      {formatEventDate(featuredEvent.date)} • {featuredEvent.time}
                    </Text>
                    
                    {/* CTA Row */}
                    <View style={styles.heroCTA}>
                      <TouchableOpacity 
                        style={[styles.heroButton, { backgroundColor: featuredEvent.accent_color || colors.accent }]}
                        onPress={() => { handleHaptic(); router.push(`/event/${featuredEvent.id}`); }}
                      >
                        <Text style={styles.heroButtonText}>Get Tickets</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                      </TouchableOpacity>
                      
                      <View style={styles.heroStats}>
                        <Ionicons name="people" size={14} color={colors.textSecondary} />
                        <Text style={styles.heroStatsText}>
                          {Math.floor(Math.random() * 200) + 50} going
                        </Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ============ WHAT'S ON - Event Timeline ============ */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>
                WHAT'S ON
              </Text>
              <Text style={styles.sectionSubtitle}>Next 7 days across all venues</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/events')} style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>See All</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Event Timeline */}
          <View style={styles.timeline}>
            {Object.entries(groupedEvents).slice(0, 4).map(([date, dateEvents], dateIndex) => (
              <View key={date} style={styles.timelineGroup}>
                {/* Date Header */}
                <View style={styles.dateHeader}>
                  <View style={[styles.dateBadge, date === 'Tonight' && styles.dateBadgeTonight]}>
                    <Text style={[styles.dateText, date === 'Tonight' && styles.dateTextTonight]}>
                      {date}
                    </Text>
                  </View>
                  <View style={styles.dateLine} />
                </View>
                
                {/* Events for this date */}
                {dateEvents.slice(0, 2).map((event: any, eventIndex: number) => (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.timelineEvent}
                    onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                    activeOpacity={0.85}
                  >
                    <Image 
                      source={{ uri: event.image_url }} 
                      style={styles.timelineEventImage}
                      contentFit="cover"
                    />
                    <View style={styles.timelineEventContent}>
                      <Text style={[styles.timelineEventVenue, { color: event.accent_color || colors.accent }]}>
                        {event.venue_name}
                      </Text>
                      <Text style={styles.timelineEventTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text style={styles.timelineEventTime}>{event.time}</Text>
                    </View>
                    <View style={styles.timelineEventAction}>
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ============ YOUR VENUES - Horizontal Scroll ============ */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>
                YOUR VENUES
              </Text>
              <Text style={styles.sectionSubtitle}>Explore Luna Group locations</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.venueScroll}
            decelerationRate="fast"
            snapToInterval={VENUE_CARD_WIDTH + spacing.md}
          >
            {venues.map((venue, index) => {
              const crowdLevel = getRandomCrowd();
              const crowdColor = getCrowdColor(crowdLevel);
              
              return (
                <Animated.View
                  key={venue.id}
                  entering={FadeInRight.delay(index * 100).duration(400)}
                >
                  <TouchableOpacity
                    style={styles.venueCard}
                    onPress={() => { handleHaptic(); router.push(`/venue/${venue.id}`); }}
                    activeOpacity={0.9}
                  >
                    <ImageBackground
                      source={{ uri: venue.image_url }}
                      style={styles.venueCardImage}
                      imageStyle={{ borderRadius: radius.lg }}
                    >
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.85)']}
                        style={styles.venueCardGradient}
                      >
                        {/* Live Crowd Indicator */}
                        {isVenueOpen() && (
                          <View style={[styles.crowdBadge, { backgroundColor: crowdColor + '30', borderColor: crowdColor }]}>
                            <View style={[styles.crowdDot, { backgroundColor: crowdColor }]} />
                            <Text style={[styles.crowdText, { color: crowdColor }]}>{crowdLevel}</Text>
                          </View>
                        )}
                        
                        {/* Venue Info */}
                        <View style={styles.venueCardContent}>
                          <View style={[styles.venueTypePill, { backgroundColor: venue.accent_color + '30' }]}>
                            <Text style={[styles.venueTypeText, { color: venue.accent_color }]}>
                              {venue.type?.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={[styles.venueCardName, fontsLoaded && { fontFamily: fonts.bold }]}>
                            {venue.name}
                          </Text>
                          <Text style={styles.venueCardLocation}>{venue.location}</Text>
                          
                          {/* Quick Book Button */}
                          <TouchableOpacity 
                            style={[styles.quickBookButton, { backgroundColor: venue.accent_color }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleHaptic();
                              router.push(`/venue/${venue.id}`);
                            }}
                          >
                            <Text style={styles.quickBookText}>View Venue</Text>
                          </TouchableOpacity>
                        </View>
                      </LinearGradient>
                    </ImageBackground>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ============ TRENDING NOW ============ */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>
                🔥 TRENDING NOW
              </Text>
              <Text style={styles.sectionSubtitle}>Popular events this week</Text>
            </View>
          </View>

          <View style={styles.trendingGrid}>
            {trendingEvents.slice(0, 4).map((event, index) => (
              <TouchableOpacity
                key={event.id}
                style={styles.trendingCard}
                onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                activeOpacity={0.85}
              >
                <Image 
                  source={{ uri: event.image_url }} 
                  style={styles.trendingImage}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.9)']}
                  style={styles.trendingGradient}
                >
                  <View style={styles.trendingRank}>
                    <Text style={styles.trendingRankText}>#{index + 1}</Text>
                  </View>
                  <Text style={styles.trendingTitle} numberOfLines={2}>{event.title}</Text>
                  <Text style={[styles.trendingVenue, { color: event.accent_color || colors.accent }]}>
                    {event.venue_name}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* ============ FRIENDS GOING OUT (Simple) ============ */}
        <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.section}>
          <View style={styles.friendsSection}>
            <View style={styles.friendsHeader}>
              <Ionicons name="people" size={20} color={colors.accent} />
              <Text style={[styles.friendsTitle, fontsLoaded && { fontFamily: fonts.semiBold }]}>
                Friends Going Out
              </Text>
            </View>
            <View style={styles.friendsContent}>
              <View style={styles.friendAvatars}>
                {[1, 2, 3, 4].map((i) => (
                  <Image
                    key={i}
                    source={{ uri: `https://randomuser.me/api/portraits/${i % 2 === 0 ? 'women' : 'men'}/${i + 10}.jpg` }}
                    style={[styles.friendAvatar, { marginLeft: i === 1 ? 0 : -12 }]}
                  />
                ))}
                <View style={styles.friendsMore}>
                  <Text style={styles.friendsMoreText}>+12</Text>
                </View>
              </View>
              <Text style={styles.friendsText}>
                <Text style={{ fontWeight: '700' }}>Sarah, James</Text> and{' '}
                <Text style={{ fontWeight: '700' }}>14 others</Text> are heading out tonight
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.friendsCTA}
              onPress={() => { handleHaptic(); router.push('/social'); }}
            >
              <Text style={styles.friendsCTAText}>See Activity</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Bottom Padding */}
        <View style={{ height: 120 }} />
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
    paddingBottom: spacing.xl,
  },
  
  // Header
  header: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  logo: {
    width: 200,
    height: 55,
  },
  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: 'rgba(0,212,170,0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D4AA',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00D4AA',
    letterSpacing: 1,
  },

  // Hero Section
  heroSection: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  heroImage: {
    height: 320,
    justifyContent: 'flex-end',
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    borderRadius: radius.xl,
  },
  tonightBadge: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(227,24,55,0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  tonightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  tonightText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  heroContent: {
    gap: spacing.xs,
  },
  heroVenue: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 32,
  },
  heroMeta: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  heroCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  heroButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroStatsText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Section
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },

  // Timeline
  timeline: {
    gap: spacing.lg,
  },
  timelineGroup: {
    gap: spacing.sm,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  dateBadge: {
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  dateBadgeTonight: {
    backgroundColor: colors.accent,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  dateTextTonight: {
    color: '#fff',
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  timelineEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.md,
  },
  timelineEventImage: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
  },
  timelineEventContent: {
    flex: 1,
    gap: 2,
  },
  timelineEventVenue: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timelineEventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  timelineEventTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  timelineEventAction: {
    padding: spacing.sm,
  },

  // Venue Cards
  venueScroll: {
    paddingRight: spacing.md,
  },
  venueCard: {
    width: VENUE_CARD_WIDTH,
    height: VENUE_CARD_HEIGHT,
    marginRight: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  venueCardImage: {
    flex: 1,
  },
  venueCardGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  crowdBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 4,
  },
  crowdDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  crowdText: {
    fontSize: 10,
    fontWeight: '700',
  },
  venueCardContent: {
    gap: spacing.xs,
  },
  venueTypePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  venueTypeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  venueCardName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  venueCardLocation: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  quickBookButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  quickBookText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // Trending
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  trendingCard: {
    width: (width - spacing.md * 2 - spacing.sm) / 2,
    height: 140,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  trendingImage: {
    ...StyleSheet.absoluteFillObject,
  },
  trendingGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.sm,
  },
  trendingRank: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  trendingRankText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
  },
  trendingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 16,
  },
  trendingVenue: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // Friends
  friendsSection: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  friendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  friendsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  friendsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  friendAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.background,
  },
  friendsMore: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
    borderWidth: 2,
    borderColor: colors.background,
  },
  friendsMoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  friendsText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  friendsCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  friendsCTAText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
});
