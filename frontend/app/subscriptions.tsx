import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StarfieldBackground } from '../src/components/StarfieldBackground';
import { RotatingMoon } from '../src/components/RotatingMoon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  billing_period: string;
  color: string;
  points_multiplier: number;
  benefits: Record<string, any>;
  description: string;
  perks_list: string[];
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // Get tiers first (no auth required)
      const tiersRes = await api.getSubscriptionTiers();
      setTiers(tiersRes.tiers || []);
      
      // Try to get subscription (requires auth)
      try {
        const subRes = await api.getMySubscription();
        setCurrentSubscription(subRes.subscription);
        setCurrentTier(subRes.tier);
      } catch (subError) {
        // User not logged in, default to lunar
        setCurrentTier(tiersRes.tiers?.find((t: any) => t.id === 'lunar') || null);
      }
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (tierId: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const tier = tiers.find(t => t.id === tierId);
    if (!tier) return;

    if (currentTier?.id === tierId) {
      Alert.alert('Already Subscribed', `You're already on the ${tier.name} plan!`);
      return;
    }

    Alert.alert(
      `Subscribe to ${tier.name}`,
      tier.price === 0 
        ? 'Switch to the free Luna plan?'
        : `Subscribe for $${tier.price}/month?\n\nThis is a demo - no real payment will be processed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: tier.price === 0 ? 'Switch' : 'Subscribe',
          onPress: async () => {
            try {
              setSubscribing(tierId);
              const result = await api.subscribeTo(tierId);
              Alert.alert('Success! 🌙', result.message);
              fetchData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to subscribe');
            } finally {
              setSubscribing(null);
            }
          },
        },
      ]
    );
  };

  const renderTierCard = (tier: SubscriptionTier, index: number) => {
    const isCurrentTier = currentTier?.id === tier.id;
    const isPopular = tier.id === 'eclipse';
    const isPremium = tier.id === 'supernova';

    return (
      <View key={tier.id} style={styles.tierCardWrapper}>
        {isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>MOST POPULAR</Text>
          </View>
        )}
        {isPremium && (
          <View style={[styles.popularBadge, { backgroundColor: tier.color }]}>
            <Text style={[styles.popularText, { color: '#000' }]}>BEST VALUE</Text>
          </View>
        )}
        
        <LinearGradient
          colors={[tier.color + '30', '#0A0A0A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            styles.tierCard,
            isCurrentTier && { borderColor: tier.color, borderWidth: 2 },
          ]}
        >
          {/* Header */}
          <View style={styles.tierHeader}>
            <View style={[styles.tierIcon, { backgroundColor: tier.color + '30' }]}>
              <Ionicons 
                name={tier.id === 'lunar' ? 'moon' : tier.id === 'eclipse' ? 'flash' : 'star'} 
                size={24} 
                color={tier.color} 
              />
            </View>
            <View style={styles.tierTitleContainer}>
              <Text style={[styles.tierName, { color: tier.color }]}>{tier.name.toUpperCase()}</Text>
              <Text style={styles.tierDescription}>{tier.description}</Text>
            </View>
          </View>

          {/* Price */}
          <View style={styles.priceContainer}>
            {tier.price === 0 ? (
              <Text style={styles.priceText}>FREE</Text>
            ) : (
              <>
                <Text style={styles.priceCurrency}>$</Text>
                <Text style={styles.priceText}>{tier.price.toFixed(2)}</Text>
                <Text style={styles.pricePeriod}>/month</Text>
              </>
            )}
          </View>

          {/* Points Multiplier Badge */}
          <View style={[styles.multiplierBadge, { backgroundColor: tier.color + '20' }]}>
            <Ionicons name="trending-up" size={16} color={tier.color} />
            <Text style={[styles.multiplierText, { color: tier.color }]}>
              {tier.points_multiplier}x Points
            </Text>
          </View>

          {/* Perks List */}
          <View style={styles.perksList}>
            {tier.perks_list.map((perk, i) => (
              <View key={i} style={styles.perkItem}>
                <Ionicons name="checkmark-circle" size={18} color={tier.color} />
                <Text style={styles.perkText}>{perk}</Text>
              </View>
            ))}
          </View>

          {/* Subscribe Button */}
          <TouchableOpacity
            style={[
              styles.subscribeButton,
              { backgroundColor: isCurrentTier ? '#333' : tier.color },
            ]}
            onPress={() => handleSubscribe(tier.id)}
            disabled={subscribing === tier.id}
            activeOpacity={0.8}
          >
            {subscribing === tier.id ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={[
                styles.subscribeButtonText,
                isCurrentTier && { color: colors.textMuted }
              ]}>
                {isCurrentTier ? 'CURRENT PLAN' : tier.price === 0 ? 'SELECT' : 'SUBSCRIBE'}
              </Text>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StarfieldBackground starCount={50} shootingStarCount={1} />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading plans...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={60} shootingStarCount={2} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <RotatingMoon size={70} rotationDuration={25000} />
          <Text style={styles.headerTitle}>MEMBERSHIP</Text>
          <View style={styles.headerUnderline} />
          <Text style={styles.headerSubtitle}>Choose your Luna experience</Text>
        </View>

        {/* Current Status */}
        {currentTier && (
          <View style={styles.currentStatus}>
            <Text style={styles.currentLabel}>Current Plan</Text>
            <View style={[styles.currentBadge, { backgroundColor: currentTier.color + '20' }]}>
              <Text style={[styles.currentTierName, { color: currentTier.color }]}>
                {currentTier.name.toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Tier Cards */}
        <View style={styles.tiersContainer}>
          {tiers.map(renderTierCard)}
        </View>

        {/* Info Text */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle" size={20} color={colors.textMuted} />
          <Text style={styles.infoText}>
            All subscriptions are billed monthly. Cancel anytime from your profile settings.
            Demo mode - no real payments processed.
          </Text>
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: spacing.sm,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 6,
    marginTop: spacing.sm,
  },
  headerUnderline: {
    width: 50,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  currentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  currentLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  currentBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  currentTierName: {
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  tiersContainer: {
    gap: spacing.lg,
  },
  tierCardWrapper: {
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    zIndex: 10,
  },
  popularText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tierCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierTitleContainer: {
    flex: 1,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tierDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  priceCurrency: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  priceText: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  pricePeriod: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  multiplierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 6,
    marginBottom: spacing.md,
  },
  multiplierText: {
    fontSize: 12,
    fontWeight: '700',
  },
  perksList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  perkText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  subscribeButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: '#111',
    borderRadius: radius.md,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
