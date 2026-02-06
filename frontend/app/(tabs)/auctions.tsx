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
  Switch,
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

export default function AuctionsScreen() {
  const user = useAuthStore((state) => state.user);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [timeLefts, setTimeLefts] = useState<Record<string, string>>({});
  const [notifyOnOutbid, setNotifyOnOutbid] = useState(true);
  const [userBids, setUserBids] = useState<Record<string, number>>({});

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
    // Refresh every 3 seconds for real-time updates
    const interval = setInterval(fetchAuctions, 3000);
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
            if (secsLeft < 60) {
              newTimeLefts[auction.id] = `${secs}s`;
            } else {
              newTimeLefts[auction.id] = `${mins}:${secs.toString().padStart(2, '0')}`;
            }
          }
        }
      });
      setTimeLefts(newTimeLefts);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [auctions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAuctions();
    setRefreshing(false);
  };

  const openBidModal = (auction: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedAuction(auction);
    const nextBid = auction.current_bid + auction.bid_increment;
    setBidAmount(nextBid.toString());
  };

  const closeBidModal = () => {
    setSelectedAuction(null);
    setBidAmount('');
  };

  const handleQuickBid = (amount: number) => {
    setBidAmount(amount.toString());
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  };

  const handleInstantWin = async () => {
    if (!selectedAuction) return;

    Alert.alert(
      'Instant Win',
      `Win this auction now for $${selectedAuction.instant_win_price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Win Now',
          style: 'default',
          onPress: () => placeBid(selectedAuction.instant_win_price),
        },
      ]
    );
  };

  const placeBid = async (customAmount?: number) => {
    if (!selectedAuction) return;

    const amount = customAmount || parseFloat(bidAmount);
    if (isNaN(amount) || amount <= selectedAuction.current_bid) {
      Alert.alert(
        'Invalid Bid',
        `Your bid must be higher than $${selectedAuction.current_bid}`
      );
      return;
    }

    setBidding(true);
    try {
      await api.placeBid(selectedAuction.id, amount);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Track user's bids
      setUserBids((prev) => ({ ...prev, [selectedAuction.id]: amount }));

      Alert.alert(
        '🎉 Bid Placed!',
        `Your bid of $${amount} has been placed successfully!${
          notifyOnOutbid ? '\n\nYou will be notified if someone outbids you.' : ''
        }`,
        [{ text: 'OK', onPress: closeBidModal }]
      );

      // Refresh auctions immediately
      fetchAuctions();
    } catch (e: any) {
      Alert.alert('Bid Failed', e.message || 'Please try again');
    } finally {
      setBidding(false);
    }
  };

  const isUserWinning = (auction: any) => {
    return auction.winner_id === user?.user_id;
  };

  const isUserOutbid = (auction: any) => {
    return (
      userBids[auction.id] &&
      userBids[auction.id] < auction.current_bid &&
      !isUserWinning(auction)
    );
  };

  const activeAuctions = auctions.filter((a) => a.status === 'active');
  const upcomingAuctions = auctions.filter((a) => a.status === 'upcoming');

  return (
    <View style={styles.container}>
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
        {/* Active Auctions */}
        {activeAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>LIVE NOW</Text>
              </View>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{activeAuctions.length} Active</Text>
              </View>
            </View>

            {activeAuctions.map((auction) => (
              <TouchableOpacity
                key={auction.id}
                style={[
                  styles.auctionCard,
                  isUserWinning(auction) && styles.auctionCardWinning,
                  isUserOutbid(auction) && styles.auctionCardOutbid,
                ]}
                onPress={() => openBidModal(auction)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={
                    isUserWinning(auction)
                      ? [colors.success + '20', colors.backgroundCard]
                      : isUserOutbid(auction)
                      ? [colors.error + '20', colors.backgroundCard]
                      : [colors.backgroundCard, colors.backgroundElevated]
                  }
                  style={styles.auctionGradient}
                >
                  {/* Status Indicators */}
                  {isUserWinning(auction) && (
                    <View style={styles.winningBadge}>
                      <Ionicons name="trophy" size={14} color={colors.success} />
                      <Text style={styles.winningText}>You're Winning!</Text>
                    </View>
                  )}
                  {isUserOutbid(auction) && (
                    <View style={styles.outbidBadge}>
                      <Ionicons name="alert-circle" size={14} color={colors.error} />
                      <Text style={styles.outbidText}>You've Been Outbid</Text>
                    </View>
                  )}

                  {/* Auction Header */}
                  <View style={styles.auctionHeader}>
                    <View style={styles.venueTag}>
                      <Ionicons name="location" size={12} color={colors.accent} />
                      <Text style={styles.venueText}>
                        {auction.venue_id.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.timeLeft,
                        differenceInSeconds(new Date(auction.end_time), new Date()) < 60 &&
                          styles.timeLeftUrgent,
                      ]}
                    >
                      <Ionicons
                        name="time"
                        size={14}
                        color={
                          differenceInSeconds(new Date(auction.end_time), new Date()) < 60
                            ? colors.error
                            : colors.warning
                        }
                      />
                      <Text
                        style={[
                          styles.timeLeftText,
                          differenceInSeconds(new Date(auction.end_time), new Date()) < 60 &&
                            styles.timeLeftTextUrgent,
                        ]}
                      >
                        {timeLefts[auction.id] || 'Calculating...'}
                      </Text>
                    </View>
                  </View>

                  {/* Auction Title */}
                  <Text style={styles.auctionTitle}>{auction.title}</Text>
                  <Text style={styles.auctionDescription} numberOfLines={2}>
                    {auction.description}
                  </Text>

                  {/* Bidding Section */}
                  <View style={styles.biddingSection}>
                    <View style={styles.currentBidContainer}>
                      <Text style={styles.currentBidLabel}>Current Bid</Text>
                      <Text style={styles.currentBidAmount}>
                        ${auction.current_bid || auction.reserve_price}
                      </Text>
                      {auction.winner_name && (
                        <Text style={styles.bidderName}>
                          by {auction.winner_name}
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.bidButton}
                      onPress={() => openBidModal(auction)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={[colors.accent, colors.accentDark]}
                        style={styles.bidButtonGradient}
                      >
                        <Ionicons name="flash" size={18} color={colors.textPrimary} />
                        <Text style={styles.bidButtonText}>Place Bid</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  {/* Instant Win Option */}
                  {auction.instant_win_price && (
                    <View style={styles.instantWinContainer}>
                      <Ionicons name="zap" size={14} color={colors.gold} />
                      <Text style={styles.instantWinText}>
                        Instant Win: ${auction.instant_win_price}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Upcoming Auctions */}
        {upcomingAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>STARTING SOON</Text>
              </View>
            </View>

            {upcomingAuctions.map((auction) => (
              <View key={auction.id} style={styles.upcomingCard}>
                <LinearGradient
                  colors={[colors.backgroundCard, colors.backgroundElevated]}
                  style={styles.auctionGradient}
                >
                  <View style={styles.upcomingBadge}>
                    <Ionicons name="hourglass-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.upcomingText}>{timeLefts[auction.id]}</Text>
                  </View>

                  <Text style={styles.auctionTitle}>{auction.title}</Text>
                  <Text style={styles.auctionDescription} numberOfLines={2}>
                    {auction.description}
                  </Text>

                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingLabel}>Starting Bid</Text>
                    <Text style={styles.upcomingAmount}>${auction.reserve_price}</Text>
                  </View>
                </LinearGradient>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {auctions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="flash-off" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Active Auctions</Text>
            <Text style={styles.emptyText}>Check back soon for exclusive deals!</Text>
          </View>
        )}
      </ScrollView>

      {/* Bid Modal */}
      <Modal
        visible={!!selectedAuction}
        transparent
        animationType="slide"
        onRequestClose={closeBidModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Place Your Bid</Text>
                <TouchableOpacity style={styles.closeButton} onPress={closeBidModal}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {selectedAuction && (
                <>
                  {/* Auction Info */}
                  <View style={styles.modalAuctionInfo}>
                    <Text style={styles.modalAuctionTitle}>{selectedAuction.title}</Text>
                    <View style={styles.modalTimeLeft}>
                      <Ionicons name="time" size={16} color={colors.warning} />
                      <Text style={styles.modalTimeText}>
                        {timeLefts[selectedAuction.id]}
                      </Text>
                    </View>
                  </View>

                  {/* Current Bid */}
                  <View style={styles.currentBidCard}>
                    <Text style={styles.currentBidCardLabel}>Current Bid</Text>
                    <Text style={styles.currentBidCardAmount}>
                      ${selectedAuction.current_bid || selectedAuction.reserve_price}
                    </Text>
                    {selectedAuction.winner_name && (
                      <Text style={styles.currentBidCardBidder}>
                        by {selectedAuction.winner_name}
                      </Text>
                    )}
                  </View>

                  {/* Bid Input */}
                  <View style={styles.bidInputSection}>
                    <Text style={styles.bidInputLabel}>YOUR BID</Text>
                    <View style={styles.bidInputContainer}>
                      <Text style={styles.bidInputSymbol}>$</Text>
                      <TextInput
                        style={styles.bidInput}
                        value={bidAmount}
                        onChangeText={setBidAmount}
                        keyboardType="numeric"
                        placeholder="Enter amount"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  {/* Quick Bid Buttons */}
                  <View style={styles.quickBidSection}>
                    <Text style={styles.quickBidLabel}>QUICK BID</Text>
                    <View style={styles.quickBidButtons}>
                      {[
                        selectedAuction.current_bid + selectedAuction.bid_increment,
                        selectedAuction.current_bid + selectedAuction.bid_increment * 2,
                        selectedAuction.current_bid + selectedAuction.bid_increment * 5,
                      ].map((amount) => (
                        <TouchableOpacity
                          key={amount}
                          style={styles.quickBidButton}
                          onPress={() => handleQuickBid(amount)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickBidButtonText}>${amount}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Notification Toggle */}
                  <View style={styles.notificationSection}>
                    <View style={styles.notificationInfo}>
                      <Ionicons name="notifications" size={20} color={colors.accent} />
                      <Text style={styles.notificationText}>Notify me if outbid</Text>
                    </View>
                    <Switch
                      value={notifyOnOutbid}
                      onValueChange={setNotifyOnOutbid}
                      trackColor={{ false: colors.border, true: colors.accent + '60' }}
                      thumbColor={notifyOnOutbid ? colors.accent : colors.textMuted}
                    />
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.bidActionButton]}
                      onPress={() => placeBid()}
                      disabled={bidding}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={[colors.accent, colors.accentDark]}
                        style={styles.actionButtonGradient}
                      >
                        <Ionicons name="flash" size={20} color={colors.textPrimary} />
                        <Text style={styles.actionButtonText}>
                          {bidding ? 'Placing...' : 'Place Bid'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    {selectedAuction.instant_win_price && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.instantWinActionButton]}
                        onPress={handleInstantWin}
                        disabled={bidding}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={[colors.gold, colors.gold + 'CC']}
                          style={styles.actionButtonGradient}
                        >
                          <Ionicons name="zap" size={20} color={colors.background} />
                          <Text style={[styles.actionButtonText, { color: colors.background }]}>
                            Win Now - ${selectedAuction.instant_win_price}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
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
    marginTop: spacing.lg,
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
    backgroundColor: colors.error + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.error,
    marginRight: spacing.xs,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.error,
  },
  auctionCard: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  auctionCardWinning: {
    borderColor: colors.success,
    borderWidth: 2,
  },
  auctionCardOutbid: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  auctionGradient: {
    padding: spacing.md,
  },
  winningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  winningText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
    marginLeft: spacing.xs,
  },
  outbidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.error + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  outbidText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.error,
    marginLeft: spacing.xs,
  },
  auctionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  venueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  venueText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    marginLeft: spacing.xs,
    letterSpacing: 1,
  },
  timeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  timeLeftUrgent: {
    backgroundColor: colors.error + '20',
  },
  timeLeftText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
    marginLeft: spacing.xs,
  },
  timeLeftTextUrgent: {
    color: colors.error,
  },
  auctionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  auctionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  biddingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  currentBidContainer: {
    flex: 1,
  },
  currentBidLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  currentBidAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  bidderName: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  bidButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bidButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  bidButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  instantWinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  instantWinText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
    marginLeft: spacing.xs,
  },
  upcomingCard: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  upcomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  upcomingText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  upcomingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  upcomingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  upcomingAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl + spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAuctionInfo: {
    marginBottom: spacing.lg,
  },
  modalAuctionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalTimeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning,
    marginLeft: spacing.xs,
  },
  currentBidCard: {
    backgroundColor: colors.backgroundElevated,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  currentBidCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  currentBidCardAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  currentBidCardBidder: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  bidInputSection: {
    marginBottom: spacing.lg,
  },
  bidInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  bidInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.accent,
    paddingHorizontal: spacing.md,
  },
  bidInputSymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.accent,
    marginRight: spacing.xs,
  },
  bidInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  quickBidSection: {
    marginBottom: spacing.lg,
  },
  quickBidLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  quickBidButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickBidButton: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickBidButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  notificationSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  notificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  modalActions: {
    gap: spacing.sm,
  },
  actionButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bidActionButton: {},
  instantWinActionButton: {},
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
});
