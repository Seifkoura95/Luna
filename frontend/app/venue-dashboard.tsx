import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { useAuthStore } from '../src/store/authStore';
import { AppBackground } from '../src/components/AppBackground';

interface DashboardStats {
  total_redemptions: number;
  today_redemptions: number;
  week_redemptions: number;
  pending_redemptions: number;
  unique_visitors: number;
}

interface Redemption {
  id: string;
  reward_name: string;
  customer_name: string;
  points_spent: number;
  status: string;
  redeemed_at?: string;
  created_at: string;
}

export default function VenueDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRedemptions, setRecentRedemptions] = useState<Redemption[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scan' | 'history'>('dashboard');

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await api.getVenueDashboard();
      setStats(data.stats);
      setRecentRedemptions(data.recent_redemptions || []);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanning) return;
    setScanning(true);
    
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      const result = await api.venueScanQR(data, user?.venue_id || '');
      
      Alert.alert(
        '✅ Reward Redeemed!',
        `${result.reward_name}\nCustomer: ${result.customer_name}\nPoints: ${result.points_spent}`,
        [{ text: 'OK', onPress: () => {
          setScanning(false);
          fetchDashboard();
        }}]
      );
    } catch (error: any) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Error', error.message || 'Invalid QR code', [
        { text: 'OK', onPress: () => setScanning(false) }
      ]);
    }
  };

  const handleManualCode = async () => {
    if (!manualCode.trim()) {
      Alert.alert('Error', 'Please enter a code');
      return;
    }
    
    try {
      const result = await api.venueScanQR(manualCode.trim(), user?.venue_id || '');
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert(
        '✅ Reward Redeemed!',
        `${result.reward_name}\nCustomer: ${result.customer_name}`,
        [{ text: 'OK' }]
      );
      
      setManualCode('');
      fetchDashboard();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid code');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const renderDashboard = () => (
    <>
      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.accent + '20' }]}>
          <Ionicons name="today" size={24} color={colors.accent} />
          <Text style={styles.statValue}>{stats?.today_redemptions || 0}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.gold + '20' }]}>
          <Ionicons name="calendar" size={24} color={colors.gold} />
          <Text style={styles.statValue}>{stats?.week_redemptions || 0}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#8B5CF6' + '20' }]}>
          <Ionicons name="hourglass" size={24} color="#8B5CF6" />
          <Text style={styles.statValue}>{stats?.pending_redemptions || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#00D4AA' + '20' }]}>
          <Ionicons name="people" size={24} color="#00D4AA" />
          <Text style={styles.statValue}>{stats?.unique_visitors || 0}</Text>
          <Text style={styles.statLabel}>Visitors</Text>
        </View>
      </View>

      {/* Quick Scan Button */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => setActiveTab('scan')}
      >
        <LinearGradient
          colors={[colors.accent, '#FF6B6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.scanButtonGradient}
        >
          <Ionicons name="qr-code" size={24} color="#fff" />
          <Text style={styles.scanButtonText}>SCAN QR CODE</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Recent Redemptions */}
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>RECENT REDEMPTIONS</Text>
        {recentRedemptions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No redemptions yet</Text>
          </View>
        ) : (
          recentRedemptions.slice(0, 10).map((redemption) => (
            <View key={redemption.id} style={styles.redemptionCard}>
              <View style={styles.redemptionIcon}>
                <Ionicons 
                  name={redemption.status === 'redeemed' ? 'checkmark-circle' : 'time'} 
                  size={20} 
                  color={redemption.status === 'redeemed' ? '#00D4AA' : colors.gold} 
                />
              </View>
              <View style={styles.redemptionContent}>
                <Text style={styles.redemptionName}>{redemption.reward_name}</Text>
                <Text style={styles.redemptionCustomer}>{redemption.customer_name}</Text>
              </View>
              <View style={styles.redemptionMeta}>
                <Text style={styles.redemptionPoints}>{redemption.points_spent} pts</Text>
                <Text style={styles.redemptionStatus}>{redemption.status}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </>
  );

  const renderScanner = () => (
    <View style={styles.scannerContainer}>
      {hasPermission === null ? (
        <Text style={styles.scannerText}>Requesting camera permission...</Text>
      ) : hasPermission === false ? (
        <View style={styles.noPermission}>
          <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
          <Text style={styles.noPermissionText}>Camera permission required</Text>
        </View>
      ) : (
        <>
          <View style={styles.scannerWrapper}>
            <BarCodeScanner
              onBarCodeScanned={scanning ? undefined : handleBarCodeScanned}
              style={styles.scanner}
            />
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame} />
            </View>
          </View>
          <Text style={styles.scannerHint}>Point camera at QR code</Text>
        </>
      )}

      {/* Manual Entry */}
      <View style={styles.manualEntry}>
        <Text style={styles.manualLabel}>Or enter code manually:</Text>
        <View style={styles.manualInputRow}>
          <TextInput
            style={styles.manualInput}
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="LUNA-XXXXXXXX-XXXX"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.manualSubmit} onPress={handleManualCode}>
            <Ionicons name="checkmark" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <AppBackground />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>VENUE DASHBOARD</Text>
            <Text style={styles.headerSubtitle}>{user?.name || 'Staff'}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
            onPress={() => setActiveTab('dashboard')}
          >
            <Ionicons name="stats-chart" size={20} color={activeTab === 'dashboard' ? colors.accent : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'scan' && styles.tabActive]}
            onPress={() => setActiveTab('scan')}
          >
            <Ionicons name="qr-code" size={20} color={activeTab === 'scan' ? colors.accent : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Ionicons name="time" size={20} color={activeTab === 'history' ? colors.accent : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'scan' && renderScanner()}
        {activeTab === 'history' && renderDashboard()}
      </ScrollView>
    </View>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  logoutButton: {
    padding: spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(227,24,55,0.2)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.accent,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    width: '47%',
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  scanButton: {
    marginBottom: spacing.xl,
  },
  scanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  recentSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  redemptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  redemptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  redemptionContent: {
    flex: 1,
  },
  redemptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  redemptionCustomer: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  redemptionMeta: {
    alignItems: 'flex-end',
  },
  redemptionPoints: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
  },
  redemptionStatus: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  scannerContainer: {
    alignItems: 'center',
  },
  scannerWrapper: {
    width: 280,
    height: 280,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  scanner: {
    ...StyleSheet.absoluteFillObject,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.md,
  },
  scannerHint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  scannerText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  noPermission: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  noPermissionText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  manualEntry: {
    width: '100%',
    marginTop: spacing.xl,
  },
  manualLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  manualInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
  },
  manualSubmit: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
