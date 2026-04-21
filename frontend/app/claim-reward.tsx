import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Icon } from '../src/components/Icon';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { AppBackground } from '../src/components/AppBackground';
import { useAuthStore } from '../src/store/authStore';
import { RedemptionQRModal } from '../src/components/modals/RedemptionQRModal';

interface ShopReward {
  id?: string;
  reward_id?: string;
  name: string;
  description?: string;
  points_cost: number;
  category?: string;
  venue_restriction?: string;
  image_url?: string;
}

interface ActiveRedemption {
  redemption_id: string;
  reward_id: string;
  reward_name: string;
  reward_description?: string;
  qr_code: string;
  expires_at: string;
  status: string;
}

const CATEGORY_META: Record<string, { icon: string; colour: string; label: string }> = {
  drinks:  { icon: 'wine',         colour: '#E76F51', label: 'DRINKS' },
  vip:     { icon: 'star',         colour: '#D4AF5A', label: 'VIP' },
  dining:  { icon: 'restaurant',   colour: '#2A9D8F', label: 'DINING' },
  bottles: { icon: 'flask',        colour: '#8B5CF6', label: 'BOTTLE SERVICE' },
  merch:   { icon: 'shirt',        colour: '#60A5FA', label: 'MERCH' },
};

export default function ClaimRewardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [rewards, setRewards] = useState<ShopReward[]>([]);
  const [myRedemptions, setMyRedemptions] = useState<ActiveRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [modalRedemption, setModalRedemption] = useState<ActiveRedemption | null>(null);

  const points = user?.points_balance ?? 0;

  const load = useCallback(async () => {
    try {
      const [rs, mineRaw, me] = await Promise.all([
        api.getRewards().catch(() => []),
        api.getMyRedemptions('pending').catch(() => []),
        api.getMe().catch(() => null),
      ]);
      setRewards(Array.isArray(rs) ? (rs as ShopReward[]) : []);
      // normalise redemptions to the shape the modal needs
      const normalised: ActiveRedemption[] = (mineRaw || [])
        .filter((r: any) => r.status === 'pending' && r.qr_code)
        .map((r: any) => ({
          redemption_id: r.redemption_id || r.id,
          reward_id: r.reward_id,
          reward_name: r.reward_name || r.name || 'Luna Reward',
          reward_description: r.reward_description || r.description,
          qr_code: r.qr_code,
          expires_at: r.expires_at,
          status: r.status || 'pending',
        }));
      setMyRedemptions(normalised);
      if (me) setUser(me as any);
    } catch (e) {
      console.error('claim-reward load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUser]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleRedeem = async (reward: ShopReward) => {
    const id = reward.id || reward.reward_id;
    if (!id) return;
    if (points < reward.points_cost) {
      Alert.alert(
        'Not enough points',
        `You need ${reward.points_cost - points} more points to redeem "${reward.name}".`
      );
      return;
    }
    Alert.alert(
      'Redeem reward?',
      `This will use ${reward.points_cost.toLocaleString()} points to unlock "${reward.name}". A one-time QR code will be generated — show it to venue staff within 48 hours.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          style: 'destructive',
          onPress: async () => {
            setRedeeming(id);
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            try {
              const res = await api.redeemRewardWithQR(id, reward.venue_restriction);
              if (!res?.success || !res?.qr_code) throw new Error(res?.message || 'Redemption failed');

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              const expiresAt = (res.redemption && (res.redemption as any).expires_at)
                || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

              const fresh: ActiveRedemption = {
                redemption_id: (res.redemption && (res.redemption as any).redemption_id) || (res.redemption as any)?.id || `r_${Date.now()}`,
                reward_id: id,
                reward_name: reward.name,
                reward_description: reward.description,
                qr_code: res.qr_code,
                expires_at: expiresAt,
                status: 'pending',
              };
              setMyRedemptions((prev) => [fresh, ...prev]);
              if (user) setUser({ ...user, points_balance: res.new_balance ?? (points - reward.points_cost) } as any);
              setModalRedemption(fresh);
            } catch (e: any) {
              Alert.alert('Redemption failed', e?.message || 'Could not redeem. Please try again.');
            } finally {
              setRedeeming(null);
            }
          },
        },
      ]
    );
  };

  const renderShopCard = (reward: ShopReward) => {
    const rid = reward.id || reward.reward_id || Math.random().toString();
    const cat = CATEGORY_META[reward.category || ''] || CATEGORY_META.vip;
    const canAfford = points >= reward.points_cost;
    const isBusy = redeeming === (reward.id || reward.reward_id);

    return (
      <View key={rid} style={styles.card} data-testid={`reward-card-${rid}`}>
        <View style={[styles.cardIconBox, { backgroundColor: cat.colour + '20', borderColor: cat.colour + '60' }]}>
          <Icon name={cat.icon} size={26} color={cat.colour} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardCategory, { color: cat.colour }]}>{cat.label}</Text>
            {reward.venue_restriction && (
              <Text style={styles.cardVenueTag}>· {reward.venue_restriction.toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{reward.name}</Text>
          {reward.description && (
            <Text style={styles.cardDesc} numberOfLines={2}>{reward.description}</Text>
          )}

          <View style={styles.cardFooter}>
            <View>
              <Text style={styles.costLabel}>COST</Text>
              <Text style={styles.costValue}>{reward.points_cost.toLocaleString()} pts</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.redeemBtn,
                !canAfford && styles.redeemBtnDisabled,
              ]}
              onPress={() => handleRedeem(reward)}
              disabled={!canAfford || isBusy}
              activeOpacity={0.8}
              data-testid={`redeem-btn-${rid}`}
            >
              {isBusy ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.redeemBtnText}>{canAfford ? 'CLAIM' : 'LOCKED'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderActiveRedemption = (r: ActiveRedemption) => (
    <TouchableOpacity
      key={r.redemption_id}
      style={styles.activeRow}
      onPress={() => setModalRedemption(r)}
      activeOpacity={0.8}
      data-testid={`active-redemption-${r.redemption_id}`}
    >
      <View style={styles.activeIconBox}>
        <Icon name="qr-code" size={22} color="#000" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activeTitle} numberOfLines={1}>{r.reward_name}</Text>
        <Text style={styles.activeSub}>Tap to show QR to staff</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <AppBackground />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          data-testid="claim-reward-back"
        >
          <Icon name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Claim a Reward</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Points balance pill */}
        <LinearGradient
          colors={['#D4AF5A', '#B8962E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.balanceCard}
        >
          <View>
            <Text style={styles.balanceLabel}>YOUR BALANCE</Text>
            <Text style={styles.balanceValue}>{points.toLocaleString()} pts</Text>
            <Text style={styles.balanceSub}>≈ ${(points * 0.025).toFixed(2)} AUD value</Text>
          </View>
          <Icon name="trophy" size={40} color="rgba(0,0,0,0.25)" />
        </LinearGradient>

        {/* Active (already-redeemed, awaiting scan) */}
        {myRedemptions.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>READY TO SHOW STAFF</Text>
            <View style={styles.activeBlock}>{myRedemptions.map(renderActiveRedemption)}</View>
          </>
        )}

        {/* Shop */}
        <Text style={styles.sectionHeader}>REWARDS SHOP</Text>
        <Text style={styles.sectionCaption}>
          Claim any reward below to generate a one-time QR code. Show it to venue staff within 48 hours.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: spacing.xl }} />
        ) : rewards.length === 0 ? (
          <Text style={styles.emptyText}>No rewards available right now. Pull to refresh.</Text>
        ) : (
          <View style={styles.list}>{rewards.map(renderShopCard)}</View>
        )}
      </ScrollView>

      <RedemptionQRModal
        visible={!!modalRedemption}
        onClose={() => setModalRedemption(null)}
        redemption={
          modalRedemption
            ? {
                id: modalRedemption.redemption_id,
                reward_name: modalRedemption.reward_name,
                reward_description: modalRedemption.reward_description,
                qr_code: modalRedemption.qr_code,
                expires_at: modalRedemption.expires_at,
                status: modalRedemption.status,
              }
            : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 16, fontWeight: '800', letterSpacing: 2,
    color: colors.textPrimary, textTransform: 'uppercase',
  },
  balanceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg, borderRadius: radius.xl,
    marginBottom: spacing.xl,
  },
  balanceLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: 'rgba(0,0,0,0.6)' },
  balanceValue: { fontSize: 32, fontWeight: '900', color: '#000', letterSpacing: -0.5, marginVertical: 2 },
  balanceSub: { fontSize: 12, color: 'rgba(0,0,0,0.6)', fontWeight: '600' },

  sectionHeader: {
    fontSize: 11, fontWeight: '800', letterSpacing: 3,
    color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md,
  },
  sectionCaption: {
    fontSize: 13, color: colors.textSecondary, lineHeight: 19,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 13, color: colors.textMuted, textAlign: 'center',
    marginTop: spacing.xl, paddingVertical: spacing.lg,
  },

  activeBlock: { marginBottom: spacing.xl, gap: spacing.sm },
  activeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: 'rgba(212, 175, 90, 0.10)',
    borderWidth: 1, borderColor: 'rgba(212, 175, 90, 0.4)',
    padding: spacing.md, borderRadius: radius.lg,
  },
  activeIconBox: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: '#D4AF5A',
    alignItems: 'center', justifyContent: 'center',
  },
  activeTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  activeSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  list: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(18, 18, 28, 0.72)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardIconBox: {
    width: 54, height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  cardContent: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardCategory: { fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  cardVenueTag: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.textMuted },
  cardTitle: {
    fontSize: 15, fontWeight: '800', color: colors.textPrimary,
    letterSpacing: -0.2, marginTop: 2,
  },
  cardDesc: {
    fontSize: 12, color: colors.textSecondary, lineHeight: 17,
    marginTop: 3,
  },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  costLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: colors.textMuted },
  costValue: { fontSize: 15, fontWeight: '800', color: '#D4AF5A', marginTop: 2 },
  redeemBtn: {
    backgroundColor: '#D4AF5A',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.full,
    minWidth: 84, alignItems: 'center',
  },
  redeemBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  redeemBtnText: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 2 },
});
