import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { Icon } from '../src/components/Icon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../src/components/AppBackground';
import { useAuthStore } from '../src/store/authStore';


export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  
  // Get auth state
  const { isAuthenticated, isLoading: authLoading, token } = useAuthStore();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    // Only fetch data when auth is ready and user is authenticated
    if (!authLoading && isAuthenticated && token) {
      fetchData();
    } else if (!authLoading && !isAuthenticated) {
      // Redirect to login if not authenticated
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, token]);

  const fetchData = async () => {
    try {
      const [notifResponse, suggestResponse, prefsResponse] = await Promise.all([
        api.getNotifications(false, 30),
        api.getSmartSuggestions(),
        api.getNotificationPreferences(),
      ]);
      
      setNotifications(notifResponse.notifications || []);
      setUnreadCount(notifResponse.unread_count || 0);
      setSuggestions(suggestResponse.suggestions || []);
      setPreferences(prefsResponse || {});
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
      // If we get an auth error, don't show error - just show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  const handleNotificationPress = async (notification: any) => {
    if (!notification.read) {
      await api.markNotificationRead(notification.id);
      setNotifications(notifications.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    }
    
    // Handle navigation based on notification type
    if (notification.data?.booking_id) {
      router.push('/my-bookings');
    } else if (notification.data?.event_id) {
      // Navigate to event
    }
  };

  const handleUpdatePreference = async (key: string, value: boolean) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    try {
      await api.updateNotificationPreferences(newPrefs);
    } catch (e) {
      console.error('Failed to update preference:', e);
    }
  };

  const handleSendTest = async () => {
    try {
      await api.sendTestNotification();
      Alert.alert('Test Sent', 'Check your notifications!');
      fetchData();
    } catch (e) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'event':
        return 'calendar';
      case 'auction':
        return 'flash';
      case 'points':
        return 'star';
      case 'safety':
        return 'shield-checkmark';
      case 'test':
        return 'notifications';
      default:
        return 'notifications-outline';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'event':
        return colors.accent;
      case 'auction':
        return '#E31837';
      case 'points':
        return '#FFD700';
      case 'safety':
        return colors.success;
      default:
        return colors.textSecondary;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, ]}>NOTIFICATIONS</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowPreferences(!showPreferences)}
        >
          <Icon name="settings-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {showPreferences ? (
        // Preferences View
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>NOTIFICATION SETTINGS</Text>
          
          <View style={styles.preferencesCard}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Icon name="location" size={20} color={colors.accent} />
                <Text style={styles.preferenceLabel}>Events Nearby</Text>
              </View>
              <Switch
                value={preferences.events_nearby ?? true}
                onValueChange={(v) => handleUpdatePreference('events_nearby', v)}
                trackColor={{ false: '#333', true: colors.accent + '50' }}
                thumbColor={preferences.events_nearby ? colors.accent : '#666'}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Icon name="heart" size={20} color={colors.error} />
                <Text style={styles.preferenceLabel}>Favorite Venues</Text>
              </View>
              <Switch
                value={preferences.favorite_venues ?? true}
                onValueChange={(v) => handleUpdatePreference('favorite_venues', v)}
                trackColor={{ false: '#333', true: colors.accent + '50' }}
                thumbColor={preferences.favorite_venues ? colors.accent : '#666'}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Icon name="flash" size={20} color={colors.gold} />
                <Text style={styles.preferenceLabel}>Auction Alerts</Text>
              </View>
              <Switch
                value={preferences.auction_alerts ?? true}
                onValueChange={(v) => handleUpdatePreference('auction_alerts', v)}
                trackColor={{ false: '#333', true: colors.accent + '50' }}
                thumbColor={preferences.auction_alerts ? colors.accent : '#666'}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Icon name="people" size={20} color={colors.success} />
                <Text style={styles.preferenceLabel}>Friends Attending</Text>
              </View>
              <Switch
                value={preferences.friends_attending ?? true}
                onValueChange={(v) => handleUpdatePreference('friends_attending', v)}
                trackColor={{ false: '#333', true: colors.accent + '50' }}
                thumbColor={preferences.friends_attending ? colors.accent : '#666'}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Icon name="gift" size={20} color="#FF69B4" />
                <Text style={styles.preferenceLabel}>New Rewards</Text>
              </View>
              <Switch
                value={preferences.new_rewards ?? true}
                onValueChange={(v) => handleUpdatePreference('new_rewards', v)}
                trackColor={{ false: '#333', true: colors.accent + '50' }}
                thumbColor={preferences.new_rewards ? colors.accent : '#666'}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Icon name="mail" size={20} color={colors.textSecondary} />
                <Text style={styles.preferenceLabel}>Weekly Digest</Text>
              </View>
              <Switch
                value={preferences.weekly_digest ?? true}
                onValueChange={(v) => handleUpdatePreference('weekly_digest', v)}
                trackColor={{ false: '#333', true: colors.accent + '50' }}
                thumbColor={preferences.weekly_digest ? colors.accent : '#666'}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.testButton} onPress={handleSendTest}>
            <Icon name="notifications" size={18} color={colors.textPrimary} />
            <Text style={styles.testButtonText}>Send Test Notification</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        // Notifications View
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        >
          {/* Smart Suggestions */}
          {suggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>RECOMMENDED FOR YOU</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {suggestions.slice(0, 5).map((suggestion, idx) => (
                  <TouchableOpacity key={idx} style={styles.suggestionCard}>
                    <LinearGradient
                      colors={['#1A1A1A', '#0D0D0D']}
                      style={styles.suggestionGradient}
                    >
                      <View style={styles.suggestionIcon}>
                        <Icon 
                          name={suggestion.type === 'event' ? 'calendar' : 'location'} 
                          size={24} 
                          color={colors.accent} 
                        />
                      </View>
                      <Text style={styles.suggestionTitle} numberOfLines={2}>
                        {suggestion.event?.title || suggestion.venue?.name}
                      </Text>
                      <View style={styles.suggestionReasons}>
                        {suggestion.reasons?.slice(0, 2).map((reason: string, i: number) => (
                          <Text key={i} style={styles.suggestionReason}>• {reason}</Text>
                        ))}
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Notifications List */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>RECENT</Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead}>
                  <Text style={styles.markAllRead}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="notifications-off-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No notifications yet</Text>
                <Text style={styles.emptySubtext}>We'll let you know when something happens</Text>
              </View>
            ) : (
              notifications.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationCard,
                    !notification.read && styles.notificationUnread
                  ]}
                  onPress={() => handleNotificationPress(notification)}
                >
                  <View style={[
                    styles.notificationIcon,
                    { backgroundColor: getNotificationColor(notification.type) + '20' }
                  ]}>
                    <Icon 
                      name={getNotificationIcon(notification.type) as any}
                      size={20} 
                      color={getNotificationColor(notification.type)} 
                    />
                  </View>
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    <Text style={styles.notificationMessage} numberOfLines={2}>
                      {notification.message}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {formatTime(notification.created_at)}
                    </Text>
                  </View>
                  {!notification.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  unreadBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  markAllRead: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  suggestionCard: {
    width: 200,
    marginRight: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionGradient: {
    padding: spacing.md,
  },
  suggestionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  suggestionReasons: {
    gap: 2,
  },
  suggestionReason: {
    fontSize: 11,
    color: colors.textMuted,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A1A1A',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationUnread: {
    backgroundColor: '#1F1F1F',
    borderColor: colors.accent + '40',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  preferencesCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  preferenceLabel: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '20',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
