import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

const colors = {
  bg: '#0A0A0A',
  glass: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  gold: '#D4AF37',
  cherry: '#D4163D',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
};

interface StatusResp {
  registered: boolean;
  connected: boolean;
  member_key: string | null;
  mock_mode: boolean;
  linked_at?: string;
  status: string;
  message: string;
}

interface PointsResp {
  points: number;
  source: string;
  member_key: string | null;
  mock_mode: boolean;
  tier?: string;
  lifetime_points?: number;
}

export default function CherryHubScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromSignup = from === 'signup';
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

  const [status, setStatus] = useState<StatusResp | null>(null);
  const [points, setPoints] = useState<PointsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [sRes, pRes] = await Promise.all([
        fetch(`${BACKEND}/api/cherryhub/status`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BACKEND}/api/cherryhub/points`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (sRes.ok) setStatus(await sRes.json());
      if (pRes.ok) setPoints(await pRes.json());
    } catch (err) {
      console.warn('CherryHub fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [BACKEND, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLink = async () => {
    if (!token) return;
    setLinking(true);
    try {
      const res = await fetch(`${BACKEND}/api/cherryhub/link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, create_if_not_exists: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const msg = data.new_account
          ? `New CherryHub account created. In-venue points will start earning as soon as Luna staff finishes setting up your POS profile.`
          : `Your CherryHub account is now linked.\nMember key: ${data.member_key}`;
        Alert.alert('You\'re all set', msg, [{
          text: fromSignup ? 'Continue to app' : 'Done',
          onPress: () => {
            if (fromSignup) {
              router.replace('/(tabs)');
            } else {
              fetchData();
            }
          },
        }]);
        if (!fromSignup) await fetchData();
      } else {
        Alert.alert('Link failed', data.detail || 'Could not link CherryHub account');
      }
    } catch (err: any) {
      Alert.alert('Link failed', err?.message || 'Network error');
    } finally {
      setLinking(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip loyalty linking?',
      'You can link anytime in Wallet. Without a CherryHub link, in-venue purchases won\'t earn points on this account.',
      [
        { text: 'Go back', style: 'cancel' },
        { text: 'Skip for now', style: 'destructive', onPress: () => router.replace('/(tabs)') },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const linked = status?.registered ?? false;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingTop: 60 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={fetchData} tintColor={colors.gold} />}
    >
      {!fromSignup && (
        <TouchableOpacity onPress={() => router.back()} style={styles.back} data-testid="cherryhub-back">
          <Icon name="chevron-back" size={24} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.title}>
        {fromSignup ? 'One last step' : 'CherryHub Membership'}
      </Text>
      <Text style={styles.subtitle}>
        {fromSignup
          ? 'Link your Luna account to CherryHub so every drink, booth, and cover charge at the bar earns you points automatically.'
          : 'Your CherryHub card is the bridge between the app and our POS system. Points earned in-venue land on this card instantly.'}
      </Text>

      <View style={styles.card} data-testid="cherryhub-status-card">
        <LinearGradient
          colors={[colors.glass, 'rgba(212, 22, 61, 0.08)']}
          style={styles.cardInner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.row}>
            <Icon name={linked ? 'checkmark-circle' : 'alert-circle-outline'}
              size={20} color={linked ? '#4ADE80' : colors.cherry} />
            <Text style={styles.statusText}>
              {linked ? 'Linked to CherryHub' : 'Not linked yet'}
            </Text>
            {status?.mock_mode ? <Text style={styles.mockBadge}>SANDBOX</Text> : null}
          </View>

          {linked && (
            <>
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Member Key</Text>
                <Text style={styles.metaValue} data-testid="cherryhub-member-key">
                  {status?.member_key}
                </Text>
              </View>
              {status?.linked_at && (
                <View style={styles.metaBlock}>
                  <Text style={styles.metaLabel}>Linked</Text>
                  <Text style={styles.metaValue}>
                    {new Date(status.linked_at).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </>
          )}
        </LinearGradient>
      </View>

      {linked && points && (
        <View style={styles.card}>
          <LinearGradient
            colors={[colors.glass, 'rgba(212, 175, 55, 0.1)']}
            style={styles.cardInner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.metaLabel}>POINTS BALANCE</Text>
            <Text style={styles.balance} data-testid="cherryhub-points">
              {(points.points || 0).toLocaleString()}
            </Text>
            <Text style={styles.metaHint}>
              Source: {points.source}{points.tier ? ` · Tier ${points.tier}` : ''}
            </Text>
          </LinearGradient>
        </View>
      )}

      {!linked ? (
        <>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={handleLink}
            disabled={linking}
            data-testid="cherryhub-link-btn"
          >
            <LinearGradient colors={[colors.cherry, '#9C1029']} style={styles.linkBtnInner}>
              {linking ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Icon name="link" size={18} color={colors.text} />
                  <Text style={styles.linkBtnText}>
                    {fromSignup ? 'Link or create CherryHub account' : 'Link CherryHub Account'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          {fromSignup && (
            <TouchableOpacity
              onPress={handleSkip}
              disabled={linking}
              style={styles.skipBtn}
              data-testid="cherryhub-skip-btn"
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <>
          <Text style={styles.footerHint}>
            Your CherryHub member card is active. Show the QR code at the bar — staff will scan it and your points will update in real time.
          </Text>
          {fromSignup && (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => router.replace('/(tabs)')}
              data-testid="cherryhub-continue-btn"
            >
              <LinearGradient colors={[colors.cherry, '#9C1029']} style={styles.linkBtnInner}>
                <Icon name="arrow-forward" size={18} color={colors.text} />
                <Text style={styles.linkBtnText}>Continue to app</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </>
      )}

      <View style={styles.helpBlock}>
        <Text style={styles.helpTitle}>How it works</Text>
        <Text style={styles.helpText}>
          • Every in-venue purchase on SwiftPOS earns points automatically — show your CherryHub QR at the bar when you pay.
        </Text>
        <Text style={styles.helpText}>
          • Missions and in-app rewards also push through as POS transactions so they count the same way.
        </Text>
        <Text style={styles.helpText}>
          • Pull down on the wallet screen to force a live balance refresh from the POS system.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backText: { color: colors.text, fontSize: 16, marginLeft: 4 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 24 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInner: { padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  mockBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    color: colors.gold,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  metaBlock: { marginTop: 14 },
  metaLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  metaValue: { color: colors.text, fontSize: 15, marginTop: 4, fontFamily: 'monospace' },
  metaHint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  balance: { color: colors.gold, fontSize: 42, fontWeight: '700', marginTop: 8 },
  linkBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  linkBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  linkBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  skipBtn: { marginTop: 14, alignSelf: 'center', padding: 10 },
  skipText: { color: colors.textMuted, fontSize: 14, textDecorationLine: 'underline' },
  footerHint: { color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 16 },
  helpBlock: { marginTop: 28, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  helpTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  helpText: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 6 },
});
