import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { PhotoCard } from '../../src/components/PhotoCard';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type TabType = 'all' | 'pending' | 'purchased';

export default function PhotosScreen() {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [photos, setPhotos] = useState<any[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<any[]>([]);
  const [purchasedPhotos, setPurchasedPhotos] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [aiEnhance, setAiEnhance] = useState(false);

  const fetchPhotos = useCallback(async () => {
    try {
      const [all, pending, purchased] = await Promise.all([
        api.getUserPhotos(),
        api.getPendingPhotos(),
        api.getPurchasedPhotos(),
      ]);
      setPhotos(all);
      setPendingPhotos(pending);
      setPurchasedPhotos(purchased);
    } catch (e) {
      console.error('Failed to fetch photos:', e);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPhotos();
    setRefreshing(false);
  };

  const handleApprove = async (tagId: string, approved: boolean) => {
    try {
      await api.approvePhoto(tagId, approved);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          approved 
            ? Haptics.NotificationFeedbackType.Success 
            : Haptics.NotificationFeedbackType.Warning
        );
      }
      fetchPhotos();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update photo');
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    const newSelection = new Set(selectedPhotos);
    if (newSelection.has(photoId)) {
      newSelection.delete(photoId);
    } else {
      newSelection.add(photoId);
    }
    setSelectedPhotos(newSelection);
  };

  const handlePurchase = async () => {
    if (selectedPhotos.size === 0) {
      Alert.alert('No Photos Selected', 'Please select photos to purchase');
      return;
    }

    const photoIds = Array.from(selectedPhotos);
    const basePrice = photoIds.length * 5;
    const aiPrice = aiEnhance ? photoIds.length * 2 : 0;
    const isBundle = photoIds.length >= 5;
    const total = isBundle ? 25 + aiPrice : basePrice + aiPrice;

    Alert.alert(
      'Confirm Purchase',
      `${photoIds.length} photos for $${total}${aiEnhance ? ' (with AI enhancement)' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            setPurchasing(true);
            try {
              const result = await api.purchasePhotos(photoIds, aiEnhance);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              Alert.alert('Success!', result.message);
              setSelectedPhotos(new Set());
              setAiEnhance(false);
              fetchPhotos();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Purchase failed');
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
  };

  const getDisplayPhotos = () => {
    switch (activeTab) {
      case 'pending':
        return pendingPhotos;
      case 'purchased':
        return purchasedPhotos;
      default:
        return photos.filter(p => p.tag_status === 'approved');
    }
  };

  const displayPhotos = getDisplayPhotos();
  const approvedCount = photos.filter(p => p.tag_status === 'approved').length;

  return (
    <View style={styles.container}>
      {/* Premium Header with Tabs */}
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.background, colors.backgroundElevated]}
          style={styles.headerGradient}
        >
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'all' && styles.tabActive]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                setActiveTab('all');
              }}
              activeOpacity={0.7}
            >
              {activeTab === 'all' && (
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                Available
              </Text>
              <View style={[styles.tabBadge, activeTab === 'all' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'all' && styles.tabBadgeTextActive]}>
                  {approvedCount}
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                setActiveTab('pending');
              }}
              activeOpacity={0.7}
            >
              {activeTab === 'pending' && (
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
                Review
              </Text>
              <View style={[styles.tabBadge, activeTab === 'pending' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'pending' && styles.tabBadgeTextActive]}>
                  {pendingPhotos.length}
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'purchased' && styles.tabActive]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                setActiveTab('purchased');
              }}
              activeOpacity={0.7}
            >
              {activeTab === 'purchased' && (
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={[styles.tabText, activeTab === 'purchased' && styles.tabTextActive]}>
                Owned
              </Text>
              <View style={[styles.tabBadge, activeTab === 'purchased' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'purchased' && styles.tabBadgeTextActive]}>
                  {purchasedPhotos.length}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

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
        {displayPhotos.length > 0 ? (
          <View style={styles.photosGrid}>
            {displayPhotos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onApprove={activeTab === 'pending' ? handleApprove : undefined}
                tagId={photo.tag_id}
                selectable={activeTab === 'all'}
                selected={selectedPhotos.has(photo.id)}
                onSelect={togglePhotoSelection}
                onPress={activeTab === 'purchased' ? () => setSelectedPhoto(photo) : undefined}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <LinearGradient
                colors={[colors.accentGlow, 'transparent']}
                style={styles.emptyGlow}
              />
              <Ionicons 
                name={
                  activeTab === 'purchased' ? 'images-outline' : 
                  activeTab === 'pending' ? 'hourglass-outline' : 
                  'camera-outline'
                } 
                size={56} 
                color={colors.textMuted} 
              />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending' ? 'No Photos to Review' :
               activeTab === 'purchased' ? 'No Purchased Photos' :
               'No Photos Available'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'pending' 
                ? 'Photos tagged to you by our photographers will appear here for your approval'
                : activeTab === 'purchased'
                ? 'Your purchased memories will be stored here'
                : 'Visit Eclipse Brisbane and capture unforgettable moments!'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Premium Purchase Bar */}
      {activeTab === 'all' && approvedCount > 0 && (
        <View style={styles.purchaseBarContainer}>
          <LinearGradient
            colors={[colors.backgroundCard, colors.background]}
            style={styles.purchaseBar}
          >
            <View style={styles.purchaseInfo}>
              <View style={styles.selectedBadge}>
                <Ionicons name="images" size={16} color={colors.accent} />
                <Text style={styles.selectedCount}>{selectedPhotos.size} selected</Text>
              </View>
              <TouchableOpacity
                style={styles.aiToggle}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                  setAiEnhance(!aiEnhance);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, aiEnhance && styles.checkboxActive]}>
                  {aiEnhance && <Ionicons name="checkmark" size={14} color={colors.background} />}
                </View>
                <Ionicons name="sparkles" size={16} color={colors.gold} style={{ marginRight: spacing.xs }} />
                <Text style={styles.aiText}>AI Enhance (+$2 each)</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.purchaseBtn,
                (selectedPhotos.size === 0 || purchasing) && styles.purchaseBtnDisabled
              ]}
              onPress={handlePurchase}
              disabled={selectedPhotos.size === 0 || purchasing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={
                  selectedPhotos.size === 0 || purchasing
                    ? [colors.border, colors.border]
                    : [colors.accent, colors.accentDark]
                }
                style={styles.purchaseBtnGradient}
              >
                <Ionicons name="cart" size={18} color={colors.textPrimary} />
                <Text style={styles.purchaseBtnText}>
                  {purchasing ? 'Processing...' : `Purchase ${selectedPhotos.size > 0 ? `(${selectedPhotos.size})` : ''}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {/* Premium Bundle Hint */}
      {activeTab === 'all' && selectedPhotos.size > 0 && selectedPhotos.size < 5 && (
        <View style={styles.bundleHintContainer}>
          <LinearGradient
            colors={[colors.goldGlow, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bundleHint}
          >
            <View style={styles.bundleIconContainer}>
              <Ionicons name="gift" size={20} color={colors.gold} />
            </View>
            <Text style={styles.bundleHintText}>
              Select {5 - selectedPhotos.size} more for bundle pricing
            </Text>
            <View style={styles.bundleBadge}>
              <Text style={styles.bundleBadgeText}>$25</Text>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Premium Full Photo Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity
            style={styles.photoModalClose}
            onPress={() => setSelectedPhoto(null)}
            activeOpacity={0.8}
          >
            <View style={styles.closeButtonContainer}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </View>
          </TouchableOpacity>
          {selectedPhoto && (
            <View style={styles.photoModalContent}>
              <Image
                source={{ uri: selectedPhoto.photo_url }}
                style={styles.fullPhoto}
                resizeMode="contain"
              />
              <LinearGradient
                colors={['transparent', colors.background]}
                style={styles.photoInfoGradient}
              >
                <View style={styles.photoInfo}>
                  {selectedPhoto.event_name && (
                    <Text style={styles.photoEventName}>{selectedPhoto.event_name}</Text>
                  )}
                  {selectedPhoto.ai_enhanced && (
                    <View style={styles.photoAiBadge}>
                      <Ionicons name="sparkles" size={14} color={colors.gold} />
                      <Text style={styles.photoAiText}>AI Enhanced</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerGradient: {
    paddingTop: spacing.md,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tabActive: {
    borderColor: colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  tabBadgeActive: {
    backgroundColor: "#000000",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabBadgeTextActive: {
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl + spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  emptyGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  purchaseBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  purchaseBar: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  purchaseInfo: {
    flex: 1,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  selectedCount: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
  aiToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
  },
  checkboxActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  aiText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  purchaseBtn: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  purchaseBtnDisabled: {
    opacity: 0.5,
  },
  purchaseBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  purchaseBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  bundleHintContainer: {
    position: 'absolute',
    bottom: 90,
    left: spacing.md,
    right: spacing.md,
  },
  bundleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.gold + '40',
    overflow: 'hidden',
  },
  bundleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  bundleHintText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  bundleBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  bundleBadgeText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 50,
    right: spacing.md,
    zIndex: 10,
  },
  closeButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoModalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  fullPhoto: {
    width: '100%',
    height: '100%',
  },
  photoInfoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    justifyContent: 'flex-end',
  },
  photoInfo: {
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoEventName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  photoAiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gold + '40',
  },
  photoAiText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
});
