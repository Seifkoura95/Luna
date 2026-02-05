import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { QRCode } from '../../src/components/QRCode';
import { QueueStatus } from '../../src/components/QueueStatus';
import { MissionCard } from '../../src/components/MissionCard';
import { Ionicons } from '@expo/vector-icons';

export default function TonightScreen() {
  const user = useAuthStore((state) => state.user);
  const [missions, setMissions] = useState<any[]>([]);
  const [boosts, setBoosts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [missionsData, boostsData] = await Promise.all([
        api.getMissions(),
        api.getActiveBoosts(),
      ]);
      setMissions(missionsData);
      setBoosts(boostsData);
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    // Refresh user data
    try {
      const userData = await api.getMe();
      useAuthStore.getState().setUser(userData);
    } catch (e) {
      console.error('Failed to refresh user:', e);
    }
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Active Boost Banner */}
        {boosts.length > 0 && (
          <View style={styles.boostBanner}>
            <Ionicons name="flash" size={20} color={colors.warning} />
            <Text style={styles.boostText}>
              {boosts[0].name}: {boosts[0].multiplier}x points active!
            </Text>
          </View>
        )}

        {/* Tonight Pass Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TONIGHT PASS</Text>
          <Text style={styles.sectionSubtitle}>
            Show this QR code at the door for instant check-in
          </Text>
          <View style={styles.qrContainer}>
            <QRCode size={220} />
          </View>
        </View>

        {/* Queue Status */}
        <View style={styles.section}>
          <QueueStatus />
        </View>

        {/* Active Missions */}
        {missions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ACTIVE MISSIONS</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.missionsScroll}
            >
              {missions.filter(m => !m.completed).slice(0, 3).map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOUR STATS</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="star" size={24} color={colors.premiumGold} />
              <Text style={styles.statValue}>{user?.points_balance || 0}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="calendar" size={24} color={colors.accent} />
              <Text style={styles.statValue}>
                {missions.filter(m => m.completed).length}
              </Text>
              <Text style={styles.statLabel}>Missions Done</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="trophy" size={24} color={colors.premiumGold} />
              <Text style={styles.statValue}>{user?.tier?.toUpperCase() || 'BRONZE'}</Text>
              <Text style={styles.statLabel}>Your Tier</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  boostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning + '20',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  boostText: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  seeAll: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  missionsScroll: {
    paddingRight: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
