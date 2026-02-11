import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  FlatList,
  RefreshControl,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
  SlideInRight,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../src/theme/colors';
import { PageHeader } from '../src/components/PageHeader';
import { StarfieldBackground } from '../src/components/StarfieldBackground';
import { GlassCard } from '../src/components/GlassCard';
import { LiveIndicator } from '../src/components/LiveIndicator';
import { useAuthStore } from '../src/store/authStore';
import { useFonts, fonts } from '../src/hooks/useFonts';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - spacing.lg * 2 - spacing.sm * 2) / 3;

// Mock photo data - In production, this would come from the API
const MOCK_EVENTS_WITH_PHOTOS = [
  {
    id: 'event1',
    name: 'Saturday Night Takeover',
    venue: 'Eclipse',
    date: '2026-02-08',
    coverImage: 'https://images.unsplash.com/photo-1713885462557-12b5c41f22cd?w=800',
    photos: [
      { id: 'p1', url: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=600', likes: 124, tagged: ['John D.', 'Sarah M.'] },
      { id: 'p2', url: 'https://images.unsplash.com/photo-1680416124175-f70a22323763?w=600', likes: 89, tagged: [] },
      { id: 'p3', url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600', likes: 203, tagged: ['Mike R.'] },
      { id: 'p4', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600', likes: 156, tagged: [] },
      { id: 'p5', url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600', likes: 78, tagged: ['You'] },
      { id: 'p6', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600', likes: 234, tagged: [] },
    ],
  },
  {
    id: 'event2',
    name: 'S2O Pre-Party',
    venue: 'Eclipse',
    date: '2026-02-01',
    coverImage: 'https://images.unsplash.com/photo-1680416124175-f70a22323763?w=800',
    photos: [
      { id: 'p7', url: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=600', likes: 312, tagged: [] },
      { id: 'p8', url: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=600', likes: 187, tagged: ['You', 'Lisa K.'] },
      { id: 'p9', url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600', likes: 145, tagged: [] },
    ],
  },
  {
    id: 'event3',
    name: 'VIP Launch Night',
    venue: 'Su Casa Brisbane',
    date: '2026-01-25',
    coverImage: 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=800',
    photos: [
      { id: 'p10', url: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=600', likes: 98, tagged: [] },
      { id: 'p11', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600', likes: 167, tagged: ['You'] },
    ],
  },
];

export default function PhotoGalleryScreen() {
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
  const fontsLoaded = useFonts();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'tagged'>('all');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleShare = async (photo: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      await Share.share({
        message: `Check out this photo from Luna Group! 🌙`,
        url: photo.url,
      });
    } catch (e) {
      console.log('Share cancelled');
    }
  };

  const handleLike = (photo: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // In production, this would call the API
    Alert.alert('Liked!', 'Photo added to your favorites');
  };

  const handleTagSelf = (photo: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert('Tag Yourself', 'You have been tagged in this photo!');
  };

  const filteredEvents = filter === 'tagged' 
    ? MOCK_EVENTS_WITH_PHOTOS.map(event => ({
        ...event,
        photos: event.photos.filter(p => p.tagged.includes('You'))
      })).filter(event => event.photos.length > 0)
    : MOCK_EVENTS_WITH_PHOTOS;

  const renderEventCard = ({ item: event }: { item: any }) => (
    <Animated.View entering={FadeIn.duration(400)}>
      <TouchableOpacity 
        style={styles.eventCard}
        onPress={() => setSelectedEvent(event)}
        activeOpacity={0.9}
      >
        <GlassCard noPadding>
          <Image source={{ uri: event.coverImage }} style={styles.eventCover} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.9)']}
            style={styles.eventOverlay}
          >
            <View style={styles.eventInfo}>
              <Text style={[styles.eventName, fontsLoaded && { fontFamily: fonts.bold }]}>
                {event.name}
              </Text>
              <View style={styles.eventMeta}>
                <Text style={styles.eventVenue}>{event.venue}</Text>
                <Text style={styles.eventDate}>{event.date}</Text>
              </View>
              <View style={styles.photoCount}>
                <Ionicons name="images" size={14} color={colors.textSecondary} />
                <Text style={styles.photoCountText}>{event.photos.length} photos</Text>
              </View>
            </View>
          </LinearGradient>
          {event.photos.some((p: any) => p.tagged.includes('You')) && (
            <View style={styles.taggedBadge}>
              <Ionicons name="person" size={10} color={colors.textPrimary} />
              <Text style={styles.taggedText}>You're tagged</Text>
            </View>
          )}
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={60} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <PageHeader 
          title="PHOTOS"
          description="Relive your nights out"
          showLogo={false}
        />

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
              All Events
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'tagged' && styles.filterTabActive]}
            onPress={() => setFilter('tagged')}
          >
            <Ionicons 
              name="person" 
              size={14} 
              color={filter === 'tagged' ? colors.accent : colors.textSecondary} 
            />
            <Text style={[styles.filterTabText, filter === 'tagged' && styles.filterTabTextActive]}>
              Tagged
            </Text>
          </TouchableOpacity>
        </View>

        {/* Events List */}
        <View style={styles.eventsContainer}>
          {filteredEvents.map((event) => (
            <View key={event.id}>
              {renderEventCard({ item: event })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Event Photos Modal */}
      <Modal
        visible={!!selectedEvent}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={[colors.backgroundCard, colors.background]}
            style={StyleSheet.absoluteFill}
          />
          
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedEvent(null)} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.modalHeaderText}>
              <Text style={[styles.modalTitle, fontsLoaded && { fontFamily: fonts.bold }]}>
                {selectedEvent?.name}
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedEvent?.venue} • {selectedEvent?.date}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Photo Grid */}
          <FlatList
            data={selectedEvent?.photos || []}
            numColumns={3}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.photoGrid}
            renderItem={({ item: photo }) => (
              <TouchableOpacity
                style={styles.photoItem}
                onPress={() => setSelectedPhoto(photo)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: photo.url }} style={styles.photoImage} />
                {photo.tagged.includes('You') && (
                  <View style={styles.photoTagBadge}>
                    <Ionicons name="person" size={10} color={colors.textPrimary} />
                  </View>
                )}
                <View style={styles.photoLikes}>
                  <Ionicons name="heart" size={10} color={colors.accent} />
                  <Text style={styles.photoLikesText}>{photo.likes}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Photo Detail Modal */}
      <Modal
        visible={!!selectedPhoto}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.photoDetailModal}>
          <TouchableOpacity
            style={styles.photoDetailClose}
            onPress={() => setSelectedPhoto(null)}
          >
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <Image
            source={{ uri: selectedPhoto?.url }}
            style={styles.photoDetailImage}
            resizeMode="contain"
          />

          {/* Photo Actions */}
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoAction} onPress={() => handleLike(selectedPhoto)}>
              <Ionicons name="heart-outline" size={28} color={colors.textPrimary} />
              <Text style={styles.photoActionText}>{selectedPhoto?.likes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoAction} onPress={() => handleTagSelf(selectedPhoto)}>
              <Ionicons name="person-add-outline" size={28} color={colors.textPrimary} />
              <Text style={styles.photoActionText}>Tag</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoAction} onPress={() => handleShare(selectedPhoto)}>
              <Ionicons name="share-outline" size={28} color={colors.textPrimary} />
              <Text style={styles.photoActionText}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Tagged People */}
          {selectedPhoto?.tagged.length > 0 && (
            <View style={styles.taggedPeople}>
              <Text style={styles.taggedPeopleTitle}>Tagged:</Text>
              <Text style={styles.taggedPeopleList}>
                {selectedPhoto.tagged.join(', ')}
              </Text>
            </View>
          )}
        </View>
      </Modal>
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  filterTabActive: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.accent,
  },
  eventsContainer: {
    gap: spacing.md,
  },
  eventCard: {
    marginBottom: spacing.sm,
  },
  eventCover: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
  },
  eventOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  eventInfo: {
    gap: spacing.xs,
  },
  eventName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  eventMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  eventVenue: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  eventDate: {
    fontSize: 13,
    color: colors.textMuted,
  },
  photoCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  photoCountText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  taggedBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  taggedText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  photoGrid: {
    padding: spacing.xs,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    margin: spacing.xs / 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoTagBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.accent,
    padding: 4,
    borderRadius: radius.full,
  },
  photoLikes: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  photoLikesText: {
    fontSize: 10,
    color: colors.textPrimary,
  },
  // Photo Detail Modal
  photoDetailModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoDetailClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: spacing.sm,
  },
  photoDetailImage: {
    width: width,
    height: width,
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  photoAction: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  photoActionText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  taggedPeople: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  taggedPeopleTitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  taggedPeopleList: {
    fontSize: 14,
    color: colors.textPrimary,
  },
});
