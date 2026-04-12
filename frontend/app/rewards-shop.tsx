import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { AppBackground } from '../src/components/AppBackground';
import { useAuthStore } from '../src/store/authStore';

// Gift card options with 10% bonus
const GIFT_CARDS = [
  { amount: 25, bonus: 2.50, total: 27.50, pointsCost: 250 },
  { amount: 50, bonus: 5.00, total: 55.00, pointsCost: 500 },
  { amount: 100, bonus: 10.00, total: 110.00, pointsCost: 1000 },
  { amount: 150, bonus: 15.00, total: 165.00, pointsCost: 1500 },
];

// In-venue redemption options
const VENUE_REDEMPTIONS = [
  { id: 'food', icon: 'restaurant', title: 'Food & Dining', description: 'Any food item at Luna restaurants' },
  { id: 'drinks', icon: 'wine', title: 'Drinks & Beverages', description: 'Cocktails, wines, beers & more' },
  { id: 'entry', icon: 'ticket', title: 'Venue Entry', description: 'Cover charge at any Luna venue' },
  { id: 'bottle', icon: 'flask', title: 'Bottle Service', description: 'Premium bottles & packages' },
  { id: 'merch', icon: 'shirt', title: 'Merchandise', description: 'Luna branded items & apparel' },
  { id: 'vip', icon: 'star', title: 'VIP Upgrades', description: 'Table upgrades & premium seating' },
];

export default function RewardsShopPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedGiftCard, setSelectedGiftCard] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  const currentPoints = user?.points_balance || 0;
  const dollarValue = currentPoints / 10;

  const handleHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userData, walletData] = await Promise.all([
        api.getMe(),
        api.getWalletBalance().catch(() => ({ wallet_balance: 0 })),
      ]);
      useAuthStore.getState().setUser(userData);
      setWalletBalance(walletData.wallet_balance || 0);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleGiftCardSelect = (amount: number) => {
    handleHaptic();
    setSelectedGiftCard(selectedGiftCard === amount ? null : amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (text: string) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomAmount(cleaned);
    setSelectedGiftCard(null);
  };

  const handlePurchaseGiftCard = () => {
    handleHaptic();
    const amount = selectedGiftCard || parseInt(customAmount) || 0;
    if (amount < 10) {
      Alert.alert('Minimum Amount', 'Gift cards must be at least $10');
      return;
    }
    
    const bonusValue = amount * 0.10;
    const totalValue = amount + bonusValue;
    
    Alert.alert(
      'Purchase Gift Card',
      `Pay $${amount} AUD to receive $${totalValue.toFixed(2)} wallet credit (+10% bonus)`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Pay with Card', 
          onPress: async () => {
            setPurchasing(true);
            try {
              const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
              const result = await api.createGiftCardCheckout(amount, backendUrl);
              if (result.checkout_url) {
                await Linking.openURL(result.checkout_url);
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to create checkout');
            } finally {
              setPurchasing(false);
            }
          }
        }
      ]
    );
  };

  const customAmountNum = parseInt(customAmount) || 0;
  const customBonus = customAmountNum * 0.10;
  const customTotal = customAmountNum + customBonus;
  const customPointsCost = customAmountNum * 10;

  return (
    <View style={styles.container}>
      <AppBackground />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>REDEEM POINTS</Text>
        </View>

        {/* Points Balance */}
        <View style={styles.pointsCard}>
          <LinearGradient
            colors={[colors.gold + '40', colors.gold + '20']}
            style={styles.pointsGradient}
          >
            <Ionicons name="star" size={32} color={colors.gold} />
            <View style={styles.pointsInfo}>
              <Text style={styles.pointsLabel}>YOUR POINTS</Text>
              <Text style={styles.pointsValue}>{currentPoints.toLocaleString()}</Text>
              <Text style={styles.pointsWorth}>Worth ${dollarValue.toFixed(2)}</Text>
            </View>
            {walletBalance > 0 && (
              <View style={styles.walletBadge}>
                <Ionicons name="wallet" size={14} color={colors.accent} />
                <Text style={styles.walletBadgeText}>${walletBalance.toFixed(2)}</Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Conversion Rate */}
        <View style={styles.conversionCard}>
          <View style={styles.conversionRow}>
            <View style={styles.conversionBadge}>
              <Ionicons name="star" size={16} color={colors.gold} />
              <Text style={styles.conversionText}>10 points</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
            <View style={styles.conversionBadge}>
              <Text style={styles.conversionText}>$1 value</Text>
            </View>
          </View>
        </View>

        {/* How to Redeem */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={22} color={colors.accent} />
            <Text style={styles.sectionTitle}>How to Redeem In-Venue</Text>
          </View>
          
          <View style={styles.steps}>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>Tell staff you want to pay with Luna Points</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>Show your member QR code from Profile</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
              <Text style={styles.stepText}>Staff deducts points instantly - done!</Text>
            </View>
          </View>
        </View>

        {/* What You Can Redeem */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cart" size={22} color={colors.accent} />
            <Text style={styles.sectionTitle}>What You Can Redeem</Text>
          </View>
          
          <View style={styles.redemptionGrid}>
            <View style={styles.redemptionRow}>
              {VENUE_REDEMPTIONS.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.redemptionItem}>
                  <View style={styles.redemptionIcon}>
                    <Ionicons name={item.icon as any} size={24} color={colors.accent} />
                  </View>
                  <Text style={styles.redemptionTitle}>{item.title}</Text>
                  <Text style={styles.redemptionDesc}>{item.description}</Text>
                </View>
              ))}
            </View>
            <View style={styles.redemptionRow}>
              {VENUE_REDEMPTIONS.slice(3, 6).map((item) => (
                <View key={item.id} style={styles.redemptionItem}>
                  <View style={styles.redemptionIcon}>
                    <Ionicons name={item.icon as any} size={24} color={colors.accent} />
                  </View>
                  <Text style={styles.redemptionTitle}>{item.title}</Text>
                  <Text style={styles.redemptionDesc}>{item.description}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Gift Cards */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="gift" size={22} color={colors.gold} />
            <Text style={styles.sectionTitle}>Luna Gift Cards</Text>
          </View>
          
          <View style={styles.bonusBanner}>
            <LinearGradient
              colors={[colors.gold + '30', colors.gold + '10']}
              style={styles.bonusGradient}
            >
              <Ionicons name="sparkles" size={18} color={colors.gold} />
              <Text style={styles.bonusText}>Get 10% EXTRA value on all gift cards!</Text>
            </LinearGradient>
          </View>
          
          <View style={styles.giftCardGrid}>
            <View style={styles.giftCardRow}>
              {GIFT_CARDS.slice(0, 2).map((card) => {
                const canAfford = currentPoints >= card.pointsCost;
                const isSelected = selectedGiftCard === card.amount;
                return (
                  <TouchableOpacity
                    key={card.amount}
                    style={[
                      styles.giftCard,
                      !canAfford && styles.giftCardDisabled,
                      isSelected && styles.giftCardSelected,
                    ]}
                    onPress={() => canAfford && handleGiftCardSelect(card.amount)}
                    activeOpacity={canAfford ? 0.7 : 1}
                  >
                    <Text style={styles.giftCardAmount}>
                      ${card.amount}
                    </Text>
                    <Text style={styles.giftCardBonus}>
                      +${card.bonus.toFixed(2)} bonus
                    </Text>
                    <View style={styles.giftCardDivider} />
                    <Text style={styles.giftCardTotal}>
                      ${card.total.toFixed(2)} value
                    </Text>
                    <Text style={styles.giftCardPoints}>
                      {card.pointsCost.toLocaleString()} pts
                    </Text>
                    {isSelected && (
                      <View style={styles.selectedCheck}>
                        <Ionicons name="checkmark-circle" size={24} color={colors.gold} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.giftCardRow}>
              {GIFT_CARDS.slice(2, 4).map((card) => {
                const canAfford = currentPoints >= card.pointsCost;
                const isSelected = selectedGiftCard === card.amount;
                return (
                  <TouchableOpacity
                    key={card.amount}
                    style={[
                      styles.giftCard,
                      !canAfford && styles.giftCardDisabled,
                      isSelected && styles.giftCardSelected,
                    ]}
                    onPress={() => canAfford && handleGiftCardSelect(card.amount)}
                    activeOpacity={canAfford ? 0.7 : 1}
                  >
                    <Text style={styles.giftCardAmount}>
                      ${card.amount}
                    </Text>
                    <Text style={styles.giftCardBonus}>
                      +${card.bonus.toFixed(2)} bonus
                    </Text>
                    <View style={styles.giftCardDivider} />
                    <Text style={styles.giftCardTotal}>
                      ${card.total.toFixed(2)} value
                    </Text>
                    <Text style={styles.giftCardPoints}>
                      {card.pointsCost.toLocaleString()} pts
                    </Text>
                    {isSelected && (
                      <View style={styles.selectedCheck}>
                        <Ionicons name="checkmark-circle" size={24} color={colors.gold} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Custom Amount */}
          <View style={styles.customAmountSection}>
            <Text style={styles.customAmountLabel}>Or enter custom amount:</Text>
            <View style={styles.customAmountRow}>
              <View style={styles.customInputWrapper}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.customInput}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={customAmount}
                  onChangeText={handleCustomAmountChange}
                  maxLength={4}
                />
              </View>
              {customAmountNum >= 10 && (
                <View style={styles.customCalc}>
                  <Text style={styles.customCalcText}>
                    +${customBonus.toFixed(2)} = ${customTotal.toFixed(2)} value
                  </Text>
                  <Text style={styles.customCalcPoints}>
                    {customPointsCost.toLocaleString()} points
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Purchase Button */}
          <TouchableOpacity
            style={[
              styles.purchaseButton,
              (!(selectedGiftCard || customAmountNum >= 10) || purchasing) && styles.purchaseButtonDisabled
            ]}
            onPress={handlePurchaseGiftCard}
            disabled={!(selectedGiftCard || customAmountNum >= 10) || purchasing}
            data-testid="purchase-gift-card-btn"
          >
            <LinearGradient
              colors={selectedGiftCard || customAmountNum >= 10 
                ? [colors.gold, '#B8960D'] 
                : ['#333', '#222']}
              style={styles.purchaseGradient}
            >
              {purchasing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="card" size={20} color={selectedGiftCard || customAmountNum >= 10 ? '#000' : colors.textMuted} />
              )}
              <Text style={[
                styles.purchaseText,
                !(selectedGiftCard || customAmountNum >= 10) && styles.purchaseTextDisabled
              ]}>
                {purchasing
                  ? 'Processing...'
                  : selectedGiftCard 
                    ? `Pay $${selectedGiftCard} AUD`
                    : customAmountNum >= 10
                      ? `Pay $${customAmountNum} AUD`
                      : 'Select a Gift Card'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Bottom Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  // Points Card
  pointsCard: {
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gold + '40',
  },
  pointsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  pointsInfo: {
    flex: 1,
  },
  pointsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.gold,
  },
  pointsWorth: {
    fontSize: 14,
    color: colors.gold,
    opacity: 0.8,
    marginTop: 2,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  walletBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  // Conversion Card
  conversionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  conversionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  conversionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  conversionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
  },
  // Section Card
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  // Steps
  steps: {
    gap: spacing.sm,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Redemption Grid
  redemptionGrid: {
    gap: spacing.sm,
  },
  redemptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  redemptionItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
  },
  redemptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  redemptionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  redemptionDesc: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 12,
  },
  // Bonus Banner
  bonusBanner: {
    marginBottom: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bonusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  bonusText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold,
  },
  // Gift Card Grid
  giftCardGrid: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  giftCardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  giftCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    position: 'relative',
  },
  giftCardSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + '10',
  },
  giftCardDisabled: {
    opacity: 0.7,
  },
  giftCardAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  giftCardBonus: {
    fontSize: 12,
    color: colors.gold,
    fontWeight: '600',
    marginTop: 2,
  },
  giftCardDivider: {
    width: '60%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: spacing.xs,
  },
  giftCardTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  giftCardPoints: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  selectedCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  // Custom Amount
  customAmountSection: {
    marginBottom: spacing.md,
  },
  customAmountLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  customAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  customInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing.md,
    minWidth: 100,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMuted,
  },
  customInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  customCalc: {
    flex: 1,
  },
  customCalcText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gold,
  },
  customCalcPoints: {
    fontSize: 11,
    color: colors.textMuted,
  },
  // Purchase Button
  purchaseButton: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  purchaseText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  purchaseTextDisabled: {
    color: colors.textMuted,
  },
});
