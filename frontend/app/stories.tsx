import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  RefreshControl,
  Clipboard,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../src/components/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../src/theme/colors';
import { AppBackground } from '../src/components/AppBackground';
import { SectionTitle } from '../src/components/SectionTitle';
import { api } from '../src/utils/api';
import { Platform } from 'react-native';

interface Story {
  id: string;
  photo_url: string;
  caption: string;
  venue_name: string;
  shares: number;
  created_at: string;
  user?: {
    name: string;
    tier: string;
  };
}

const SHARE_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: 'logo-instagram', color: '#E4405F' },
  { id: 'facebook', name: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
  { id: 'twitter', name: 'Twitter', icon: 'logo-twitter', color: '#1DA1F2' },
  { id: 'snapchat', name: 'Snapchat', icon: 'logo-snapchat', color: '#FFFC00' },
  { id: 'tiktok', name: 'TikTok', icon: 'logo-tiktok', color: '#000000' },
  { id: 'copy_link', name: 'Copy', icon: 'copy-outline', color: colors.accent },
];

export default function Stories() {
  const insets = useSafeAreaInsets();
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [feedStories, setFeedStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const [myStoriesRes, feedRes] = await Promise.all([
        api.getMyStories(),
        api.getStoryFeed(20)
      ]);
      setMyStories(myStoriesRes.stories || []);
      setFeedStories(feedRes.stories || []);
    } catch (error) {
      console.error('Failed to fetch stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStories();
    setRefreshing(false);
  };

  const handleHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleShare = async (story: Story, platform: string) => {
    handleHaptic();
    
    try {
      const result = await api.shareStory(story.id, platform);
      
      if (result.success) {
        // Handle based on platform
        if (platform === 'copy_link') {
          Clipboard.setString(`${story.caption} #LunaGroup #${story.venue_name.replace(/\s/g, '')}`);
          Alert.alert('Copied!', `Caption copied. +${result.points_earned} Luna Points earned!`);
        } else {
          // Use native share for other platforms
          await Share.share({
            message: `${story.caption} #LunaGroup #${story.venue_name.replace(/\s/g, '')} #NightOut`,
          });
          Alert.alert('Shared!', `+${result.points_earned} Luna Points earned for sharing!`);
        }
        
        // Refresh stories to update share count
        fetchStories();
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share story. Please try again.');
    }
    
    setShowShareModal(false);
    setSelectedStory(null);
  };

  const openShareModal = (story: Story) => {
    handleHaptic();
    setSelectedStory(story);
    setShowShareModal(true);
  };

  const renderStoryCard = (story: Story, index: number, isMyStory: boolean = false) => (
    <Animated.View 
      key={story.id} 
      entering={FadeInDown.delay(index * 100).duration(300)}
    >
      <TouchableOpacity
        style={styles.storyCard}
        onPress={() => openShareModal(story)}
        activeOpacity={0.85}
        data-testid={`story-${story.id}`}
      >
        <Image 
          source={{ uri: story.photo_url }} 
          style={styles.storyImage}
          contentFit="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.storyOverlay}
        >
          <View style={styles.storyContent}>
            {!isMyStory && story.user && (
              <View style={styles.storyUser}>
                <View style={[styles.userTierDot, { backgroundColor: getTierColor(story.user.tier) }]} />
                <Text style={styles.userName}>{story.user.name}</Text>
              </View>
            )}
            <Text style={styles.storyCaption} numberOfLines={2}>{story.caption}</Text>
            <View style={styles.storyMeta}>
              <Text style={styles.storyVenue}>{story.venue_name}</Text>
              {story.shares > 0 && (
                <View style={styles.shareCount}>
                  <Icon name="share-social" size={12} color={colors.textMuted} />
                  <Text style={styles.shareCountText}>{story.shares}</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
        
        {/* Share Button */}
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => openShareModal(story)}
          data-testid={`share-btn-${story.id}`}
        >
          <Icon name="share-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'gold': return colors.gold;
      case 'platinum': return colors.accent;
      case 'diamond': return '#B9F2FF';
      default: return colors.orange;
    }
  };

  return (
    <View style={styles.container}>
      <AppBackground />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          data-testid="stories-back"
        >
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stories</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Points Banner */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.pointsBanner}>
          <LinearGradient
            colors={[colors.accent + '20', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.pointsBannerGradient}
          >
            <Icon name="gift" size={20} color={colors.accent} />
            <Text style={styles.pointsBannerText}>
              Earn <Text style={styles.pointsHighlight}>25 Luna Points</Text> for every story you share!
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* My Stories */}
        {myStories.length > 0 && (
          <View style={styles.section}>
            <SectionTitle 
              title="My Stories" 
              icon="images"
              iconColor={colors.accent}
            />
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {myStories.map((story, index) => (
                <View key={story.id} style={styles.horizontalCard}>
                  {renderStoryCard(story, index, true)}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Community Feed */}
        <View style={styles.section}>
          <SectionTitle 
            title="Community" 
            icon="people"
            iconColor={colors.gold}
          />
          <View style={styles.feedGrid}>
            {feedStories.map((story, index) => renderStoryCard(story, index))}
          </View>
          
          {feedStories.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Icon name="camera-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyStateText}>No stories yet</Text>
              <Text style={styles.emptyStateSub}>Be the first to share a moment!</Text>
            </View>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Share Modal */}
      {showShareModal && selectedStory && (
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowShareModal(false)}
        >
          <Animated.View 
            entering={FadeInDown.duration(200)}
            style={styles.shareModal}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Share Story</Text>
            <Text style={styles.modalCaption} numberOfLines={2}>{selectedStory.caption}</Text>
            
            <View style={styles.platformGrid}>
              {SHARE_PLATFORMS.map((platform) => (
                <TouchableOpacity
                  key={platform.id}
                  style={styles.platformButton}
                  onPress={() => handleShare(selectedStory, platform.id)}
                  data-testid={`share-platform-${platform.id}`}
                >
                  <View style={[styles.platformIcon, { backgroundColor: platform.color + '20' }]}>
                    <Icon name={platform.icon as any} size={24} color={platform.color} />
                  </View>
                  <Text style={styles.platformName}>{platform.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.pointsReward}>
              <Icon name="star" size={16} color={colors.gold} />
              <Text style={styles.pointsRewardText}>+25 Luna Points for sharing</Text>
            </View>
          </Animated.View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  pointsBanner: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  pointsBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  pointsBannerText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  pointsHighlight: {
    color: colors.accent,
    fontWeight: '700',
  },
  section: {
    marginBottom: spacing.xl,
  },
  horizontalScroll: {
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  horizontalCard: {
    width: 200,
  },
  feedGrid: {
    gap: spacing.md,
  },
  storyCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    height: 200,
    backgroundColor: '#1A1A1A',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  storyOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingTop: spacing.xl,
  },
  storyContent: {
    gap: spacing.xs,
  },
  storyUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  userTierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  storyCaption: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  storyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storyVenue: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  shareCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareCountText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  shareButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptyStateSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  shareModal: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalCaption: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  platformButton: {
    alignItems: 'center',
    width: 80,
  },
  platformIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  platformName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pointsReward: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gold + '15',
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  pointsRewardText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gold,
  },
});
