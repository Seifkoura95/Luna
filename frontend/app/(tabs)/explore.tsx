import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { AppBackground } from '../../src/components/AppBackground';
import { PageHeader } from '../../src/components/PageHeader';

// Venue categories
const VENUE_CATEGORIES = {
  ALL: 'all',
  NIGHTLIFE: 'nightclub',
  RESTAURANT: 'restaurant',
};

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Venues',
  nightclub: 'Nightlife',
  restaurant: 'Restaurants & Bars',
};

export default function VenuesScreen() {
  const [venues, setVenues] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(VENUE_CATEGORIES.ALL);
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  

  // Auto scroll to top when tab gains focus
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const fetchVenues = async () => {
    try {
      const data = await api.getVenues();
      setVenues(data);
    } catch (e) {
      console.error('Failed to fetch venues:', e);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVenues();
    setRefreshing(false);
  };

  const handleVenuePress = (venue: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(`/venue/${venue.id}`);
  };

  const handleGetDirections = (venue: any) => {
    const url = `https://maps.google.com/?q=${venue.coordinates.lat},${venue.coordinates.lng}`;
    Linking.openURL(url);
  };

  const handleCategoryChange = (category: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedCategory(category);
  };

  // Filter venues by category
  const getFilteredVenues = () => {
    if (selectedCategory === VENUE_CATEGORIES.ALL) {
      return venues;
    }
    return venues.filter(v => v.type === selectedCategory);
  };

  const filteredVenues = getFilteredVenues();
  const brisbaneVenues = filteredVenues.filter(v => v.region === 'brisbane');
  const goldCoastVenues = filteredVenues.filter(v => v.region === 'gold_coast');

  // Get venue counts by category
  const nightlifeCount = venues.filter(v => v.type === 'nightclub').length;
  const restaurantCount = venues.filter(v => v.type === 'restaurant').length;

  return (
    <View style={styles.container}>
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
      
      {/* Header with Logo */}
      <PageHeader 
        title="VENUES" 
        description={`${venues.length} premier venues across Brisbane & Gold Coast`}
        showPoints={false}
      />

      {/* Category Tabs */}
      <View style={styles.categoryTabs}>
        <TouchableOpacity 
          style={[
            styles.categoryTab, 
            selectedCategory === VENUE_CATEGORIES.ALL && styles.categoryTabActive
          ]}
          onPress={() => handleCategoryChange(VENUE_CATEGORIES.ALL)}
        >
          <Ionicons 
            name="grid" 
            size={16} 
            color={selectedCategory === VENUE_CATEGORIES.ALL ? colors.accent : colors.textMuted} 
          />
          <Text style={[
            styles.categoryTabText,
            selectedCategory === VENUE_CATEGORIES.ALL && styles.categoryTabTextActive
          ]}>
            All ({venues.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.categoryTab, 
            selectedCategory === VENUE_CATEGORIES.NIGHTLIFE && styles.categoryTabActive
          ]}
          onPress={() => handleCategoryChange(VENUE_CATEGORIES.NIGHTLIFE)}
        >
          <Ionicons 
            name="musical-notes" 
            size={16} 
            color={selectedCategory === VENUE_CATEGORIES.NIGHTLIFE ? colors.accent : colors.textMuted} 
          />
          <Text style={[
            styles.categoryTabText,
            selectedCategory === VENUE_CATEGORIES.NIGHTLIFE && styles.categoryTabTextActive
          ]}>
            Nightlife ({nightlifeCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.categoryTab, 
            selectedCategory === VENUE_CATEGORIES.RESTAURANT && styles.categoryTabActive
          ]}
          onPress={() => handleCategoryChange(VENUE_CATEGORIES.RESTAURANT)}
        >
          <Ionicons 
            name="restaurant" 
            size={16} 
            color={selectedCategory === VENUE_CATEGORIES.RESTAURANT ? colors.accent : colors.textMuted} 
          />
          <Text style={[
            styles.categoryTabText,
            selectedCategory === VENUE_CATEGORIES.RESTAURANT && styles.categoryTabTextActive
          ]}>
            Dining ({restaurantCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Brisbane Section */}
        {brisbaneVenues.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.regionBadge}>
                <Ionicons name="location" size={14} color={colors.accent} />
                <Text style={styles.regionText}>BRISBANE</Text>
              </View>
              <Text style={styles.venueCount}>{brisbaneVenues.length} venues</Text>
            </View>

            {brisbaneVenues.map((venue) => (
              <TouchableOpacity
                key={venue.id}
                style={styles.venueCard}
                onPress={() => handleVenuePress(venue)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: venue.image_url }} style={styles.venueImage} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.9)']}
                  style={styles.venueOverlay}
                >
                  <View style={styles.venueContent}>
                    <View style={styles.venueInfo}>
                      <Text style={[styles.venueName, ]}>
                        {venue.name}
                      </Text>
                      <View style={styles.venueMetaRow}>
                        <View style={[styles.venueTypeBadge, { borderColor: venue.accent_color }]}>
                          <Ionicons 
                            name={venue.type === 'nightclub' ? 'musical-notes' : 'restaurant'} 
                            size={10} 
                            color={venue.accent_color} 
                          />
                          <Text style={[styles.venueType, { color: venue.accent_color }]}>
                            {venue.type.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.venueLocation}>{venue.location}</Text>
                      </View>
                      <Text style={styles.venueDescription} numberOfLines={2}>
                        {venue.description}
                      </Text>
                    </View>

                    <View style={styles.venueActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleGetDirections(venue)}
                      >
                        <View style={[styles.actionIcon, { backgroundColor: venue.accent_color + '20' }]}>
                          <Ionicons name="navigate" size={18} color={venue.accent_color} />
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonPrimary]}
                        onPress={() => handleVenuePress(venue)}
                      >
                        <LinearGradient
                          colors={[venue.accent_color, venue.accent_color + 'CC']}
                          style={styles.actionButtonGradient}
                        >
                          <Text style={styles.actionButtonText}>View</Text>
                          <Ionicons name="arrow-forward" size={16} color={colors.textPrimary} />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Gold Coast Section */}
        {goldCoastVenues.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.regionBadge}>
                <Ionicons name="location" size={14} color={colors.gold} />
                <Text style={[styles.regionText, { color: colors.gold }]}>GOLD COAST</Text>
              </View>
              <Text style={styles.venueCount}>{goldCoastVenues.length} venues</Text>
            </View>

            {goldCoastVenues.map((venue) => (
              <TouchableOpacity
                key={venue.id}
                style={styles.venueCard}
                onPress={() => handleVenuePress(venue)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: venue.image_url }} style={styles.venueImage} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.9)']}
                  style={styles.venueOverlay}
                >
                  <View style={styles.venueContent}>
                    <View style={styles.venueInfo}>
                      <Text style={[styles.venueName, ]}>
                        {venue.name}
                      </Text>
                      <View style={styles.venueMetaRow}>
                        <View style={[styles.venueTypeBadge, { borderColor: venue.accent_color }]}>
                          <Ionicons 
                            name={venue.type === 'nightclub' ? 'musical-notes' : 'restaurant'} 
                            size={10} 
                            color={venue.accent_color} 
                          />
                          <Text style={[styles.venueType, { color: venue.accent_color }]}>
                            {venue.type.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.venueLocation}>{venue.location}</Text>
                      </View>
                      <Text style={styles.venueDescription} numberOfLines={2}>
                        {venue.description}
                      </Text>
                    </View>

                    <View style={styles.venueActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleGetDirections(venue)}
                      >
                        <View style={[styles.actionIcon, { backgroundColor: venue.accent_color + '20' }]}>
                          <Ionicons name="navigate" size={18} color={venue.accent_color} />
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonPrimary]}
                        onPress={() => handleVenuePress(venue)}
                      >
                        <LinearGradient
                          colors={[venue.accent_color, venue.accent_color + 'CC']}
                          style={styles.actionButtonGradient}
                        >
                          <Text style={styles.actionButtonText}>View</Text>
                          <Ionicons name="arrow-forward" size={16} color={colors.textPrimary} />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state */}
        {filteredVenues.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No venues found</Text>
            <Text style={styles.emptySubtext}>
              {selectedCategory === VENUE_CATEGORIES.RESTAURANT 
                ? 'More restaurants coming soon!'
                : 'Check back for new venues'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  // Category Tabs
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  categoryTabActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  categoryTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  categoryTabTextActive: {
    color: colors.accent,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  regionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 2,
    marginLeft: spacing.xs,
  },
  venueCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  venueCard: {
    height: 280,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  venueImage: {
    width: '100%',
    height: '100%',
  },
  venueOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'flex-end',
  },
  venueContent: {
    padding: spacing.md,
  },
  venueInfo: {
    marginBottom: spacing.md,
  },
  venueName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  venueMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  venueTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginRight: spacing.sm,
    gap: 4,
  },
  venueType: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  venueLocation: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  venueDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  venueActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  actionIcon: {
    width: '100%',
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonPrimary: {
    flex: 2,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
