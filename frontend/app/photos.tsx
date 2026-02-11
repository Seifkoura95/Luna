import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  RefreshControl,
  Share,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, radius } from '../src/theme/colors';
import { PageHeader } from '../src/components/PageHeader';
import { StarfieldBackground } from '../src/components/StarfieldBackground';
import { GlassCard } from '../src/components/GlassCard';
import { useAuthStore } from '../src/store/authStore';
import { useFonts, fonts } from '../src/hooks/useFonts';
import { api } from '../src/utils/api';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - spacing.lg * 2 - spacing.sm * 2) / 3;

// API URL for image loading
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface VenueGallery {
  venue_id: string;
  venue_name: string;
  folder: string;
  photo_count: number;
  cover_image: string | null;
  accent_color: string;
}

interface Photo {
  id: string;
  filename: string;
  url: string;
  venue_id: string;
  likes: number;
  tagged: string[];
}

export default function PhotoGalleryScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fontsLoaded = useFonts();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [galleries, setGalleries] = useState<VenueGallery[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<VenueGallery | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const fetchGalleries = async () => {
    try {
      setLoading(true);
      const data = await api.getVenueGalleries();
      setGalleries(data);
    } catch (e) {
      console.error('Failed to fetch galleries:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGalleries();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGalleries();
    setRefreshing(false);
  }, []);

  const openGallery = async (gallery: VenueGallery) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedGallery(gallery);
    setLoadingPhotos(true);
    try {
      const photos = await api.getVenuePhotos(gallery.venue_id);
      setGalleryPhotos(photos);
    } catch (e) {
      console.error('Failed to fetch photos:', e);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleShare = async (photo: Photo) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      await Share.share({
        message: `Check out this photo from ${selectedGallery?.venue_name || 'Luna Group'}! 🌙`,
        url: photo.url,
      });
    } catch (e) {
      console.log('Share cancelled');
    }
  };

  const handleLike = (photo: Photo) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert('Liked!', 'Photo added to your favorites');
  };

  const renderGalleryCard = ({ item: gallery, index }: { item: VenueGallery; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
      <TouchableOpacity 
        style={styles.galleryCard}
        onPress={() => openGallery(gallery)}
        activeOpacity={0.9}
      >
        <GlassCard noPadding>
          {gallery.cover_image ? (
            <Image 
              source={{ uri: `${API_BASE}${gallery.cover_image}` }} 
              style={styles.galleryCover}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.galleryCover, styles.placeholderCover]}>
              <Ionicons name="images" size={40} color={colors.textMuted} />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.9)']}
            style={styles.galleryOverlay}
          >
            <View style={styles.galleryInfo}>
              <Text style={[styles.galleryName, fontsLoaded && { fontFamily: fonts.bold }]}>
                {gallery.venue_name}
              </Text>
              <View style={styles.photoCount}>
                <Ionicons name="images" size={14} color={colors.textSecondary} />
                <Text style={styles.photoCountText}>{gallery.photo_count} photos</Text>
              </View>
            </View>
          </LinearGradient>
          <View style={[styles.accentBar, { backgroundColor: gallery.accent_color }]} />
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderPhotoItem = ({ item: photo, index }: { item: Photo; index: number }) => (
    <TouchableOpacity
      style={styles.photoItem}
      onPress={() => setSelectedPhoto(photo)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: `${API_BASE}${photo.url}` }} style={styles.photoImage} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StarfieldBackground starCount={30} />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading galleries...</Text>
      </View>
    );
  }

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
          description="Browse venue photo galleries"
          showLogo={false}
        />

        {/* Gallery Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, fontsLoaded && { fontFamily: fonts.bold }]}>
              {galleries.length}
            </Text>
            <Text style={styles.statLabel}>Venues</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, fontsLoaded && { fontFamily: fonts.bold }]}>
              {galleries.reduce((sum, g) => sum + g.photo_count, 0)}
            </Text>
            <Text style={styles.statLabel}>Total Photos</Text>
          </View>
        </View>

        {/* Venue Galleries */}
        <View style={styles.galleriesContainer}>
          {galleries.map((gallery, index) => (
            <View key={gallery.venue_id}>
              {renderGalleryCard({ item: gallery, index })}
            </View>
          ))}
        </View>

        {galleries.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>No photo galleries available yet</Text>
          </View>
        )}
      </ScrollView>

      {/* Gallery Photos Modal */}
      <Modal
        visible={!!selectedGallery}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedGallery(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={[colors.backgroundCard, colors.background]}
            style={StyleSheet.absoluteFill}
          />
          
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedGallery(null)} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.modalHeaderText}>
              <Text style={[styles.modalTitle, fontsLoaded && { fontFamily: fonts.bold }]}>
                {selectedGallery?.venue_name}
              </Text>
              <Text style={styles.modalSubtitle}>
                {galleryPhotos.length} photos
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Photo Grid */}
          {loadingPhotos ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.photoScrollContent}>
              <View style={styles.photoGrid}>
                {galleryPhotos.map((photo) => (
                  <TouchableOpacity
                    key={photo.id}
                    onPress={() => setSelectedPhoto(photo)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.photoItemContainer}>
                      <Image 
                        source={{ uri: `${API_BASE}${photo.url}` }} 
                        style={styles.photoThumbnail}
                        contentFit="cover"
                        transition={200}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
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
            style={[styles.photoDetailClose, { top: insets.top + 20 }]}
            onPress={() => setSelectedPhoto(null)}
          >
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <Image
            source={{ uri: selectedPhoto ? `${API_BASE}${selectedPhoto.url}` : '' }}
            style={styles.photoDetailImage}
            resizeMode="contain"
          />

          {/* Photo Actions */}
          <View style={[styles.photoActions, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity style={styles.photoAction} onPress={() => selectedPhoto && handleLike(selectedPhoto)}>
              <Ionicons name="heart-outline" size={28} color={colors.textPrimary} />
              <Text style={styles.photoActionText}>Like</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoAction} onPress={() => selectedPhoto && handleShare(selectedPhoto)}>
              <Ionicons name="share-outline" size={28} color={colors.textPrimary} />
              <Text style={styles.photoActionText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.photoAction}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                Alert.alert('Download', 'Photo download feature coming soon!');
              }}
            >
              <Ionicons name="download-outline" size={28} color={colors.textPrimary} />
              <Text style={styles.photoActionText}>Save</Text>
            </TouchableOpacity>
          </View>
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  // Galleries
  galleriesContainer: {
    gap: spacing.md,
  },
  galleryCard: {
    marginBottom: spacing.sm,
  },
  galleryCover: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
  },
  placeholderCover: {
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  galleryInfo: {
    gap: spacing.xs,
  },
  galleryName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  photoCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  photoCountText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  accentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textMuted,
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
  photoGridContainer: {
    width: '100%',
    paddingHorizontal: spacing.xs,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    width: '100%',
  },
  photoItem: {
    margin: spacing.xs / 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.backgroundCard,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
    right: 20,
    zIndex: 10,
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.full,
  },
  photoDetailImage: {
    width: width,
    height: width,
  },
  photoActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingTop: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  photoAction: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  photoActionText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
