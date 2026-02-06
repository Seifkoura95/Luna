import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Dimensions,
  Animated,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../../src/theme/colors';
import { api } from '../../src/utils/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookingModal } from '../../src/components/BookingModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = SCREEN_HEIGHT * 0.45;

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeAuctions, setActiveAuctions] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingType, setBookingType] = useState<'reservation' | 'guestlist'>('reservation');

  useEffect(() => {
    fetchVenueData();
  }, [id]);

  const fetchVenueData = async () => {
    try {
      setLoading(true);
      const venueData = await api.getVenue(id!);
      setVenue(venueData);

      // Fetch venue-specific auctions and events
      try {
        const [auctions, events] = await Promise.all([
          api.getAuctions(id, 'active'),
          api.getEvents(id),
        ]);
        setActiveAuctions(auctions || []);
        setUpcomingEvents(events || []);
      } catch (e) {
        console.log('Failed to fetch venue extras:', e);
      }
    } catch (e) {
      console.error('Failed to fetch venue:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleGetDirections = () => {
    if (!venue) return;
    const url = `https://maps.google.com/?q=${venue.coordinates.lat},${venue.coordinates.lng}`;
    Linking.openURL(url);
  };

  const handleOpenWebsite = () => {
    if (venue?.contact?.website) {
      Linking.openURL(venue.contact.website);
    }
  };

  const handleOpenInstagram = () => {
    if (venue?.social?.instagram) {
      const handle = venue.social.instagram.replace('@', '');
      Linking.openURL(`https://instagram.com/${handle}`);
    }
  };

  const handleCall = () => {
    if (venue?.contact?.phone) {
      Linking.openURL(`tel:${venue.contact.phone}`);
    }
  };

  const handleEmail = () => {
    if (venue?.contact?.email) {
      Linking.openURL(`mailto:${venue.contact.email}`);
    }
  };

  const handleBooking = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setBookingType(venue?.type === 'restaurant' ? 'reservation' : 'guestlist');
    setShowBookingModal(true);
  };

  // Animated header opacity
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>Venue not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOpen = venue.status !== 'closed';
  const hasOperatingHours = venue.operating_hours && !venue.operating_hours.status;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Animated Header Bar */}
      <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity, paddingTop: insets.top }]}>
        <BlurView intensity={80} tint="dark" style={styles.blurHeader}>
          <TouchableOpacity style={styles.headerBackButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.animatedHeaderTitle} numberOfLines={1}>{venue.name}</Text>
          <View style={styles.headerSpacer} />
        </BlurView>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: venue.hero_image || venue.image_url }}
            style={styles.heroImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(13,13,15,1)']}
            style={styles.heroGradient}
          />

          {/* Back Button */}
          <TouchableOpacity
            style={[styles.floatingBackButton, { top: insets.top + 10 }]}
            onPress={handleBack}
          >
            <BlurView intensity={60} tint="dark" style={styles.blurButton}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </BlurView>
          </TouchableOpacity>

          {/* Venue Info Overlay */}
          <View style={styles.heroContent}>
            <View style={[styles.statusBadge, { backgroundColor: isOpen ? colors.success + '30' : colors.error + '30' }]}>
              <View style={[styles.statusDot, { backgroundColor: isOpen ? colors.success : colors.error }]} />
              <Text style={[styles.statusText, { color: isOpen ? colors.success : colors.error }]}>
                {venue.status?.toUpperCase() || 'OPEN'}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{venue.name}</Text>
            <Text style={styles.heroTagline}>{venue.tagline}</Text>
            <View style={styles.heroMeta}>
              <View style={[styles.typeBadge, { borderColor: venue.accent_color }]}>
                <Text style={[styles.typeText, { color: venue.accent_color }]}>
                  {venue.type?.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.locationText}>
                <Ionicons name="location" size={14} color={colors.textSecondary} /> {venue.location}
              </Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction} onPress={handleGetDirections}>
              <LinearGradient
                colors={[venue.accent_color + '30', venue.accent_color + '10']}
                style={styles.quickActionGradient}
              >
                <Ionicons name="navigate" size={22} color={venue.accent_color} />
              </LinearGradient>
              <Text style={styles.quickActionLabel}>Directions</Text>
            </TouchableOpacity>

            {venue.contact?.website && (
              <TouchableOpacity style={styles.quickAction} onPress={handleOpenWebsite}>
                <LinearGradient
                  colors={[colors.accent + '30', colors.accent + '10']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="globe" size={22} color={colors.accent} />
                </LinearGradient>
                <Text style={styles.quickActionLabel}>Website</Text>
              </TouchableOpacity>
            )}

            {venue.social?.instagram && (
              <TouchableOpacity style={styles.quickAction} onPress={handleOpenInstagram}>
                <LinearGradient
                  colors={['#E1306C30', '#E1306C10']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="logo-instagram" size={22} color="#E1306C" />
                </LinearGradient>
                <Text style={styles.quickActionLabel}>Instagram</Text>
              </TouchableOpacity>
            )}

            {venue.contact?.phone && (
              <TouchableOpacity style={styles.quickAction} onPress={handleCall}>
                <LinearGradient
                  colors={[colors.success + '30', colors.success + '10']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="call" size={22} color={colors.success} />
                </LinearGradient>
                <Text style={styles.quickActionLabel}>Call</Text>
              </TouchableOpacity>
            )}

            {venue.contact?.email && (
              <TouchableOpacity style={styles.quickAction} onPress={handleEmail}>
                <LinearGradient
                  colors={[colors.gold + '30', colors.gold + '10']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="mail" size={22} color={colors.gold} />
                </LinearGradient>
                <Text style={styles.quickActionLabel}>Email</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>
              {venue.long_description || venue.description}
            </Text>
          </View>

          {/* Operating Hours */}
          {hasOperatingHours && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Opening Hours</Text>
              <View style={styles.hoursContainer}>
                {Object.entries(venue.operating_hours).map(([day, hours]: [string, any]) => (
                  <View key={day} style={styles.hoursRow}>
                    <Text style={styles.dayText}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                    <Text style={styles.hoursText}>{hours}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {venue.operating_hours?.status === 'Coming Soon' && (
            <View style={styles.section}>
              <View style={styles.comingSoonBadge}>
                <Ionicons name="time" size={20} color={colors.gold} />
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              </View>
            </View>
          )}

          {/* Music & Vibe (for nightclubs/bars) */}
          {venue.music_genres && venue.music_genres.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Music & Vibe</Text>
              <View style={styles.tagsContainer}>
                {venue.music_genres.map((genre: string, index: number) => (
                  <View key={index} style={[styles.tag, { borderColor: venue.accent_color + '60' }]}>
                    <Ionicons name="musical-notes" size={14} color={venue.accent_color} />
                    <Text style={[styles.tagText, { color: venue.accent_color }]}>{genre}</Text>
                  </View>
                ))}
              </View>
              {venue.dress_code && (
                <View style={styles.dressCodeContainer}>
                  <Ionicons name="shirt" size={16} color={colors.textSecondary} />
                  <Text style={styles.dressCodeText}>{venue.dress_code}</Text>
                </View>
              )}
            </View>
          )}

          {/* Cuisine (for restaurants) */}
          {venue.cuisine && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cuisine</Text>
              <View style={styles.cuisineRow}>
                <View style={[styles.cuisineBadge, { backgroundColor: venue.accent_color + '20' }]}>
                  <Ionicons name="restaurant" size={16} color={venue.accent_color} />
                  <Text style={[styles.cuisineText, { color: venue.accent_color }]}>{venue.cuisine}</Text>
                </View>
                {venue.price_range && (
                  <Text style={styles.priceRange}>{venue.price_range}</Text>
                )}
              </View>
              {venue.dietary_options && venue.dietary_options.length > 0 && (
                <View style={styles.dietaryContainer}>
                  {venue.dietary_options.map((option: string, index: number) => (
                    <View key={index} style={styles.dietaryBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                      <Text style={styles.dietaryText}>{option}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featuresGrid}>
              {venue.features?.map((feature: string, index: number) => {
                const featureIcons: Record<string, string> = {
                  booth_booking: 'people',
                  fast_lane: 'flash',
                  auctions: 'trophy',
                  photos: 'camera',
                  vip_tables: 'star',
                  bottle_service: 'wine',
                  rooftop_terrace: 'sunny',
                  table_booking: 'calendar',
                  private_dining: 'lock-closed',
                  group_dining: 'people-circle',
                  cocktail_bar: 'beer',
                  cafe: 'cafe',
                };
                const featureNames: Record<string, string> = {
                  booth_booking: 'VIP Booths',
                  fast_lane: 'Fast Lane',
                  auctions: 'Auctions',
                  photos: 'Event Photos',
                  vip_tables: 'VIP Tables',
                  bottle_service: 'Bottle Service',
                  rooftop_terrace: 'Rooftop Terrace',
                  table_booking: 'Table Booking',
                  private_dining: 'Private Dining',
                  group_dining: 'Group Dining',
                  cocktail_bar: 'Cocktail Bar',
                  cafe: 'Cafe',
                };
                return (
                  <View key={index} style={styles.featureItem}>
                    <View style={[styles.featureIcon, { backgroundColor: venue.accent_color + '20' }]}>
                      <Ionicons
                        name={(featureIcons[feature] || 'checkmark') as any}
                        size={20}
                        color={venue.accent_color}
                      />
                    </View>
                    <Text style={styles.featureName}>{featureNames[feature] || feature}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Active Auctions */}
          {activeAuctions.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Active Auctions</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/auctions')}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              {activeAuctions.slice(0, 2).map((auction: any) => (
                <TouchableOpacity
                  key={auction.id}
                  style={styles.auctionCard}
                  onPress={() => router.push('/(tabs)/auctions')}
                >
                  <Image source={{ uri: auction.image_url }} style={styles.auctionImage} />
                  <View style={styles.auctionContent}>
                    <Text style={styles.auctionTitle}>{auction.title}</Text>
                    <Text style={styles.auctionBid}>Current Bid: ${auction.current_bid}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <TouchableOpacity style={styles.addressCard} onPress={handleGetDirections}>
              <View style={styles.addressContent}>
                <Ionicons name="location" size={24} color={venue.accent_color} />
                <View style={styles.addressText}>
                  <Text style={styles.addressLine}>{venue.address}</Text>
                  <Text style={styles.addressAction}>Tap to get directions</Text>
                </View>
              </View>
              <Ionicons name="navigate" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Gallery */}
          {venue.gallery && venue.gallery.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gallery</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
                {venue.gallery.map((image: string, index: number) => (
                  <Image key={index} source={{ uri: image }} style={styles.galleryImage} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Bottom Spacer */}
          <View style={{ height: 100 }} />
        </View>
      </Animated.ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCTA, { paddingBottom: insets.bottom + 10 }]}>
        <LinearGradient
          colors={[venue.accent_color, venue.accent_color + 'CC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaButton}
        >
          <TouchableOpacity style={styles.ctaButtonInner} onPress={handleBooking}>
            <Text style={styles.ctaButtonText}>
              {venue.type === 'restaurant' ? 'Book a Table' : 'Get on the List'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Booking Modal */}
      <BookingModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        venue={venue}
        type={bookingType}
      />
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
  errorText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
  },
  backButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  blurHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  heroContainer: {
    height: HEADER_HEIGHT,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  floatingBackButton: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
  },
  blurButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroContent: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  heroTagline: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  locationText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  quickActionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  hoursContainer: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  hoursText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold + '20',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  comingSoonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gold,
    marginLeft: spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 6,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dressCodeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  dressCodeText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  cuisineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cuisineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: 6,
  },
  cuisineText: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceRange: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gold,
  },
  dietaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dietaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  dietaryText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  featureItem: {
    alignItems: 'center',
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md * 2) / 3,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  featureName: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  auctionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  auctionImage: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  auctionContent: {
    flex: 1,
  },
  auctionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  auctionBid: {
    fontSize: 13,
    color: colors.gold,
    fontWeight: '500',
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  addressLine: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: 2,
  },
  addressAction: {
    fontSize: 12,
    color: colors.textMuted,
  },
  gallery: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  galleryImage: {
    width: 200,
    height: 140,
    borderRadius: radius.md,
    marginRight: spacing.sm,
  },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  ctaButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
