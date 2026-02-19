import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../../src/theme/colors';
import { api } from '../../src/utils/api';
import { AppBackground } from '../../src/components/AppBackground';

interface EventDetail {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  end_time?: string;
  venue_name: string;
  location: string;
  address: string;
  image: string;
  category: string;
  is_free: boolean;
  restrictions?: string;
  url: string;
  luna_venue?: string;
}

export default function EventDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<{ going_count: number; interested_count: number; friends_going: any[]; friends_interested: any[] }>({ going_count: 0, interested_count: 0, friends_going: [], friends_interested: [] });
  const [loadingRsvp, setLoadingRsvp] = useState(false);

  useEffect(() => {
    if (id) {
      loadEvent();
      loadRsvp();
      loadAttendees();
    }
  }, [id]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading event with ID:', id);
      const data = await api.getEventDetail(id as string);
      console.log('Event data received:', data);
      if (data) {
        setEvent(data);
      } else {
        setError('Event not found');
      }
    } catch (err: any) {
      console.error('Failed to load event:', err);
      setError(err?.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const loadRsvp = async () => {
    try {
      const data = await api.getMyEventRsvp(id as string);
      setRsvpStatus(data.rsvp?.status || null);
    } catch (err) {
      console.log('No RSVP found');
    }
  };

  const loadAttendees = async () => {
    try {
      const data = await api.getEventAttendees(id as string);
      setAttendees(data);
    } catch (err) {
      console.log('Failed to load attendees');
    }
  };

  const handleRsvp = async (status: 'going' | 'interested' | 'not_going') => {
    if (loadingRsvp) return;
    
    setLoadingRsvp(true);
    handleHaptic();
    
    try {
      await api.markEventRsvp(id as string, status, false);
      setRsvpStatus(status);
      loadAttendees();
    } catch (err: any) {
      console.error('Failed to RSVP:', err);
    } finally {
      setLoadingRsvp(false);
    }
  };

  const handleHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
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

  const openTicketLink = () => {
    handleHaptic();
    if (event?.url) {
      Linking.openURL(event.url);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.container}>
        <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.errorText}>{error || 'Event not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
      
      {/* Header with back button */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => { handleHaptic(); router.back(); }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { handleHaptic(); }} style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Event Image */}
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: event.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800' }} 
            style={styles.eventImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.imageGradient}
          />
          {event.luna_venue && (
            <View style={styles.venueBadge}>
              <Text style={styles.venueBadgeText}>{event.luna_venue}</Text>
            </View>
          )}
        </View>

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            <Text style={styles.metaText}>{formatDate(event.date)}</Text>
          </View>
          
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={18} color={colors.accent} />
            <Text style={styles.metaText}>
              {formatTime(event.time)}
              {event.end_time && ` - ${formatTime(event.end_time)}`}
            </Text>
          </View>
          
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color={colors.accent} />
            <View style={styles.locationInfo}>
              <Text style={styles.metaText}>{event.venue_name}</Text>
              <Text style={styles.addressText}>{event.address}</Text>
            </View>
          </View>

          {event.restrictions && (
            <View style={styles.metaRow}>
              <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
              <Text style={styles.metaText}>{event.restrictions}</Text>
            </View>
          )}

          {/* Category & Price */}
          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{event.category.toUpperCase()}</Text>
            </View>
            {event.is_free && (
              <View style={[styles.tag, styles.freeTag]}>
                <Text style={styles.tagText}>FREE ENTRY</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {event.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>About This Event</Text>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          )}

          {/* RSVP Section */}
          <View style={styles.rsvpSection}>
            <Text style={styles.sectionTitle}>Are You Going?</Text>
            
            <View style={styles.rsvpButtons}>
              <TouchableOpacity
                style={[styles.rsvpButton, rsvpStatus === 'going' && styles.rsvpButtonActive]}
                onPress={() => handleRsvp('going')}
                disabled={loadingRsvp}
              >
                <Ionicons 
                  name="checkmark-circle" 
                  size={24} 
                  color={rsvpStatus === 'going' ? colors.success : colors.textMuted} 
                />
                <Text style={[styles.rsvpButtonText, rsvpStatus === 'going' && styles.rsvpButtonTextActive]}>
                  Going
                </Text>
                {attendees.going_count > 0 && (
                  <Text style={styles.rsvpCount}>{attendees.going_count}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rsvpButton, rsvpStatus === 'interested' && styles.rsvpButtonActive]}
                onPress={() => handleRsvp('interested')}
                disabled={loadingRsvp}
              >
                <Ionicons 
                  name="star" 
                  size={24} 
                  color={rsvpStatus === 'interested' ? colors.accent : colors.textMuted} 
                />
                <Text style={[styles.rsvpButtonText, rsvpStatus === 'interested' && styles.rsvpButtonTextActive]}>
                  Interested
                </Text>
                {attendees.interested_count > 0 && (
                  <Text style={styles.rsvpCount}>{attendees.interested_count}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Friends Going */}
            {(attendees.friends_going.length > 0 || attendees.friends_interested.length > 0) && (
              <View style={styles.friendsSection}>
                <Ionicons name="people" size={16} color={colors.textMuted} />
                <Text style={styles.friendsText}>
                  {attendees.friends_going.length > 0 && `${attendees.friends_going.map(f => f.name).join(', ')} ${attendees.friends_going.length === 1 ? 'is' : 'are'} going`}
                  {attendees.friends_going.length > 0 && attendees.friends_interested.length > 0 && ' • '}
                  {attendees.friends_interested.length > 0 && `${attendees.friends_interested.length} friend${attendees.friends_interested.length === 1 ? '' : 's'} interested`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity 
          style={styles.ticketButton}
          onPress={openTicketLink}
          activeOpacity={0.8}
        >
          <Text style={styles.ticketButtonText}>
            {event.is_free ? 'RSVP NOW' : 'GET TICKETS'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  errorButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  errorButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  imageContainer: {
    height: 300,
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  venueBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  venueBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  eventInfo: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    lineHeight: 30,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  metaText: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
  },
  locationInfo: {
    flex: 1,
  },
  addressText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 24,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  freeTag: {
    backgroundColor: 'rgba(0,212,170,0.2)',
  },
  tagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  descriptionSection: {
    marginTop: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  descriptionText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  ticketButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  ticketButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
