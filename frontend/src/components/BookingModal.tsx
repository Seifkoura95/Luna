import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../theme/colors';
import { api } from '../utils/api';
import { format, addDays } from 'date-fns';

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  venue: any;
  type: 'reservation' | 'guestlist';
}

export const BookingModal: React.FC<BookingModalProps> = ({
  visible,
  onClose,
  venue,
  type,
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [specialRequests, setSpecialRequests] = useState('');
  const [occasion, setOccasion] = useState<string | null>(null);
  const [vipBooth, setVipBooth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<any>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Generate next 7 days
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      date: format(date, 'yyyy-MM-dd'),
      display: format(date, 'EEE'),
      day: format(date, 'd'),
    };
  });

  const occasions = [
    'Birthday',
    'Anniversary',
    'Date Night',
    'Business',
    'Celebration',
    'Other',
  ];

  useEffect(() => {
    if (selectedDate && venue) {
      fetchAvailability();
    }
  }, [selectedDate, partySize, venue]);

  const fetchAvailability = async () => {
    if (!selectedDate || !venue) return;
    setLoadingAvailability(true);
    try {
      const data = await api.getAvailability(venue.id, selectedDate, partySize);
      setAvailability(data);
    } catch (e) {
      console.error('Failed to fetch availability:', e);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Error', 'Please select a date and time');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setLoading(true);
    try {
      if (type === 'reservation') {
        const result = await api.createReservation(
          venue.id,
          selectedDate,
          selectedTime,
          partySize,
          specialRequests || undefined,
          occasion || undefined
        );
        Alert.alert(
          '🎉 Reservation Confirmed!',
          `Your table at ${venue.name} is booked for ${format(new Date(selectedDate), 'EEEE, MMMM d')} at ${selectedTime}.\n\nConfirmation: ${result.booking.confirmation_code}\n\nYou earned ${result.booking.points_earned} points!`,
          [{ text: 'Done', onPress: onClose }]
        );
      } else {
        const result = await api.addToGuestlist(
          venue.id,
          selectedDate,
          partySize,
          selectedTime,
          vipBooth
        );
        Alert.alert(
          '🎉 You\'re On The List!',
          `${venue.name} - ${format(new Date(selectedDate), 'EEEE, MMMM d')}\n\nConfirmation: ${result.guestlist.confirmation_code}\nEntry: ${result.guestlist.entry_priority}\n\nYou earned ${result.guestlist.points_earned} points!`,
          [{ text: 'Done', onPress: onClose }]
        );
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      Alert.alert('Booking Failed', e.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDate(null);
    setSelectedTime(null);
    setPartySize(2);
    setSpecialRequests('');
    setOccasion(null);
    setVipBooth(false);
    setAvailability(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!venue) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={[colors.backgroundCard, colors.background]}
            style={styles.gradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>
                  {type === 'reservation' ? 'Book a Table' : 'Get on the List'}
                </Text>
                <Text style={styles.venueName}>{venue.name}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
              {/* Date Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SELECT DATE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.datesRow}>
                    {dates.map((d) => (
                      <TouchableOpacity
                        key={d.date}
                        style={[
                          styles.dateCard,
                          selectedDate === d.date && styles.dateCardSelected,
                        ]}
                        onPress={() => {
                          setSelectedDate(d.date);
                          setSelectedTime(null);
                          if (Platform.OS !== 'web') Haptics.selectionAsync();
                        }}
                      >
                        <Text
                          style={[
                            styles.dateDay,
                            selectedDate === d.date && styles.dateDaySelected,
                          ]}
                        >
                          {d.display}
                        </Text>
                        <Text
                          style={[
                            styles.dateNumber,
                            selectedDate === d.date && styles.dateNumberSelected,
                          ]}
                        >
                          {d.day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Party Size */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PARTY SIZE</Text>
                <View style={styles.partySizeRow}>
                  <TouchableOpacity
                    style={styles.partySizeButton}
                    onPress={() => setPartySize(Math.max(1, partySize - 1))}
                    disabled={partySize <= 1}
                  >
                    <Ionicons
                      name="remove"
                      size={24}
                      color={partySize <= 1 ? colors.textMuted : colors.textPrimary}
                    />
                  </TouchableOpacity>
                  <View style={styles.partySizeDisplay}>
                    <Text style={styles.partySizeNumber}>{partySize}</Text>
                    <Text style={styles.partySizeLabel}>
                      {partySize === 1 ? 'Guest' : 'Guests'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.partySizeButton}
                    onPress={() => setPartySize(Math.min(20, partySize + 1))}
                    disabled={partySize >= 20}
                  >
                    <Ionicons
                      name="add"
                      size={24}
                      color={partySize >= 20 ? colors.textMuted : colors.textPrimary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Time Slots */}
              {selectedDate && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {type === 'reservation' ? 'SELECT TIME' : 'ARRIVAL TIME'}
                  </Text>
                  {loadingAvailability ? (
                    <ActivityIndicator color={colors.accent} style={{ padding: spacing.lg }} />
                  ) : availability?.time_slots ? (
                    <View style={styles.timeSlotsGrid}>
                      {availability.time_slots.map((slot: any) => (
                        <TouchableOpacity
                          key={slot.time}
                          style={[
                            styles.timeSlot,
                            selectedTime === slot.time && styles.timeSlotSelected,
                            !slot.available && styles.timeSlotUnavailable,
                          ]}
                          onPress={() => {
                            if (slot.available) {
                              setSelectedTime(slot.time);
                              if (Platform.OS !== 'web') Haptics.selectionAsync();
                            }
                          }}
                          disabled={!slot.available}
                        >
                          <Text
                            style={[
                              styles.timeSlotText,
                              selectedTime === slot.time && styles.timeSlotTextSelected,
                              !slot.available && styles.timeSlotTextUnavailable,
                            ]}
                          >
                            {slot.time}
                          </Text>
                          {slot.tables && (
                            <Text style={styles.timeSlotAvail}>
                              {slot.tables} {slot.tables === 1 ? 'table' : 'tables'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noSlotsText}>Select a date to see available times</Text>
                  )}
                </View>
              )}

              {/* VIP Booth Option (for guestlist) */}
              {type === 'guestlist' && (
                <TouchableOpacity
                  style={[styles.vipOption, vipBooth && styles.vipOptionSelected]}
                  onPress={() => {
                    setVipBooth(!vipBooth);
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                >
                  <View style={styles.vipOptionContent}>
                    <Ionicons
                      name={vipBooth ? 'checkmark-circle' : 'star-outline'}
                      size={24}
                      color={vipBooth ? colors.gold : colors.textSecondary}
                    />
                    <View style={styles.vipOptionText}>
                      <Text style={styles.vipOptionTitle}>VIP Booth Package</Text>
                      <Text style={styles.vipOptionDesc}>
                        Priority entry + Reserved booth + Bottle service
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.vipOptionPrice}>$500+</Text>
                </TouchableOpacity>
              )}

              {/* Occasion (for reservation) */}
              {type === 'reservation' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>OCCASION (OPTIONAL)</Text>
                  <View style={styles.occasionsGrid}>
                    {occasions.map((occ) => (
                      <TouchableOpacity
                        key={occ}
                        style={[
                          styles.occasionChip,
                          occasion === occ && styles.occasionChipSelected,
                        ]}
                        onPress={() => {
                          setOccasion(occasion === occ ? null : occ);
                          if (Platform.OS !== 'web') Haptics.selectionAsync();
                        }}
                      >
                        <Text
                          style={[
                            styles.occasionText,
                            occasion === occ && styles.occasionTextSelected,
                          ]}
                        >
                          {occ}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Special Requests */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SPECIAL REQUESTS</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder={
                    type === 'reservation'
                      ? 'Dietary requirements, seating preferences, etc.'
                      : 'Any special requests for your night...'
                  }
                  placeholderTextColor={colors.textMuted}
                  value={specialRequests}
                  onChangeText={setSpecialRequests}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Powered By */}
              <View style={styles.poweredBy}>
                <Text style={styles.poweredByText}>Powered by</Text>
                <Text style={styles.poweredByBrand}>SevenRooms</Text>
              </View>
            </ScrollView>

            {/* Book Button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.bookButton, (!selectedDate || !selectedTime) && styles.bookButtonDisabled]}
                onPress={handleBook}
                disabled={loading || !selectedDate || !selectedTime}
              >
                <LinearGradient
                  colors={
                    !selectedDate || !selectedTime
                      ? [colors.backgroundElevated, colors.backgroundCard]
                      : [venue.accent_color || colors.accent, (venue.accent_color || colors.accent) + 'CC']
                  }
                  style={styles.bookButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textPrimary} />
                  ) : (
                    <>
                      <Text style={styles.bookButtonText}>
                        {type === 'reservation' ? 'Confirm Reservation' : 'Join Guestlist'}
                      </Text>
                      <Ionicons name="arrow-forward" size={20} color={colors.textPrimary} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    overflow: 'hidden',
  },
  gradient: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  venueName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    maxHeight: 500,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  datesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateCard: {
    width: 60,
    height: 70,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateCardSelected: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  dateDay: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dateDaySelected: {
    color: colors.accent,
  },
  dateNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dateNumberSelected: {
    color: colors.accent,
  },
  partySizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  partySizeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  partySizeDisplay: {
    alignItems: 'center',
  },
  partySizeNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  partySizeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeSlot: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 80,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  timeSlotUnavailable: {
    backgroundColor: colors.backgroundCard,
    borderColor: colors.border,
    opacity: 0.5,
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timeSlotTextSelected: {
    color: colors.accent,
  },
  timeSlotTextUnavailable: {
    color: colors.textMuted,
  },
  timeSlotAvail: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  noSlotsText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.lg,
  },
  vipOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundElevated,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  vipOptionSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + '10',
  },
  vipOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vipOptionText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  vipOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  vipOptionDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  vipOptionPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gold,
  },
  occasionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  occasionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  occasionChipSelected: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  occasionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  occasionTextSelected: {
    color: colors.accent,
  },
  textArea: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  poweredBy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  poweredByText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  poweredByBrand: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bookButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bookButtonDisabled: {
    opacity: 0.5,
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
});

export default BookingModal;
