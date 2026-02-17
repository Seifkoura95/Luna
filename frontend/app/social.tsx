import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, radius } from '../src/theme/colors';
import { PageHeader } from '../src/components/PageHeader';
import { StarfieldBackground } from '../src/components/StarfieldBackground';
import { GlassCard } from '../src/components/GlassCard';
import { useAuthStore } from '../src/store/authStore';


const { width } = Dimensions.get('window');

// Mock data for friends activity
const MOCK_FRIENDS = [
  { id: '1', name: 'Sarah M.', avatar: 'https://randomuser.me/api/portraits/women/1.jpg', username: '@sarahm' },
  { id: '2', name: 'James T.', avatar: 'https://randomuser.me/api/portraits/men/2.jpg', username: '@jamest' },
  { id: '3', name: 'Emily R.', avatar: 'https://randomuser.me/api/portraits/women/3.jpg', username: '@emilyr' },
  { id: '4', name: 'Michael K.', avatar: 'https://randomuser.me/api/portraits/men/4.jpg', username: '@michaelk' },
  { id: '5', name: 'Jessica L.', avatar: 'https://randomuser.me/api/portraits/women/5.jpg', username: '@jessical' },
];

const MOCK_VENUES = [
  { id: 'eclipse', name: 'Eclipse', hashtag: '#EclipseBrisbane', color: '#E31837' },
  { id: 'after_dark', name: 'After Dark', hashtag: '#AfterDarkBrisbane', color: '#9333EA' },
  { id: 'su_casa_brisbane', name: 'Su Casa Brisbane', hashtag: '#SucasaBrisbane', color: '#FF6B35' },
  { id: 'su_casa_gold_coast', name: 'Su Casa Gold Coast', hashtag: '#SucasaGoldcoast', color: '#FF6B35' },
  { id: 'night_market', name: 'Night Market', hashtag: '#NightMarket', color: '#3B82F6' },
];

const ACTIVITY_TYPES = {
  CHECK_IN: 'check_in',
  RSVP: 'rsvp',
  LIKE: 'like',
  PHOTO: 'photo',
  EARNED_POINTS: 'earned_points',
  VIP_UPGRADE: 'vip_upgrade',
};

// Generate mock activity feed
const generateMockActivities = () => {
  const activities = [];
  const now = Date.now();
  
  const activityTemplates = [
    { type: ACTIVITY_TYPES.CHECK_IN, verb: 'checked in at', icon: 'location' },
    { type: ACTIVITY_TYPES.RSVP, verb: 'is going to', icon: 'calendar' },
    { type: ACTIVITY_TYPES.LIKE, verb: 'liked a post at', icon: 'heart' },
    { type: ACTIVITY_TYPES.PHOTO, verb: 'shared a photo at', icon: 'camera' },
    { type: ACTIVITY_TYPES.EARNED_POINTS, verb: 'earned 50 Luna Points at', icon: 'star' },
    { type: ACTIVITY_TYPES.VIP_UPGRADE, verb: 'upgraded to VIP at', icon: 'diamond' },
  ];
  
  for (let i = 0; i < 15; i++) {
    const friend = MOCK_FRIENDS[Math.floor(Math.random() * MOCK_FRIENDS.length)];
    const venue = MOCK_VENUES[Math.floor(Math.random() * MOCK_VENUES.length)];
    const template = activityTemplates[Math.floor(Math.random() * activityTemplates.length)];
    const timeAgo = Math.floor(Math.random() * 24 * 60);
    
    activities.push({
      id: `activity-${i}`,
      friend,
      venue,
      type: template.type,
      verb: template.verb,
      icon: template.icon,
      timestamp: now - (timeAgo * 60 * 1000),
      likes: Math.floor(Math.random() * 50),
      hasImage: template.type === ACTIVITY_TYPES.PHOTO || Math.random() > 0.7,
    });
  }
  
  return activities.sort((a, b) => b.timestamp - a.timestamp);
};

// Mock Instagram posts data
const MOCK_INSTAGRAM_POSTS = [
  {
    id: 'ig1',
    image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400',
    venue: MOCK_VENUES[0],
    hashtag: '#EclipseBrisbane',
    likes: 234,
    caption: 'Amazing night at Eclipse! 🌙✨',
  },
  {
    id: 'ig2',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
    venue: MOCK_VENUES[1],
    hashtag: '#AfterDarkBrisbane',
    likes: 189,
    caption: 'The vibes at After Dark are unreal 🔥',
  },
  {
    id: 'ig3',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400',
    venue: MOCK_VENUES[2],
    hashtag: '#SucasaBrisbane',
    likes: 312,
    caption: 'Su Casa never disappoints 🎉',
  },
];

const formatTimeAgo = (timestamp: number) => {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function SocialFeedScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
import { api } from '../src/utils/api';
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [instagramPosts, setInstagramPosts] = useState<any[]>([]);
  const [instagramLoading, setInstagramLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'friends' | 'instagram'>('friends');

  useEffect(() => {
    loadActivities();
    loadInstagramFeed();
  }, []);

  const loadActivities = async () => {
    setLoading(true);
    // Simulate API call for friend activity
    await new Promise(resolve => setTimeout(resolve, 800));
    setActivities(generateMockActivities());
    setLoading(false);
  };

  const loadInstagramFeed = async () => {
    setInstagramLoading(true);
    try {
      const feed = await api.getInstagramFeed(20);
      setInstagramPosts(feed.posts || []);
    } catch (error) {
      console.error('Failed to load Instagram feed:', error);
      // Fall back to mock data if API fails
      setInstagramPosts(MOCK_INSTAGRAM_POSTS);
    } finally {
      setInstagramLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadActivities(), loadInstagramFeed()]);
    setRefreshing(false);
  }, []);

  const handleLike = (activityId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActivities(prev => 
      prev.map(a => a.id === activityId ? { ...a, likes: a.likes + 1, liked: true } : a)
    );
  };

  const handleFollow = (friendId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert('Following!', 'You are now following this user');
  };

  const getActivityIcon = (iconName: string) => {
    const iconMap: { [key: string]: string } = {
      location: 'location',
      calendar: 'calendar',
      heart: 'heart',
      camera: 'camera',
      star: 'star',
      diamond: 'diamond',
    };
    return iconMap[iconName] || 'ellipse';
  };

  const renderActivityItem = (activity: any, index: number) => (
    <Animated.View 
      key={activity.id}
      entering={FadeInDown.delay(index * 50).duration(300)}
    >
      <GlassCard style={styles.activityCard}>
        <View style={styles.activityHeader}>
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={() => handleFollow(activity.friend.id)}
          >
            <Image 
              source={{ uri: activity.friend.avatar }} 
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.userText}>
              <Text style={[styles.userName, ]}>
                {activity.friend.name}
              </Text>
              <Text style={styles.userHandle}>{activity.friend.username}</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.timeAgo}>{formatTimeAgo(activity.timestamp)}</Text>
        </View>
        
        <View style={styles.activityContent}>
          <View style={styles.activityTextRow}>
            <Ionicons 
              name={getActivityIcon(activity.icon) as any} 
              size={16} 
              color={activity.venue.color} 
            />
            <Text style={styles.activityText}>
              {activity.verb}{' '}
              <Text style={[styles.venueName, { color: activity.venue.color }]}>
                {activity.venue.name}
              </Text>
            </Text>
          </View>
          
          {activity.hasImage && (
            <View style={styles.activityImageContainer}>
              <Image 
                source={{ uri: `https://source.unsplash.com/400x300/?nightclub,party&sig=${activity.id}` }}
                style={styles.activityImage}
                contentFit="cover"
              />
            </View>
          )}
        </View>
        
        <View style={styles.activityActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLike(activity.id)}
          >
            <Ionicons 
              name={activity.liked ? 'heart' : 'heart-outline'} 
              size={20} 
              color={activity.liked ? '#E31837' : colors.textSecondary} 
            />
            <Text style={styles.actionText}>{activity.likes}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderInstagramPost = (post: any, index: number) => (
    <Animated.View 
      key={post.id}
      entering={FadeInDown.delay(index * 50).duration(300)}
    >
      <GlassCard style={styles.instagramCard}>
        <View style={styles.instagramPostHeader}>
          <View style={styles.instagramAccountInfo}>
            <LinearGradient
              colors={['#833AB4', '#E1306C', '#F77737']}
              style={styles.instagramAvatarGradient}
            >
              <View style={styles.instagramAvatarInner}>
                <Ionicons name="logo-instagram" size={18} color="#fff" />
              </View>
            </LinearGradient>
            <View>
              <Text style={styles.instagramUsername}>@{post.username}</Text>
              <Text style={styles.instagramTime}>
                {formatTimeAgo(new Date(post.timestamp).getTime())}
                {post.demo && ' • Demo'}
              </Text>
            </View>
          </View>
          {post.source_type === 'official' && (
            <View style={styles.officialBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
              <Text style={styles.officialText}>Official</Text>
            </View>
          )}
        </View>
        
        <Image 
          source={{ uri: post.media_url }}
          style={styles.instagramMainImage}
          contentFit="cover"
        />
        
        {post.caption && (
          <Text style={styles.instagramCaption} numberOfLines={3}>
            {post.caption}
          </Text>
        )}
        
        <View style={styles.instagramActions}>
          <View style={styles.instagramStats}>
            {post.like_count > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="heart" size={16} color={colors.accent} />
                <Text style={styles.statText}>{post.like_count}</Text>
              </View>
            )}
            {post.comments_count > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="chatbubble" size={14} color={colors.textSecondary} />
                <Text style={styles.statText}>{post.comments_count}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={styles.viewOnInstagram}
            onPress={() => {
              if (post.permalink) {
                // Would open Instagram link in browser
                Alert.alert('Opening Instagram', 'This would open the post on Instagram');
              }
            }}
          >
            <Text style={styles.viewOnInstagramText}>View on Instagram</Text>
            <Ionicons name="open-outline" size={14} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderInstagramFeed = () => (
    <View style={styles.instagramFeedContainer}>
      {/* Hashtag Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hashtagScroll}>
        {MOCK_VENUES.map((venue) => (
          <TouchableOpacity 
            key={venue.id}
            style={[styles.hashtagChip, { borderColor: venue.color }]}
          >
            <Text style={[styles.hashtagText, { color: venue.color }]}>
              {venue.hashtag}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* Demo Mode Banner */}
      {instagramPosts.length > 0 && instagramPosts[0]?.demo && (
        <View style={styles.demoBanner}>
          <Ionicons name="information-circle" size={16} color={colors.gold} />
          <Text style={styles.demoBannerText}>
            Demo Mode - Connect Instagram API for live content
          </Text>
        </View>
      )}
      
      {instagramLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E4405F" />
          <Text style={styles.loadingText}>Loading Instagram feed...</Text>
        </View>
      ) : (
        instagramPosts.map((post, index) => renderInstagramPost(post, index))
      )}
    </View>
  );

  const renderTrendingHashtags = () => (
    <View style={styles.trendingSection}>
      <Text style={[styles.sectionTitle, ]}>
        Trending Hashtags
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {MOCK_VENUES.map((venue, index) => (
          <TouchableOpacity 
            key={venue.id}
            style={[styles.hashtagChip, { borderColor: venue.color }]}
          >
            <Text style={[styles.hashtagText, { color: venue.color }]}>
              {venue.hashtag}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity 
          style={[styles.hashtagChip, { borderColor: colors.accent }]}
        >
          <Text style={[styles.hashtagText, { color: colors.accent }]}>
            #LunaGroup
          </Text>
        </TouchableOpacity>
      </ScrollView>
      
      {/* Instagram Preview Section */}
      <View style={styles.instagramPreview}>
        <View style={styles.instagramHeader}>
          <Ionicons name="logo-instagram" size={20} color="#E4405F" />
          <Text style={styles.instagramTitle}>From Instagram</Text>
          <TouchableOpacity onPress={() => setSelectedTab('instagram')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(instagramPosts.length > 0 ? instagramPosts.slice(0, 5) : MOCK_INSTAGRAM_POSTS).map((post: any) => (
            <TouchableOpacity key={post.id} style={styles.instagramPost}>
              <Image 
                source={{ uri: post.media_url || post.image }}
                style={styles.instagramImage}
                contentFit="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.instagramOverlay}
              >
                <Text style={styles.instagramHashtag}>
                  {post.source_hashtag ? `#${post.source_hashtag}` : (post.hashtag || '@' + post.username)}
                </Text>
                <View style={styles.instagramLikes}>
                  <Ionicons name="heart" size={12} color="#fff" />
                  <Text style={styles.instagramLikesText}>{post.like_count || post.likes || 0}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StarfieldBackground starCount={30} />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading social feed...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={60} />
      
      {/* Back Button */}
      <View style={[styles.backButtonContainer, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <PageHeader 
          title="SOCIAL"
          description="See what your friends are up to"
          showLogo={false}
        />

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, selectedTab === 'friends' && styles.tabActive]}
            onPress={() => setSelectedTab('friends')}
          >
            <Ionicons 
              name="people" 
              size={18} 
              color={selectedTab === 'friends' ? colors.accent : colors.textSecondary} 
            />
            <Text style={[styles.tabText, selectedTab === 'friends' && styles.tabTextActive]}>
              Friends
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, selectedTab === 'instagram' && styles.tabActive]}
            onPress={() => setSelectedTab('instagram')}
          >
            <Ionicons 
              name="logo-instagram" 
              size={18} 
              color={selectedTab === 'instagram' ? '#E4405F' : colors.textSecondary} 
            />
            <Text style={[styles.tabText, selectedTab === 'instagram' && styles.tabTextActive]}>
              Instagram
            </Text>
          </TouchableOpacity>
        </View>

        {selectedTab === 'instagram' ? (
          renderInstagramFeed()
        ) : (
          <>
            {renderTrendingHashtags()}

            {/* Activity Feed */}
            <View style={styles.feedContainer}>
              {activities.slice(0, 10).map((activity, index) => 
                renderActivityItem(activity, index)
              )}
            </View>
          </>
        )}

        {activities.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>No activity yet</Text>
            <Text style={styles.emptySubtext}>Follow friends to see their activity</Text>
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Back Button
  backButtonContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  // Tabs
  tabContainer: {
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
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.backgroundCard,
  },
  tabText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  // Trending Section
  trendingSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  hashtagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
    backgroundColor: colors.glass,
  },
  hashtagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Instagram Preview
  instagramPreview: {
    marginTop: spacing.lg,
  },
  instagramHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  instagramTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  instagramSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  instagramPost: {
    width: 150,
    height: 150,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  instagramImage: {
    width: '100%',
    height: '100%',
  },
  instagramOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: spacing.sm,
  },
  instagramHashtag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  instagramLikes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  instagramLikesText: {
    fontSize: 11,
    color: '#fff',
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  userText: {
    gap: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userHandle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  timeAgo: {
    fontSize: 12,
    color: colors.textMuted,
  },
  activityContent: {
    marginBottom: spacing.sm,
  },
  activityTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  activityText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  venueName: {
    fontWeight: '600',
  },
  activityImageContainer: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  activityImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
  },
  activityActions: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptySubtext: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.textMuted,
  },
  // Instagram Feed Styles
  instagramFeedContainer: {
    paddingHorizontal: spacing.md,
  },
  hashtagScroll: {
    marginBottom: spacing.md,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  demoBannerText: {
    fontSize: 12,
    color: colors.gold,
  },
  instagramCard: {
    marginBottom: spacing.md,
  },
  instagramPostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  instagramAccountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  instagramAvatarGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instagramAvatarInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instagramUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  instagramTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(227, 24, 55, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  officialText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  instagramMainImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  instagramCaption: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  instagramActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  instagramStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  viewOnInstagram: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewOnInstagramText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '500',
  },
  seeAllText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
});
