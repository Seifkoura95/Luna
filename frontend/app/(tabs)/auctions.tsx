import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { differenceInSeconds } from 'date-fns';

const { width } = Dimensions.get('window');

const auctionTypeConfig: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  booth_upgrade: { icon: 'star', color: colors.gold },
  fast_lane: { icon: 'flash', color: colors.warning },
  bottle_service: { icon: 'wine', color: colors.accent },
  vip_experience: { icon: 'diamond', color: colors.platinum },
};

export default function AuctionsScreen() {
  const user = useAuthStore((state) => state.user);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [timeLefts, setTimeLefts] = useState<Record<string, string>>({});

  const fetchAuctions = useCallback(async () => {
    try {
      const data = await api.getAuctions();
      setAuctions(data);
    } catch (e) {
      console.error('Failed to fetch auctions:', e);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 5000);
    return () => clearInterval(interval);
  }, [fetchAuctions]);

  useEffect(() => {
    const updateTimers = () => {
      const newTimeLefts: Record<string, string> = {};
      auctions.forEach((auction) => {
        const now = new Date();
        const endTime = new Date(auction.end_time);
        const startTime = new Date(auction.start_time);

        if (auction.status === 'upcoming') {
          const secsToStart = differenceInSeconds(startTime, now);
          if (secsToStart <= 0) {
            newTimeLefts[auction.id] = 'Starting...';
          } else {
            const mins = Math.floor(secsToStart / 60);
            const secs = secsToStart % 60;
            newTimeLefts[auction.id] = `Starts in ${mins}m ${secs}s`;
          }
        } else if (auction.status === 'active') {
          const secsLeft = differenceInSeconds(endTime, now);
          if (secsLeft <= 0) {
            newTimeLefts[auction.id] = 'Ended';
          } else {
            const mins = Math.floor(secsLeft / 60);
            const secs = secsLeft % 60;
            newTimeLefts[auction.id] = `${mins}:${secs.toString().padStart(2, '0')}`;
          }
        } else {
          newTimeLefts[auction.id] = 'Ended';
        }
      });
      setTimeLefts(newTimeLefts);
    };

    updateTimers();
    const timer = setInterval(updateTimers, 1000);
    return () => clearInterval(timer);
  }, [auctions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAuctions();
    setRefreshing(false);
  };

  const handleAuctionPress = async (auctionId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const detail = await api.getAuctionDetail(auctionId);
      const minBid = detail.current_bid > 0
        ? detail.current_bid + detail.bid_increment
        : detail.reserve_price;
      setBidAmount(minBid.toString());
      setSelectedAuction(detail);
    } catch (e) {
      console.error('Failed to fetch auction detail:', e);
    }
  };

  const handlePlaceBid = async () => {
    if (!selectedAuction || !bidAmount) return;

    const amount = parseFloat(bidAmount);
    if (isNaN(amount)) {
      Alert.alert('Invalid Bid', 'Please enter a valid amount');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setBidding(true);
    try {
      const result = await api.placeBid(selectedAuction.id, amount);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Bid Placed!', result.message);
      setSelectedAuction(result.auction);
      fetchAuctions();
    } catch (e: any) {
      Alert.alert('Bid Failed', e.message || 'Please try again');
    } finally {
      setBidding(false);
    }
  };

  const handleQuickBid = (increment: number) => {
    const currentBid = selectedAuction?.current_bid || selectedAuction?.reserve_price || 0;
    const newBid = currentBid + increment;
    setBidAmount(newBid.toString());
  };

  const activeAuctions = auctions.filter((a) => a.status === 'active');
  const upcomingAuctions = auctions.filter((a) => a.status === 'upcoming');

  const renderAuctionCard = (auction: any) => {
    const config = auctionTypeConfig[auction.auction_type] || { icon: 'pricetag', color: colors.accent };
    const timeLeft = timeLefts[auction.id] || '';
    const isUrgent = auction.status === 'active' && timeLeft.includes(':') && parseInt(timeLeft) < 1;
    const isUserWinning = auction.winner_id === user?.user_id;

    return (
      <TouchableOpacity
        key={auction.id}
        style={[
          styles.auctionCard,
          isUrgent && styles.auctionCardUrgent,
          isUserWinning && styles.auctionCardWinning,
        ]}
        onPress={() => handleAuctionPress(auction.id)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={
            isUserWinning
              ? [colors.successGlow, colors.backgroundCard]
              : isUrgent
              ? [colors.warningGlow, colors.backgroundCard]
              : [colors.backgroundCard, colors.backgroundElevated]
          }
          style={styles.auctionGradient}
        >
          {/* Header */}
          <View style={styles.auctionHeader}>
            <View style={[styles.auctionIcon, { backgroundColor: config.color + '20' }]}>
              <Ionicons name={config.icon} size={24} color={config.color} />
            </View>
            <View
              style={[
                styles.timerBadge,
                auction.status === 'active' && styles.timerBadgeActive,
                isUrgent && styles.timerBadgeUrgent,
              ]}
            >
              <Ionicons
                name={auction.status === 'active' ? 'time' : 'hourglass'}
                size={14}
                color={
                  isUrgent
                    ? colors.background
                    : auction.status === 'active'
                    ? colors.textPrimary
                    : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.timerText,
                  auction.status === 'active' && styles.timerTextActive,
                  isUrgent && styles.timerTextUrgent,
                ]}
              >
                {timeLeft}
              </Text>
            </View>
          </View>

          {/* Content */}
          <Text style={styles.auctionTitle}>{auction.title}</Text>
          <Text style={styles.auctionDesc} numberOfLines={2}>
            {auction.description}
          </Text>

          {/* Footer */}
          <View style={styles.auctionFooter}>
            <View>
              <Text style={styles.bidLabel}>
                {auction.current_bid > 0 ? 'Current Bid' : 'Reserve'}
              </Text>
              <Text style={styles.bidAmount}>
                ${(auction.current_bid > 0 ? auction.current_bid : auction.reserve_price).toFixed(0)}
              </Text>
            </View>

            {isUserWinning ? (
              <View style={styles.winningBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.winningText}>Winning!</Text>
              </View>
            ) : auction.status === 'active' ? (
              <View style={styles.bidNowButton}>
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  style={styles.bidNowGradient}
                >
                  <Text style={styles.bidNowText}>Bid Now</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.textPrimary} />
                </LinearGradient>
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Live Auctions */}
        {activeAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>LIVE NOW</Text>
              </View>
              <View style={styles.liveBadge}>
                <View style={styles.liveIndicator} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            {activeAuctions.map(renderAuctionCard)}
          </View>
        )}

        {/* Upcoming Auctions */}
        {upcomingAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>COMING UP</Text>
              </View>
            </View>
            {upcomingAuctions.map(renderAuctionCard)}
          </View>
        )}

        {/* Empty State */}
        {auctions.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="flash-outline" size={48} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Active Auctions</Text>
            <Text style={styles.emptyText}>
              Check back during events for exclusive auction items!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Auction Detail Modal */}
      <Modal
        visible={!!selectedAuction}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAuction(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSelectedAuction(null)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>

              {selectedAuction && (
                <>
                  <Text style={styles.modalTitle}>{selectedAuction.title}</Text>
                  <Text style={styles.modalDesc}>{selectedAuction.description}</Text>

                  {/* Timer */}
                  {selectedAuction.status === 'active' && (
                    <View style={styles.modalTimer}>
                      <Ionicons name="time" size={24} color={colors.warning} />
                      <Text style={styles.modalTimerText}>
                        {timeLefts[selectedAuction.id] || ''}
                      </Text>
                    </View>
                  )}

                  {/* Current Bid */}
                  <View style={styles.modalBidInfo}>
                    <Text style={styles.modalBidLabel}>Current Bid</Text>
                    <Text style={styles.modalBidValue}>
                      $
                      {selectedAuction.current_bid > 0
                        ? selectedAuction.current_bid.toFixed(0)
                        : selectedAuction.reserve_price.toFixed(0)}
                    </Text>
                    {selectedAuction.winner_name && (
                      <Text style={styles.modalLeader}>Leading: {selectedAuction.winner_name}</Text>
                    )}
                  </View>

                  {/* Quick Bid Buttons */}
                  {selectedAuction.status === 'active' && (
                    <View style={styles.quickBids}>
                      {[5, 10, 20].map((inc) => (
                        <TouchableOpacity
                          key={inc}
                          style={styles.quickBidBtn}
                          onPress={() => handleQuickBid(inc)}
                        >
                          <Text style={styles.quickBidText}>+${inc}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Bid Input */}
                  {selectedAuction.status === 'active' && (
                    <View style={styles.bidInputContainer}>
                      <Text style={styles.dollarSign}>$</Text>
                      <TextInput
                        style={styles.bidInput}
                        value={bidAmount}
                        onChangeText={setBidAmount}
                        keyboardType="numeric"
                        placeholder="Enter bid"
                        placeholderTextColor={colors.textMuted}
                      />
                      <TouchableOpacity
                        style={[styles.placeBidBtn, bidding && styles.placeBidBtnDisabled]}
                        onPress={handlePlaceBid}
                        disabled={bidding}
                      >
                        <LinearGradient
                          colors={
                            bidding ? [colors.border, colors.border] : [colors.accent, colors.accentDark]
                          }
                          style={styles.placeBidGradient}
                        >
                          <Text style={styles.placeBidText}>
                            {bidding ? 'Placing...' : 'Place Bid'}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </LinearGradient>
          </View>
        </View>
      </Modal>
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
    paddingBottom: spacing.xxl,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionAccent: {
    width: 3,
    height: 16,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textPrimary,
    marginRight: spacing.xs,
  },
  liveText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  auctionCard: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  auctionCardUrgent: {
    borderColor: colors.warning,
  },
  auctionCardWinning: {
    borderColor: colors.success,
  },
  auctionGradient: {
    padding: spacing.md,
  },
  auctionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  auctionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  timerBadgeActive: {
    backgroundColor: colors.accent,
  },
  timerBadgeUrgent: {
    backgroundColor: colors.warning,
  },
  timerText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
  timerTextActive: {
    color: colors.textPrimary,
  },
  timerTextUrgent: {
    color: colors.background,
  },
  auctionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  auctionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  auctionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bidLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bidAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.gold,
  },
  winningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successGlow,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  winningText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
  bidNowButton: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  bidNowGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bidNowText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
    padding: spacing.sm,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    paddingRight: 40,
  },
  modalDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningGlow,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  modalTimerText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.warning,
    marginLeft: spacing.md,
  },
  modalBidInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalBidLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  modalBidValue: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.gold,
  },
  modalLeader: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  quickBids: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  quickBidBtn: {
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickBidText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  bidInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dollarSign: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  bidInput: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeBidBtn: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  placeBidBtnDisabled: {
    opacity: 0.6,
  },
  placeBidGradient: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  placeBidText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
