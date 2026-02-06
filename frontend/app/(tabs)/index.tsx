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
  ActivityIndicator,
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
import { useFonts, fonts } from '../../src/hooks/useFonts';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

export default function TonightScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const fontsLoaded = useFonts();
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
    return events.filter(e => e.featured).slice(0, 5);
  }, [events]);

  // Tonight's events
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

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StarfieldBackground starCount={30} />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

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

        {/* Quick Actions - Premium Redesigned */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity 
            style={styles.primaryAction}
            onPress={() => { handleHaptic(); router.push('/table-booking'); }}
            activeOpacity={0.85}
          >
            <LinearGradient 
              colors={['#E31837', '#B8132C', '#8A0F22']} 
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryActionGradient}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="restaurant-outline" size={26} color="#FFF" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={[styles.actionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>VIP Tables</Text>
                <Text style={[styles.actionSubtitle, fontsLoaded && { fontFamily: fonts.regular }]}>Book premium booths</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity 
              style={styles.secondaryAction}
              onPress={() => { handleHaptic(); router.push('/auctions'); }}
              activeOpacity={0.85}
            >
              <LinearGradient 
                colors={['rgba(212,175,55,0.15)', 'rgba(212,175,55,0.05)']}
                style={styles.secondaryActionGradient}
              >
                <Ionicons name="trophy" size={22} color={colors.gold} />
                <Text style={[styles.secondaryActionText, fontsLoaded && { fontFamily: fonts.semiBold }]}>Auctions</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryAction}
              onPress={() => { handleHaptic(); router.push('/guestlist'); }}
              activeOpacity={0.85}
            >
              <LinearGradient 
                colors={['rgba(0,212,170,0.15)', 'rgba(0,212,170,0.05)']}
                style={styles.secondaryActionGradient}
              >
                <Ionicons name="people" size={22} color="#00D4AA" />
                <Text style={[styles.secondaryActionText, fontsLoaded && { fontFamily: fonts.semiBold }]}>Guestlist</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryAction}
              onPress={() => { handleHaptic(); router.push('/rewards'); }}
              activeOpacity={0.85}
            >
              <LinearGradient 
                colors={['rgba(139,0,255,0.15)', 'rgba(139,0,255,0.05)']}
                style={styles.secondaryActionGradient}
              >
                <Ionicons name="gift" size={22} color="#8B00FF" />
                <Text style={[styles.secondaryActionText, fontsLoaded && { fontFamily: fonts.semiBold }]}>Rewards</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Featured Events Section */}
        {featuredEvents.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>FEATURED EVENTS</Text>
              <TouchableOpacity onPress={() => router.push('/events')}>
                <Text style={[styles.seeAllText, fontsLoaded && { fontFamily: fonts.medium }]}>See All</Text>
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
                      colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
                      locations={[0, 0.4, 1]}
                      style={styles.featuredOverlay}
                    >
                      {venue?.logo_url && (
                        <Image source={{ uri: venue.logo_url }} style={styles.venueLogo} resizeMode="contain" />
                      )}
                      
                      <View style={styles.featuredContent}>
                        <View style={styles.eventMeta}>
                          <View style={[styles.dateBadge, { backgroundColor: venue?.accent_color || colors.accent }]}>
                            <Text style={[styles.dateBadgeText, fontsLoaded && { fontFamily: fonts.bold }]}>
                              {formatEventDate(event.event_date)}
                            </Text>
                          </View>
                          {event.ticket_price > 0 && (
                            <View style={styles.priceBadge}>
                              <Text style={[styles.priceBadgeText, fontsLoaded && { fontFamily: fonts.bold }]}>
                                ${event.ticket_price}
                              </Text>
                            </View>
                          )}
                        </View>
                        
                        <Text style={[styles.featuredTitle, fontsLoaded && { fontFamily: fonts.bold }]} numberOfLines={2}>
                          {event.title}
                        </Text>
                        <Text style={[styles.featuredVenue, fontsLoaded && { fontFamily: fonts.medium }]}>
                          {venue?.name || event.venue_name}
                        </Text>
                        <Text style={[styles.featuredDesc, fontsLoaded && { fontFamily: fonts.regular }]} numberOfLines={2}>
                          {event.description}
                        </Text>
                        
                        <TouchableOpacity 
                          style={[styles.ticketButton, { backgroundColor: venue?.accent_color || colors.accent }]}
                          onPress={() => { handleHaptic(); router.push(`/event/${event.id}`); }}
                        >
                          <Ionicons name="ticket" size={18} color="#FFF" />
                          <Text style={[styles.ticketButtonText, fontsLoaded && { fontFamily: fonts.bold }]}>GET TICKETS</Text>
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
                <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>HAPPENING TONIGHT</Text>
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
                      <Text style={[styles.eventListTitle, fontsLoaded && { fontFamily: fonts.semiBold }]} numberOfLines={1}>
                        {event.title}
                      </Text>
                      {event.ticket_price > 0 && (
                        <Text style={[styles.eventListPrice, { color: venue?.accent_color || colors.accent }, fontsLoaded && { fontFamily: fonts.bold }]}>
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
                      <Text style={[styles.eventListVenue, fontsLoaded && { fontFamily: fonts.regular }]}>
                        {venue?.name || event.venue_name}
                      </Text>
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
          <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>OUR VENUES</Text>
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
                  <Text style={[styles.venueCardName, fontsLoaded && { fontFamily: fonts.bold }]}>{venue.name}</Text>
                )}
                <Text style={[styles.venueCardType, fontsLoaded && { fontFamily: fonts.regular }]}>
                  {venue.tagline || venue.type.toUpperCase()}
                </Text>
                
                {eventsByVenue[venue.id]?.length > 0 && (
                  <View style={[styles.eventsCountBadge, { backgroundColor: venue.accent_color }]}>
                    <Text style={[styles.eventsCountText, fontsLoaded && { fontFamily: fonts.semiBold }]}>
                      {eventsByVenue[venue.id].length} Events
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Venue Events Sections */}
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
                    <Text style={[styles.venueEventName, fontsLoaded && { fontFamily: fonts.bold }]}>{venue.name}</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => router.push(`/venue/${venueId}`)}>
                  <Text style={[styles.seeAllText, { color: venue.accent_color }, fontsLoaded && { fontFamily: fonts.medium }]}>
                    View All
                  </Text>
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
                      <Text style={[styles.smallEventDate, fontsLoaded && { fontFamily: fonts.medium }]}>
                        {formatEventDate(event.event_date)}
                      </Text>
                      <Text style={[styles.smallEventTitle, fontsLoaded && { fontFamily: fonts.semiBold }]} numberOfLines={2}>
                        {event.title}
                      </Text>
                      {event.ticket_price > 0 && (
                        <Text style={[styles.smallEventPrice, { color: venue.accent_color }, fontsLoaded && { fontFamily: fonts.bold }]}>
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
  
  // Quick Actions - Premium Redesigned
  quickActionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 28,
    gap: 12,
  },
  primaryAction: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  primaryActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  actionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryActionGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.3,
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
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  seeAllText: {
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
    height: 360,
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
  // Venue Logo - consistent sizing
  venueLogo: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 70,
    height: 28,
    opacity: 0.95,
  },
  featuredContent: {
    gap: 6,
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
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  priceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  priceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  featuredVenue: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -2,
  },
  featuredDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  ticketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: 10,
  },
  ticketButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
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
    width: 60,
    height: 60,
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
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  eventListPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  eventListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventListLogo: {
    width: 32,
    height: 14,
    opacity: 0.9,
  },
  eventListVenue: {
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
    width: 155,
    height: 195,
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
    width: 70,
    height: 28,
    marginBottom: 4,
  },
  venueCardName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  venueCardType: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.3,
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
    fontSize: 10,
    fontWeight: '600',
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
    width: 90,
    height: 32,
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
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  venueEventsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  smallEventCard: {
    width: 145,
    height: 175,
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
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  smallEventTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 17,
  },
  smallEventPrice: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
});
