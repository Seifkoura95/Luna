import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../src/components/Icon';
import * as Haptics from 'expo-haptics';
import { colors } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { AppBackground } from '../src/components/AppBackground';

const LUNA_LOGO = 'https://customer-assets.emergentagent.com/job_c826baa4-6640-40ce-9e0d-38132d9944fc/artifacts/2k76js5m_luna-group-logo-2.webp';

// Luna Group venues for filtering
const VENUE_FILTERS = [
  { id: 'all', name: 'All Venues' },
  { id: 'eclipse', name: 'Eclipse' },
  { id: 'after_dark', name: 'After Dark' },
  { id: 'su_casa_brisbane', name: 'Su Casa BNE' },
  { id: 'su_casa_gold_coast', name: 'Su Casa GC' },
  { id: 'juju', name: 'Juju' },
  { id: 'night_market', name: 'Night Market' },
];

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  venue_name: string;
  location: string;
  image: string;
  category: string;
  is_free: boolean;
  luna_venue?: string;
  url?: string;
}

export default function EventsListPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadEvents = async () => {
    try {
      setLoading(true);
      console.log('Fetching events feed...');
      const data = await api.getEventsFeed(50);
      console.log('Events feed response:', JSON.stringify(data, null, 2));
      
      // Combine all events from different categories
      const tonightEvents = Array.isArray(data?.tonight) ? data.tonight : [];
      const tomorrowEvents = Array.isArray(data?.tomorrow) ? data.tomorrow : [];
      const upcomingEvents = Array.isArray(data?.upcoming) ? data.upcoming : [];
      
      // Combine and dedupe by ID
      const seenIds = new Set<string>();
      const allEvents: Event[] = [];
      
      [...tonightEvents, ...tomorrowEvents, ...upcomingEvents].forEach(event => {
        if (!seenIds.has(event.id)) {
          seenIds.add(event.id);
          allEvents.push(event);
        }
      });
      
      console.log('Total unique events loaded:', allEvents.length);
      setEvents(allEvents);
      filterEvents(allEvents, selectedVenue, searchQuery);
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents([]);
      setFilteredEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const filterEvents = (eventList: Event[], venue: string, query: string) => {
    let filtered = eventList;
    
    // Filter by venue
    if (venue !== 'all') {
      const venueFilter = VENUE_FILTERS.find(v => v.id === venue);
      if (venueFilter) {
        filtered = filtered.filter(e => 
          e.luna_venue?.toLowerCase().includes(venueFilter.name.toLowerCase().replace(' BNE', '').replace(' GC', '')) ||
          e.venue_name?.toLowerCase().includes(venueFilter.name.toLowerCase().replace(' BNE', '').replace(' GC', ''))
        );
      }
    }
    
    // Filter by search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(e =>
        e.title?.toLowerCase().includes(lowerQuery) ||
        e.venue_name?.toLowerCase().includes(lowerQuery) ||
        e.category?.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Sort by date
    filtered.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time || '00:00'}`);
      const dateB = new Date(`${b.date} ${b.time || '00:00'}`);
      return dateA.getTime() - dateB.getTime();
    });
    
    setFilteredEvents(filtered);
  };

  const handleVenueFilter = (venueId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVenue(venueId);
    filterEvents(events, venueId, searchQuery);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    filterEvents(events, selectedVenue, query);
  };

  const handleEventPress = (event: Event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Open Eventfinda page directly for ticket booking
    if (event.url) {
      Linking.openURL(event.url);
    }
  };

  const handleBookTickets = (event: Event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (event.url) {
      Linking.openURL(event.url);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hour, min] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${min} ${ampm}`;
  };

  return (
    <View style={styles.container}>
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Image source={{ uri: LUNA_LOGO }} style={styles.logo} contentFit="contain" />
          <View style={styles.placeholder} />
        </View>

        <Text style={styles.pageTitle}>EVENTS</Text>
        <Text style={styles.subtitle}>Luna Group Venues</Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Icon name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Venue Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {VENUE_FILTERS.map((venue) => (
            <TouchableOpacity
              key={venue.id}
              style={[
                styles.filterPill,
                selectedVenue === venue.id && styles.filterPillActive,
              ]}
              onPress={() => handleVenueFilter(venue.id)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedVenue === venue.id && styles.filterPillTextActive,
                ]}
              >
                {venue.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Events Count */}
        <Text style={styles.resultsCount}>
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found
        </Text>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading events...</Text>
          </View>
        )}

        {/* Events List */}
        {!loading && (
          <View style={styles.eventsList}>
            {filteredEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => handleEventPress(event)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: event.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800' }}
                  style={styles.eventImage}
                  contentFit="cover"
                />
                <View style={styles.eventInfo}>
                  <View style={styles.eventDateBadge}>
                    <Text style={styles.eventDateText}>{formatDate(event.date)}</Text>
                    {event.time && <Text style={styles.eventTimeText}>{formatTime(event.time)}</Text>}
                  </View>
                  <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                  <View style={styles.eventMeta}>
                    <Icon name="location-outline" size={14} color={colors.accent} />
                    <Text style={styles.eventVenue} numberOfLines={1}>
                      {event.luna_venue || event.venue_name}
                    </Text>
                  </View>
                  {/* Book Tickets Button */}
                  <TouchableOpacity 
                    style={styles.bookButton}
                    onPress={() => handleBookTickets(event)}
                  >
                    <Text style={styles.bookButtonText}>
                      {event.is_free ? 'RSVP' : 'BOOK TICKETS'}
                    </Text>
                    <Icon name="open-outline" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {filteredEvents.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Icon name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No events found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        )}
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
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 180,
    height: 50,
  },
  placeholder: {
    width: 40,
  },
  pageTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  filterScroll: {
    paddingBottom: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
  },
  filterPillText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  resultsCount: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  eventsList: {
    gap: 12,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  eventImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  eventInfo: {
    flex: 1,
    gap: 4,
  },
  eventDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDateText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  eventTimeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventVenue: {
    color: colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  freeBadge: {
    backgroundColor: 'rgba(0,212,170,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  freeBadgeText: {
    color: '#00D4AA',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
