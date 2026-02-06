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
        {/* Photos Grid */}
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

        {/* Empty State */}
        {displayPhotos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons 
              name={activeTab === 'purchased' ? 'images-outline' : 'camera-outline'} 
              size={64} 
              color={colors.textMuted} 
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending' ? 'No Photos to Review' :
               activeTab === 'purchased' ? 'No Purchased Photos' :
               'No Photos Available'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'pending' 
                ? 'Photos tagged to you will appear here for approval'
                : 'Visit Eclipse and get your photos taken!'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Purchase Bar */}
      {activeTab === 'all' && approvedCount > 0 && (
        <View style={styles.purchaseBar}>
          <View style={styles.purchaseInfo}>
            <Text style={styles.selectedCount}>
              {selectedPhotos.size} selected
            </Text>
            <TouchableOpacity
              style={styles.aiToggle}
              onPress={() => setAiEnhance(!aiEnhance)}
            >
              <View style={[styles.checkbox, aiEnhance && styles.checkboxActive]}>
                {aiEnhance && <Ionicons name="checkmark" size={14} color={colors.textPrimary} />}
              </View>
              <Text style={styles.aiText}>AI Enhance (+$2/photo)</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.purchaseBtn,
              (selectedPhotos.size === 0 || purchasing) && styles.purchaseBtnDisabled
            ]}
            onPress={handlePurchase}
            disabled={selectedPhotos.size === 0 || purchasing}
          >
            <Text style={styles.purchaseBtnText}>
              {purchasing ? 'Processing...' : `Buy ${selectedPhotos.size} Photos`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bundle Hint */}
      {activeTab === 'all' && selectedPhotos.size > 0 && selectedPhotos.size < 5 && (
        <View style={styles.bundleHint}>
          <Ionicons name="gift" size={16} color={colors.premiumGold} />
          <Text style={styles.bundleHintText}>
            Select {5 - selectedPhotos.size} more for bundle deal ($25 for all)!
          </Text>
        </View>
      )}

      {/* Full Photo Modal */}
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
          >
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto.photo_url }}
              style={styles.fullPhoto}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 4,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  purchaseBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  purchaseInfo: {
    flex: 1,
  },
  selectedCount: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
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
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.premiumGold,
    borderColor: colors.premiumGold,
  },
  aiText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  purchaseBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  purchaseBtnDisabled: {
    opacity: 0.5,
  },
  purchaseBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  bundleHint: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: colors.premiumGold + '20',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleHintText: {
    color: colors.premiumGold,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    padding: 8,
  },
  fullPhoto: {
    width: '100%',
    height: '80%',
  },
});
