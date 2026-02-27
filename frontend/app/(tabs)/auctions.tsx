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
import { AppBackground } from '../../src/components/AppBackground';
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
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />
      
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

      {/* Premium Auction Detail Modal */}
      <Modal
        visible={!!selectedAuction}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAuction(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.premiumModalContent}>
            {selectedAuction && (
              <>
                {/* Hero Image with Gradient Overlay */}
                <View style={styles.heroImageContainer}>
                  <Image 
                    source={{ uri: selectedAuction.image_url }} 
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)', colors.background]}
                    style={styles.heroGradient}
                  />
                  
                  {/* Close Button */}
                  <TouchableOpacity
                    style={styles.premiumCloseBtn}
                    onPress={() => setSelectedAuction(null)}
                  >
                    <View style={styles.premiumCloseBtnInner}>
                      <Ionicons name="close" size={20} color={colors.textPrimary} />
                    </View>
                  </TouchableOpacity>

                  {/* Timer Badge on Image */}
                  <View style={styles.timerBadgeOnImage}>
                    <Ionicons name="time" size={14} color={colors.accent} />
                    <Text style={styles.timerBadgeText}>
                      {selectedAuction.status === 'active' 
                        ? timeLeft[selectedAuction.id] || 'Loading...'
                        : selectedAuction.status.toUpperCase()
                      }
                    </Text>
                  </View>

                  {/* Title Overlay */}
                  <View style={styles.heroTitleOverlay}>
                    <Text style={styles.heroVenueName}>{selectedAuction.venue_name}</Text>
                    <Text style={styles.heroTitle}>{selectedAuction.title}</Text>
                  </View>
                </View>

                {/* Scrollable Content */}
                <ScrollView 
                  style={styles.premiumScrollView}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.premiumScrollContent}
                  bounces={true}
                >
                  {/* Features Row */}
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.premiumFeaturesRow}
                    contentContainerStyle={styles.premiumFeaturesContent}
                  >
                    {selectedAuction.features?.map((feature, index) => (
                      <View key={index} style={styles.premiumFeatureChip}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.premiumFeatureText}>{feature}</Text>
                      </View>
                    ))}
                  </ScrollView>

                  {/* Description */}
                  {selectedAuction.description && (
                    <Text style={styles.premiumDescription}>{selectedAuction.description}</Text>
                  )}

                  {/* Bid Stats Row */}
                  <View style={styles.bidStatsRow}>
                    <View style={styles.bidStatItem}>
                      <Text style={styles.bidStatLabel}>CURRENT BID</Text>
                      <Text style={styles.bidStatValue}>
                        ${selectedAuction.current_bid > 0 ? selectedAuction.current_bid : selectedAuction.starting_bid}
                      </Text>
                    </View>
                    <View style={styles.bidStatDivider} />
                    <View style={styles.bidStatItem}>
                      <Text style={styles.bidStatLabel}>MIN INCREMENT</Text>
                      <Text style={styles.bidStatValueSmall}>+${selectedAuction.min_increment}</Text>
                    </View>
                    <View style={styles.bidStatDivider} />
                    <View style={styles.bidStatItem}>
                      <Text style={styles.bidStatLabel}>DEPOSIT</Text>
                      <Text style={styles.bidStatValueSmall}>${selectedAuction.deposit_required}</Text>
                    </View>
                  </View>

                  {/* Leading Bidder */}
                  {selectedAuction.winner_name && (
                    <View style={[styles.leadingBidderCard, isWinning(selectedAuction) && styles.leadingBidderCardWinning]}>
                      <Ionicons 
                        name={isWinning(selectedAuction) ? 'trophy' : 'person-circle'} 
                        size={24} 
                        color={isWinning(selectedAuction) ? colors.gold : colors.textMuted} 
                      />
                      <Text style={[styles.leadingBidderText, isWinning(selectedAuction) && styles.leadingBidderTextWinning]}>
                        {isWinning(selectedAuction) ? "You're in the lead!" : `Leading: ${selectedAuction.winner_name}`}
                      </Text>
                    </View>
                  )}

                  {/* Bid Controls */}
                  {selectedAuction.status === 'active' && (
                    <>
                      {/* Your Bid Input */}
                      <View style={styles.premiumBidInputContainer}>
                        <Text style={styles.premiumInputLabel}>YOUR BID</Text>
                        <View style={styles.premiumBidInput}>
                          <Text style={styles.premiumCurrency}>$</Text>
                          <TextInput
                            style={styles.premiumBidField}
                            value={bidAmount}
                            onChangeText={setBidAmount}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>
                      </View>

                      {/* Quick Add Buttons */}
                      <View style={styles.premiumQuickBids}>
                        {[10, 25, 50, 100].map((increment) => (
                          <TouchableOpacity
                            key={increment}
                            style={styles.premiumQuickBidBtn}
                            onPress={() => handleQuickBid(increment)}
                          >
                            <Text style={styles.premiumQuickBidText}>+${increment}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Notify Toggle - Premium Card */}
                      <TouchableOpacity
                        style={[styles.premiumNotifyCard, notifyOutbid && styles.premiumNotifyCardActive]}
                        onPress={() => {
                          setNotifyOutbid(!notifyOutbid);
                          if (Platform.OS !== 'web') Haptics.selectionAsync();
                        }}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={notifyOutbid ? [colors.accent + '20', colors.accent + '10'] : ['transparent', 'transparent']}
                          style={styles.premiumNotifyGradient}
                        >
                          <View style={[styles.premiumNotifyIcon, notifyOutbid && styles.premiumNotifyIconActive]}>
                            <Ionicons 
                              name={notifyOutbid ? 'notifications' : 'notifications-outline'} 
                              size={22} 
                              color={notifyOutbid ? colors.accent : colors.textMuted} 
                            />
                          </View>
                          <View style={styles.premiumNotifyContent}>
                            <Text style={[styles.premiumNotifyTitle, notifyOutbid && styles.premiumNotifyTitleActive]}>
                              Notify if Outbid
                            </Text>
                            <Text style={styles.premiumNotifyDesc}>
                              Push notification when outbid
                            </Text>
                          </View>
                          <View style={[styles.premiumToggle, notifyOutbid && styles.premiumToggleActive]}>
                            <View style={[styles.premiumToggleKnob, notifyOutbid && styles.premiumToggleKnobActive]} />
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>

                      {/* Auto-Bid Option */}
                      <TouchableOpacity
                        style={styles.premiumAutoBidRow}
                        onPress={() => setShowMaxBid(!showMaxBid)}
                      >
                        <Ionicons 
                          name={showMaxBid ? 'checkbox' : 'square-outline'} 
                          size={22} 
                          color={showMaxBid ? colors.accent : colors.textMuted} 
                        />
                        <Text style={[styles.premiumAutoBidText, showMaxBid && styles.premiumAutoBidTextActive]}>
                          Enable auto-bid (set maximum)
                        </Text>
                      </TouchableOpacity>

                      {showMaxBid && (
                        <View style={styles.premiumMaxBidInput}>
                          <Text style={styles.premiumMaxBidHelper}>
                            We'll automatically bid for you up to this amount
                          </Text>
                          <View style={styles.premiumBidInput}>
                            <Text style={styles.premiumCurrency}>$</Text>
                            <TextInput
                              style={styles.premiumBidField}
                              value={maxBidAmount}
                              onChangeText={setMaxBidAmount}
                              keyboardType="numeric"
                              placeholder="Max amount"
                              placeholderTextColor={colors.textMuted}
                            />
                          </View>
                        </View>
                      )}

                      {/* Place Bid Button */}
                      <TouchableOpacity
                        style={[styles.premiumBidButton, isPlacingBid && styles.premiumBidButtonDisabled]}
                        onPress={handlePlaceBid}
                        disabled={isPlacingBid}
                        activeOpacity={0.9}
                      >
                        <LinearGradient
                          colors={[colors.accent, '#B81230']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.premiumBidButtonGradient}
                        >
                          {isPlacingBid ? (
                            <Text style={styles.premiumBidButtonText}>Placing Bid...</Text>
                          ) : (
                            <>
                              <Ionicons name="flash" size={22} color="#FFF" />
                              <Text style={styles.premiumBidButtonText}>
                                {bidAmount ? `Place Bid · $${bidAmount}` : 'Enter Amount'}
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>

                      {/* Security Badge */}
                      <View style={styles.securityBadge}>
                        <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                        <Text style={styles.securityText}>Secure · Deposit refundable if you don't win</Text>
                      </View>
                    </>
                  )}

                  {/* Won State */}
                  {selectedAuction.status === 'ended' && isWinning(selectedAuction) && (
                    <View style={styles.premiumWonContainer}>
                      <LinearGradient
                        colors={[colors.gold + '30', colors.gold + '10', 'transparent']}
                        style={styles.premiumWonGradient}
                      >
                        <Ionicons name="trophy" size={56} color={colors.gold} />
                        <Text style={styles.premiumWonTitle}>Congratulations!</Text>
                        <Text style={styles.premiumWonSubtitle}>
                          You won with a bid of ${selectedAuction.current_bid}
                        </Text>
                        <TouchableOpacity style={styles.premiumClaimBtn}>
                          <Text style={styles.premiumClaimBtnText}>Claim Prize</Text>
                        </TouchableOpacity>
                      </LinearGradient>
                    </View>
                  )}

                  {/* Bid History */}
                  {bidHistory.length > 0 && (
                    <View style={styles.premiumHistorySection}>
                      <Text style={styles.premiumHistoryTitle}>Recent Bids</Text>
                      {bidHistory.slice(0, 5).map((bid, index) => (
                        <View key={index} style={styles.premiumHistoryItem}>
                          <View style={styles.premiumHistoryLeft}>
                            <View style={styles.premiumHistoryAvatar}>
                              <Text style={styles.premiumHistoryInitial}>
                                {(bid.user_name || 'A')[0]}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.premiumHistoryName}>{bid.user_name || 'Anonymous'}</Text>
                              <Text style={styles.premiumHistoryTime}>
                                {new Date(bid.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.premiumHistoryAmount}>${bid.amount}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={{ height: 40 }} />
                </ScrollView>
              </>
            )}
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
  depositInfoCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  depositTextCompact: {
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
  // New Improved Auction Modal Styles
  auctionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  featuresContainer: {
    marginBottom: spacing.md,
  },
  featuresLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  featuresScroll: {
    marginBottom: spacing.sm,
  },
  featureChipModal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    gap: 6,
  },
  featureChipTextModal: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  currentBidCardNew: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bidCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bidCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  bidCardValue: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  bidCardMinIncrement: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  leadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 4,
  },
  leadingBadgeWinning: {
    backgroundColor: colors.goldGlow,
  },
  leadingText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  leadingTextWinning: {
    color: colors.gold,
    fontWeight: '700',
  },
  bidControlsSection: {
    marginBottom: spacing.lg,
  },
  bidInputSection: {
    marginBottom: spacing.lg,
  },
  bidInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  bidInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.accent,
    paddingHorizontal: spacing.lg,
  },
  bidCurrency: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.accent,
    marginRight: spacing.xs,
  },
  bidInputField: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  quickBidSection: {
    marginBottom: spacing.lg,
  },
  quickBidLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  quickBidButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickBidBtn: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickBidBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  notifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  notifyCardActive: {
    borderColor: colors.accent + '50',
    backgroundColor: colors.accent + '10',
  },
  notifyIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifyTextContainer: {
    flex: 1,
  },
  notifyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  notifyTitleActive: {
    color: colors.textPrimary,
  },
  notifySubtitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  notifyToggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  notifyToggleActive: {
    backgroundColor: colors.accent,
  },
  notifyToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.textMuted,
  },
  notifyToggleKnobActive: {
    backgroundColor: colors.textPrimary,
    alignSelf: 'flex-end',
  },
  maxBidToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  maxBidToggleLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  maxBidInputSection: {
    marginBottom: spacing.md,
  },
  maxBidHelper: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  maxBidInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent + '50',
    paddingHorizontal: spacing.md,
  },
  depositInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  depositInfoText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  bidHistorySection: {
    marginTop: spacing.lg,
  },
  bidHistoryTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  bidHistoryLeft: {},
  winningBadgeActive: {
    backgroundColor: colors.goldGlow,
  },
  winningTextActive: {
    color: colors.gold,
  },
  // Premium Modal Styles
  premiumModalContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroImageContainer: {
    height: 220,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  premiumCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  premiumCloseBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerBadgeOnImage: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  timerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  heroTitleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  heroVenueName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 28,
  },
  premiumScrollView: {
    flex: 1,
  },
  premiumScrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  premiumFeaturesRow: {
    marginBottom: 16,
    marginLeft: -20,
    marginRight: -20,
    paddingLeft: 20,
  },
  premiumFeaturesContent: {
    paddingRight: 20,
    gap: 8,
  },
  premiumFeatureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  premiumFeatureText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  premiumDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  bidStatsRow: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundElevated,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bidStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  bidStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  bidStatValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  bidStatValueSmall: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  bidStatDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  leadingBidderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  leadingBidderCardWinning: {
    backgroundColor: colors.gold + '15',
    borderWidth: 1,
    borderColor: colors.gold + '30',
  },
  leadingBidderText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  leadingBidderTextWinning: {
    color: colors.gold,
    fontWeight: '700',
  },
  premiumBidInputContainer: {
    marginBottom: 16,
  },
  premiumInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  premiumBidInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.accent,
    paddingHorizontal: 20,
  },
  premiumCurrency: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
  },
  premiumBidField: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    paddingVertical: 14,
    paddingLeft: 8,
  },
  premiumQuickBids: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  premiumQuickBidBtn: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  premiumQuickBidText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  premiumNotifyCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  premiumNotifyCardActive: {
    borderColor: colors.accent + '50',
  },
  premiumNotifyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  premiumNotifyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumNotifyIconActive: {
    backgroundColor: colors.accent + '20',
  },
  premiumNotifyContent: {
    flex: 1,
  },
  premiumNotifyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  premiumNotifyTitleActive: {
    color: colors.textPrimary,
  },
  premiumNotifyDesc: {
    fontSize: 12,
    color: colors.textMuted,
  },
  premiumToggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  premiumToggleActive: {
    backgroundColor: colors.accent,
  },
  premiumToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.textMuted,
  },
  premiumToggleKnobActive: {
    backgroundColor: colors.textPrimary,
    alignSelf: 'flex-end',
  },
  premiumAutoBidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  premiumAutoBidText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  premiumAutoBidTextActive: {
    color: colors.textPrimary,
  },
  premiumMaxBidInput: {
    marginBottom: 20,
  },
  premiumMaxBidHelper: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  premiumBidButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  premiumBidButtonDisabled: {
    opacity: 0.6,
  },
  premiumBidButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  premiumBidButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  securityText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  premiumWonContainer: {
    marginVertical: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  premiumWonGradient: {
    alignItems: 'center',
    padding: 32,
  },
  premiumWonTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.gold,
    marginTop: 16,
    marginBottom: 8,
  },
  premiumWonSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  premiumClaimBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  premiumClaimBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
  premiumHistorySection: {
    marginTop: 8,
  },
  premiumHistoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  premiumHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  premiumHistoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  premiumHistoryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumHistoryInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  premiumHistoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  premiumHistoryTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  premiumHistoryAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
});
