import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../src/theme/colors';
import { api, apiFetch } from '../src/utils/api';
import { AppBackground } from '../src/components/AppBackground';

// BarCodeScanner is only available on native
const isNative = Platform.OS !== 'web';

interface MemberResult {
  user_id: string; name: string; email: string; phone: string;
  tier: string; tier_color: string; points_balance: number; wallet_balance: number;
}

interface MemberProfile extends MemberResult {
  tier_id: string; benefits: any;
  today: { entries: number; drink_redeemed: boolean; guest_used: number; guest_remaining: number; guest_limit: number; };
}

export default function StaffPortal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MemberResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
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

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearching(true);
    setSelectedMember(null);
    try {
      const data = await api.searchMember(searchQuery);
      setResults(data.members || []);
      if (data.members.length === 0) Alert.alert('No Results', 'No members found matching your search.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Search failed');
    } finally { setSearching(false); }
  };

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanning) return;
    setScanning(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowScanner(false);
    // QR code data is expected to be a user_id
    const userId = data.trim();
    try {
      const profile = await api.getMemberProfile(userId);
      setSelectedMember(profile);
      setResults([]);
    } catch {
      // Fallback: try searching by the scanned data
      try {
        const searchData = await api.searchMember(userId);
        if (searchData.members.length === 1) {
          const profile = await api.getMemberProfile(searchData.members[0].user_id);
          setSelectedMember(profile);
        } else if (searchData.members.length > 1) {
          setResults(searchData.members);
        } else {
          Alert.alert('Not Found', 'No member found for this QR code');
        }
      } catch {
        Alert.alert('Error', 'Could not identify member from QR code');
      }
    } finally { setScanning(false); }
  };

  const selectMember = async (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingProfile(true);
    try {
      const profile = await api.getMemberProfile(userId);
      setSelectedMember(profile);
      setResults([]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load member');
    } finally { setLoadingProfile(false); }
  };

  const doAction = async (action: string, body: any, successMsg: string) => {
    if (!selectedMember) return;
    setActionLoading(action);
    try {
      await apiFetch(`/api/perks/${action}`, { method: 'POST', body: JSON.stringify(body) });
      Alert.alert('Success', successMsg);
      // Refresh profile
      const profile = await api.getMemberProfile(selectedMember.user_id);
      setSelectedMember(profile);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Action failed');
    } finally { setActionLoading(''); }
  };

  const logEntry = () => doAction('entry/log', {
    user_id: selectedMember!.user_id, venue_id: 'eclipse', entry_type: 'free_member',
  }, 'Entry logged successfully');

  const redeemDrink = () => {
    Alert.alert('Comp Drink', 'Which drink type?', [
      { text: 'House Wine', onPress: () => doAction('drinks/redeem', { user_id: selectedMember!.user_id, venue_id: 'eclipse', drink_type: 'house_wine' }, 'House wine redeemed') },
      { text: 'House Beer', onPress: () => doAction('drinks/redeem', { user_id: selectedMember!.user_id, venue_id: 'eclipse', drink_type: 'house_beer' }, 'House beer redeemed') },
      { text: 'Soft Drink', onPress: () => doAction('drinks/redeem', { user_id: selectedMember!.user_id, venue_id: 'eclipse', drink_type: 'soft_drink' }, 'Soft drink redeemed') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const logGuest = () => doAction('entry/guest', {
    member_user_id: selectedMember!.user_id, venue_id: 'eclipse', guest_name: 'Guest',
  }, 'Guest entry logged');

  const m = selectedMember;

  return (
    <View style={styles.container}>
      <AppBackground />
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="staff-portal-back-btn">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>STAFF PORTAL</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchCard} data-testid="staff-search-card">
          <View style={styles.searchRow}>
            <View style={styles.searchInput}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchText}
                placeholder="Search by name, email or phone..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                data-testid="staff-search-input"
              />
            </View>
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching} data-testid="staff-search-btn">
              {searching ? <ActivityIndicator size="small" color="#000" /> : <Ionicons name="arrow-forward" size={20} color="#000" />}
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.scanQrBtn} 
            onPress={() => setShowScanner(!showScanner)}
            data-testid="staff-scan-qr-btn"
          >
            <Ionicons name="qr-code" size={18} color={colors.accent} />
            <Text style={styles.scanQrText}>{showScanner ? 'Hide Scanner' : 'Scan Member QR Code'}</Text>
          </TouchableOpacity>
        </View>

        {/* QR Scanner */}
        {showScanner && (
          <View style={styles.scannerCard} data-testid="staff-qr-scanner">
            {Platform.OS === 'web' ? (
              <View style={styles.scannerMsg}>
                <Ionicons name="phone-portrait" size={32} color={colors.textMuted} />
                <Text style={styles.scannerMsgText}>QR scanning available on mobile only</Text>
              </View>
            ) : hasPermission === false ? (
              <View style={styles.scannerMsg}>
                <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                <Text style={styles.scannerMsgText}>Camera permission required</Text>
              </View>
            ) : isNative ? (
              <View style={styles.scannerWrapper}>
                <Text style={styles.scannerHint}>Camera scanner active on native device</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{results.length} Result{results.length > 1 ? 's' : ''}</Text>
            {results.map((r) => (
              <TouchableOpacity key={r.user_id} style={styles.resultRow} onPress={() => selectMember(r.user_id)} data-testid={`member-result-${r.user_id}`}>
                <View style={[styles.tierDot, { backgroundColor: r.tier_color }]} />
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{r.name}</Text>
                  <Text style={styles.resultEmail}>{r.email}</Text>
                </View>
                <View style={styles.resultRight}>
                  <Text style={styles.resultTier}>{r.tier}</Text>
                  <Text style={styles.resultPts}>{r.points_balance.toLocaleString()} pts</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loadingProfile && <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />}

        {/* Member Profile */}
        {m && (
          <>
            {/* Member Header */}
            <View style={styles.memberCard} data-testid="member-profile-card">
              <View style={styles.memberHeader}>
                <View style={[styles.memberAvatar, { borderColor: m.tier_color }]}>
                  <Ionicons name="person" size={28} color={m.tier_color} />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <View style={[styles.tierBadge, { backgroundColor: m.tier_color + '30' }]}>
                    <Text style={[styles.tierText, { color: m.tier_color }]}>{m.tier}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.memberStats}>
                <View style={styles.stat}>
                  <Ionicons name="star" size={16} color={colors.gold} />
                  <Text style={styles.statValue}>{m.points_balance.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Points</Text>
                </View>
                <View style={styles.stat}>
                  <Ionicons name="wallet" size={16} color={colors.accent} />
                  <Text style={styles.statValue}>${m.wallet_balance.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>Wallet</Text>
                </View>
                <View style={styles.stat}>
                  <Ionicons name="enter" size={16} color={colors.textMuted} />
                  <Text style={styles.statValue}>{m.today.entries}</Text>
                  <Text style={styles.statLabel}>Entries</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.sectionCard} data-testid="staff-actions-card">
              <Text style={styles.sectionTitle}>Actions</Text>
              <View style={styles.actionsGrid}>
                <ActionButton icon="enter" label="Log Entry" color="#22C55E" loading={actionLoading === 'entry/log'} onPress={logEntry} testId="action-log-entry" />
                <ActionButton icon="wine" label="Comp Drink" color="#8B5CF6" loading={actionLoading === 'drinks/redeem'} onPress={redeemDrink} disabled={m.today.drink_redeemed} testId="action-comp-drink" />
                <ActionButton icon="people" label={`Guest (${m.today.guest_remaining})`} color={colors.accent} loading={actionLoading === 'entry/guest'} onPress={logGuest} disabled={m.today.guest_remaining <= 0} testId="action-guest-entry" />
                <ActionButton icon="receipt" label="Discount" color={colors.gold} onPress={() => Alert.alert('Discount', `${m.tier} member: Check benefits for discount eligibility.`)} testId="action-discount" />
              </View>
              {m.today.drink_redeemed && (
                <View style={styles.alertRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                  <Text style={styles.alertText}>Comp drink already redeemed today</Text>
                </View>
              )}
            </View>

            {/* Benefits Summary */}
            <View style={styles.sectionCard} data-testid="staff-benefits-card">
              <Text style={styles.sectionTitle}>Tier Benefits</Text>
              <BenefitRow icon="enter" label="Free Entry" value={m.benefits.free_entry_before_time === 'all_night' ? 'Unlimited' : `Before ${m.benefits.free_entry_before_time}`} />
              <BenefitRow icon="flash" label="Skip The Line" value={m.benefits.skip_the_line ? 'Yes' : 'No'} />
              <BenefitRow icon="wine" label="Comp Drink" value={m.benefits.complimentary_drink ? 'Yes' : 'No'} />
              <BenefitRow icon="people" label="Guest Entry" value={`${m.benefits.guest_entry || 0}/day`} />
              <BenefitRow icon="pricetag" label="Restaurant Discount" value={`${m.benefits.restaurant_discount || 0}%`} />
              <BenefitRow icon="key" label="Sky Lounge" value={m.benefits.sky_lounge_access ? 'Access' : 'No'} />
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function ActionButton({ icon, label, color, loading, onPress, disabled, testId }: any) {
  return (
    <TouchableOpacity style={[styles.actionBtn, disabled && styles.actionBtnDisabled]} onPress={onPress} disabled={disabled || loading} data-testid={testId}>
      {loading ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={22} color={disabled ? colors.textMuted : color} />}
      <Text style={[styles.actionLabel, disabled && { color: colors.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BenefitRow({ icon, label, value }: any) {
  return (
    <View style={styles.benefitRow}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text style={styles.benefitLabel}>{label}</Text>
      <Text style={styles.benefitValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: 2 },
  // Search
  searchCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchText: { flex: 1, fontSize: 14, color: colors.textPrimary },
  searchBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  scanQrBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.accent + '10', borderRadius: radius.md },
  scanQrText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  scannerCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  scannerWrapper: { height: 250, position: 'relative' },
  scanner: { flex: 1 },
  scannerHint: { position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 4 },
  scannerMsg: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  scannerMsgText: { fontSize: 13, color: colors.textMuted },
  // Section
  sectionCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md, letterSpacing: 1 },
  // Results
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: spacing.sm },
  tierDot: { width: 10, height: 10, borderRadius: 5 },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  resultEmail: { fontSize: 11, color: colors.textMuted },
  resultRight: { alignItems: 'flex-end' },
  resultTier: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  resultPts: { fontSize: 11, color: colors.gold },
  // Member Card
  memberCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1.5, borderColor: colors.accent + '30' },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  memberAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  tierBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.full, marginTop: 4 },
  tierText: { fontSize: 11, fontWeight: '700' },
  memberStats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 10, color: colors.textMuted },
  // Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionBtn: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  actionBtnDisabled: { opacity: 0.4 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  alertText: { fontSize: 11, color: '#22C55E' },
  // Benefits
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  benefitLabel: { flex: 1, fontSize: 13, color: colors.textSecondary },
  benefitValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
});
