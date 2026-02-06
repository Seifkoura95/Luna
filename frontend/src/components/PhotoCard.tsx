import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

interface PhotoCardProps {
  photo: {
    id: string;
    photo_url: string;
    thumbnail_url?: string;
    event_name?: string;
    taken_at: string;
    tag_status?: string;
    purchase_price?: number;
    ai_enhanced?: boolean;
  };
  onPress?: (photoId: string) => void;
  onApprove?: (tagId: string, approved: boolean) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (photoId: string) => void;
  tagId?: string;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({ 
  photo, 
  onPress, 
  onApprove,
  selectable,
  selected,
  onSelect,
  tagId
}) => {
  const imageUrl = photo.thumbnail_url || photo.photo_url;
  const takenAt = new Date(photo.taken_at);

  const handlePress = () => {
    if (selectable && onSelect) {
      onSelect(photo.id);
    } else if (onPress) {
      onPress(photo.id);
    }
  };

  return (
    <TouchableOpacity 
      style={[
        styles.container,
        selected && styles.containerSelected
      ]} 
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: imageUrl }} 
        style={styles.image}
        resizeMode="cover"
      />
      
      {/* Overlay */}
      <View style={styles.overlay}>
        {photo.event_name && (
          <Text style={styles.eventName} numberOfLines={1}>{photo.event_name}</Text>
        )}
        <Text style={styles.date}>{format(takenAt, 'MMM dd, h:mm a')}</Text>
      </View>
      
      {/* Status Badge */}
      {photo.tag_status && (
        <View style={[
          styles.statusBadge,
          photo.tag_status === 'purchased' && styles.statusPurchased,
          photo.tag_status === 'approved' && styles.statusApproved,
          photo.tag_status === 'pending' && styles.statusPending,
        ]}>
          <Ionicons 
            name={
              photo.tag_status === 'purchased' ? 'checkmark-circle' :
              photo.tag_status === 'approved' ? 'cart' :
              'time'
            } 
            size={12} 
            color={colors.textPrimary} 
          />
          <Text style={styles.statusText}>
            {photo.tag_status === 'purchased' ? 'Owned' :
             photo.tag_status === 'approved' ? `$${photo.purchase_price || 5}` :
             'Review'}
          </Text>
        </View>
      )}
      
      {/* AI Enhanced Badge */}
      {photo.ai_enhanced && (
        <View style={styles.aiBadge}>
          <Ionicons name="sparkles" size={12} color={colors.premiumGold} />
          <Text style={styles.aiText}>AI</Text>
        </View>
      )}
      
      {/* Selection Checkbox */}
      {selectable && (
        <View style={[
          styles.checkbox,
          selected && styles.checkboxSelected
        ]}>
          {selected && <Ionicons name="checkmark" size={16} color={colors.textPrimary} />}
        </View>
      )}
      
      {/* Approval Buttons */}
      {photo.tag_status === 'pending' && onApprove && tagId && (
        <View style={styles.approvalButtons}>
          <TouchableOpacity 
            style={[styles.approvalBtn, styles.approveBtn]}
            onPress={() => onApprove(tagId, true)}
          >
            <Ionicons name="checkmark" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.approvalBtn, styles.declineBtn]}
            onPress={() => onApprove(tagId, false)}
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: colors.card,
  },
  containerSelected: {
    borderWidth: 3,
    borderColor: colors.accent,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  eventName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  date: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  statusPurchased: {
    backgroundColor: colors.success,
  },
  statusApproved: {
    backgroundColor: colors.accent,
  },
  statusPending: {
    backgroundColor: colors.warning,
  },
  statusText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  aiBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.premiumGold + '30',
  },
  aiText: {
    color: colors.premiumGold,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  approvalButtons: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  approvalBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: colors.success,
  },
  declineBtn: {
    backgroundColor: colors.error,
  },
});
