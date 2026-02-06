import React, { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { StarfieldBackground } from '../../src/components/StarfieldBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ExploreScreen() {
  const [venues, setVenues] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const brisbaneVenues = venues.filter(v => v.region === 'brisbane');
  const goldCoastVenues = venues.filter(v => v.region === 'gold_coast');

  return (
    <View style={styles.container}>
      {/* Premium Header with Custom Lunar Image */}
      <LinearGradient
        colors={[colors.background, colors.backgroundElevated]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <View style={styles.logoGlow} />
            <Image
              source={{ uri: 'https://customer-assets.emergentagent.com/job_cluboscenexus/artifacts/ekzz65x8_lunar%20moon.PNG' }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>EXPLORE</Text>
            <View style={styles.headerUnderline} />
          </View>
          <Text style={styles.headerSubtitle}>7 Premier Venues • Brisbane & Gold Coast</Text>
        </View>
      </LinearGradient>

      <ScrollView
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
                    <Text style={styles.venueName}>{venue.name}</Text>
                    <View style={styles.venueMetaRow}>
                      <View style={[styles.venueTypeBadge, { borderColor: venue.accent_color }]}>
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

        {/* Gold Coast Section */}
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
                    <Text style={styles.venueName}>{venue.name}</Text>
                    <View style={styles.venueMetaRow}>
                      <View style={[styles.venueTypeBadge, { borderColor: venue.accent_color }]}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    paddingTop: spacing.xxxl + spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    alignItems: 'center',
  },
  logoContainer: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  logoGlow: {
    position: 'absolute',
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    backgroundColor: colors.accentGlow,
    borderRadius: 50,
    opacity: 0.4,
  },
  logoImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  headerTextContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 8,
    marginBottom: spacing.sm,
  },
  headerUnderline: {
    width: 50,
    height: 3,
    backgroundColor: colors.accent,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 2,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginRight: spacing.sm,
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
});