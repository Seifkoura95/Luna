import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform,
  Alert,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StarfieldBackground } from '../src/components/StarfieldBackground';
import * as Haptics from 'expo-haptics';


export default function ReferFriendScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  
  const [referralData, setReferralData] = useState<any>(null);
  const [referralHistory, setReferralHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const [codeResponse, historyResponse] = await Promise.all([
        api.getReferralCode(),
        api.getReferralHistory(),
      ]);
      setReferralData(codeResponse);
      setReferralHistory(historyResponse.referrals || []);
    } catch (e) {
      console.error('Failed to fetch referral data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const message = `Join me on Luna Group VIP! 🌙✨\n\nGet exclusive access to Brisbane & Gold Coast's best nightclubs, bars, and restaurants.\n\nUse my code: ${referralData?.referral_code}\n\n${referralData?.referral_link}`;
      
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(message);
        Alert.alert('Copied!', 'Share link copied to clipboard');
      } else {
        await Share.share({
          message,
          title: 'Join Luna Group VIP',
        });
      }
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  const handleCopyCode = async () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(referralData?.referral_code || '');
      } else {
        Clipboard.setString(referralData?.referral_code || '');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StarfieldBackground starCount={40} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StarfieldBackground starCount={40} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: fonts.display }]}>Refer & Earn</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.giftIconContainer}>
            <LinearGradient colors={['#00D4AA', '#00A080']} style={styles.giftIconGradient}>
              <Ionicons name="gift" size={48} color="#FFF" />
            </LinearGradient>
          </View>
          
          <Text style={[styles.heroTitle, ]}>
            Invite Friends, Earn Points
          </Text>
          <Text style={[styles.heroSubtitle, ]}>
            Share your referral code with friends. When they sign up, you both earn{' '}
            <Text style={{ color: '#00D4AA', fontWeight: '700' }}>
              {referralData?.stats?.points_per_referral || 10} points
            </Text>
            !
          </Text>
        </View>

        {/* Referral Code Card */}
        <View style={styles.codeCard}>
          <Text style={[styles.codeLabel, fontsLoaded && { fontFamily: fonts.medium }]}>YOUR REFERRAL CODE</Text>
          <View style={styles.codeContainer}>
            <Text style={[styles.codeText, ]}>
              {referralData?.referral_code || 'LOADING...'}
            </Text>
            <TouchableOpacity 
              style={[styles.copyButton, copied && styles.copyButtonSuccess]}
              onPress={handleCopyCode}
            >
              <Ionicons 
                name={copied ? "checkmark" : "copy-outline"} 
                size={20} 
                color={copied ? "#FFF" : colors.accent} 
              />
            </TouchableOpacity>
          </View>
          {copied && (
            <Text style={[styles.copiedText, fontsLoaded && { fontFamily: fonts.medium }]}>Copied!</Text>
          )}
        </View>

        {/* Share Button */}
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <LinearGradient
            colors={['#00D4AA', '#00A080']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.shareButtonGradient}
          >
            <Ionicons name="share-social" size={24} color="#FFF" />
            <Text style={[styles.shareButtonText, ]}>
              SHARE WITH FRIENDS
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, ]}>
              {referralData?.stats?.successful_referrals || 0}
            </Text>
            <Text style={[styles.statLabel, ]}>
              Friends Joined
            </Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, ]}>
              {referralData?.stats?.pending_referrals || 0}
            </Text>
            <Text style={[styles.statLabel, ]}>
              Pending
            </Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#00D4AA' }, ]}>
              {referralData?.stats?.total_points_earned || 0}
            </Text>
            <Text style={[styles.statLabel, ]}>
              Points Earned
            </Text>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, ]}>HOW IT WORKS</Text>
          
          <View style={styles.stepCard}>
            <View style={[styles.stepNumber, { backgroundColor: 'rgba(0,212,170,0.2)' }]}>
              <Text style={[styles.stepNumberText, { color: '#00D4AA' }, ]}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, ]}>Share Your Code</Text>
              <Text style={[styles.stepDesc, ]}>
                Send your unique referral code to friends via text, email, or social media
              </Text>
            </View>
          </View>
          
          <View style={styles.stepCard}>
            <View style={[styles.stepNumber, { backgroundColor: 'rgba(139,0,255,0.2)' }]}>
              <Text style={[styles.stepNumberText, { color: '#8B00FF' }, ]}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, ]}>Friend Signs Up</Text>
              <Text style={[styles.stepDesc, ]}>
                Your friend downloads Luna and enters your referral code during signup
              </Text>
            </View>
          </View>
          
          <View style={styles.stepCard}>
            <View style={[styles.stepNumber, { backgroundColor: 'rgba(212,175,55,0.2)' }]}>
              <Text style={[styles.stepNumberText, { color: colors.gold }, ]}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, ]}>Both Earn Points</Text>
              <Text style={[styles.stepDesc, ]}>
                Once verified, you both receive {referralData?.stats?.points_per_referral || 10} bonus points!
              </Text>
            </View>
          </View>
        </View>

        {/* Referral History */}
        {referralHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, ]}>REFERRAL HISTORY</Text>
            
            {referralHistory.map((referral, index) => (
              <View key={referral.id || index} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <View style={[
                    styles.historyDot,
                    { backgroundColor: referral.status === 'completed' ? '#00D4AA' : colors.gold }
                  ]} />
                  <View>
                    <Text style={[styles.historyName, ]}>
                      Friend #{index + 1}
                    </Text>
                    <Text style={[styles.historyDate, ]}>
                      {new Date(referral.created_at).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.historyBadge,
                  { backgroundColor: referral.status === 'completed' ? 'rgba(0,212,170,0.2)' : 'rgba(212,175,55,0.2)' }
                ]}>
                  <Text style={[
                    styles.historyBadgeText,
                    { color: referral.status === 'completed' ? '#00D4AA' : colors.gold },
                    fontsLoaded && { fontFamily: fonts.medium }
                  ]}>
                    {referral.status === 'completed' ? '+10 pts' : 'Pending'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  giftIconContainer: {
    marginBottom: spacing.lg,
  },
  giftIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  
  // Code Card
  codeCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeLabel: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 3,
  },
  copyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,212,170,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyButtonSuccess: {
    backgroundColor: '#00D4AA',
  },
  copiedText: {
    fontSize: 12,
    color: '#00D4AA',
    marginTop: spacing.sm,
  },
  
  // Share Button
  shareButton: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  
  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  
  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  
  // Steps
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  
  // History
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  historyName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  historyDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  historyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  historyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
