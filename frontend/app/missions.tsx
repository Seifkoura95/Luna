import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../src/theme/colors';
import { apiFetch } from '../src/utils/api';
import { Icon } from '../src/components/Icon';
import { AppBackground } from '../src/components/AppBackground';

const isNative = Platform.OS !== 'web';

const MISSION_ICONS: Record<string, string> = {
  check_in: 'location',
  visit: 'navigate',
  spend: 'card',
  purchase: 'cart',
  refer: 'people',
  social: 'share',
  review: 'chatbubble',
  photo: 'camera',
  drink: 'wine',
  food: 'restaurant',
  daily: 'sunny',
  weekly: 'calendar',
  special: 'flash',
  birthday: 'gift',
  event: 'musical-notes',
  default: 'flag',
};

const MISSION_COLORS = ['#2563EB', '#8B5CF6', '#10B981', '#FF6B35', '#E31837', '#00D4AA', '#F59E0B', '#FF1493', '#D4A832'];

export default function MissionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMissions = useCallback(async () => {
    try {
      const data = await apiFetch<any[]>('/api/missions');
      setMissions(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMissions();
    setRefreshing(false);
  };

  const getMissionIcon = (mission: any): string => {
    if (mission.icon && MISSION_ICONS[mission.icon]) return MISSION_ICONS[mission.icon];
    if (mission.type && MISSION_ICONS[mission.type]) return MISSION_ICONS[mission.type];
    const title = (mission.title || mission.name || '').toLowerCase();
    if (title.includes('check in') || title.includes('checkin')) return 'location';
    if (title.includes('visit')) return 'navigate';
    if (title.includes('drink') || title.includes('cocktail') || title.includes('happy hour')) return 'wine';
    if (title.includes('food') || title.includes('dine') || title.includes('dinner')) return 'restaurant';
    if (title.includes('refer') || title.includes('friend') || title.includes('invite')) return 'people';
    if (title.includes('photo') || title.includes('selfie')) return 'camera';
    if (title.includes('share') || title.includes('social') || title.includes('post')) return 'share';
    if (title.includes('review') || title.includes('rate')) return 'chatbubble';
    if (title.includes('spend') || title.includes('buy') || title.includes('purchase')) return 'card';
    if (title.includes('event') || title.includes('party') || title.includes('night')) return 'musical-notes';
    if (title.includes('weekend') || title.includes('warrior')) return 'flash';
    if (title.includes('birthday')) return 'gift';
    if (title.includes('early') || title.includes('bird')) return 'sunny';
    if (title.includes('vip') || title.includes('booth') || title.includes('table')) return 'diamond';
    if (title.includes('loyal') || title.includes('streak')) return 'flame';
    return 'flag';
  };

  const getMissionColor = (mission: any, index: number): string => {
    if (mission.color) return mission.color;
    return MISSION_COLORS[index % MISSION_COLORS.length];
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} data-testid="missions-screen">
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} data-testid="missions-back-btn">
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>MISSIONS</Text>
          <Text style={styles.headerSub}>Complete challenges, earn points</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{missions.length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.gold }]}>{missions.reduce((s, m) => s + (m.points_reward || m.points || 0), 0)}</Text>
              <Text style={styles.statLabel}>Total Points</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#10B981' }]}>{missions.filter(m => (m.current_progress || 0) >= (m.target || m.target_value || 1)).length}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>

          {/* Mission Cards */}
          {missions.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="flag" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No missions available</Text>
              <Text style={styles.emptySub}>Check back soon for new challenges!</Text>
            </View>
          ) : (
            missions.map((mission, idx) => {
              const mColor = getMissionColor(mission, idx);
              const icon = getMissionIcon(mission);
              const progress = mission.current_progress || 0;
              const target = mission.target || mission.target_value || mission.requirement_value || 1;
              const pct = Math.min(1, progress / target);
              const pts = mission.points_reward || mission.points || 0;
              const completed = progress >= target;

              return (
                <View key={mission.id || idx} style={[styles.missionCard, completed && { borderColor: mColor + '30' }]} data-testid={`mission-${mission.id || idx}`}>
                  {/* Icon */}
                  <View style={[styles.missionIcon, { backgroundColor: mColor + '18' }]}>
                    <Icon name={icon as any} size={22} color={completed ? mColor : mColor + 'AA'} />
                  </View>

                  {/* Info */}
                  <View style={styles.missionInfo}>
                    <View style={styles.missionTopRow}>
                      <Text style={styles.missionTitle}>{mission.title || mission.name}</Text>
                      <View style={[styles.pointsBadge, { backgroundColor: mColor + '18' }]}>
                        <Text style={[styles.pointsBadgeText, { color: mColor }]}>+{pts} pts</Text>
                      </View>
                    </View>

                    <Text style={styles.missionDesc} numberOfLines={2}>{mission.description}</Text>

                    {/* Progress Bar */}
                    <View style={styles.progressRow}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${pct * 100}%`, backgroundColor: mColor }]} />
                      </View>
                      <Text style={[styles.progressText, completed && { color: mColor }]}>{progress}/{target}</Text>
                    </View>

                    {completed && (
                      <View style={[styles.completedBadge, { backgroundColor: mColor }]}>
                        <Icon name="checkmark" size={12} color="#FFF" />
                        <Text style={styles.completedText}>COMPLETED</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: 1.5 },
  headerSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.md },

  // Stats
  statsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: colors.glass, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.glassBorderSubtle },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginTop: 2, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },

  // Empty
  emptyState: { alignItems: 'center', padding: 40, gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  emptySub: { fontSize: 13, color: colors.textMuted },

  // Mission Card
  missionCard: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, backgroundColor: colors.glass, borderRadius: radius.xl, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.glassBorderSubtle },
  missionIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  missionInfo: { flex: 1 },
  missionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  missionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  pointsBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  pointsBadgeText: { fontSize: 11, fontWeight: '700' },
  missionDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 16, marginBottom: spacing.sm },

  // Progress
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressBarBg: { flex: 1, height: 6, backgroundColor: colors.glassMid, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 11, fontWeight: '700', color: colors.textMuted, minWidth: 30, textAlign: 'right' },

  // Completed
  completedBadge: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, marginTop: spacing.sm },
  completedText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
});
