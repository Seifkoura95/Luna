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
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { Icon } from '../src/components/Icon';
import { LunaIcon } from '../src/components/LunaIcons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { AppBackground } from '../src/components/AppBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  billing_period: string;
  color: string;
  icon?: string;
  points_multiplier: number;
  benefits: Record<string, any>;
  description: string;
  perks_list: string[];
  nightclub_perks?: string[];
  restaurant_perks?: string[];
  general_perks?: string[];
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'compare'>('cards');
  const [compareCategory, setCompareCategory] = useState<'nightclub' | 'restaurant' | 'general'>('nightclub');

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
        // User not logged in, default to bronze
        setCurrentTier(tiersRes.tiers?.find((t: any) => t.id === 'bronze') || null);
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

    // Paid subscriptions happen OUTSIDE the app on our web portal to
    // comply with Apple IAP rules. The app only supports free tier switches.
    if (tier.price > 0) {
      Alert.alert(
        `Subscribe to ${tier.name}`,
        `${tier.name} is $${tier.price}/month. You'll be redirected to our secure subscription portal to complete payment.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue in Browser',
            onPress: async () => {
              const STRIPE_LINKS: Record<string, string> = {
                silver: 'https://buy.stripe.com/7sY8wP03ugUIeLE3O3aVa00',
                gold: 'https://buy.stripe.com/14A28r4jK1ZO5b43O3aVa01',
              };
              const portalUrl = STRIPE_LINKS[tierId]
                || `https://lunagroupapp.com.au/subscribe?tier=${encodeURIComponent(tierId)}`;
              try {
                await WebBrowser.openBrowserAsync(portalUrl);
              } catch (e) {
                Alert.alert(
                  'Subscribe on the web',
                  `Visit ${portalUrl} to subscribe.`
                );
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Switch to Free Plan',
      'Switch to the free Luna plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            try {
              setSubscribing(tierId);
              const result = await api.subscribeTo(tierId);
              Alert.alert('Done', result.message);
              fetchData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to switch');
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
    const isPopular = tier.id === 'silver';
    const isPremium = tier.id === 'gold';

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
              <LunaIcon 
                name={tier.id as any} 
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
            <Icon name="trending-up" size={16} color={tier.color} />
            <Text style={[styles.multiplierText, { color: tier.color }]}>
              {tier.points_multiplier}x Points
            </Text>
          </View>

          {/* Perks List */}
          <View style={styles.perksList}>
            {tier.perks_list.map((perk, i) => (
              <View key={i} style={styles.perkItem}>
                <Icon name="checkmark-circle" size={18} color={tier.color} />
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

  // Compare view - feature comparison matrix
  const renderCompareView = () => {
    const getPerksForCategory = (tier: SubscriptionTier) => {
      switch (compareCategory) {
        case 'nightclub':
          return tier.nightclub_perks || [];
        case 'restaurant':
          return tier.restaurant_perks || [];
        case 'general':
          return tier.general_perks || [];
        default:
          return tier.perks_list || [];
      }
    };

    // Key features to compare
    const keyFeatures = [
      { key: 'price', label: 'Monthly Price' },
      { key: 'points_multiplier', label: 'Points Multiplier' },
      { key: 'free_entry', label: 'Free Entry' },
      { key: 'skip_line', label: 'Skip the Line' },
      { key: 'complimentary_drink', label: 'Free Drink' },
      { key: 'guest_entry', label: 'Guest Entry' },
      { key: 'restaurant_discount', label: 'Restaurant Discount' },
      { key: 'priority_booking', label: 'Priority Booking' },
      { key: 'vip_events', label: 'VIP Events Access' },
      { key: 'concierge', label: 'Concierge Access' },
    ];

    const getFeatureValue = (tier: SubscriptionTier, key: string): string | boolean => {
      const benefits = tier.benefits || {};
      switch (key) {
        case 'price':
          return tier.price === 0 ? 'FREE' : `$${tier.price}/mo`;
        case 'points_multiplier':
          return `${tier.points_multiplier}x`;
        case 'free_entry':
          if (benefits.free_entry_before_time === 'all_night') return '✓ All Night';
          return benefits.free_entry_before_time ? `Before ${benefits.free_entry_before_time}` : '✗';
        case 'skip_line':
          return benefits.skip_the_line ? '✓' : '✗';
        case 'complimentary_drink':
          if (benefits.complimentary_drink) {
            return benefits.complimentary_drink_excludes ? `✓ (excl. ${benefits.complimentary_drink_excludes})` : '✓';
          }
          return '✗';
        case 'guest_entry':
          return benefits.guest_entry > 0 ? `+${benefits.guest_entry} Guest` : '✗';
        case 'restaurant_discount':
          return benefits.restaurant_discount ? `${benefits.restaurant_discount}%` : '✗';
        case 'priority_booking':
          return benefits.priority_booking ? '✓' : '✗';
        case 'vip_events':
          return benefits.private_events_access ? '✓' : '✗';
        case 'concierge':
          if (benefits.whatsapp_concierge) return '✓ WhatsApp';
          return benefits.concierge_access ? '✓' : '✗';
        default:
          return '—';
      }
    };

    return (
      <View style={styles.compareContainer}>
        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {(['nightclub', 'restaurant', 'general'] as const).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryTab,
                compareCategory === cat && styles.categoryTabActive
              ]}
              onPress={() => setCompareCategory(cat)}
            >
              <Icon 
                name={cat === 'nightclub' ? 'musical-notes' : cat === 'restaurant' ? 'restaurant' : 'star'} 
                size={16} 
                color={compareCategory === cat ? '#000' : colors.textMuted} 
              />
              <Text style={[
                styles.categoryTabText,
                compareCategory === cat && styles.categoryTabTextActive
              ]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Comparison Table */}
        <View style={styles.compareTable}>
          {/* Header Row */}
          <View style={styles.compareHeaderRow}>
            <View style={styles.compareFeatureCell}>
              <Text style={styles.compareHeaderText}>Feature</Text>
            </View>
            {tiers.map((tier) => (
              <View key={tier.id} style={[styles.compareTierCell, { borderBottomColor: tier.color }]}>
                <Text style={[styles.compareTierName, { color: tier.color }]}>{tier.name}</Text>
              </View>
            ))}
          </View>

          {/* Feature Rows */}
          {keyFeatures.map((feature, idx) => (
            <View key={feature.key} style={[styles.compareRow, idx % 2 === 0 && styles.compareRowAlt]}>
              <View style={styles.compareFeatureCell}>
                <Text style={styles.compareFeatureText}>{feature.label}</Text>
              </View>
              {tiers.map((tier) => {
                const value = getFeatureValue(tier, feature.key);
                const isCheck = value === '✓' || (typeof value === 'string' && value.startsWith('✓'));
                const isCross = value === '✗';
                return (
                  <View key={tier.id} style={styles.compareTierCell}>
                    <Text style={[
                      styles.compareValueText,
                      isCheck && { color: '#22C55E' },
                      isCross && { color: colors.textMuted }
                    ]}>
                      {value}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Category-specific Perks */}
        <View style={styles.categoryPerksSection}>
          <Text style={styles.categoryPerksTitle}>
            {compareCategory === 'nightclub' ? 'Nightlife Perks' : 
             compareCategory === 'restaurant' ? '🍽️ Restaurant Perks' : '⭐ General Perks'}
          </Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tiers.map((tier) => {
              const perks = getPerksForCategory(tier);
              return (
                <View key={tier.id} style={[styles.categoryPerkCard, { borderColor: tier.color }]}>
                  <Text style={[styles.categoryPerkTierName, { color: tier.color }]}>{tier.name}</Text>
                  {perks.length > 0 ? (
                    perks.slice(0, 4).map((perk, i) => (
                      <View key={i} style={styles.categoryPerkItem}>
                        <Icon name="checkmark" size={14} color={tier.color} />
                        <Text style={styles.categoryPerkText} numberOfLines={2}>{perk}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noPerkText}>No specific perks</Text>
                  )}
                  {perks.length > 4 && (
                    <Text style={[styles.morePerkText, { color: tier.color }]}>+{perks.length - 4} more</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading plans...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
      
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
            <Icon name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          
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

        {/* View Toggle - always show */}
        <View style={styles.viewToggleContainer}>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'cards' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('cards')}
            >
              <Icon name="grid" size={18} color={viewMode === 'cards' ? '#000' : colors.textMuted} />
              <Text style={[styles.viewToggleText, viewMode === 'cards' && styles.viewToggleTextActive]}>Plans</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'compare' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('compare')}
            >
              <Icon name="git-compare" size={18} color={viewMode === 'compare' ? '#000' : colors.textMuted} />
              <Text style={[styles.viewToggleText, viewMode === 'compare' && styles.viewToggleTextActive]}>Compare</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content based on view mode */}
        {viewMode === 'cards' ? (
          <View style={styles.tiersContainer}>
            {tiers.map(renderTierCard)}
          </View>
        ) : (
          renderCompareView()
        )}

        {/* Info Text */}
        <View style={styles.infoSection}>
          <Icon name="information-circle" size={20} color={colors.textMuted} />
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
  // View Toggle styles
  viewToggleContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: radius.full,
    padding: 4,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    gap: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.accent,
  },
  viewToggleText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  viewToggleTextActive: {
    color: '#000',
  },
  // Compare View styles
  compareContainer: {
    marginBottom: spacing.xl,
  },
  categoryTabs: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    gap: 6,
  },
  categoryTabActive: {
    backgroundColor: colors.accent,
  },
  categoryTabText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  categoryTabTextActive: {
    color: '#000',
  },
  compareTable: {
    backgroundColor: '#111',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  compareHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  compareRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  compareRowAlt: {
    backgroundColor: '#0A0A0A',
  },
  compareFeatureCell: {
    flex: 1.2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  compareTierCell: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  compareHeaderText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  compareTierName: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  compareFeatureText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  compareValueText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryPerksSection: {
    marginTop: spacing.lg,
  },
  categoryPerksTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  categoryPerkCard: {
    width: 200,
    backgroundColor: '#111',
    borderRadius: radius.md,
    padding: spacing.md,
    marginRight: spacing.md,
    borderWidth: 1,
  },
  categoryPerkTierName: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  categoryPerkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  categoryPerkText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  noPerkText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  morePerkText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
