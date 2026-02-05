import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/utils/api';
import { AuctionCard } from '../../src/components/AuctionCard';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { differenceInSeconds } from 'date-fns';

export default function AuctionsScreen() {
  const user = useAuthStore((state) => state.user);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);

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
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchAuctions, 5000);
    return () => clearInterval(interval);
  }, [fetchAuctions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAuctions();
    setRefreshing(false);
  };

  const handleAuctionPress = async (auctionId: string) => {
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

  const activeAuctions = auctions.filter(a => a.status === 'active');
  const upcomingAuctions = auctions.filter(a => a.status === 'upcoming');

  const getTimeLeft = (endTime: string) => {
    const secs = differenceInSeconds(new Date(endTime), new Date());
    if (secs <= 0) return 'Ended';
    const mins = Math.floor(secs / 60);
    const secsLeft = secs % 60;
    return `${mins}:${secsLeft.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
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
              <Text style={styles.sectionTitle}>LIVE NOW</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveIndicator} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            {activeAuctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                onPress={handleAuctionPress}
                isUserWinning={auction.winner_id === user?.user_id}
              />
            ))}
          </View>
        )}

        {/* Upcoming Auctions */}
        {upcomingAuctions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COMING UP</Text>
            {upcomingAuctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                onPress={handleAuctionPress}
              />
            ))}
          </View>
        )}

        {/* Empty State */}
        {auctions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="flash-outline" size={64} color={colors.textMuted} />
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
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedAuction(null)}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            {selectedAuction && (
              <>
                <Text style={styles.modalTitle}>{selectedAuction.title}</Text>
                <Text style={styles.modalDescription}>
                  {selectedAuction.description}
                </Text>

                {/* Timer */}
                {selectedAuction.status === 'active' && (
                  <View style={styles.timerContainer}>
                    <Ionicons name="time" size={24} color={colors.warning} />
                    <Text style={styles.timerText}>
                      {getTimeLeft(selectedAuction.end_time)}
                    </Text>
                  </View>
                )}

                {/* Current Bid */}
                <View style={styles.bidInfo}>
                  <Text style={styles.bidLabel}>Current Bid</Text>
                  <Text style={styles.currentBid}>
                    ${selectedAuction.current_bid > 0 
                      ? selectedAuction.current_bid.toFixed(0) 
                      : selectedAuction.reserve_price.toFixed(0)}
                  </Text>
                  {selectedAuction.winner_name && (
                    <Text style={styles.winnerName}>
                      Leading: {selectedAuction.winner_name}
                    </Text>
                  )}
                </View>

                {/* Quick Bid Buttons */}
                {selectedAuction.status === 'active' && (
                  <View style={styles.quickBids}>
                    <TouchableOpacity
                      style={styles.quickBidBtn}
                      onPress={() => handleQuickBid(5)}
                    >
                      <Text style={styles.quickBidText}>+$5</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickBidBtn}
                      onPress={() => handleQuickBid(10)}
                    >
                      <Text style={styles.quickBidText}>+$10</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickBidBtn}
                      onPress={() => handleQuickBid(20)}
                    >
                      <Text style={styles.quickBidText}>+$20</Text>
                    </TouchableOpacity>
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
                      style={[
                        styles.placeBidBtn,
                        bidding && styles.placeBidBtnDisabled
                      ]}
                      onPress={handlePlaceBid}
                      disabled={bidding}
                    >
                      <Text style={styles.placeBidText}>
                        {bidding ? 'Placing...' : 'Place Bid'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Recent Bids */}
                {selectedAuction.recent_bids?.length > 0 && (
                  <View style={styles.recentBids}>
                    <Text style={styles.recentBidsTitle}>Recent Bids</Text>
                    {selectedAuction.recent_bids.slice(0, 5).map((bid: any, index: number) => (
                      <View key={bid.id || index} style={styles.bidItem}>
                        <Text style={styles.bidder}>{bid.user_name}</Text>
                        <Text style={styles.bidValue}>${bid.bid_amount}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textPrimary,
    marginRight: 6,
  },
  liveText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    paddingRight: 40,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning + '20',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  timerText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.warning,
    marginLeft: 12,
  },
  bidInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bidLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  currentBid: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.premiumGold,
  },
  winnerName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  quickBids: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  quickBidBtn: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickBidText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  bidInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dollarSign: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 8,
  },
  bidInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: 12,
  },
  placeBidBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  placeBidBtnDisabled: {
    opacity: 0.5,
  },
  placeBidText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  recentBids: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  recentBidsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  bidItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  bidder: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  bidValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
