import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { format, differenceInSeconds } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface AuctionCardProps {
  auction: {
    id: string;
    title: string;
    description: string;
    auction_type: string;
    reserve_price: number;
    current_bid: number;
    bid_increment: number;
    winner_name?: string;
    start_time: string;
    end_time: string;
    status: string;
  };
  onPress: (auctionId: string) => void;
  isUserWinning?: boolean;
}

const auctionTypeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  booth_upgrade: 'star',
  fast_lane: 'flash',
  bottle_service: 'wine',
  vip_experience: 'diamond',
};

export const AuctionCard: React.FC<AuctionCardProps> = ({ auction, onPress, isUserWinning }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const endTime = new Date(auction.end_time);
      const startTime = new Date(auction.start_time);
      
      if (auction.status === 'upcoming') {
        const secsToStart = differenceInSeconds(startTime, now);
        if (secsToStart <= 0) {
          setTimeLeft('Starting...');
        } else {
          const mins = Math.floor(secsToStart / 60);
          const secs = secsToStart % 60;
          setTimeLeft(`Starts in ${mins}m ${secs}s`);
        }
        setIsUrgent(false);
      } else if (auction.status === 'active') {
        const secsLeft = differenceInSeconds(endTime, now);
        if (secsLeft <= 0) {
          setTimeLeft('Ended');
          setIsUrgent(false);
        } else {
          const mins = Math.floor(secsLeft / 60);
          const secs = secsLeft % 60;
          setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
          setIsUrgent(secsLeft <= 60);
        }
      } else {
        setTimeLeft('Ended');
        setIsUrgent(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [auction]);

  const icon = auctionTypeIcons[auction.auction_type] || 'pricetag';
  const currentBid = auction.current_bid > 0 ? auction.current_bid : auction.reserve_price;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress(auction.id);
  };

  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        isUrgent && styles.containerUrgent,
        isUserWinning && styles.containerWinning
      ]} 
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, isUrgent && styles.iconUrgent]}>
          <Ionicons name={icon} size={24} color={isUrgent ? colors.warning : colors.accent} />
        </View>
        <View style={[
          styles.timerBadge, 
          isUrgent && styles.timerUrgent,
          auction.status === 'upcoming' && styles.timerUpcoming
        ]}>
          <Ionicons 
            name={auction.status === 'active' ? 'time' : 'hourglass'} 
            size={14} 
            color={isUrgent ? colors.warning : auction.status === 'upcoming' ? colors.textSecondary : colors.textPrimary} 
          />
          <Text style={[
            styles.timerText, 
            isUrgent && styles.timerTextUrgent,
            auction.status === 'upcoming' && styles.timerTextUpcoming
          ]}>
            {timeLeft}
          </Text>
        </View>
      </View>
      
      <Text style={styles.title}>{auction.title}</Text>
      <Text style={styles.description} numberOfLines={2}>{auction.description}</Text>
      
      <View style={styles.footer}>
        <View>
          <Text style={styles.bidLabel}>
            {auction.current_bid > 0 ? 'Current Bid' : 'Reserve'}
          </Text>
          <Text style={styles.bidAmount}>${currentBid.toFixed(0)}</Text>
        </View>
        
        {isUserWinning && (
          <View style={styles.winningBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.winningText}>Winning!</Text>
          </View>
        )}
        
        {auction.winner_name && !isUserWinning && (
          <Text style={styles.leaderName}>{auction.winner_name}</Text>
        )}
        
        {auction.status === 'active' && (
          <View style={styles.bidButton}>
            <Text style={styles.bidButtonText}>Bid Now</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.textPrimary} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerUrgent: {
    borderColor: colors.warning,
    backgroundColor: colors.warning + '10',
  },
  containerWinning: {
    borderColor: colors.success,
    backgroundColor: colors.success + '10',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconUrgent: {
    backgroundColor: colors.warning + '30',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  timerUpcoming: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerUrgent: {
    backgroundColor: colors.warning,
  },
  timerText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  timerTextUpcoming: {
    color: colors.textSecondary,
  },
  timerTextUrgent: {
    color: colors.background,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bidLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bidAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.premiumGold,
  },
  winningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  winningText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  leaderName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  bidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bidButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
});
