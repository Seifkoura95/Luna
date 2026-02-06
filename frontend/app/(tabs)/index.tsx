import React, { useEffect, useState } from 'react';
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
import { MissionCard } from '../../src/components/MissionCard';
import { Ionicons } from '@expo/vector-icons';
import { StarfieldBackground } from '../../src/components/StarfieldBackground';
import { PageHeader } from '../../src/components/PageHeader';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const LUNAR_MOON_IMAGE = 'https://customer-assets.emergentagent.com/job_cluboscenexus/artifacts/ekzz65x8_lunar%20moon.PNG';

export default function TonightScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null); // null = Luna Group (all)
  const [venues, setVenues] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showVenueDropdown, setShowVenueDropdown] = useState(false);

  const fetchData = async () => {
    try {
      const [venuesData, missionsData, eventsData] = await Promise.all([
        api.getVenues(),
        api.getMissions(selectedVenueId || undefined),
        api.getEvents(selectedVenueId || undefined),
      ]);
      setVenues(venuesData);
      setMissions(missionsData || []);
      setEvents(eventsData || []);
      
      // Generate news from venues data
      generateNews(venuesData);
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  };

  const generateNews = (venuesData: any[]) => {
    // Create news/updates from venue data
    const newsItems = [
      {
        id: '1',
        type: 'event',
        title: 'Saturday Night Live',
        subtitle: 'Eclipse Brisbane',
        description: 'International DJ takeover this Saturday. Doors open 9PM.',
        image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
        accent: '#E31837',
        time: '2 hours ago',
      },
      {
        id: '2',
        type: 'promo',
        title: 'Double Points Weekend',
        subtitle: 'All Luna Group Venues',
        description: 'Earn 2x points on all purchases this weekend only.',
        image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400',
        accent: colors.gold,
        time: '5 hours ago',
      },
      {
        id: '3',
        type: 'new',
        title: 'New Menu Launch',
        subtitle: 'Night Market Brisbane',
        description: 'Try our new pan-Asian summer menu featuring wagyu sliders.',
        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400',
        accent: '#FF4757',
        time: '1 day ago',
      },
      {
        id: '4',
        type: 'event',
        title: 'Sunset Sessions',
        subtitle: 'Juju Mermaid Beach',
        description: 'Live acoustic sessions every Sunday from 4PM.',
        image: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=400',
        accent: '#00D4AA',
        time: '2 days ago',
      },
      {
        id: '5',
        type: 'vip',
        title: 'VIP Table Auction',
        subtitle: 'After Dark',
        description: 'Premium booth packages available - bid now!',
        image: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=400',
        accent: '#8B00FF',
        time: '3 days ago',
      },
    ];
    setNews(newsItems);
  };

  useEffect(() => {
    fetchData();
  }, [selectedVenueId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleVenueSelect = (venueId: string | null) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedVenueId(venueId);
    setShowVenueDropdown(false);
  };

  const selectedVenue = venues.find(v => v.id === selectedVenueId);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'event': return 'calendar';
      case 'promo': return 'pricetag';
      case 'new': return 'sparkles';
      case 'vip': return 'diamond';
      default: return 'newspaper';
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'event': return 'EVENT';
      case 'promo': return 'PROMO';
      case 'new': return 'NEW';
      case 'vip': return 'VIP';
      default: return 'UPDATE';
    }
  };

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={60} shootingStarCount={2} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header with Rotating Lunar Moon */}
        <View style={[styles.heroHeader, { paddingTop: insets.top + spacing.lg }]}>
          <RotatingMoon size={80} rotationDuration={30000} />
          <Text style={styles.brandTitle}>LUNA GROUP</Text>
          <View style={styles.brandUnderline} />
          
          {/* Points Badge with Fiery Sun */}
          <View style={styles.pointsContainer}>
            <View style={styles.pointsBadge}>
              <FierySun size={22} />
              <Text style={styles.pointsText}>{user?.points_balance?.toLocaleString() || 0} pts</Text>
            </View>
          </View>
        </View>

        {/* Venue Dropdown Selector */}
        <View style={styles.dropdownSection}>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowVenueDropdown(!showVenueDropdown)}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownLeft}>
              <View style={[
                styles.dropdownIcon, 
                { backgroundColor: selectedVenue?.accent_color ? selectedVenue.accent_color + '20' : colors.accent + '20' }
              ]}>
                <Ionicons 
                  name={selectedVenueId ? 'location' : 'globe'} 
                  size={20} 
                  color={selectedVenue?.accent_color || colors.accent} 
                />
              </View>
              <View>
                <Text style={styles.dropdownLabel}>VIEWING</Text>
                <Text style={styles.dropdownValue}>
                  {selectedVenueId ? selectedVenue?.name : 'Luna Group'}
                </Text>
              </View>
            </View>
            <Ionicons 
              name={showVenueDropdown ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={colors.textSecondary} 
            />
          </TouchableOpacity>

          {/* Dropdown Options */}
          {showVenueDropdown && (
            <View style={styles.dropdownOptions}>
              <TouchableOpacity
                style={[styles.dropdownOption, !selectedVenueId && styles.dropdownOptionActive]}
                onPress={() => handleVenueSelect(null)}
              >
                <Ionicons name="globe" size={18} color={!selectedVenueId ? colors.accent : colors.textMuted} />
                <Text style={[styles.dropdownOptionText, !selectedVenueId && styles.dropdownOptionTextActive]}>
                  Luna Group (All Venues)
                </Text>
                {!selectedVenueId && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </TouchableOpacity>
              
              {venues.map((venue) => (
                <TouchableOpacity
                  key={venue.id}
                  style={[styles.dropdownOption, selectedVenueId === venue.id && styles.dropdownOptionActive]}
                  onPress={() => handleVenueSelect(venue.id)}
                >
                  <View style={[styles.venueDot, { backgroundColor: venue.accent_color }]} />
                  <Text style={[styles.dropdownOptionText, selectedVenueId === venue.id && styles.dropdownOptionTextActive]}>
                    {venue.name}
                  </Text>
                  {selectedVenueId === venue.id && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Content based on selection */}
        {!selectedVenueId ? (
          // LUNA GROUP VIEW - News Feed
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>LATEST UPDATES</Text>
            </View>

            {news.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.newsCard}
                activeOpacity={0.8}
              >
                <Image source={{ uri: item.image }} style={styles.newsImage} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.95)']}
                  style={styles.newsOverlay}
                >
                  <View style={styles.newsContent}>
                    <View style={[styles.typeBadge, { backgroundColor: item.accent + '30' }]}>
                      <Ionicons name={getTypeIcon(item.type)} size={12} color={item.accent} />
                      <Text style={[styles.typeBadgeText, { color: item.accent }]}>{getTypeBadge(item.type)}</Text>
                    </View>
                    <Text style={styles.newsTitle}>{item.title}</Text>
                    <Text style={styles.newsSubtitle}>{item.subtitle}</Text>
                    <Text style={styles.newsDesc} numberOfLines={2}>{item.description}</Text>
                    <Text style={styles.newsTime}>{item.time}</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}

            {/* Quick Links to Venues */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>EXPLORE VENUES</Text>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.venueCardsContainer}
            >
              {venues.map((venue) => (
                <TouchableOpacity
                  key={venue.id}
                  style={styles.venueQuickCard}
                  onPress={() => router.push(`/venue/${venue.id}`)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: venue.image_url }} style={styles.venueQuickImage} />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.9)']}
                    style={styles.venueQuickOverlay}
                  >
                    <Text style={styles.venueQuickName}>{venue.name}</Text>
                    <Text style={styles.venueQuickType}>{venue.type.toUpperCase()}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : (
          // SPECIFIC VENUE VIEW - Perks & Dashboard
          <>
            {/* Venue Header */}
            <View style={styles.venueHeaderCard}>
              <Image source={{ uri: selectedVenue?.image_url }} style={styles.venueHeaderImage} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.95)']}
                style={styles.venueHeaderOverlay}
              >
                <View style={[styles.venueTypeBadge, { borderColor: selectedVenue?.accent_color }]}>
                  <Text style={[styles.venueTypeText, { color: selectedVenue?.accent_color }]}>
                    {selectedVenue?.type?.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.venueHeaderName}>{selectedVenue?.name}</Text>
                <Text style={styles.venueHeaderLocation}>{selectedVenue?.location}</Text>
              </LinearGradient>
            </View>

            {/* Venue Quick Stats */}
            <View style={styles.quickStats}>
              <View style={styles.statItem}>
                <Ionicons name="star" size={20} color={colors.gold} />
                <Text style={styles.statValue}>{selectedVenue?.points_rate || 1}x</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="time" size={20} color={colors.accent} />
                <Text style={styles.statValue}>Open</Text>
                <Text style={styles.statLabel}>Status</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="trophy" size={20} color={selectedVenue?.accent_color || colors.gold} />
                <Text style={styles.statValue}>{missions.length}</Text>
                <Text style={styles.statLabel}>Missions</Text>
              </View>
            </View>

            {/* Active Missions */}
            {missions.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>ACTIVE MISSIONS</Text>
                </View>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.missionsContainer}
                >
                  {missions.slice(0, 5).map((mission) => (
                    <MissionCard key={mission.id} mission={mission} />
                  ))}
                </ScrollView>
              </>
            )}

            {/* Venue Features */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>FEATURES</Text>
            </View>
            <View style={styles.featuresGrid}>
              {selectedVenue?.features?.map((feature: string, index: number) => {
                const featureConfig: Record<string, { icon: string; label: string }> = {
                  booth_booking: { icon: 'people', label: 'VIP Booths' },
                  fast_lane: { icon: 'flash', label: 'Fast Lane' },
                  auctions: { icon: 'trophy', label: 'Auctions' },
                  photos: { icon: 'camera', label: 'Photos' },
                  bottle_service: { icon: 'wine', label: 'Bottles' },
                  table_booking: { icon: 'calendar', label: 'Reservations' },
                  rooftop_terrace: { icon: 'sunny', label: 'Rooftop' },
                };
                const config = featureConfig[feature] || { icon: 'checkmark', label: feature };
                return (
                  <View key={index} style={styles.featureItem}>
                    <View style={[styles.featureIcon, { backgroundColor: selectedVenue?.accent_color + '20' }]}>
                      <Ionicons name={config.icon as any} size={20} color={selectedVenue?.accent_color} />
                    </View>
                    <Text style={styles.featureLabel}>{config.label}</Text>
                  </View>
                );
              })}
            </View>

            {/* View Full Details Button */}
            <TouchableOpacity
              style={styles.viewDetailsButton}
              onPress={() => router.push(`/venue/${selectedVenueId}`)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[selectedVenue?.accent_color || colors.accent, (selectedVenue?.accent_color || colors.accent) + 'CC']}
                style={styles.viewDetailsGradient}
              >
                <Text style={styles.viewDetailsText}>View Full Details</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.textPrimary} />
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  heroHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  moonImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: spacing.md,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 6,
  },
  brandUnderline: {
    width: 50,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
  },
  pointsContainer: {
    marginTop: spacing.md,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldGlow,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: 6,
  },
  pointsText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 14,
  },
  dropdownSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dropdownIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  dropdownValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dropdownOptions: {
    marginTop: spacing.sm,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionActive: {
    backgroundColor: colors.accent + '10',
  },
  dropdownOptionText: {
    flex: 1,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  dropdownOptionTextActive: {
    color: colors.textPrimary,
  },
  venueDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
  },
  newsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  newsImage: {
    width: '100%',
    height: '100%',
  },
  newsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  newsContent: {},
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 4,
    marginBottom: spacing.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  newsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  newsSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  newsDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  newsTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  venueCardsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  venueQuickCard: {
    width: 160,
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  venueQuickImage: {
    width: '100%',
    height: '100%',
  },
  venueQuickOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  venueQuickName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  venueQuickType: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  venueHeaderCard: {
    marginHorizontal: spacing.lg,
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  venueHeaderImage: {
    width: '100%',
    height: '100%',
  },
  venueHeaderOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  venueTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  venueTypeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  venueHeaderName: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  venueHeaderLocation: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 90,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  missionsContainer: {
    paddingHorizontal: spacing.lg,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  featureItem: {
    alignItems: 'center',
    width: (width - spacing.lg * 2 - spacing.md * 2) / 3,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  featureLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  viewDetailsButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  viewDetailsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  viewDetailsText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
