import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius } from '../src/theme/colors';
import { AppBackground } from '../src/components/AppBackground';

export default function AboutPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const venues = [
    { name: 'Eclipse', location: 'Fortitude Valley, Brisbane' },
    { name: 'After Dark', location: 'Fortitude Valley, Brisbane' },
    { name: 'Su Casa', location: 'Brisbane & Gold Coast' },
    { name: 'Juju', location: 'Mermaid Beach, Gold Coast' },
    { name: 'Night Market', location: 'Brisbane' },
    { name: 'Ember & Ash', location: 'Brisbane' },
  ];

  const socialLinks = [
    { icon: 'logo-instagram', url: 'https://instagram.com/lunagrouphospitality', color: '#E4405F' },
    { icon: 'logo-facebook', url: 'https://facebook.com/lunagrouphospitality', color: '#1877F2' },
    { icon: 'logo-tiktok', url: 'https://tiktok.com/@lunagrouphospitality', color: '#000' },
    { icon: 'globe', url: 'https://lunagroup.com.au', color: colors.gold },
  ];

  return (
    <View style={styles.container}>
      <AppBackground />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ABOUT</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logoText}>LUNA GROUP</Text>
          <Text style={styles.tagline}>Brisbane • Gold Coast</Text>
        </View>

        {/* About Text */}
        <View style={styles.section}>
          <Text style={styles.aboutText}>
            Luna Group Hospitality is Queensland's premier nightlife and entertainment company, 
            operating some of the most iconic venues across Brisbane and the Gold Coast.
          </Text>
          <Text style={styles.aboutText}>
            From exclusive nightclubs to sophisticated dining experiences, we create unforgettable 
            moments that define Queensland's nightlife scene.
          </Text>
        </View>

        {/* Our Venues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OUR VENUES</Text>
          {venues.map((venue, index) => (
            <View key={index} style={styles.venueCard}>
              <Text style={styles.venueName}>{venue.name}</Text>
              <Text style={styles.venueLocation}>{venue.location}</Text>
            </View>
          ))}
        </View>

        {/* Social Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FOLLOW US</Text>
          <View style={styles.socialGrid}>
            {socialLinks.map((link, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.socialButton, { backgroundColor: link.color + '20' }]}
                onPress={() => Linking.openURL(link.url)}
              >
                <Ionicons name={link.icon as any} size={28} color={link.color} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Luna Group VIP v1.0.0</Text>
          <Text style={styles.appCopyright}>© 2024 Luna Group Hospitality. All rights reserved.</Text>
        </View>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: 200,
    height: 80,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 14,
    color: colors.textMuted,
    letterSpacing: 4,
    marginTop: spacing.sm,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  aboutText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  venueCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  venueName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  venueLocation: {
    fontSize: 12,
    color: colors.textMuted,
  },
  socialGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  appVersion: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  appCopyright: {
    fontSize: 12,
    color: colors.textMuted,
    opacity: 0.6,
    textAlign: 'center',
  },
});
