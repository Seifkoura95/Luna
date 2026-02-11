import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, radius } from '../src/theme/colors';
import { PageHeader } from '../src/components/PageHeader';
import { StarfieldBackground } from '../src/components/StarfieldBackground';
import { GlassCard } from '../src/components/GlassCard';
import { LiveIndicator } from '../src/components/LiveIndicator';
import { useAuthStore } from '../src/store/authStore';
import { useFonts, fonts } from '../src/hooks/useFonts';

const { width } = Dimensions.get('window');

// Mock friends data
const MOCK_FRIENDS = [
  {
    id: 'f1',
    name: 'Sarah Mitchell',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    status: 'going_out',
    venue: 'Eclipse',
    mutualFriends: 5,
  },
  {
    id: 'f2',
    name: 'Mike Rodriguez',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    status: 'at_venue',
    venue: 'Su Casa Brisbane',
    mutualFriends: 3,
  },
  {
    id: 'f3',
    name: 'Emma Chen',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
    status: 'checked_in',
    venue: 'After Dark',
    mutualFriends: 8,
  },
  {
    id: 'f4',
    name: 'James Wilson',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    status: 'offline',
    venue: null,
    mutualFriends: 2,
  },
];

// Mock activity feed
const MOCK_ACTIVITY = [
  {
    id: 'a1',
    type: 'check_in',
    user: { name: 'Sarah Mitchell', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200' },
    venue: 'Eclipse',
    timestamp: '5 mins ago',
    message: 'Just arrived! 🔥',
  },
  {
    id: 'a2',
    type: 'going_out',
    user: { name: 'Mike Rodriguez', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' },
    venue: 'Su Casa Brisbane',
    timestamp: '15 mins ago',
    message: 'Who else is heading to Su Casa tonight?',
  },
  {
    id: 'a3',
    type: 'photo_tagged',
    user: { name: 'Emma Chen', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200' },
    photo: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400',
    timestamp: '1 hour ago',
    message: 'Tagged you in a photo',
  },
  {
    id: 'a4',
    type: 'booth_booked',
    user: { name: 'James Wilson', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200' },
    venue: 'Eclipse',
    timestamp: '2 hours ago',
    message: 'Booked VIP booth for Saturday! Who wants in?',
  },
  {
    id: 'a5',
    type: 'points_earned',
    user: { name: 'You', avatar: null },
    points: 250,
    timestamp: '3 hours ago',
    message: 'Earned 250 Luna Points at Eclipse',
  },
];

// Tonight's Plans
const TONIGHTS_PLANS = [
  { venue: 'Eclipse', count: 12, time: '10 PM' },
  { venue: 'Su Casa Brisbane', count: 5, time: '9 PM' },
  { venue: 'After Dark', count: 3, time: '11 PM' },
];

export default function SocialScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fontsLoaded = useFonts();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'friends'>('feed');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'at_venue':
      case 'checked_in':
        return colors.success;
      case 'going_out':
        return colors.gold;
      default:
        return colors.textMuted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'at_venue':
        return 'At venue';
      case 'checked_in':
        return 'Checked in';
      case 'going_out':
        return 'Going out';
      default:
        return 'Offline';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'check_in':
        return 'location';
      case 'going_out':
        return 'moon';
      case 'photo_tagged':
        return 'camera';
      case 'booth_booked':
        return 'wine';
      case 'points_earned':
        return 'star';
      default:
        return 'ellipse';
    }
  };

  const renderActivityItem = (activity: any, index: number) => (
    <Animated.View
      key={activity.id}
      entering={FadeInDown.delay(index * 100).duration(400)}
    >
      <GlassCard style={styles.activityCard}>
        <View style={styles.activityHeader}>
          {activity.user.avatar ? (
            <Image source={{ uri: activity.user.avatar }} style={styles.activityAvatar} />
          ) : (
            <View style={[styles.activityAvatar, styles.selfAvatar]}>
              <Ionicons name="person" size={20} color={colors.gold} />
            </View>
          )}
          <View style={styles.activityInfo}>
            <Text style={[styles.activityUser, fontsLoaded && { fontFamily: fonts.semiBold }]}>
              {activity.user.name}
            </Text>
            <Text style={styles.activityTime}>{activity.timestamp}</Text>
          </View>
          <View style={[styles.activityIcon, { backgroundColor: colors.accentGlow }]}>
            <Ionicons name={getActivityIcon(activity.type)} size={16} color={colors.accent} />
          </View>
        </View>

        <Text style={styles.activityMessage}>{activity.message}</Text>

        {activity.venue && (
          <TouchableOpacity style={styles.activityVenue}>
            <Ionicons name="location" size={14} color={colors.textSecondary} />
            <Text style={styles.activityVenueText}>{activity.venue}</Text>
          </TouchableOpacity>
        )}

        {activity.photo && (
          <Image source={{ uri: activity.photo }} style={styles.activityPhoto} />
        )}

        {activity.points && (
          <View style={styles.pointsBadge}>
            <Ionicons name="star" size={16} color={colors.gold} />
            <Text style={styles.pointsText}>+{activity.points} pts</Text>
          </View>
        )}
      </GlassCard>
    </Animated.View>
  );

  const renderFriendItem = (friend: any, index: number) => (
    <Animated.View
      key={friend.id}
      entering={SlideInRight.delay(index * 80).duration(400)}
    >
      <TouchableOpacity activeOpacity={0.85}>
        <GlassCard style={styles.friendCard}>
          <Image source={{ uri: friend.avatar }} style={styles.friendAvatar} />
          <View style={styles.friendInfo}>
            <Text style={[styles.friendName, fontsLoaded && { fontFamily: fonts.semiBold }]}>
              {friend.name}
            </Text>
            <View style={styles.friendStatus}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(friend.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(friend.status) }]}>
                {getStatusText(friend.status)}
              </Text>
            </View>
            {friend.venue && (
              <View style={styles.friendVenue}>
                <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                <Text style={styles.friendVenueText}>{friend.venue}</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={60} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <PageHeader 
          title="SOCIAL"
          description="See what your crew is up to"
          showLogo={false}
        />

        {/* Tonight's Plans Summary */}
        <View style={styles.tonightSection}>
          <View style={styles.sectionHeader}>
            <LiveIndicator text="TONIGHT" color={colors.accent} />
            <Text style={styles.tonightCount}>20 friends going out</Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tonightScroll}>
            {TONIGHTS_PLANS.map((plan, index) => (
              <Animated.View key={plan.venue} entering={FadeIn.delay(index * 100)}>
                <TouchableOpacity style={styles.venueChip}>
                  <LinearGradient
                    colors={['rgba(227,24,55,0.2)', 'rgba(227,24,55,0.05)']}
                    style={styles.venueChipGradient}
                  >
                    <Text style={styles.venueChipName}>{plan.venue}</Text>
                    <View style={styles.venueChipMeta}>
                      <Ionicons name="people" size={12} color={colors.textSecondary} />
                      <Text style={styles.venueChipCount}>{plan.count}</Text>
                      <Text style={styles.venueChipTime}>@ {plan.time}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </ScrollView>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
            onPress={() => setActiveTab('feed')}
          >
            <Ionicons 
              name="newspaper-outline" 
              size={18} 
              color={activeTab === 'feed' ? colors.accent : colors.textSecondary} 
            />
            <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>
              Activity
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
            onPress={() => setActiveTab('friends')}
          >
            <Ionicons 
              name="people-outline" 
              size={18} 
              color={activeTab === 'friends' ? colors.accent : colors.textSecondary} 
            />
            <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
              Friends
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'feed' ? (
          <View style={styles.feedContainer}>
            {MOCK_ACTIVITY.map((activity, index) => renderActivityItem(activity, index))}
          </View>
        ) : (
          <View style={styles.friendsContainer}>
            {/* Online Friends Section */}
            <Text style={styles.friendsSection}>Active Now</Text>
            {MOCK_FRIENDS.filter(f => f.status !== 'offline').map((friend, index) => 
              renderFriendItem(friend, index)
            )}
            
            <Text style={[styles.friendsSection, { marginTop: spacing.lg }]}>Offline</Text>
            {MOCK_FRIENDS.filter(f => f.status === 'offline').map((friend, index) => 
              renderFriendItem(friend, index)
            )}
          </View>
        )}
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  // Tonight Section
  tonightSection: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  tonightCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tonightScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  venueChip: {
    marginRight: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  venueChipGradient: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  venueChipName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  venueChipMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  venueChipCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  venueChipTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.accentGlow,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.accent,
  },
  // Activity Feed
  feedContainer: {
    gap: spacing.md,
  },
  activityCard: {
    padding: spacing.md,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.sm,
  },
  selfAvatar: {
    backgroundColor: colors.goldGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityUser: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activityTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  activityVenue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityVenueText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  activityPhoto: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.goldGlow,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  pointsText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold,
  },
  // Friends
  friendsContainer: {
    gap: spacing.sm,
  },
  friendsSection: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.md,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  friendStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  friendVenue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  friendVenueText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
