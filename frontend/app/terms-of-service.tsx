import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../src/theme/colors';
import { VideoBackground } from '../src/components/VideoBackground';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <VideoBackground intensity={30} tint="dark" overlayOpacity={0.4} />
      
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last Updated: February 2025</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing or using the Luna Group mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Eligibility</Text>
          <Text style={styles.paragraph}>
            You must be at least 18 years of age to use this App. By using the App, you represent and warrant that you are at least 18 years old and have the legal capacity to enter into these Terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Account Registration</Text>
          <Text style={styles.paragraph}>
            To access certain features, you must create an account. You agree to:
          </Text>
          <Text style={styles.bulletPoint}>• Provide accurate and complete information</Text>
          <Text style={styles.bulletPoint}>• Maintain the security of your account credentials</Text>
          <Text style={styles.bulletPoint}>• Notify us immediately of any unauthorized access</Text>
          <Text style={styles.bulletPoint}>• Accept responsibility for all activities under your account</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Use of Services</Text>
          <Text style={styles.paragraph}>You agree to use the App only for lawful purposes. You shall not:</Text>
          <Text style={styles.bulletPoint}>• Violate any applicable laws or regulations</Text>
          <Text style={styles.bulletPoint}>• Infringe on the rights of others</Text>
          <Text style={styles.bulletPoint}>• Transmit harmful or malicious content</Text>
          <Text style={styles.bulletPoint}>• Attempt to gain unauthorized access to our systems</Text>
          <Text style={styles.bulletPoint}>• Use the App for any fraudulent purpose</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Bookings and Reservations</Text>
          <Text style={styles.paragraph}>
            When making bookings through the App:
          </Text>
          <Text style={styles.bulletPoint}>• All bookings are subject to availability</Text>
          <Text style={styles.bulletPoint}>• Cancellation policies vary by venue and event</Text>
          <Text style={styles.bulletPoint}>• You must comply with venue policies and dress codes</Text>
          <Text style={styles.bulletPoint}>• We reserve the right to refuse service</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Loyalty Program</Text>
          <Text style={styles.paragraph}>
            Participation in the Luna Points loyalty program is subject to:
          </Text>
          <Text style={styles.bulletPoint}>• Points have no cash value</Text>
          <Text style={styles.bulletPoint}>• Points may expire after 12 months of inactivity</Text>
          <Text style={styles.bulletPoint}>• We may modify the program at any time</Text>
          <Text style={styles.bulletPoint}>• Abuse of the program may result in account termination</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Intellectual Property</Text>
          <Text style={styles.paragraph}>
            All content, features, and functionality of the App are owned by Luna Group and are protected by copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, or create derivative works without our written permission.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Disclaimer of Warranties</Text>
          <Text style={styles.paragraph}>
            The App is provided "as is" without warranties of any kind, either express or implied. We do not guarantee that the App will be uninterrupted, secure, or error-free.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            To the fullest extent permitted by law, Luna Group shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Termination</Text>
          <Text style={styles.paragraph}>
            We may terminate or suspend your account at any time for violation of these Terms. Upon termination, your right to use the App will immediately cease.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We reserve the right to modify these Terms at any time. Continued use of the App after changes constitutes acceptance of the modified Terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms shall be governed by the laws of Queensland, Australia. Any disputes shall be resolved in the courts of Queensland.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. Contact Us</Text>
          <Text style={styles.paragraph}>
            For questions about these Terms, please contact us at:
          </Text>
          <Text style={styles.contactInfo}>Email: legal@lunagroup.com.au</Text>
          <Text style={styles.contactInfo}>Address: Brisbane, QLD, Australia</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 24,
    paddingLeft: 8,
  },
  contactInfo: {
    fontSize: 14,
    color: colors.accent,
    marginTop: 4,
  },
});
