import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRouter } from 'expo-router';
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
        Alert.alert('Linked', `CherryHub account linked\nMember key: ${data.member_key}`);
        await fetchData();
      } else {
        Alert.alert('Link failed', data.detail || 'Could not link CherryHub account');
      }
    } catch (err: any) {
      Alert.alert('Link failed', err?.message || 'Network error');
    } finally {
      setLinking(false);
    }
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
      <TouchableOpacity onPress={() => router.back()} style={styles.back} data-testid="cherryhub-back">
        <Icon name="chevron-back" size={24} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>CherryHub Membership</Text>
      <Text style={styles.subtitle}>
        Your in-store loyalty profile. Points earned in the app are mirrored to your CherryHub member card.
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
                <Text style={styles.linkBtnText}>Link CherryHub Account</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <Text style={styles.footerHint}>
          Your CherryHub member card is active. In-store staff can look you up with your member key above.
        </Text>
      )}

      <View style={styles.helpBlock}>
        <Text style={styles.helpTitle}>How it works</Text>
        <Text style={styles.helpText}>
          • Points you earn in the Luna app (bookings, missions, auctions, birthday bonuses) live in Luna.
        </Text>
        <Text style={styles.helpText}>
          • When you tap your card in-store, CherryHub pulls your live Luna balance.
        </Text>
        <Text style={styles.helpText}>
          • In-store redemptions logged in CherryHub are mirrored back into Luna so your balance stays accurate everywhere.
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
  footerHint: { color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  helpBlock: { marginTop: 28, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  helpTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  helpText: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 6 },
});
