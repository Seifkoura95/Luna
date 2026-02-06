import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarfieldBackground } from '../../src/components/StarfieldBackground';
import { PageHeader } from '../../src/components/PageHeader';

const { width } = Dimensions.get('window');

interface Auction {
  id: string;
  title: string;
  description: string;
  venue_id: string;
  venue_name: string;
  auction_type: string;
  starting_bid: number;
  current_bid: number;
  min_increment: number;
  max_bid_limit: number;
  deposit_required: number;
  deposit_rules: string;
  winner_id: string | null;
  winner_name: string | null;
  start_time: string;
  end_time: string;
  status: string;
  image_url: string;
  features: string[];
}

export default function AuctionsScreen() {
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [bidHistory, setBidHistory] = useState<any[]>([]);
  const [bidAmount, setBidAmount] = useState('');
  const [maxBidAmount, setMaxBidAmount] = useState('');
  const [showMaxBid, setShowMaxBid] = useState(false);
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({});
  const [isPlacingBid, setIsPlacingBid] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getAuctions();
      setAuctions(data || []);
    } catch (e) {
      console.error('Failed to fetch auctions:', e);
    }
  }, []);

  const fetchAuctionDetail = async (auctionId: string) => {
    try {
      const data = await api.getAuctionDetail(auctionId);
      setSelectedAuction(data);
      setBidHistory(data.bid_history || []);
      setBidAmount(String(data.current_bid + data.min_increment));
    } catch (e) {
      console.error('Failed to fetch auction detail:', e);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Update timers every second
    const interval = setInterval(() => {
      const newTimeLeft: Record<string, string> = {};
      auctions.forEach((auction) => {
        newTimeLeft[auction.id] = calculateTimeLeft(auction.end_time);
      });
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(interval);
  }, [auctions.length]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateTimeLeft = (endTime: string): string => {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;

    if (diff <= 0) return 'ENDED';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleQuickBid = (increment: number) => {
    const newBid = (selectedAuction?.current_bid || 0) + increment;
    setBidAmount(String(newBid));
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  };

  const handlePlaceBid = async () => {
    if (!selectedAuction || isPlacingBid) return;

    const amount = parseFloat(bidAmount);
    const minBid = selectedAuction.current_bid + selectedAuction.min_increment;
    
    if (isNaN(amount) || amount < minBid) {
      Alert.alert('Invalid Bid', `Minimum bid is $${minBid}`);
      return;
    }

    if (amount > selectedAuction.max_bid_limit) {
      Alert.alert('Bid Too High', `Maximum bid limit is $${selectedAuction.max_bid_limit}`);
      return;
    }

    setIsPlacingBid(true);
    try {
      const maxBid = showMaxBid && maxBidAmount ? parseFloat(maxBidAmount) : undefined;
      const result = await api.placeBid(selectedAuction.id, amount, maxBid);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert('Bid Placed!', 'You are now the highest bidder!');
      
      // Refresh auction data
      await fetchAuctionDetail(selectedAuction.id);
      await fetchData();
    } catch (e: any) {
      Alert.alert('Bid Failed', e.message || 'Failed to place bid');
    } finally {
      setIsPlacingBid(false);
    }
  };

  const openAuctionDetail = (auction: Auction) => {
    setSelectedAuction(auction);
    setBidAmount(String(auction.current_bid + auction.min_increment));
    fetchAuctionDetail(auction.id);
  };

  const isWinning = (auction: Auction) => auction.winner_id === user?.user_id;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return colors.success;
      case 'upcoming': return colors.accent;
      case 'ended': return colors.textMuted;
      default: return colors.textMuted;
    }
  };

  const renderAuctionCard = (auction: Auction) => (
    <TouchableOpacity
      key={auction.id}
      style={styles.auctionCard}
      onPress={() => openAuctionDetail(auction)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: auction.image_url }} style={styles.auctionImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.95)']}
        style={styles.auctionOverlay}
      >
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(auction.status) + '30' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(auction.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(auction.status) }]}>
            {auction.status.toUpperCase()}
          </Text>
        </View>

        {/* Timer */}
        {auction.status === 'active' && (
          <View style={styles.timerBadge}>
            <Ionicons name="time" size={14} color={colors.accent} />
            <Text style={styles.timerText}>{timeLeft[auction.id] || 'Loading...'}</Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.auctionContent}>
          <Text style={styles.auctionVenue}>{auction.venue_name}</Text>
          <Text style={styles.auctionTitle} numberOfLines={2}>{auction.title}</Text>
          
          <View style={styles.bidSection}>
            <View style={styles.bidInfo}>
              <Text style={styles.bidLabel}>
                {auction.current_bid > 0 ? 'CURRENT BID' : 'STARTING BID'}
              </Text>
              <Text style={styles.bidAmount}>
                ${auction.current_bid > 0 ? auction.current_bid : auction.starting_bid}
              </Text>
            </View>
            
            {isWinning(auction) && (
              <View style={styles.winningBadge}>
                <Ionicons name="trophy" size={14} color={colors.gold} />
                <Text style={styles.winningText}>WINNING</Text>
              </View>
            )}
          </View>

          {/* Features Preview */}
          <View style={styles.featuresRow}>
            {auction.features?.slice(0, 3).map((feature, index) => (
              <View key={index} style={styles.featureChip}>
                <Text style={styles.featureChipText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StarfieldBackground starCount={50} shootingStarCount={2} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <RotatingMoon size={60} rotationDuration={30000} />
          <Text style={styles.headerTitle}>LIVE AUCTIONS</Text>
          <View style={styles.headerUnderline} />
          <View style={styles.pointsBadge}>
            <FierySun size={18} />
            <Text style={styles.pointsText}>{user?.points_balance?.toLocaleString() || 0} pts</Text>
          </View>
        </View>

        {/* Active Auctions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIVE NOW</Text>
          {auctions.filter(a => a.status === 'active').map(renderAuctionCard)}
          
          {auctions.filter(a => a.status === 'active').length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="flash-off" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No active auctions</Text>
              <Text style={styles.emptySubtitle}>Check back soon!</Text>
            </View>
          )}
        </View>

        {/* Upcoming Auctions */}
        {auctions.filter(a => a.status === 'upcoming').length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COMING SOON</Text>
            {auctions.filter(a => a.status === 'upcoming').map(renderAuctionCard)}
          </View>
        )}

        <View style={{ height: 100 }} />
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
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Auction Detail</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedAuction(null)}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {selectedAuction && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Auction Image */}
                  <View style={styles.modalImageContainer}>
                    <Image source={{ uri: selectedAuction.image_url }} style={styles.modalImage} />
                    <LinearGradient
                      colors={['transparent', colors.backgroundCard]}
                      style={styles.modalImageOverlay}
                    />
                    {/* Timer Overlay */}
                    <View style={styles.timerOverlay}>
                      <Ionicons name="time" size={18} color={colors.accent} />
                      <Text style={styles.timerOverlayText}>
                        {selectedAuction.status === 'active' 
                          ? timeLeft[selectedAuction.id] || 'Loading...'
                          : selectedAuction.status.toUpperCase()
                        }
                      </Text>
                    </View>
                  </View>

                  {/* Auction Info */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalVenue}>{selectedAuction.venue_name}</Text>
                    <Text style={styles.modalAuctionTitle}>{selectedAuction.title}</Text>
                    <Text style={styles.modalDescription}>{selectedAuction.description}</Text>
                  </View>

                  {/* Features */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>INCLUDED</Text>
                    <View style={styles.modalFeaturesRow}>
                      {selectedAuction.features?.map((feature, index) => (
                        <View key={index} style={styles.modalFeatureChip}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                          <Text style={styles.modalFeatureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Current Bid Section */}
                  <View style={styles.modalSection}>
                    <View style={styles.currentBidCard}>
                      <View style={styles.currentBidInfo}>
                        <Text style={styles.currentBidLabel}>
                          {selectedAuction.current_bid > 0 ? 'CURRENT BID' : 'STARTING BID'}
                        </Text>
                        <Text style={styles.currentBidValue}>
                          ${selectedAuction.current_bid > 0 ? selectedAuction.current_bid : selectedAuction.starting_bid}
                        </Text>
                        {selectedAuction.winner_name && (
                          <Text style={styles.currentBidder}>
                            {isWinning(selectedAuction) ? '🏆 You are winning!' : `By: ${selectedAuction.winner_name}`}
                          </Text>
                        )}
                      </View>
                      <View style={styles.bidRules}>
                        <Text style={styles.bidRulesText}>
                          Min increment: ${selectedAuction.min_increment}
                        </Text>
                        <Text style={styles.bidRulesText}>
                          Max bid: ${selectedAuction.max_bid_limit}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Deposit Rules */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>DEPOSIT RULES</Text>
                    <View style={styles.depositCard}>
                      <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
                      <View style={styles.depositInfo}>
                        <Text style={styles.depositAmount}>
                          ${selectedAuction.deposit_required} deposit required
                        </Text>
                        <Text style={styles.depositRules}>{selectedAuction.deposit_rules}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Bid Controls */}
                  {selectedAuction.status === 'active' && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>PLACE YOUR BID</Text>
                      
                      {/* Quick Bid Buttons */}
                      <View style={styles.quickBidRow}>
                        {[10, 25, 50, 100].map((increment) => (
                          <TouchableOpacity
                            key={increment}
                            style={styles.quickBidButton}
                            onPress={() => handleQuickBid(increment)}
                          >
                            <Text style={styles.quickBidText}>+${increment}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Bid Input */}
                      <View style={styles.bidInputContainer}>
                        <Text style={styles.bidInputLabel}>YOUR BID</Text>
                        <View style={styles.bidInputRow}>
                          <Text style={styles.bidInputPrefix}>$</Text>
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

                      {/* Max Bid Toggle */}
                      <TouchableOpacity
                        style={styles.maxBidToggle}
                        onPress={() => setShowMaxBid(!showMaxBid)}
                      >
                        <Ionicons 
                          name={showMaxBid ? 'checkbox' : 'square-outline'} 
                          size={20} 
                          color={colors.accent} 
                        />
                        <Text style={styles.maxBidToggleText}>Set auto-bid maximum</Text>
                      </TouchableOpacity>

                      {showMaxBid && (
                        <View style={styles.bidInputContainer}>
                          <Text style={styles.bidInputLabel}>MAX AUTO-BID</Text>
                          <View style={styles.bidInputRow}>
                            <Text style={styles.bidInputPrefix}>$</Text>
                            <TextInput
                              style={styles.bidInput}
                              value={maxBidAmount}
                              onChangeText={setMaxBidAmount}
                              keyboardType="numeric"
                              placeholder="Auto-bid up to this amount"
                              placeholderTextColor={colors.textMuted}
                            />
                          </View>
                          <Text style={styles.maxBidHelp}>
                            We'll automatically increase your bid to stay ahead
                          </Text>
                        </View>
                      )}

                      {/* Place Bid Button */}
                      <TouchableOpacity
                        style={[styles.placeBidButton, isPlacingBid && styles.placeBidButtonDisabled]}
                        onPress={handlePlaceBid}
                        disabled={isPlacingBid}
                      >
                        <LinearGradient
                          colors={[colors.accent, colors.accentDark]}
                          style={styles.placeBidGradient}
                        >
                          {isPlacingBid ? (
                            <Text style={styles.placeBidText}>Placing Bid...</Text>
                          ) : (
                            <>
                              <Ionicons name="flash" size={20} color={colors.textPrimary} />
                              <Text style={styles.placeBidText}>Place Bid - ${bidAmount}</Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Won State */}
                  {selectedAuction.status === 'ended' && isWinning(selectedAuction) && (
                    <View style={styles.wonSection}>
                      <LinearGradient
                        colors={[colors.gold + '30', 'transparent']}
                        style={styles.wonGradient}
                      >
                        <Ionicons name="trophy" size={48} color={colors.gold} />
                        <Text style={styles.wonTitle}>🎉 You Won!</Text>
                        <Text style={styles.wonSubtitle}>
                          Winning bid: ${selectedAuction.current_bid}
                        </Text>
                        <TouchableOpacity style={styles.claimButton}>
                          <Text style={styles.claimButtonText}>Claim Your Prize</Text>
                        </TouchableOpacity>
                      </LinearGradient>
                    </View>
                  )}

                  {/* Bid History */}
                  {bidHistory.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>BID HISTORY</Text>
                      {bidHistory.slice(0, 5).map((bid, index) => (
                        <View key={bid.id || index} style={styles.bidHistoryItem}>
                          <View style={styles.bidHistoryInfo}>
                            <Text style={styles.bidHistoryUser}>
                              {bid.user_id === user?.user_id ? 'You' : bid.user_name || 'Anonymous'}
                            </Text>
                            <Text style={styles.bidHistoryTime}>
                              {new Date(bid.timestamp).toLocaleTimeString()}
                            </Text>
                          </View>
                          <Text style={styles.bidHistoryAmount}>${bid.amount}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={{ height: 40 }} />
                </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  moonImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 6,
  },
  headerUnderline: {
    width: 40,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
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
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  auctionCard: {
    height: 280,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  auctionImage: {
    width: '100%',
    height: '100%',
  },
  auctionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timerBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    gap: 6,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  auctionContent: {
    justifyContent: 'flex-end',
  },
  auctionVenue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  auctionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  bidSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  bidInfo: {},
  bidLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  bidAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  winningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldGlow,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 4,
  },
  winningText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 1,
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  featureChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  featureChipText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '95%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    overflow: 'hidden',
  },
  modalGradient: {
    paddingBottom: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
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
  modalImageContainer: {
    height: 200,
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  timerOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: 8,
  },
  timerOverlayText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
  },
  modalSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  modalVenue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  modalAuctionTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  modalFeaturesRow: {
    gap: spacing.sm,
  },
  modalFeatureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  modalFeatureText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  currentBidCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  currentBidInfo: {},
  currentBidLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  currentBidValue: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  currentBidder: {
    fontSize: 12,
    color: colors.success,
    marginTop: 4,
  },
  bidRules: {
    alignItems: 'flex-end',
  },
  bidRulesText: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  depositCard: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  depositInfo: {
    flex: 1,
  },
  depositAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  depositRules: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  quickBidRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickBidButton: {
    flex: 1,
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
    color: colors.accent,
  },
  bidInputContainer: {
    marginBottom: spacing.md,
  },
  bidInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  bidInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  bidInputPrefix: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  bidInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  maxBidToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  maxBidToggleText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  maxBidHelp: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  placeBidButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  placeBidButtonDisabled: {
    opacity: 0.6,
  },
  placeBidGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  placeBidText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  wonSection: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  wonGradient: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  wonTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.gold,
    marginTop: spacing.md,
  },
  wonSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  claimButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  claimButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  bidHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  bidHistoryInfo: {},
  bidHistoryUser: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  bidHistoryTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  bidHistoryAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
});
