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
import { Icon } from '../../src/components/Icon';
import * as Haptics from 'expo-haptics';
import { colors, radius } from '../../src/theme/colors';
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
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<{ going_count: number; interested_count: number; friends_going: any[]; friends_interested: any[] }>({ going_count: 0, interested_count: 0, friends_going: [], friends_interested: [] });
  const [loadingRsvp, setLoadingRsvp] = useState(false);

  // Safe ID - handle both string and array from useLocalSearchParams
  const eventId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    if (eventId) {
      loadEvent();
      loadRsvp();
      loadAttendees();
    }
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      console.log('Loading event with ID:', eventId);
      const data = await api.getEventDetail(eventId);
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
      const data = await api.getMyEventRsvp(eventId as string);
      setRsvpStatus(data.rsvp?.status || null);
    } catch (err) {
      console.log('No RSVP found');
    }
  };

  const loadAttendees = async () => {
    try {
      const data = await api.getEventAttendees(eventId as string);
      setAttendees({
        going_count: data?.going_count || 0,
        interested_count: data?.interested_count || 0,
        friends_going: data?.friends_going || [],
        friends_interested: data?.friends_interested || []
      });
    } catch (err) {
      console.log('Failed to load attendees');
    }
  };

  const handleRsvp = async (status: 'going' | 'interested' | 'not_going') => {
    if (loadingRsvp) return;
    
    setLoadingRsvp(true);
    handleHaptic();
    
    try {
      await api.rsvpToEvent(eventId as string, status, false);
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
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={48} color={colors.textMuted} />
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
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { handleHaptic(); }} style={styles.shareButton}>
          <Icon name="share-outline" size={24} color="#fff" />
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
            <Icon name="calendar-outline" size={18} color={colors.accent} />
            <Text style={styles.metaText}>{formatDate(event.date)}</Text>
          </View>
          
          <View style={styles.metaRow}>
            <Icon name="time-outline" size={18} color={colors.accent} />
            <Text style={styles.metaText}>
              {formatTime(event.time)}
              {event.end_time && ` - ${formatTime(event.end_time)}`}
            </Text>
          </View>
          
          <View style={styles.metaRow}>
            <Icon name="location-outline" size={18} color={colors.accent} />
            <View style={styles.locationInfo}>
              <Text style={styles.metaText}>{event.venue_name}</Text>
              <Text style={styles.addressText}>{event.address}</Text>
            </View>
          </View>

          {event.restrictions && (
            <View style={styles.metaRow}>
              <Icon name="information-circle-outline" size={18} color={colors.accent} />
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
                <Icon 
                  name="checkmark-circle" 
                  size={24} 
                  color={rsvpStatus === 'going' ? colors.success : colors.textMuted} 
                />
                <Text style={[styles.rsvpButtonText, rsvpStatus === 'going' && styles.rsvpButtonTextActive]}>
                  Going
                </Text>
                {(attendees?.going_count || 0) > 0 && (
                  <Text style={styles.rsvpCount}>{attendees.going_count}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rsvpButton, rsvpStatus === 'interested' && styles.rsvpButtonActive]}
                onPress={() => handleRsvp('interested')}
                disabled={loadingRsvp}
              >
                <Icon 
                  name="star" 
                  size={24} 
                  color={rsvpStatus === 'interested' ? colors.accent : colors.textMuted} 
                />
                <Text style={[styles.rsvpButtonText, rsvpStatus === 'interested' && styles.rsvpButtonTextActive]}>
                  Interested
                </Text>
                {(attendees?.interested_count || 0) > 0 && (
                  <Text style={styles.rsvpCount}>{attendees.interested_count}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Friends Going */}
            {((attendees?.friends_going?.length || 0) > 0 || (attendees?.friends_interested?.length || 0) > 0) && (
              <View style={styles.friendsSection}>
                <Icon name="people" size={16} color={colors.textMuted} />
                <Text style={styles.friendsText}>
                  {(attendees?.friends_going?.length || 0) > 0 && `${attendees.friends_going.map(f => f.name).join(', ')} ${attendees.friends_going.length === 1 ? 'is' : 'are'} going`}
                  {(attendees?.friends_going?.length || 0) > 0 && (attendees?.friends_interested?.length || 0) > 0 && ' • '}
                  {(attendees?.friends_interested?.length || 0) > 0 && `${attendees.friends_interested.length} friend${attendees.friends_interested.length === 1 ? '' : 's'} interested`}
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
          <Icon name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: colors.textTertiary,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  errorButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
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
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.glassBorder,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.glassBorder,
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
    borderRadius: radius.sm,
  },
  venueBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  eventInfo: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
    lineHeight: 30,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  metaText: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  locationInfo: {
    flex: 1,
  },
  addressText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 24,
  },
  tag: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  freeTag: {
    backgroundColor: colors.greenDim,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  tagText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  descriptionSection: {
    marginTop: 8,
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  descriptionText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  ticketButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.lg,
    gap: 8,
  },
  ticketButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  rsvpSection: {
    paddingTop: 24,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  rsvpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 14,
    borderRadius: radius.lg,
    gap: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  rsvpButtonActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  rsvpButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  rsvpButtonTextActive: {
    color: colors.text,
  },
  rsvpCount: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentDim,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  friendsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  friendsText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
