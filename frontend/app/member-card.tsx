import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Image, Platform, Linking, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { Icon } from '../src/components/Icon';
import { LunaIcon } from '../src/components/LunaIcons';
import { AppBackground } from '../src/components/AppBackground';
import { useAuthStore } from '../src/store/authStore';

const CHERRY = '#D4163D';
const CHERRY_DARK = '#6E0A1E';
const INK = '#0A0308';

interface CherryStatus {
  registered: boolean;
  member_key: string | null;
  mock_mode: boolean;
  linked_at?: string;
  status: string;
}

export default function MemberCard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<any>(null);
  const [cherry, setCherry] = useState<CherryStatus | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [cardData, cherryRes] = await Promise.all([
        api.getMemberCard(),
        fetch(`${BACKEND}/api/cherryhub/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : null)),
      ]);
      setCard(cardData);
      setCherry(cherryRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [BACKEND, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const linkCherryHub = async () => {
    if (!token) return;
    setLinking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${BACKEND}/api/cherryhub/link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ create_if_not_exists: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        Alert.alert('Linked', `CherryHub member: ${data.member_key}`);
        await fetchAll();
      } else {
        Alert.alert('Link failed', data.detail || 'Could not link CherryHub');
      }
    } catch (e: any) {
      Alert.alert('Link failed', e?.message || 'Network error');
    } finally {
      setLinking(false);
    }
  };

  const addToWallet = async (passType: 'apple' | 'google') => {
    if (!cherry?.registered) {
      Alert.alert('Link CherryHub first', 'Tap "Link CherryHub" to enable wallet passes.');
      return;
    }
    setWalletLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${BACKEND}/api/cherryhub/wallet-pass`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass_type: passType }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Wallet pass unavailable', data.detail || 'Try again later');
        return;
      }
      const pass = data.pass_data || {};
      if (data.mock_mode) {
        Alert.alert(
          'Sandbox mode',
          'Your CherryHub wallet pass will be issued by CherryHub once the backend is running in production.'
        );
        return;
      }
      if (passType === 'google') {
        const url = pass.GooglePassUrl;
        if (url) {
          await Linking.openURL(url);
        } else {
          Alert.alert('No Google Wallet URL returned');
        }
      } else {
        const b64 = pass.IosPassContentBase64;
        if (!b64) {
          Alert.alert('No pass payload returned');
          return;
        }
        // Write the .pkpass to a local file, then hand off to iOS
        const fileUri = `${FileSystem.cacheDirectory}cherryhub-${cherry.member_key}.pkpass`;
        await FileSystem.writeAsStringAsync(fileUri, b64, { encoding: FileSystem.EncodingType.Base64 });
        await Linking.openURL(fileUri);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not generate wallet pass');
    } finally {
      setWalletLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppBackground />
        <ActivityIndicator size="large" color={CHERRY} style={{ marginTop: 200 }} />
      </View>
    );
  }

  const linked = cherry?.registered ?? false;

  return (
    <View style={styles.container}>
      <AppBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={fetchAll} tintColor={CHERRY} />}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            data-testid="member-card-back"
          >
            <Icon name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>MEMBERSHIP CARD</Text>
        </View>

        {/* CherryHub-branded card */}
        <View style={styles.cardOuter} data-testid="cherryhub-member-card">
          <LinearGradient
            colors={[INK, CHERRY_DARK, INK]}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cherryLogo}>CHERRYHUB</Text>
                <Text style={styles.cherrySub}>× LUNA GROUP</Text>
              </View>
              <View style={[styles.tierPill, { backgroundColor: (card?.tier_color || '#CD7F32') + '30' }]}>
                <LunaIcon name={card?.tier_id || 'bronze'} size={14} color={card?.tier_color || '#CD7F32'} />
                <Text style={[styles.tierPillText, { color: card?.tier_color }]}>{card?.tier || 'Bronze'}</Text>
              </View>
            </View>

            <View style={styles.qrSection}>
              {card?.qr_code && <Image source={{ uri: card.qr_code }} style={styles.qrImage} resizeMode="contain" />}
              <Text style={styles.qrHint}>Staff scan • In-store or at venue</Text>
            </View>

            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{card?.name || 'Member'}</Text>
              <Text style={styles.cardEmail}>{card?.email || ''}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{(card?.points_balance || 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>POINTS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>${(card?.wallet_balance || 0).toFixed(2)}</Text>
                <Text style={styles.statLabel}>WALLET</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{card?.multiplier || 1}x</Text>
                <Text style={styles.statLabel}>MULTIPLIER</Text>
              </View>
            </View>

            <View style={styles.cardBottom}>
              <Text style={styles.memberSince}>
                Member since {card?.member_since ? new Date(card.member_since).getFullYear() : '2024'}
              </Text>
              <Text style={styles.cardIdText} data-testid="cherryhub-card-id">
                {linked ? `CH: ${cherry?.member_key}` : `ID: ${card?.user_id?.slice(0, 8) || '—'}`}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Link CTA if not linked to CherryHub */}
        {!linked && (
          <TouchableOpacity
            style={styles.linkCtaBtn}
            onPress={linkCherryHub}
            disabled={linking}
            data-testid="member-card-link-cherryhub"
          >
            <LinearGradient colors={[CHERRY, CHERRY_DARK]} style={styles.linkCtaInner}>
              {linking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="link" size={18} color="#fff" />
                  <Text style={styles.linkCtaText}>Link CherryHub Account</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Wallet buttons */}
        <View style={styles.walletButtons}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.walletBtn, !linked && styles.walletBtnDisabled]}
              onPress={() => addToWallet('apple')}
              disabled={walletLoading || !linked}
              data-testid="add-apple-wallet-btn"
            >
              {walletLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="phone-portrait" size={20} color="#fff" />
                  <Text style={styles.walletBtnText}>Add to Apple Wallet</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.walletBtn, styles.googleBtn, !linked && styles.walletBtnDisabled]}
            onPress={() => addToWallet('google')}
            disabled={walletLoading || !linked}
            data-testid="add-google-wallet-btn"
          >
            {walletLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="logo-google" size={20} color="#fff" />
                <Text style={styles.walletBtnText}>Add to Google Wallet</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Icon name="information-circle" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>
            {linked
              ? `Your CherryHub member card is active. Staff scan the QR to award points on every purchase. Your ${card?.tier || 'Bronze'} tier gives ${card?.multiplier || 1}x points.`
              : 'Link your CherryHub account to sync your in-store loyalty balance and unlock wallet passes.'}
          </Text>
        </View>

        {cherry?.mock_mode && (
          <View style={styles.mockBanner}>
            <Icon name="flask" size={14} color={CHERRY} />
            <Text style={styles.mockBannerText}>
              Sandbox: live CherryHub wallet pass will activate once backend is deployed to production.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1.5 },
  // Card
  cardOuter: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: CHERRY + '88',
    marginBottom: spacing.lg,
    shadowColor: CHERRY,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  cardGradient: { padding: spacing.lg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  cherryLogo: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 3 },
  cherrySub: { fontSize: 9, color: CHERRY, letterSpacing: 2, marginTop: 2, fontWeight: '600' },
  tierPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
  tierPillText: { fontSize: 11, fontWeight: '700' },
  // QR
  qrSection: { alignItems: 'center', marginBottom: spacing.lg },
  qrImage: { width: 180, height: 180, borderRadius: radius.md, backgroundColor: '#fff', padding: 8 },
  qrHint: { fontSize: 11, color: '#FFFFFF99', marginTop: spacing.sm, letterSpacing: 1 },
  // Info
  cardInfo: { alignItems: 'center', marginBottom: spacing.md },
  cardName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  cardEmail: { fontSize: 12, color: '#FFFFFF88', marginTop: 2 },
  // Stats
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: '#FFFFFF18' },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 10, color: '#FFFFFF77', letterSpacing: 1, marginTop: 2 },
  // Bottom
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberSince: { fontSize: 10, color: '#FFFFFF77' },
  cardIdText: { fontSize: 11, color: CHERRY, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700' },
  // Link CTA
  linkCtaBtn: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.lg },
  linkCtaInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 14 },
  linkCtaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // Wallet
  walletButtons: { gap: spacing.sm, marginBottom: spacing.lg },
  walletBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#000', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.glassBorderSubtle },
  googleBtn: { backgroundColor: '#1A73E8' },
  walletBtnDisabled: { opacity: 0.45 },
  walletBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  // Info
  infoBox: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.glass, borderRadius: radius.lg, marginBottom: spacing.md },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  mockBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: CHERRY + '18', borderRadius: radius.md, borderWidth: 1, borderColor: CHERRY + '44' },
  mockBannerText: { flex: 1, fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
});
