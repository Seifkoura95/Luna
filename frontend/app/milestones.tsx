import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { Icon } from '../src/components/Icon';
import { AppBackground } from '../src/components/AppBackground';

const isNative = Platform.OS !== 'web';

type Milestone = {
  id: string; title: string; points_required: number; icon: string; color: string;
  description: string; total_rewards: number; reward_summary: string;
  unlocked: boolean; claimed: boolean; active_tickets: number; progress: number;
};
type Ticket = {
  ticket_id: string; milestone_id: string; milestone_title: string;
  reward_type: string; reward_label: string; reward_description: string;
  qr_code: string; status: string;
};

export default function MilestonesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const fetchMilestones = useCallback(async () => {
    try {
      const res = await api.getMilestones();
      setMilestones(res.milestones);
      setPoints(res.points_balance);
    } catch (e) { console.error('Failed to load milestones:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

  const handleClaim = async (m: Milestone) => {
    if (!m.unlocked) { Alert.alert('Locked', `You need ${m.points_required.toLocaleString()} points to unlock this milestone.`); return; }
    if (m.claimed) { loadTicketsForMilestone(m); return; }
    if (m.total_rewards === 0) { Alert.alert(m.title, m.description); return; }

    setClaiming(m.id);
    try {
      const res = await api.claimMilestone(m.id);
      if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Milestone Claimed!', res.message);
      await fetchMilestones();
      loadTicketsForMilestone(m);
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to claim'); }
    finally { setClaiming(null); }
  };

  const loadTicketsForMilestone = async (m: Milestone) => {
    setSelectedMilestone(m);
    setLoadingTickets(true);
    try {
      const res = await api.getMilestoneTickets(m.id);
      setTickets(res.tickets);
    } catch (e) { console.error('Failed to load tickets:', e); setTickets([]); }
    finally { setLoadingTickets(false); }
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'free_drink': return 'wine';
      case 'free_entry': return 'enter';
      case 'express_entry': return 'flash';
      case 'free_vip_booth': return 'diamond';
      case 'dj_shoutout': return 'musical-notes';
      case 'gold_upgrade': return 'star';
      case 'booth_with_bottle': return 'diamond';
      case 'giftable_entry': return 'gift';
      default: return 'ticket';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} data-testid="milestones-screen">
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} data-testid="milestones-back-btn">
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>MILESTONES</Text>
          <Text style={styles.headerSub}>{points.toLocaleString()} points</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Progress Tracker */}
          <View style={styles.progressTrack}>
            {milestones.map((m, i) => (
              <View key={m.id} style={styles.progressNode}>
                <View style={[styles.progressDot, m.unlocked ? { backgroundColor: m.color, borderColor: m.color } : {}]} />
                {i < milestones.length - 1 && (
                  <View style={[styles.progressLine, milestones[i + 1].unlocked ? { backgroundColor: milestones[i + 1].color } : {}]} />
                )}
              </View>
            ))}
          </View>

          {/* Milestone Cards */}
          {milestones.map((m) => {
            const isClaiming = claiming === m.id;
            const canClaim = m.unlocked && !m.claimed && m.total_rewards > 0;

            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.card, m.unlocked && { borderColor: m.color + '50' }]}
                onPress={() => handleClaim(m)}
                activeOpacity={0.7}
                data-testid={`milestone-${m.id}`}
              >
                <LinearGradient
                  colors={m.unlocked ? [m.color + '10', 'transparent'] : ['transparent', 'transparent']}
                  style={styles.cardGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  {/* Left Icon */}
                  <View style={[styles.iconCircle, { backgroundColor: m.unlocked ? m.color + '20' : colors.glassMid, borderColor: m.unlocked ? m.color + '40' : colors.border }]}>
                    <Icon name={m.unlocked && m.claimed ? 'checkmark-circle' : m.icon as any} size={24} color={m.unlocked ? m.color : colors.textMuted} />
                  </View>

                  {/* Center Info */}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTop}>
                      <Text style={[styles.cardTitle, m.unlocked && { color: m.color }]}>{m.title}</Text>
                      <Text style={[styles.cardPts, m.unlocked && { color: m.color }]}>
                        {m.points_required === 0 ? 'Start' : `${m.points_required.toLocaleString()} pts`}
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    {m.points_required > 0 && (
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${m.progress * 100}%`, backgroundColor: m.color }]} />
                      </View>
                    )}

                    <Text style={styles.cardDesc} numberOfLines={1}>{m.description}</Text>

                    {/* Reward Summary */}
                    {m.total_rewards > 0 && (
                      <View style={styles.rewardRow}>
                        <Icon name="gift" size={12} color={m.unlocked ? m.color : colors.textMuted} />
                        <Text style={[styles.rewardText, m.unlocked && { color: m.color }]}>{m.reward_summary}</Text>
                      </View>
                    )}

                    {/* Action Badge */}
                    {canClaim && (
                      <View style={[styles.claimBadge, { backgroundColor: m.color }]} data-testid={`claim-${m.id}`}>
                        {isClaiming ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.claimBadgeText}>CLAIM REWARDS</Text>}
                      </View>
                    )}
                    {m.claimed && m.active_tickets > 0 && (
                      <View style={[styles.ticketBadge, { backgroundColor: m.color + '20', borderColor: m.color }]}>
                        <Icon name="ticket" size={12} color={m.color} />
                        <Text style={[styles.ticketBadgeText, { color: m.color }]}>{m.active_tickets} tickets remaining</Text>
                      </View>
                    )}
                    {m.claimed && m.active_tickets === 0 && m.total_rewards > 0 && (
                      <Text style={styles.usedText}>All rewards used</Text>
                    )}
                    {!m.unlocked && (
                      <Text style={styles.lockedText}>{(m.points_required - points).toLocaleString()} pts to go</Text>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Tickets Modal */}
      <Modal visible={!!selectedMilestone} transparent animationType="slide" onRequestClose={() => setSelectedMilestone(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { backgroundColor: selectedMilestone?.color || colors.accent }]}>
              <View>
                <Text style={styles.modalTitle}>{selectedMilestone?.title}</Text>
                <Text style={styles.modalSub}>Your Reward Tickets</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedMilestone(null)} data-testid="close-tickets-modal">
                <Icon name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {loadingTickets ? (
                <ActivityIndicator size="large" color={selectedMilestone?.color} style={{ margin: 40 }} />
              ) : tickets.length === 0 ? (
                <View style={styles.emptyTickets}>
                  <Icon name="checkmark-circle" size={40} color={colors.textMuted} />
                  <Text style={styles.emptyText}>All tickets have been used!</Text>
                </View>
              ) : (
                tickets.map((t) => (
                  <TouchableOpacity
                    key={t.ticket_id}
                    style={styles.ticketCard}
                    onPress={() => setSelectedTicket(t)}
                    data-testid={`ticket-${t.ticket_id}`}
                  >
                    <View style={[styles.ticketIcon, { backgroundColor: (selectedMilestone?.color || colors.accent) + '15' }]}>
                      <Icon name={getRewardIcon(t.reward_type) as any} size={20} color={selectedMilestone?.color || colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketLabel}>{t.reward_label}</Text>
                      <Text style={styles.ticketDesc}>{t.reward_description}</Text>
                    </View>
                    <View style={styles.qrBadge}>
                      <Icon name="qr-code" size={16} color={colors.accent} />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ticket QR Detail Modal */}
      <Modal visible={!!selectedTicket} transparent animationType="fade" onRequestClose={() => setSelectedTicket(null)}>
        <View style={styles.qrOverlay}>
          <View style={styles.qrModal}>
            <View style={[styles.qrHeader, { backgroundColor: selectedMilestone?.color || colors.accent }]}>
              <Text style={styles.qrHeaderTitle}>{selectedTicket?.reward_label}</Text>
              <TouchableOpacity onPress={() => setSelectedTicket(null)} data-testid="close-qr-modal">
                <Icon name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.qrBody}>
              <View style={styles.qrBox}>
                <Icon name="qr-code" size={80} color={colors.textPrimary} />
                <Text style={styles.qrCode}>{selectedTicket?.qr_code}</Text>
              </View>
              <Text style={styles.qrInstruction}>Show this QR code to staff to redeem</Text>
              <Text style={styles.qrWarning}>One-time use — ticket deleted after scan</Text>
              <Text style={styles.qrMilestone}>{selectedTicket?.milestone_title}</Text>
              <Text style={styles.qrRewardDesc}>{selectedTicket?.reward_description}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: 1.5 },
  headerSub: { fontSize: 12, color: colors.gold, marginTop: 2 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },

  // Progress dots
  progressTrack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.md },
  progressNode: { flexDirection: 'row', alignItems: 'center' },
  progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.glassMid, borderWidth: 2, borderColor: colors.border },
  progressLine: { width: 32, height: 2, backgroundColor: colors.border, marginHorizontal: 2 },

  // Cards
  card: { marginBottom: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.glassBorderSubtle, overflow: 'hidden', backgroundColor: colors.glass },
  cardGrad: { flexDirection: 'row', padding: spacing.md, gap: spacing.md },
  iconCircle: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  cardInfo: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.textMuted },
  cardPts: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  progressBarBg: { height: 4, backgroundColor: colors.glassMid, borderRadius: 2, marginBottom: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },
  cardDesc: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  rewardText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  claimBadge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full },
  claimBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  ticketBadge: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  ticketBadgeText: { fontSize: 11, fontWeight: '600' },
  usedText: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  lockedText: { fontSize: 11, color: colors.textMuted },

  // Tickets Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.backgroundCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  modalSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  modalBody: { padding: spacing.md },
  emptyTickets: { alignItems: 'center', padding: 40, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted },
  ticketCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.glass, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorderSubtle, marginBottom: spacing.sm },
  ticketIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  ticketLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  ticketDesc: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  qrBadge: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.glassMid, justifyContent: 'center', alignItems: 'center' },

  // QR Modal
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  qrModal: { backgroundColor: colors.backgroundCard, borderRadius: radius.xl, width: '100%', maxWidth: 340, overflow: 'hidden' },
  qrHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  qrHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', flex: 1 },
  qrBody: { padding: spacing.lg, alignItems: 'center' },
  qrBox: { backgroundColor: '#FFF', borderRadius: radius.lg, padding: 24, alignItems: 'center', marginBottom: spacing.md },
  qrCode: { fontSize: 10, color: '#333', marginTop: 8, letterSpacing: 1, fontWeight: '600' },
  qrInstruction: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  qrWarning: { fontSize: 11, color: colors.error, marginTop: 4, textAlign: 'center' },
  qrMilestone: { fontSize: 13, color: colors.gold, fontWeight: '700', marginTop: spacing.md },
  qrRewardDesc: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
});
