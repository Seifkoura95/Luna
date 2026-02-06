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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { differenceInSeconds } from 'date-fns';
import { StarfieldBackground } from '../../src/components/StarfieldBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function AuctionsScreen() {
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
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

  const placeBid = async (amount: number) => {
    if (!selectedAuction) return;

    setBidding(true);
    try {
      await api.placeBid(selectedAuction.id, amount);
      
      if (notifyOnOutbid) {
        await api.subscribeToAuction(selectedAuction.id, true);
      }

      setUserBids((prev) => ({ ...prev, [selectedAuction.id]: amount }));
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert('Bid Placed!', `Your bid of $${amount} has been placed.`);
      setSelectedAuction(null);
      setBidAmount('');
      fetchAuctions();
    } catch (e: any) {
      Alert.alert('Bid Failed', e.message || 'Could not place bid');
    } finally {
      setBidding(false);
    }
  };

  const handleBid = () => {
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= selectedAuction.current_bid) {
      Alert.alert('Invalid Bid', `Your bid must be higher than $${selectedAuction.current_bid}`);
      return;
    }
    placeBid(amount);
  };

  const handleQuickBid = (increment: number) => {
    const newBid = selectedAuction.current_bid + increment;
    setBidAmount(newBid.toString());
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  };

  const openBidModal = (auction: any) => {
    setSelectedAuction(auction);
    setBidAmount((auction.current_bid + auction.min_increment).toString());
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const isUserWinning = (auction: any) => {
    return auction.highest_bidder_id === user?.user_id;
  };

  const activeAuctions = auctions.filter((a) => a.status === 'active');
  const upcomingAuctions = auctions.filter((a) => a.status === 'upcoming');

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={60} shootingStarCount={2} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View>
          <Text style={styles.headerTitle}>LIVE AUCTIONS</Text>
          <View style={styles.headerUnderline} />
        </View>
        <View style={styles.pointsBadge}>
          <Ionicons name="star" size={14} color={colors.gold} />
          <Text style={styles.pointsText}>{user?.points_balance || 0}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Active Auctions */}
        {activeAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.liveBadge}>
                <View style={styles.liveIndicator} />
                <Text style={styles.liveBadgeText}>LIVE NOW</Text>
              </View>
              <Text style={styles.sectionCount}>{activeAuctions.length} active</Text>
            </View>

            {activeAuctions.map((auction) => (
              <TouchableOpacity
                key={auction.id}
                style={[styles.auctionCard, isUserWinning(auction) && styles.winningCard]}
                onPress={() => openBidModal(auction)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isUserWinning(auction) 
                    ? [colors.success + '20', colors.backgroundCard] 
                    : [colors.backgroundCard, colors.backgroundElevated]}
                  style={styles.cardGradient}
                >
                  {/* Image */}
                  <Image source={{ uri: auction.image_url }} style={styles.auctionImage} />

                  {/* Content */}
                  <View style={styles.auctionContent}>
                    <View style={styles.auctionHeader}>
                      <Text style={styles.auctionTitle} numberOfLines={1}>{auction.title}</Text>
                      {isUserWinning(auction) && (
                        <View style={styles.winningBadge}>
                          <Ionicons name="trophy" size={12} color={colors.success} />
                          <Text style={styles.winningText}>WINNING</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.auctionVenue}>{auction.venue_name}</Text>

                    <View style={styles.bidInfo}>
                      <View>
                        <Text style={styles.bidLabel}>Current Bid</Text>
                        <Text style={styles.bidAmount}>${auction.current_bid}</Text>
                      </View>
                      <View style={styles.timerContainer}>
                        <Ionicons 
                          name="time" 
                          size={16} 
                          color={timeLefts[auction.id]?.includes('s') && !timeLefts[auction.id]?.includes('m') 
                            ? colors.error 
                            : colors.textSecondary} 
                        />
                        <Text style={[
                          styles.timerText,
                          timeLefts[auction.id]?.includes('s') && !timeLefts[auction.id]?.includes('m') 
                            && styles.timerUrgent
                        ]}>
                          {timeLefts[auction.id] || '--:--'}
                        </Text>
                      </View>
                    </View>

                    {/* Bid Button */}
                    <TouchableOpacity
                      style={styles.bidButton}
                      onPress={() => openBidModal(auction)}
                    >
                      <LinearGradient
                        colors={[colors.accent, colors.accentDark]}
                        style={styles.bidButtonGradient}
                      >
                        <Text style={styles.bidButtonText}>Place Bid</Text>
                        <Ionicons name="arrow-forward" size={16} color={colors.textPrimary} />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Upcoming Auctions */}
        {upcomingAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>COMING SOON</Text>
              <Text style={styles.sectionCount}>{upcomingAuctions.length} upcoming</Text>
            </View>

            {upcomingAuctions.map((auction) => (
              <View key={auction.id} style={styles.upcomingCard}>
                <Image source={{ uri: auction.image_url }} style={styles.upcomingImage} />
                <View style={styles.upcomingContent}>
                  <Text style={styles.upcomingTitle} numberOfLines={1}>{auction.title}</Text>
                  <Text style={styles.upcomingVenue}>{auction.venue_name}</Text>
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingBid}>Starting at ${auction.starting_bid}</Text>
                    <Text style={styles.upcomingTime}>{timeLefts[auction.id]}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {auctions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Active Auctions</Text>
            <Text style={styles.emptySubtitle}>Check back soon for exclusive VIP experiences</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bid Modal */}
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
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Place Your Bid</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedAuction(null)}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {selectedAuction && (
                <>
                  {/* Auction Info */}
                  <View style={styles.modalAuctionInfo}>
                    <Image source={{ uri: selectedAuction.image_url }} style={styles.modalImage} />
                    <View style={styles.modalAuctionDetails}>
                      <Text style={styles.modalAuctionTitle}>{selectedAuction.title}</Text>
                      <Text style={styles.modalVenue}>{selectedAuction.venue_name}</Text>
                      <View style={styles.modalBidRow}>
                        <Text style={styles.modalCurrentLabel}>Current Bid:</Text>
                        <Text style={styles.modalCurrentBid}>${selectedAuction.current_bid}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Quick Bid Buttons */}
                  <View style={styles.quickBidRow}>
                    {[10, 25, 50, 100].map((inc) => (
                      <TouchableOpacity
                        key={inc}
                        style={styles.quickBidButton}
                        onPress={() => handleQuickBid(inc)}
                      >
                        <Text style={styles.quickBidText}>+${inc}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Bid Input */}
                  <View style={styles.bidInputContainer}>
                    <Text style={styles.bidInputLabel}>YOUR BID</Text>
                    <View style={styles.bidInputWrapper}>
                      <Text style={styles.dollarSign}>$</Text>
                      <TextInput
                        style={styles.bidInput}
                        value={bidAmount}
                        onChangeText={setBidAmount}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  {/* Notify Toggle */}
                  <View style={styles.notifyRow}>
                    <View>
                      <Text style={styles.notifyLabel}>Notify if outbid</Text>
                      <Text style={styles.notifyDesc}>Get alerts when someone outbids you</Text>
                    </View>
                    <Switch
                      value={notifyOnOutbid}
                      onValueChange={setNotifyOnOutbid}
                      trackColor={{ false: colors.backgroundElevated, true: colors.accent + '60' }}
                      thumbColor={notifyOnOutbid ? colors.accent : colors.textMuted}
                    />
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.placeBidButton]}
                      onPress={handleBid}
                      disabled={bidding}
                    >
                      <LinearGradient
                        colors={bidding ? ['#333', '#222'] : [colors.accent, colors.accentDark]}
                        style={styles.actionButtonGradient}
                      >
                        <Ionicons name="flash" size={20} color={colors.textPrimary} />
                        <Text style={styles.actionButtonText}>
                          {bidding ? 'Placing Bid...' : `Bid $${bidAmount}`}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
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
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  headerUnderline: {
    width: 40,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: spacing.xs,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldGlow,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: 6,
  },
  pointsText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: 8,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.error,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  sectionCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  auctionCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  winningCard: {
    borderColor: colors.success + '60',
  },
  cardGradient: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  auctionImage: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
  },
  auctionContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  auctionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auctionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  winningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    gap: 4,
  },
  winningText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
  },
  auctionVenue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bidInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  bidLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bidAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.gold,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  timerUrgent: {
    color: colors.error,
  },
  bidButton: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bidButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 6,
  },
  bidButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  upcomingCard: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  upcomingImage: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
  },
  upcomingContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  upcomingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  upcomingVenue: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  upcomingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  upcomingBid: {
    fontSize: 12,
    color: colors.gold,
    fontWeight: '600',
  },
  upcomingTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
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
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  modalImage: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
  },
  modalAuctionDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  modalAuctionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalVenue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalBidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  modalCurrentLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  modalCurrentBid: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.gold,
  },
  quickBidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  quickBidButton: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickBidText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bidInputContainer: {
    marginBottom: spacing.lg,
  },
  bidInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  bidInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dollarSign: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  bidInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    paddingVertical: spacing.md,
    marginLeft: spacing.sm,
  },
  notifyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
  },
  notifyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  notifyDesc: {
    fontSize: 12,
    color: colors.textMuted,
  },
  modalActions: {
    gap: spacing.md,
  },
  actionButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  placeBidButton: {},
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
