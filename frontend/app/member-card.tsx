import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Platform, Linking, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { Icon } from '../src/components/Icon';
import { LunaIcon } from '../src/components/LunaIcons';
import { AppBackground } from '../src/components/AppBackground';

export default function MemberCard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getMemberCard();
        setCard(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const addToAppleWallet = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const token = require('../src/stores/authStore').useAuthStore.getState().token;
      await Linking.openURL(`${backendUrl}/api/loyalty/wallet-pass/apple?token=${token}`);
    } catch {
      Alert.alert('Error', 'Could not generate Apple Wallet pass. Please try again.');
    }
  };

  const addToGoogleWallet = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await api.getGoogleWalletLink();
      if (result.save_url) {
        await Linking.openURL(result.save_url);
      } else {
        Alert.alert('Error', result.message || 'Google Wallet not available');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not generate Google Wallet pass');
    }
  };

  if (loading) return <View style={styles.container}><AppBackground /><ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 200 }} /></View>;

  return (
    <View style={styles.container}>
      <AppBackground />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Icon name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
          <Text style={styles.headerTitle}>MEMBER CARD</Text>
        </View>

        {/* Card */}
        <View style={styles.cardOuter}>
          <LinearGradient colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']} style={styles.cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {/* Top Row */}
            <View style={styles.cardTop}>
              <Text style={styles.cardLogo}>LUNA</Text>
              <View style={[styles.tierPill, { backgroundColor: (card?.tier_color || '#CD7F32') + '30' }]}>
                <LunaIcon name={card?.tier_id || 'bronze'} size={14} color={card?.tier_color || '#CD7F32'} />
                <Text style={[styles.tierPillText, { color: card?.tier_color }]}>{card?.tier || 'Bronze'}</Text>
              </View>
            </View>

            {/* QR Code */}
            <View style={styles.qrSection}>
              {card?.qr_code && <Image source={{ uri: card.qr_code }} style={styles.qrImage} resizeMode="contain" />}
              <Text style={styles.qrHint}>Show this to staff when ordering</Text>
            </View>

            {/* Member Info */}
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{card?.name || 'Member'}</Text>
              <Text style={styles.cardEmail}>{card?.email || ''}</Text>
            </View>

            {/* Stats Row */}
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

            {/* Bottom */}
            <View style={styles.cardBottom}>
              <Text style={styles.memberSince}>Member since {card?.member_since ? new Date(card.member_since).getFullYear() : '2024'}</Text>
              <Text style={styles.cardIdText}>ID: {card?.user_id?.slice(0, 8) || '—'}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Wallet Buttons */}
        <View style={styles.walletButtons}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.walletBtn} onPress={addToAppleWallet} data-testid="add-apple-wallet-btn">
              <Icon name="phone-portrait" size={20} color="#fff" />
              <Text style={styles.walletBtnText}>Add to Apple Wallet</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.walletBtn, styles.googleBtn]} onPress={addToGoogleWallet} data-testid="add-google-wallet-btn">
            <Icon name="logo-google" size={20} color="#fff" />
            <Text style={styles.walletBtnText}>Add to Google Wallet</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Icon name="information-circle" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>Staff will scan your QR code to award points on every purchase. Your {card?.tier || 'Bronze'} tier gives you a {card?.multiplier || 1}x points multiplier!</Text>
        </View>

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
  cardOuter: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accentGlow, marginBottom: spacing.lg },
  cardGradient: { padding: spacing.lg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  cardLogo: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, letterSpacing: 4 },
  tierPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
  tierPillText: { fontSize: 11, fontWeight: '700' },
  // QR
  qrSection: { alignItems: 'center', marginBottom: spacing.lg },
  qrImage: { width: 180, height: 180, borderRadius: radius.md },
  qrHint: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
  // Info
  cardInfo: { alignItems: 'center', marginBottom: spacing.md },
  cardName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  cardEmail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  // Stats
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.glassBorderSubtle },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 1, marginTop: 2 },
  // Bottom
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberSince: { fontSize: 10, color: colors.textMuted },
  cardIdText: { fontSize: 10, color: colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  // Wallet
  walletButtons: { gap: spacing.sm, marginBottom: spacing.lg },
  walletBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#000', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.glassBorderSubtle },
  googleBtn: { backgroundColor: '#1A73E8' },
  walletBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  // Info
  infoBox: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.glass, borderRadius: radius.lg },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});
