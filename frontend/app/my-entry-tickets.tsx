import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Icon } from '../src/components/Icon';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { AppBackground } from '../src/components/AppBackground';

interface EntryTicket {
  id: string;
  venue_id: string;
  venue_name: string;
  qr_code: string;
  status: string;
  live_status: 'active' | 'scheduled' | 'used' | 'expired' | 'revoked';
  valid_from: string;
  valid_until: string;
  note?: string | null;
  created_at: string;
}

const STATUS_META: Record<EntryTicket['live_status'], { label: string; color: string; icon: string }> = {
  active:    { label: 'ACTIVE',    color: '#22C55E', icon: 'checkmark-circle' },
  scheduled: { label: 'UPCOMING',  color: '#60A5FA', icon: 'time' },
  used:      { label: 'USED',      color: '#6B7280', icon: 'checkmark-done' },
  expired:   { label: 'EXPIRED',   color: '#9CA3AF', icon: 'close-circle' },
  revoked:   { label: 'REVOKED',   color: '#EF4444', icon: 'ban' },
};

function useCountdown(target: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h >= 1) return `${h}h ${m}m remaining`;
  if (m >= 1) return `${m}m ${s}s remaining`;
  return `${s}s remaining`;
}

function TicketCountdown({ until, startsAt, status }: { until: string; startsAt: string; status: EntryTicket['live_status'] }) {
  const starts = useCountdown(startsAt);
  const expires = useCountdown(until);
  if (status === 'scheduled') {
    return <Text style={styles.countdownText} data-testid="entry-ticket-countdown">Starts in {starts}</Text>;
  }
  if (status === 'active') {
    return <Text style={styles.countdownText} data-testid="entry-ticket-countdown">{expires}</Text>;
  }
  return null;
}

export default function MyEntryTicketsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<EntryTicket[]>([]);
  const [selected, setSelected] = useState<EntryTicket | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getMyEntryTickets();
      setTickets(res.tickets || []);
    } catch (_e) {
      setTickets([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Sort: active first, then scheduled, then used/expired
  const sortOrder: Record<EntryTicket['live_status'], number> = {
    active: 0, scheduled: 1, used: 2, expired: 3, revoked: 4,
  };
  const sorted = [...tickets].sort((a, b) => sortOrder[a.live_status] - sortOrder[b.live_status]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} data-testid="my-entry-tickets-screen">
      <AppBackground intensity={20} tint="dark" overlayOpacity={0.85} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          data-testid="entry-tickets-back-btn"
        >
          <Icon name="chevron-back" size={26} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Free Entries</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>
      ) : sorted.length === 0 ? (
        <View style={styles.centered}>
          <Icon name="ticket-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No free entries yet</Text>
          <Text style={styles.emptySubtitle}>
            When a Luna Group manager gifts you a free entry, it'll appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {sorted.map((t) => {
            const meta = STATUS_META[t.live_status];
            const disabled = t.live_status !== 'active' && t.live_status !== 'scheduled';
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.card, disabled && styles.cardDim]}
                onPress={() => setSelected(t)}
                disabled={disabled}
                data-testid={`entry-ticket-card-${t.id}`}
              >
                <LinearGradient
                  colors={['rgba(212,168,50,0.08)', 'rgba(212,168,50,0.02)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.cardTop}>
                  <View style={[styles.badge, { backgroundColor: `${meta.color}22`, borderColor: meta.color }]}>
                    <Icon name={meta.icon as any} size={10} color={meta.color} />
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <Text style={styles.venueName} numberOfLines={1}>{t.venue_name}</Text>
                </View>
                <Text style={styles.cardTitle}>Complimentary Entry</Text>
                {t.note ? <Text style={styles.cardNote} numberOfLines={2}>{t.note}</Text> : null}
                <View style={styles.cardFooter}>
                  <TicketCountdown until={t.valid_until} startsAt={t.valid_from} status={t.live_status} />
                  {(t.live_status === 'active' || t.live_status === 'scheduled') && (
                    <View style={styles.viewQrPill}>
                      <Icon name="qr-code" size={12} color={colors.accent} />
                      <Text style={styles.viewQrText}>View QR</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* QR modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {selected && (
              <>
                <Text style={styles.modalVenue}>{selected.venue_name}</Text>
                <Text style={styles.modalTitle}>Complimentary Entry</Text>
                <View style={styles.qrWrapper}>
                  <QRCode value={selected.qr_code} size={220} backgroundColor="#FFFFFF" color="#000000" />
                </View>
                <Text style={styles.modalCode} data-testid="entry-ticket-qr-code">{selected.qr_code}</Text>
                {selected.live_status === 'active' ? (
                  <Text style={styles.modalExpiry}>
                    Expires {new Date(selected.valid_until).toLocaleString('en-AU', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                ) : (
                  <Text style={styles.modalExpiry}>
                    Valid from {new Date(selected.valid_from).toLocaleString('en-AU', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setSelected(null)}
                  data-testid="entry-ticket-modal-close"
                >
                  <Text style={styles.modalCloseText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', letterSpacing: 0.5 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: spacing.lg },
  emptySubtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,168,50,0.25)',
    backgroundColor: 'rgba(15,15,20,0.6)',
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardDim: { opacity: 0.55 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  venueName: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 },
  cardTitle: { color: colors.accent, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  cardNote: { color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  countdownText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  viewQrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,168,50,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  viewQrText: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalSheet: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,168,50,0.3)',
  },
  modalVenue: { color: colors.textSecondary, fontSize: 12, letterSpacing: 1.5, fontWeight: '700' },
  modalTitle: { color: colors.accent, fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: spacing.lg },
  qrWrapper: { backgroundColor: '#FFFFFF', padding: spacing.md, borderRadius: radius.md },
  modalCode: { color: colors.textPrimary, fontSize: 12, fontFamily: 'monospace', marginTop: spacing.md, letterSpacing: 1 },
  modalExpiry: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
  modalClose: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 100,
    marginTop: spacing.lg,
  },
  modalCloseText: { color: '#000', fontWeight: '800', letterSpacing: 1 },
});
