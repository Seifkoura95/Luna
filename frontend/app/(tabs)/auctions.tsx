import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { VideoBackground } from '../../src/components/VideoBackground';
import { PageHeader } from '../../src/components/PageHeader';
import { GlassCard } from '../../src/components/GlassCard';
import { CardSkeleton, ListSkeleton } from '../../src/components/Shimmer';
import { AnimatedCounter, SpringCounter } from '../../src/components/AnimatedCounter';
import { useFocusEffect } from 'expo-router';

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
  const scrollRef = useRef<ScrollView>(null);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [bidHistory, setBidHistory] = useState<any[]>([]);
  const [bidAmount, setBidAmount] = useState('');
  const [maxBidAmount, setMaxBidAmount] = useState('');
  const [showMaxBid, setShowMaxBid] = useState(false);
  const [notifyOutbid, setNotifyOutbid] = useState(true);
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({});
  const [isPlacingBid, setIsPlacingBid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Auto scroll to top when tab gains focus
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getAuctions();
      setAuctions(data || []);
    } catch (e) {
      console.error('Failed to fetch auctions:', e);
    } finally {
      setIsLoading(false);
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
      const result = await api.placeBid(selectedAuction.id, amount, maxBid, notifyOutbid);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert('Bid Placed!', notifyOutbid 
        ? 'You are now the highest bidder! We\'ll notify you if someone outbids you.' 
        : 'You are now the highest bidder!');
      
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
      <VideoBackground intensity={30} tint="dark" overlayOpacity={0.4} />
      
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Consistent Header - No Points */}
        <PageHeader 
          title="AUCTIONS" 
          description="Bid on exclusive VIP booths & experiences"
          showPoints={false} 
        />

        {/* Active Auctions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIVE NOW</Text>
          
          {/* Loading Skeletons */}
          {isLoading && (
            <View style={styles.skeletonsContainer}>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          )}
          
          {/* Auction Cards */}
          {!isLoading && auctions.filter(a => a.status === 'active').map(renderAuctionCard)}
          
          {!isLoading && auctions.filter(a => a.status === 'active').length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="flash-off" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No active auctions</Text>
              <Text style={styles.emptySubtitle}>Check back soon!</Text>
            </View>
          )}
        </View>

        {/* Upcoming Auctions */}
        {!isLoading && auctions.filter(a => a.status === 'upcoming').length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COMING SOON</Text>
            {auctions.filter(a => a.status === 'upcoming').map(renderAuctionCard)}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Auction Detail Modal - Optimized Layout */}
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
                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  {/* Compact Image + Info Row */}
                  <View style={styles.compactInfoRow}>
                    <Image source={{ uri: selectedAuction.image_url }} style={styles.compactImage} />
                    <View style={styles.compactDetails}>
                      <Text style={styles.compactVenue}>{selectedAuction.venue_name}</Text>
                      <Text style={styles.compactTitle} numberOfLines={2}>{selectedAuction.title}</Text>
                      <View style={styles.compactTimer}>
                        <Ionicons name="time" size={14} color={colors.accent} />
                        <Text style={styles.compactTimerText}>
                          {selectedAuction.status === 'active' 
                            ? timeLeft[selectedAuction.id] || 'Loading...'
                            : selectedAuction.status.toUpperCase()
                          }
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Current Bid - Compact */}
                  <View style={styles.compactBidCard}>
                    <View style={styles.compactBidLeft}>
                      <Text style={styles.compactBidLabel}>
                        {selectedAuction.current_bid > 0 ? 'CURRENT BID' : 'STARTING'}
                      </Text>
                      <Text style={styles.compactBidValue}>
                        ${selectedAuction.current_bid > 0 ? selectedAuction.current_bid : selectedAuction.starting_bid}
                      </Text>
                    </View>
                    {selectedAuction.winner_name && (
                      <View style={[styles.winningBadge, isWinning(selectedAuction) && styles.winningBadgeActive]}>
                        <Ionicons 
                          name={isWinning(selectedAuction) ? 'trophy' : 'person'} 
                          size={12} 
                          color={isWinning(selectedAuction) ? colors.gold : colors.textMuted} 
                        />
                        <Text style={[
                          styles.winningText,
                          isWinning(selectedAuction) && styles.winningTextActive
                        ]}>
                          {isWinning(selectedAuction) ? 'Winning!' : selectedAuction.winner_name}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Features - Horizontal Scroll */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featuresScroll}>
                    {selectedAuction.features?.map((feature, index) => (
                      <View key={index} style={styles.featureChip}>
                        <Ionicons name="checkmark" size={12} color={colors.success} />
                        <Text style={styles.featureChipText}>{feature}</Text>
                      </View>
                    ))}
                  </ScrollView>

                  {/* Bid Controls */}
                  {selectedAuction.status === 'active' && (
                    <View style={styles.bidSection}>
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
                      <View style={styles.bidInputRow}>
                        <Text style={styles.bidInputPrefix}>$</Text>
                        <TextInput
                          style={styles.bidInput}
                          value={bidAmount}
                          onChangeText={setBidAmount}
                          keyboardType="numeric"
                          placeholder="Enter bid amount"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>

                      {/* Notification Opt-in */}
                      <TouchableOpacity
                        style={styles.notifyToggle}
                        onPress={() => setNotifyOutbid(!notifyOutbid)}
                      >
                        <Ionicons 
                          name={notifyOutbid ? 'notifications' : 'notifications-off-outline'} 
                          size={18} 
                          color={notifyOutbid ? colors.accent : colors.textMuted} 
                        />
                        <Text style={[styles.notifyToggleText, notifyOutbid && styles.notifyToggleTextActive]}>
                          Notify me if outbid
                        </Text>
                        <View style={[styles.toggleSwitch, notifyOutbid && styles.toggleSwitchActive]}>
                          <View style={[styles.toggleKnob, notifyOutbid && styles.toggleKnobActive]} />
                        </View>
                      </TouchableOpacity>

                      {/* Max Bid Toggle */}
                      <TouchableOpacity
                        style={styles.maxBidToggle}
                        onPress={() => setShowMaxBid(!showMaxBid)}
                      >
                        <Ionicons 
                          name={showMaxBid ? 'checkbox' : 'square-outline'} 
                          size={18} 
                          color={showMaxBid ? colors.accent : colors.textMuted} 
                        />
                        <Text style={[styles.maxBidToggleText, showMaxBid && { color: colors.textPrimary }]}>
                          Set auto-bid maximum
                        </Text>
                      </TouchableOpacity>

                      {showMaxBid && (
                        <View style={styles.maxBidInputRow}>
                          <Text style={styles.bidInputPrefix}>$</Text>
                          <TextInput
                            style={styles.bidInput}
                            value={maxBidAmount}
                            onChangeText={setMaxBidAmount}
                            keyboardType="numeric"
                            placeholder="Max auto-bid"
                            placeholderTextColor={colors.textMuted}
                          />
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
                              <Ionicons name="flash" size={18} color={colors.textPrimary} />
                              <Text style={styles.placeBidText}>
                                {bidAmount ? `Bid $${bidAmount}` : 'Enter Amount'}
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>

                      {/* Deposit Info - Compact */}
                      <View style={styles.depositInfo}>
                        <Ionicons name="shield-checkmark" size={14} color={colors.textMuted} />
                        <Text style={styles.depositText}>
                          ${selectedAuction.deposit_required} deposit • Min +${selectedAuction.min_increment}
                        </Text>
                      </View>
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
  skeletonsContainer: {
    gap: spacing.md,
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
    maxHeight: '85%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    overflow: 'hidden',
  },
  modalGradient: {
    paddingBottom: spacing.md,
  },
  modalScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Compact Layout Styles
  compactInfoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  compactImage: {
    width: 100,
    height: 100,
    borderRadius: radius.lg,
  },
  compactDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  compactVenue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 1,
    marginBottom: 4,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  compactTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactTimerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  compactBidCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  compactBidLeft: {},
  compactBidLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  compactBidValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  winningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  winningBadgeActive: {
    backgroundColor: colors.gold + '30',
  },
  winningText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  winningTextActive: {
    color: colors.gold,
  },
  featuresScroll: {
    marginBottom: spacing.md,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  featureChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  bidSection: {
    backgroundColor: '#0A0A0A',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  bidInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  maxBidInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent + '50',
  },
  notifyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  notifyToggleText: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
  },
  notifyToggleTextActive: {
    color: colors.textPrimary,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: colors.accent,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textMuted,
  },
  toggleKnobActive: {
    backgroundColor: colors.textPrimary,
    alignSelf: 'flex-end',
  },
  depositInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  depositText: {
    fontSize: 11,
    color: colors.textMuted,
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
