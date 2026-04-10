import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius } from '../src/theme/colors';
import { AppBackground } from '../src/components/AppBackground';

export default function NotificationSettingsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [notifications, setNotifications] = useState({
    pushEnabled: true,
    emailEnabled: true,
    events: true,
    auctions: true,
    rewards: true,
    friends: true,
    safety: true,
    marketing: false,
    crewActivity: true,
  });

  const notificationGroups = [
    {
      title: 'GENERAL',
      items: [
        { key: 'pushEnabled', title: 'Push Notifications', desc: 'Receive push notifications on your device' },
        { key: 'emailEnabled', title: 'Email Notifications', desc: 'Receive updates via email' },
      ],
    },
    {
      title: 'ACTIVITY',
      items: [
        { key: 'events', title: 'Events & Tickets', desc: 'Event reminders and ticket updates' },
        { key: 'auctions', title: 'Auctions', desc: 'Outbid alerts and auction endings' },
        { key: 'rewards', title: 'Rewards & Points', desc: 'Points earned and new rewards' },
      ],
    },
    {
      title: 'SOCIAL',
      items: [
        { key: 'friends', title: 'Friends', desc: 'Friend requests and activity' },
        { key: 'crewActivity', title: 'Crew Activity', desc: 'Updates from your crews' },
      ],
    },
    {
      title: 'SAFETY',
      items: [
        { key: 'safety', title: 'Safety Alerts', desc: 'Emergency alerts from crew members' },
      ],
    },
    {
      title: 'OTHER',
      items: [
        { key: 'marketing', title: 'Marketing', desc: 'Promotions and special offers' },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <AppBackground />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>NOTIFICATIONS</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Notification Groups */}
        {notificationGroups.map((group) => (
          <View key={group.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{group.title}</Text>
            <View style={styles.sectionCard}>
              {group.items.map((item, index) => (
                <View
                  key={item.key}
                  style={[
                    styles.notificationItem,
                    index !== group.items.length - 1 && styles.itemBorder,
                  ]}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemDesc}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={notifications[item.key as keyof typeof notifications]}
                    onValueChange={(v) => setNotifications({ ...notifications, [item.key]: v })}
                    trackColor={{ false: '#333', true: colors.accent }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.textMuted} />
          <Text style={styles.infoText}>
            Safety alerts cannot be disabled for your protection. You will always receive emergency notifications from crew members.
          </Text>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  itemDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
