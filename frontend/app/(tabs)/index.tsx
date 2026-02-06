import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { StarfieldBackground } from '../../src/components/StarfieldBackground';
import { PageHeader } from '../../src/components/PageHeader';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

export default function TonightScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [venues, setVenues] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [venuesData, eventsData] = await Promise.all([
        api.getVenues(),
        api.getEvents(),
      ]);
      setVenues(venuesData || []);
      setEvents(eventsData || []);
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

  // Group events by venue
  const eventsByVenue = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    events.forEach(event => {
      const venueId = event.venue_id;
      if (!grouped[venueId]) {
        grouped[venueId] = [];
      }
      grouped[venueId].push(event);
    });
    return grouped;
  }, [events]);

  // Featured events (first 5)
  const featuredEvents = useMemo(() => {
    return events
      .filter(e => e.featured)
      .slice(0, 5);
  }, [events]);

  // Tonight's events (within 24 hours)
  const tonightsEvents = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return events.filter(e => {
      const eventDate = new Date(e.event_date);
      return eventDate >= now && eventDate <= tomorrow;
    }).slice(0, 6);
  }, [events]);

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const getVenueForEvent = (venueId: string) => {
    return venues.find(v => v.id === venueId);
  };

  const handleHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  };

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
        {/* Header */}
        <PageHeader 
          title="LUNA" 
          description="Premium nightlife & dining across Brisbane & Gold Coast"
          showPoints={false} 
        />

        {/* Quick Actions - Revenue Focused */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => { handleHaptic(); router.push('/table-booking'); }}
          >
            <LinearGradient colors={[colors.accent, colors.accentDark]} style={styles.quickActionGradient}>
              <Ionicons name="restaurant" size={22} color="#FFF" />
              <Text style={styles.quickActionText}>BOOK VIP TABLE</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => { handleHaptic(); router.push('/auctions'); }}
          >
            <LinearGradient colors={[colors.gold, colors.goldDark]} style={styles.quickActionGradient}>
              <Ionicons name="trophy" size={22} color="#000" />
              <Text style={[styles.quickActionText, { color: '#000' }]}>AUCTIONS</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Featured Events Section */}
        {featuredEvents.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>FEATURED EVENTS</Text>
              <TouchableOpacity onPress={() => router.push('/events')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredContainer}
              pagingEnabled
              snapToInterval={CARD_WIDTH + 16}
              decelerationRate="fast"
            >
              {featuredEvents.map((event) => {
                const venue = getVenueForEvent(event.venue_id);
                return (
                  <TouchableOpacity 
                    key={event.id}
                    style={styles.featuredCard}
                    onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                    activeOpacity={0.9}
                  >
                    <Image source={{ uri: event.image_url }} style={styles.featuredImage} />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.98)']}
                      locations={[0, 0.5, 1]}
                      style={styles.featuredOverlay}
                    >
                      {/* Venue Logo */}
                      {venue?.logo_url && (
                        <Image 
                          source={{ uri: venue.logo_url }} 
                          style={styles.venueLogo}
                          resizeMode="contain"
                        />
                      )}
                      
                      <View style={styles.featuredContent}>
                        <View style={styles.eventMeta}>
                          <View style={[styles.dateBadge, { backgroundColor: venue?.accent_color || colors.accent }]}>
                            <Text style={styles.dateBadgeText}>{formatEventDate(event.event_date)}</Text>
                          </View>
                          {event.ticket_price > 0 && (
                            <View style={styles.priceBadge}>
                              <Text style={styles.priceBadgeText}>${event.ticket_price}</Text>
                            </View>
                          )}
                        </View>
                        
                        <Text style={styles.featuredTitle} numberOfLines={2}>{event.title}</Text>
                        <Text style={styles.featuredVenue}>{venue?.name || event.venue_name}</Text>
                        <Text style={styles.featuredDesc} numberOfLines={2}>{event.description}</Text>
                        
                        <TouchableOpacity 
                          style={[styles.ticketButton, { backgroundColor: venue?.accent_color || colors.accent }]}
                          onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                        >
                          <Ionicons name="ticket" size={18} color="#FFF" />
                          <Text style={styles.ticketButtonText}>GET TICKETS</Text>
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Tonight's Events */}
        {tonightsEvents.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.liveDot} />
                <Text style={styles.sectionTitle}>HAPPENING TONIGHT</Text>
              </View>
            </View>

            {tonightsEvents.map((event) => {
              const venue = getVenueForEvent(event.venue_id);
              return (
                <TouchableOpacity 
                  key={event.id}
                  style={styles.eventListItem}
                  onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: event.image_url }} style={styles.eventListImage} />
                  <View style={styles.eventListContent}>
                    <View style={styles.eventListHeader}>
                      <Text style={styles.eventListTitle} numberOfLines={1}>{event.title}</Text>
                      {event.ticket_price > 0 && (
                        <Text style={[styles.eventListPrice, { color: venue?.accent_color || colors.accent }]}>
                          ${event.ticket_price}
                        </Text>
                      )}
                    </View>
                    <View style={styles.eventListMeta}>
                      {venue?.logo_url ? (
                        <Image source={{ uri: venue.logo_url }} style={styles.eventListLogo} resizeMode="contain" />
                      ) : (
                        <View style={[styles.venueDot, { backgroundColor: venue?.accent_color }]} />
                      )}
                      <Text style={styles.eventListVenue}>{venue?.name || event.venue_name}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Venues Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>OUR VENUES</Text>
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.venueCardsContainer}
        >
          {venues.map((venue) => (
            <TouchableOpacity
              key={venue.id}
              style={styles.venueCard}
              onPress={() => { handleHaptic(); router.push(`/venue/${venue.id}`); }}
              activeOpacity={0.9}
            >
              <Image source={{ uri: venue.image_url }} style={styles.venueCardImage} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.95)']}
                style={styles.venueCardOverlay}
              >
                {venue.logo_url ? (
                  <Image source={{ uri: venue.logo_url }} style={styles.venueCardLogo} resizeMode="contain" />
                ) : (
                  <Text style={styles.venueCardName}>{venue.name}</Text>
                )}
                <Text style={styles.venueCardType}>{venue.tagline || venue.type.toUpperCase()}</Text>
                
                {/* Events count badge */}
                {eventsByVenue[venue.id]?.length > 0 && (
                  <View style={[styles.eventsCountBadge, { backgroundColor: venue.accent_color }]}>
                    <Text style={styles.eventsCountText}>
                      {eventsByVenue[venue.id].length} Events
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* All Upcoming Events by Venue */}
        {Object.entries(eventsByVenue).slice(0, 3).map(([venueId, venueEvents]) => {
          const venue = getVenueForEvent(venueId);
          if (!venue || venueEvents.length === 0) return null;
          
          return (
            <View key={venueId} style={styles.venueEventsSection}>
              <View style={styles.venueEventHeader}>
                {venue.logo_url ? (
                  <Image source={{ uri: venue.logo_url }} style={styles.venueEventLogo} resizeMode="contain" />
                ) : (
                  <View style={styles.venueEventNameContainer}>
                    <View style={[styles.venueDotLarge, { backgroundColor: venue.accent_color }]} />
                    <Text style={styles.venueEventName}>{venue.name}</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => router.push(`/venue/${venueId}`)}>
                  <Text style={[styles.seeAllText, { color: venue.accent_color }]}>View All</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.venueEventsScroll}
              >
                {venueEvents.slice(0, 4).map((event) => (
                  <TouchableOpacity 
                    key={event.id}
                    style={styles.smallEventCard}
                    onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                  >
                    <Image source={{ uri: event.image_url }} style={styles.smallEventImage} />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.9)']}
                      style={styles.smallEventOverlay}
                    >
                      <Text style={styles.smallEventDate}>{formatEventDate(event.event_date)}</Text>
                      <Text style={styles.smallEventTitle} numberOfLines={2}>{event.title}</Text>
                      {event.ticket_price > 0 && (
                        <Text style={[styles.smallEventPrice, { color: venue.accent_color }]}>
                          From ${event.ticket_price}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
  },
  
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  quickActionBtn: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  quickActionText: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  
  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  seeAllText: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif',
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  
  // Featured Events
  featuredContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  featuredCard: {
    width: CARD_WIDTH,
    height: 380,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.backgroundCard,
  },
  featuredImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
  },
  venueLogo: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 60,
    height: 40,
    opacity: 0.9,
  },
  featuredContent: {
    gap: 8,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  dateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  dateBadgeText: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  priceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  priceBadgeText: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  featuredTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  featuredVenue: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -2,
  },
  featuredDesc: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  ticketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: 12,
  },
  ticketButtonText: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  
  // Tonight's Events List
  eventListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    gap: 14,
  },
  eventListImage: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
  },
  eventListContent: {
    flex: 1,
    gap: 4,
  },
  eventListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventListTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  eventListPrice: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 14,
    fontWeight: '800',
  },
  eventListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventListLogo: {
    width: 24,
    height: 16,
    opacity: 0.8,
  },
  eventListVenue: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
    fontSize: 13,
    color: colors.textSecondary,
  },
  venueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  // Venue Cards
  venueCardsContainer: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 8,
  },
  venueCard: {
    width: 160,
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  venueCardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  venueCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 14,
  },
  venueCardLogo: {
    width: 80,
    height: 35,
    marginBottom: 4,
  },
  venueCardName: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  venueCardType: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  eventsCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  eventsCountText: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif',
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  
  // Venue Events Section
  venueEventsSection: {
    marginTop: 24,
  },
  venueEventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  venueEventLogo: {
    width: 100,
    height: 30,
  },
  venueEventNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  venueDotLarge: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  venueEventName: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  venueEventsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  smallEventCard: {
    width: 150,
    height: 180,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  smallEventImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  smallEventOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 12,
  },
  smallEventDate: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif',
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  smallEventTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  smallEventPrice: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
});
