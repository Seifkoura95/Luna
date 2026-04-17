import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../src/components/Icon';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../src/theme/colors';
import { api, apiFetch } from '../src/utils/api';
import { AppBackground } from '../src/components/AppBackground';

const isNative = Platform.OS !== 'web';

const VENUES = [
  { id: 'eclipse', name: 'Eclipse', color: '#E31837' },
  { id: 'after_dark', name: 'After Dark', color: '#8B00FF' },
  { id: 'su_casa_brisbane', name: 'Su Casa BNE', color: '#FFB800' },
  { id: 'su_casa_gold_coast', name: 'Su Casa GC', color: '#FF6B35' },
  { id: 'pump', name: 'Pump', color: '#FF1493' },
  { id: 'mamacita', name: 'Mamacita', color: '#FF4500' },
  { id: 'juju', name: 'Juju', color: '#00D4AA' },
  { id: 'night_market', name: 'Night Market', color: '#FF4757' },
  { id: 'ember_and_ash', name: 'Ember & Ash', color: '#FFA502' },
];

const CATEGORIES = [
  { id: 'drinks', label: 'Drinks', icon: 'wine' },
  { id: 'food', label: 'Food', icon: 'restaurant' },
  { id: 'entry', label: 'Entry', icon: 'enter' },
  { id: 'booth', label: 'Booth', icon: 'people' },
  { id: 'bottle_service', label: 'Bottles', icon: 'wine' },
  { id: 'general', label: 'Other', icon: 'card' },
];

interface MemberResult { user_id: string; name: string; email: string; phone: string; tier: string; tier_color: string; points_balance: number; wallet_balance: number; }
interface MemberProfile extends MemberResult { tier_id: string; benefits: any; today: { entries: number; drink_redeemed: boolean; guest_used: number; guest_remaining: number; guest_limit: number; }; }

type PortalTab = 'award' | 'validate' | 'history';

export default function StaffPortal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PortalTab>('award');
  const [activeVenue, setActiveVenue] = useState(VENUES[0]);

  // Search / member state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MemberResult[]>([]);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Quick Award state
  const [amountInput, setAmountInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('drinks');
  const [receiptRef, setReceiptRef] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [lastAward, setLastAward] = useState<any>(null);

  // Validate Reward state
  const [qrInput, setQrInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  // History state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Scanner
  const [showScanner, setShowScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (isNative) {
      (async () => {
        try {
          const { BarCodeScanner: BCS } = require('expo-barcode-scanner');
          const { status } = await BCS.requestPermissionsAsync();
          setHasPermission(status === 'granted');
        } catch {}
      })();
    }
  }, []);

  // Load history when tab switches
  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, activeVenue]);

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearching(true); setMember(null); setLastAward(null);
    try {
      const data = await api.searchMember(searchQuery);
      setResults(data.members || []);
      if (data.members.length === 0) Alert.alert('No Results', 'No members found.');
      if (data.members.length === 1) selectMember(data.members[0].user_id);
    } catch (e: any) { Alert.alert('Error', e.message || 'Search failed'); }
    finally { setSearching(false); }
  };

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanning) return;
    setScanning(true);
    if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowScanner(false);
    const userId = data.replace('LUNA-MEMBER:', '').replace('LUNA-', '').trim();

    if (activeTab === 'validate') {
      setQrInput(userId);
      setScanning(false);
      handleValidateReward(userId);
      return;
    }

    try {
      const profile = await api.getMemberProfile(userId);
      setMember(profile); setResults([]); setLastAward(null);
    } catch {
      try {
        const searchData = await api.searchMember(userId);
        if (searchData.members.length === 1) { const p = await api.getMemberProfile(searchData.members[0].user_id); setMember(p); }
        else if (searchData.members.length > 1) setResults(searchData.members);
        else Alert.alert('Not Found', 'No member found for this QR code');
      } catch { Alert.alert('Error', 'Could not identify member'); }
    } finally { setScanning(false); }
  };

  const selectMember = async (userId: string) => {
    if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingProfile(true);
    try {
      const profile = await api.getMemberProfile(userId);
      setMember(profile); setResults([]); setLastAward(null);
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to load member'); }
    finally { setLoadingProfile(false); }
  };

  const handleQuickAward = async () => {
    if (!member) return;
    const amount = parseFloat(amountInput);
    if (!amount || amount <= 0) { Alert.alert('Invalid', 'Enter a valid dollar amount'); return; }
    if (amount > 50000) { Alert.alert('Limit', 'Max single transaction is $50,000'); return; }

    setAwarding(true);
    try {
      const result = await api.quickAwardPoints({
        user_id: member.user_id,
        amount_spent: amount,
        venue_id: activeVenue.id,
        category: selectedCategory,
        receipt_ref: receiptRef || undefined,
      });
      if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLastAward(result);
      setAmountInput('');
      setReceiptRef('');
      // Refresh member profile
      const profile = await api.getMemberProfile(member.user_id);
      setMember(profile);
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to award points'); }
    finally { setAwarding(false); }
  };

  const handleValidateReward = async (code?: string) => {
    const qr = code || qrInput;
    if (!qr) { Alert.alert('Enter QR', 'Scan or enter the reward QR code'); return; }
    setValidating(true); setValidationResult(null);

    // Try milestone ticket QR first (LUNA-TKT-...), then fall back to rewards QR
    if (qr.startsWith('LUNA-TKT-')) {
      try {
        const result = await api.validateTicketQR(qr, activeVenue.id);
        if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setValidationResult({ ...result, success: true, message: `${result.message} (ticket deleted)` });
        return;
      } catch (e: any) {
        setValidationResult({ success: false, message: e.message || 'Invalid milestone ticket' });
        return;
      } finally { setValidating(false); }
    }

    try {
      const result = await api.validateRewardQR(qr, activeVenue.id);
      if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setValidationResult(result);
    } catch (e: any) {
      // Also try milestone ticket validation as fallback
      try {
        const result = await api.validateTicketQR(qr, activeVenue.id);
        if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setValidationResult({ ...result, success: true, message: `${result.message} (ticket deleted)` });
      } catch {
        setValidationResult({ success: false, message: e.message || 'Invalid QR code' });
      }
    } finally { setValidating(false); }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const [txnRes, sumRes] = await Promise.all([
        api.getStaffTransactions(activeVenue.id, 30),
        api.getStaffTransactionSummary(activeVenue.id, 'today'),
      ]);
      setTransactions(txnRes.transactions || []);
      setSummary(sumRes);
    } catch (e) { console.error('Failed to load history:', e); }
    finally { setLoadingHistory(false); }
  };

  const doAction = async (action: string, body: any, successMsg: string) => {
    if (!member) return;
    try {
      await apiFetch(`/api/perks/${action}`, { method: 'POST', body: JSON.stringify(body) });
      Alert.alert('Success', successMsg);
      const profile = await api.getMemberProfile(member.user_id);
      setMember(profile);
    } catch (e: any) { Alert.alert('Error', e.message || 'Action failed'); }
  };

  return (
    <View style={styles.container} data-testid="staff-portal-screen">
      <AppBackground />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="staff-portal-back-btn">
            <Icon name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>STAFF PORTAL</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Venue Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.venueRow} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs }}>
          {VENUES.map(v => (
            <TouchableOpacity
              key={v.id}
              style={[styles.venueChip, activeVenue.id === v.id && { backgroundColor: v.color, borderColor: v.color }]}
              onPress={() => setActiveVenue(v)}
              data-testid={`venue-select-${v.id}`}
            >
              <Text style={[styles.venueChipText, activeVenue.id === v.id && { color: '#FFF' }]}>{v.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab Switcher */}
        <View style={styles.tabs} data-testid="staff-tabs">
          {([['award', 'Award Points'], ['validate', 'Validate Reward'], ['history', 'History']] as [PortalTab, string][]).map(([id, label]) => (
            <TouchableOpacity key={id} style={[styles.tab, activeTab === id && styles.tabActive]} onPress={() => setActiveTab(id)} data-testid={`tab-${id}`}>
              <Text style={[styles.tabText, activeTab === id && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ═══ AWARD POINTS TAB ═══ */}
        {activeTab === 'award' && (
          <>
            {/* Search / Scan */}
            <View style={styles.card} data-testid="staff-search-card">
              <Text style={styles.cardTitle}>Find Member</Text>
              <View style={styles.searchRow}>
                <View style={styles.searchInputWrap}>
                  <Icon name="search" size={16} color={colors.textMuted} />
                  <TextInput style={styles.searchInput} placeholder="Name, email, phone..." placeholderTextColor={colors.textMuted} value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} returnKeyType="search" data-testid="staff-search-input" />
                </View>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: activeVenue.color }]} onPress={handleSearch} disabled={searching} data-testid="staff-search-btn">
                  {searching ? <ActivityIndicator size="small" color="#FFF" /> : <Icon name="arrow-forward" size={18} color="#FFF" />}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.accent }]} onPress={() => setShowScanner(!showScanner)} data-testid="staff-scan-qr-btn">
                  <Icon name="qr-code" size={18} color={colors.accent} />
                </TouchableOpacity>
              </View>

              {showScanner && (
                <View style={styles.scannerWrap}>
                  {Platform.OS === 'web' ? (
                    <View style={styles.scannerMsg}><Icon name="phone-portrait" size={28} color={colors.textMuted} /><Text style={styles.scannerMsgText}>QR scanning on mobile only</Text></View>
                  ) : (
                    <View style={styles.scannerMsg}><Text style={styles.scannerMsgText}>Camera scanner active on device</Text></View>
                  )}
                </View>
              )}

              {/* Results */}
              {results.length > 0 && results.map(r => (
                <TouchableOpacity key={r.user_id} style={styles.resultRow} onPress={() => selectMember(r.user_id)} data-testid={`member-result-${r.user_id}`}>
                  <View style={[styles.dot, { backgroundColor: r.tier_color }]} />
                  <View style={{ flex: 1 }}><Text style={styles.resultName}>{r.name}</Text><Text style={styles.resultSub}>{r.email}</Text></View>
                  <View style={{ alignItems: 'flex-end' }}><Text style={[styles.resultTier, { color: r.tier_color }]}>{r.tier}</Text><Text style={styles.resultPts}>{r.points_balance.toLocaleString()} pts</Text></View>
                </TouchableOpacity>
              ))}
              {loadingProfile && <ActivityIndicator size="small" color={activeVenue.color} style={{ marginTop: spacing.md }} />}
            </View>

            {/* Member Found → Quick Award */}
            {member && (
              <>
                {/* Member Badge */}
                <View style={[styles.memberBadge, { borderColor: member.tier_color }]} data-testid="member-profile-card">
                  <View style={[styles.memberAvatar, { borderColor: member.tier_color }]}><Icon name="person" size={24} color={member.tier_color} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <View style={[styles.tierPill, { backgroundColor: member.tier_color + '30' }]}><Text style={[styles.tierPillText, { color: member.tier_color }]}>{member.tier} - {member.benefits?.points_multiplier || 1}x</Text></View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.memberPts}>{member.points_balance.toLocaleString()}</Text>
                    <Text style={styles.memberPtsLabel}>points</Text>
                  </View>
                </View>

                {/* Category Picker */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Spending Category</Text>
                  <View style={styles.catGrid}>
                    {CATEGORIES.map(c => (
                      <TouchableOpacity key={c.id} style={[styles.catBtn, selectedCategory === c.id && { backgroundColor: activeVenue.color + '25', borderColor: activeVenue.color }]} onPress={() => setSelectedCategory(c.id)} data-testid={`cat-${c.id}`}>
                        <Icon name={c.icon} size={18} color={selectedCategory === c.id ? activeVenue.color : colors.textMuted} />
                        <Text style={[styles.catLabel, selectedCategory === c.id && { color: activeVenue.color }]}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Amount Input */}
                <View style={styles.card} data-testid="award-amount-card">
                  <Text style={styles.cardTitle}>Purchase Amount</Text>
                  <View style={styles.amountRow}>
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput style={styles.amountInput} value={amountInput} onChangeText={setAmountInput} placeholder="0.00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" data-testid="amount-input" />
                  </View>
                  {amountInput ? (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewText}>
                        {Math.floor(parseFloat(amountInput) || 0)} base pts x {member.benefits?.points_multiplier || 1} = <Text style={{ color: activeVenue.color, fontWeight: '800' }}>{Math.floor((parseFloat(amountInput) || 0) * (member.benefits?.points_multiplier || 1))} pts</Text>
                      </Text>
                    </View>
                  ) : null}
                  <TextInput style={styles.receiptInput} value={receiptRef} onChangeText={setReceiptRef} placeholder="Receipt / docket # (optional)" placeholderTextColor={colors.textMuted} data-testid="receipt-input" />
                </View>

                {/* Quick Amount Buttons */}
                <View style={styles.quickAmounts}>
                  {[20, 50, 100, 200, 500].map(a => (
                    <TouchableOpacity key={a} style={styles.quickAmtBtn} onPress={() => setAmountInput(a.toString())} data-testid={`quick-${a}`}>
                      <Text style={styles.quickAmtText}>${a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Award Button */}
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: activeVenue.color }]} onPress={handleQuickAward} disabled={awarding || !amountInput} data-testid="award-points-btn">
                  {awarding ? <ActivityIndicator color="#FFF" /> : (
                    <Text style={styles.primaryBtnText}>AWARD {amountInput ? `${Math.floor((parseFloat(amountInput) || 0) * (member.benefits?.points_multiplier || 1))} POINTS` : 'POINTS'}</Text>
                  )}
                </TouchableOpacity>

                {/* Success Confirmation */}
                {lastAward && (
                  <View style={[styles.successCard, { borderColor: activeVenue.color }]} data-testid="award-success">
                    <Icon name="checkmark-circle" size={28} color={colors.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.successTitle}>{lastAward.total_points} pts awarded to {lastAward.member_name}</Text>
                      <Text style={styles.successSub}>${lastAward.amount_spent} {lastAward.category} - {lastAward.tier} ({lastAward.multiplier}x) - New balance: {lastAward.new_balance.toLocaleString()}</Text>
                    </View>
                  </View>
                )}

                {/* Perk Actions */}
                <View style={styles.card} data-testid="staff-actions-card">
                  <Text style={styles.cardTitle}>Quick Perks</Text>
                  <View style={styles.perkActions}>
                    <PerkBtn icon="enter" label="Log Entry" color="#22C55E" onPress={() => doAction('entry/log', { user_id: member.user_id, venue_id: activeVenue.id, entry_type: 'free_member' }, 'Entry logged')} testId="action-log-entry" />
                    <PerkBtn icon="wine" label="Comp Drink" color="#8B5CF6" disabled={member.today.drink_redeemed} onPress={() => doAction('drinks/redeem', { user_id: member.user_id, venue_id: activeVenue.id, drink_type: 'house_beer' }, 'Drink redeemed')} testId="action-comp-drink" />
                    <PerkBtn icon="people" label={`Guest (${member.today.guest_remaining})`} color={colors.accent} disabled={member.today.guest_remaining <= 0} onPress={() => doAction('entry/guest', { member_user_id: member.user_id, venue_id: activeVenue.id, guest_name: 'Guest' }, 'Guest entry logged')} testId="action-guest-entry" />
                    <PerkBtn icon="pricetag" label="Discount" color={colors.gold} onPress={() => Alert.alert('Discount', `${member.tier}: ${member.benefits?.restaurant_discount || 0}% off`)} testId="action-discount" />
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {/* ═══ VALIDATE REWARD TAB ═══ */}
        {activeTab === 'validate' && (
          <View style={styles.card} data-testid="validate-reward-card">
            <Text style={styles.cardTitle}>Scan Reward QR</Text>
            <Text style={styles.cardSub}>When a customer shows their reward QR code, scan it here to validate and mark as used.</Text>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <Icon name="qr-code" size={16} color={colors.textMuted} />
                <TextInput style={styles.searchInput} placeholder="Enter or scan QR code..." placeholderTextColor={colors.textMuted} value={qrInput} onChangeText={setQrInput} onSubmitEditing={() => handleValidateReward()} data-testid="qr-code-input" />
              </View>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: activeVenue.color }]} onPress={() => handleValidateReward()} disabled={validating} data-testid="validate-btn">
                {validating ? <ActivityIndicator size="small" color="#FFF" /> : <Icon name="checkmark" size={18} color="#FFF" />}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.accent }]} onPress={() => setShowScanner(!showScanner)} data-testid="validate-scan-btn">
                <Icon name="scan" size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {showScanner && (
              <View style={styles.scannerWrap}>
                {Platform.OS === 'web' ? (
                  <View style={styles.scannerMsg}><Text style={styles.scannerMsgText}>QR scanning on mobile only</Text></View>
                ) : (
                  <View style={styles.scannerMsg}><Text style={styles.scannerMsgText}>Camera active</Text></View>
                )}
              </View>
            )}

            {validationResult && (
              <View style={[styles.validationResult, { borderColor: validationResult.success ? colors.success : colors.error }]} data-testid="validation-result">
                <Icon name={validationResult.success ? 'checkmark-circle' : 'close-circle'} size={32} color={validationResult.success ? colors.success : colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.validationTitle, { color: validationResult.success ? colors.success : colors.error }]}>
                    {validationResult.success ? 'VALID' : 'INVALID'}
                  </Text>
                  {validationResult.reward_name && <Text style={styles.validationReward}>{validationResult.reward_name}</Text>}
                  <Text style={styles.validationMsg}>{validationResult.message}</Text>
                  {validationResult.member_name && <Text style={styles.validationMember}>Member: {validationResult.member_name} ({validationResult.member_tier})</Text>}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {activeTab === 'history' && (
          <>
            {loadingHistory ? (
              <ActivityIndicator size="large" color={activeVenue.color} style={{ marginTop: 40 }} />
            ) : (
              <>
                {/* Summary Cards */}
                {summary && (
                  <View style={styles.summaryGrid} data-testid="history-summary">
                    <SummaryCard label="Transactions" value={summary.total_transactions} color={activeVenue.color} />
                    <SummaryCard label="Revenue" value={`$${summary.total_revenue.toLocaleString()}`} color={colors.success} />
                    <SummaryCard label="Points Given" value={summary.total_points_awarded.toLocaleString()} color={colors.gold} />
                    <SummaryCard label="Members" value={summary.unique_members_served} color={colors.accent} />
                  </View>
                )}

                {/* Recent Transactions */}
                <View style={styles.card} data-testid="history-transactions">
                  <Text style={styles.cardTitle}>Recent ({activeVenue.name})</Text>
                  {transactions.length === 0 ? (
                    <Text style={styles.emptyText}>No transactions yet today</Text>
                  ) : transactions.map((t, i) => (
                    <View key={t.id || i} style={styles.txnRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txnName}>{t.member_name}</Text>
                        <Text style={styles.txnMeta}>{t.category} - ${t.amount_spent} - {t.created_at?.slice(11, 16)}</Text>
                      </View>
                      <Text style={[styles.txnPts, { color: activeVenue.color }]}>+{t.total_points}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function PerkBtn({ icon, label, color, disabled, onPress, testId }: any) {
  return (
    <TouchableOpacity style={[styles.perkBtn, disabled && { opacity: 0.3 }]} onPress={onPress} disabled={disabled} data-testid={testId}>
      <Icon name={icon} size={20} color={color} />
      <Text style={styles.perkBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1.5 },

  // Venue chips
  venueRow: { marginBottom: spacing.md },
  venueChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass },
  venueChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  // Tabs
  tabs: { flexDirection: 'row', gap: 4, backgroundColor: colors.glass, borderRadius: radius.lg, padding: 4, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.glassBorderSubtle },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.md },
  tabActive: { backgroundColor: colors.backgroundElevated },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.textPrimary },

  // Cards
  card: { backgroundColor: colors.glass, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.glassBorderSubtle },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm, letterSpacing: 0.5 },
  cardSub: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 },

  // Search
  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.backgroundCard, borderRadius: radius.md, paddingHorizontal: spacing.sm, height: 42 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  iconBtn: { width: 42, height: 42, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  scannerWrap: { marginTop: spacing.sm, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.backgroundCard },
  scannerMsg: { alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  scannerMsgText: { fontSize: 12, color: colors.textMuted },

  // Results
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.glassBorderSubtle, gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  resultName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  resultSub: { fontSize: 11, color: colors.textMuted },
  resultTier: { fontSize: 11, fontWeight: '700' },
  resultPts: { fontSize: 11, color: colors.gold },

  // Member badge
  memberBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassMid, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1.5, gap: spacing.md },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.glass },
  memberName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  tierPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, marginTop: 3 },
  tierPillText: { fontSize: 10, fontWeight: '700' },
  memberPts: { fontSize: 20, fontWeight: '800', color: colors.gold },
  memberPtsLabel: { fontSize: 10, color: colors.textMuted },

  // Categories
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border },
  catLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  // Amount
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dollarSign: { fontSize: 28, fontWeight: '700', color: colors.textSecondary },
  amountInput: { flex: 1, fontSize: 36, fontWeight: '800', color: colors.textPrimary, height: 56 },
  previewRow: { marginBottom: spacing.sm },
  previewText: { fontSize: 13, color: colors.textSecondary },
  receiptInput: { backgroundColor: colors.backgroundCard, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 13, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  quickAmounts: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, paddingHorizontal: 2 },
  quickAmtBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.glass, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  quickAmtText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

  // Primary button
  primaryBtn: { paddingVertical: 16, borderRadius: radius.lg, alignItems: 'center', marginBottom: spacing.md },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 1 },

  // Success
  successCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm, borderWidth: 1 },
  successTitle: { fontSize: 14, fontWeight: '700', color: colors.success },
  successSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Perk actions
  perkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  perkBtn: { flex: 1, minWidth: '45%', alignItems: 'center', gap: 4, paddingVertical: spacing.md, backgroundColor: colors.backgroundCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  perkBtnLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

  // Validation
  validationResult: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.backgroundCard, borderWidth: 1.5 },
  validationTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  validationReward: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  validationMsg: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  validationMember: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },

  // Summary
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: { flex: 1, minWidth: '45%', backgroundColor: colors.glass, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.glassBorderSubtle },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Transactions
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.glassBorderSubtle },
  txnName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  txnMeta: { fontSize: 11, color: colors.textMuted },
  txnPts: { fontSize: 15, fontWeight: '700' },
});
