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
import { VideoBackground } from '../src/components/VideoBackground';

export default function HelpSupportPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const faqItems = [
    {
      question: 'How do I earn points?',
      answer: 'Earn points by attending events, completing missions, referring friends, and making purchases at Luna Group venues.',
    },
    {
      question: 'How do I redeem rewards?',
      answer: 'Go to the Rewards page, select a reward, and tap Redeem. You\'ll receive a QR code to show at the venue.',
    },
    {
      question: 'How does the safety feature work?',
      answer: 'Tap the Safety button to instantly share your location with your crew, emergency contacts, and venue staff.',
    },
    {
      question: 'Can I transfer points to a friend?',
      answer: 'Points cannot be transferred between accounts to maintain the integrity of our rewards system.',
    },
    {
      question: 'How do I book a VIP table?',
      answer: 'Go to VIP Tables from your profile, select a venue and date, choose your table, and complete the booking.',
    },
  ];

  const contactOptions = [
    { icon: 'mail', title: 'Email Support', desc: 'support@lunagroup.com.au', action: () => Linking.openURL('mailto:support@lunagroup.com.au') },
    { icon: 'call', title: 'Phone Support', desc: '+61 7 1234 5678', action: () => Linking.openURL('tel:+61712345678') },
    { icon: 'logo-instagram', title: 'Instagram DM', desc: '@lunagrouphospitality', action: () => Linking.openURL('https://instagram.com/lunagrouphospitality') },
  ];

  return (
    <View style={styles.container}>
      <VideoBackground />
      
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
          <Text style={styles.headerTitle}>HELP & SUPPORT</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Contact Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTACT US</Text>
          {contactOptions.map((option) => (
            <TouchableOpacity key={option.title} style={styles.contactCard} onPress={option.action}>
              <View style={styles.contactIcon}>
                <Ionicons name={option.icon as any} size={24} color={colors.accent} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>{option.title}</Text>
                <Text style={styles.contactDesc}>{option.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FREQUENTLY ASKED QUESTIONS</Text>
          {faqItems.map((item, index) => (
            <View key={index} style={styles.faqCard}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Text style={styles.faqAnswer}>{item.answer}</Text>
            </View>
          ))}
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK LINKS</Text>
          <View style={styles.linksGrid}>
            <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/terms')}>
              <Ionicons name="document-text" size={24} color={colors.gold} />
              <Text style={styles.linkText}>Terms of Service</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/privacy-policy')}>
              <Ionicons name="shield-checkmark" size={24} color={colors.gold} />
              <Text style={styles.linkText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
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
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
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
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  contactDesc: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  faqCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  faqAnswer: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  linksGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  linkCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
