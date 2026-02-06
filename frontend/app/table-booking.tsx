import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StarfieldBackground } from '../src/components/StarfieldBackground';
import * as Haptics from 'expo-haptics';

export default function TableBookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const venueId = params.venue_id as string || 'eclipse';
  const venueName = params.venue_name as string || 'Eclipse';

  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [partySize, setPartySize] = useState<number>(4);
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<any>(null);

  // Generate next 14 days
  const getAvailableDates = () => {
    const dates = [];
    for (let i = 1; i <= 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push({
        value: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' }),
        dayName: date.toLocaleDateString('en-AU', { weekday: 'short' })
      });
    }
    return dates;
  };

  const availableDates = getAvailableDates();

  useEffect(() => {
    fetchTables();
  }, [venueId, selectedDate]);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const response = await api.getVenueTables(venueId, selectedDate || undefined);
      setTables(response.tables || []);
    } catch (e) {
      console.error('Failed to fetch tables:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTable = (table: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedTable(table);
    setPartySize(Math.min(partySize, table.capacity));
  };

  const handleBookTable = async () => {
    if (!selectedTable || !selectedDate) {
      Alert.alert('Missing Info', 'Please select a table and date');
      return;
    }

    setBookingLoading(true);
    try {
      const response = await api.createTableBooking({
        venue_id: venueId,
        table_id: selectedTable.id,
        date: selectedDate,
        party_size: partySize,
        special_requests: specialRequests || undefined,
        contact_phone: contactPhone || undefined,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setCreatedBooking(response.booking);
      setShowConfirmModal(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create booking');
    } finally {
      setBookingLoading(false);
    }
  };

  const handlePayDeposit = async () => {
    if (!createdBooking) return;

    try {
      const depositResponse = await api.getTableDepositIntent(createdBooking.booking_id);
      
      if (depositResponse.demo_mode) {
        // Demo mode - simulate payment success
        Alert.alert(
          'Demo Payment',
          `This is demo mode. In production, you'd pay $${depositResponse.amount} via Stripe.\n\nSimulating successful payment...`,
          [
            {
              text: 'Confirm Payment',
              onPress: async () => {
                const confirmResponse = await api.confirmTableBooking(
                  createdBooking.booking_id,
                  depositResponse.payment_intent_id
                );
                
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                
                Alert.alert(
                  'Booking Confirmed! 🎉',
                  `Your ${selectedTable.name} is confirmed!\n\nYou earned ${confirmResponse.points_earned} points!`,
                  [{ text: 'View My Bookings', onPress: () => router.push('/my-bookings') }]
                );
                setShowConfirmModal(false);
              }
            }
          ]
        );
      } else {
        // Real Stripe payment would go here
        Alert.alert('Payment', 'Stripe payment sheet would open here');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to process payment');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StarfieldBackground starCount={40} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>VIP TABLES</Text>
          <Text style={styles.headerSubtitle}>{venueName}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECT DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
            {availableDates.map((date) => (
              <TouchableOpacity
                key={date.value}
                style={[
                  styles.dateCard,
                  selectedDate === date.value && styles.dateCardSelected
                ]}
                onPress={() => setSelectedDate(date.value)}
              >
                <Text style={[
                  styles.dateDayName,
                  selectedDate === date.value && styles.dateTextSelected
                ]}>
                  {date.dayName}
                </Text>
                <Text style={[
                  styles.dateLabel,
                  selectedDate === date.value && styles.dateTextSelected
                ]}>
                  {date.label.split(',')[1]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tables */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AVAILABLE TABLES</Text>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
          ) : tables.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No tables available</Text>
              <Text style={styles.emptySubtext}>Select a date to see availability</Text>
            </View>
          ) : (
            tables.map((table) => (
              <TouchableOpacity
                key={table.id}
                style={[
                  styles.tableCard,
                  selectedTable?.id === table.id && styles.tableCardSelected,
                  !table.available && styles.tableCardUnavailable
                ]}
                onPress={() => table.available && handleSelectTable(table)}
                disabled={!table.available}
              >
                <LinearGradient
                  colors={selectedTable?.id === table.id ? [colors.accent + '30', '#0A0A0A'] : ['#1A1A1A', '#0A0A0A']}
                  style={styles.tableCardGradient}
                >
                  <View style={styles.tableHeader}>
                    <View>
                      <Text style={styles.tableName}>{table.name}</Text>
                      <Text style={styles.tableLocation}>
                        <Ionicons name="location-outline" size={12} color={colors.textMuted} /> {table.location}
                      </Text>
                    </View>
                    {!table.available && (
                      <View style={styles.unavailableBadge}>
                        <Text style={styles.unavailableText}>BOOKED</Text>
                      </View>
                    )}
                    {table.available && selectedTable?.id === table.id && (
                      <Ionicons name="checkmark-circle" size={28} color={colors.accent} />
                    )}
                  </View>

                  <View style={styles.tableStats}>
                    <View style={styles.tableStat}>
                      <Ionicons name="people" size={16} color={colors.gold} />
                      <Text style={styles.tableStatText}>Up to {table.capacity}</Text>
                    </View>
                    <View style={styles.tableStat}>
                      <Ionicons name="card" size={16} color={colors.gold} />
                      <Text style={styles.tableStatText}>${table.min_spend} min</Text>
                    </View>
                    <View style={styles.tableStat}>
                      <Ionicons name="lock-closed" size={16} color={colors.gold} />
                      <Text style={styles.tableStatText}>${table.deposit_amount} deposit</Text>
                    </View>
                  </View>

                  <View style={styles.tableFeatures}>
                    {table.features?.slice(0, 4).map((feature: string, idx: number) => (
                      <View key={idx} style={styles.featureBadge}>
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Party Size */}
        {selectedTable && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PARTY SIZE</Text>
            <View style={styles.partySizeContainer}>
              <TouchableOpacity
                style={styles.partySizeButton}
                onPress={() => setPartySize(Math.max(1, partySize - 1))}
              >
                <Ionicons name="remove" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.partySizeText}>{partySize} guests</Text>
              <TouchableOpacity
                style={styles.partySizeButton}
                onPress={() => setPartySize(Math.min(selectedTable.capacity, partySize + 1))}
              >
                <Ionicons name="add" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Special Requests */}
        {selectedTable && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SPECIAL REQUESTS (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={specialRequests}
              onChangeText={setSpecialRequests}
              placeholder="Birthday celebration, dietary requirements..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Booking Summary & CTA */}
      {selectedTable && selectedDate && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.bookingSummary}>
            <Text style={styles.summaryText}>{selectedTable.name}</Text>
            <Text style={styles.summaryPrice}>${selectedTable.deposit_amount} deposit</Text>
          </View>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={handleBookTable}
            disabled={bookingLoading}
          >
            <LinearGradient
              colors={[colors.gold, '#B8860B']}
              style={styles.bookButtonGradient}
            >
              {bookingLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="diamond" size={20} color="#000" />
                  <Text style={styles.bookButtonText}>RESERVE TABLE</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1A1A1A', '#0A0A0A']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Ionicons name="checkmark-circle" size={60} color={colors.success} />
                <Text style={styles.modalTitle}>Table Reserved!</Text>
                <Text style={styles.modalSubtitle}>Pay deposit to confirm</Text>
              </View>

              {createdBooking && (
                <View style={styles.bookingDetails}>
                  <View style={styles.bookingRow}>
                    <Text style={styles.bookingLabel}>Table</Text>
                    <Text style={styles.bookingValue}>{createdBooking.table_name}</Text>
                  </View>
                  <View style={styles.bookingRow}>
                    <Text style={styles.bookingLabel}>Date</Text>
                    <Text style={styles.bookingValue}>{createdBooking.date}</Text>
                  </View>
                  <View style={styles.bookingRow}>
                    <Text style={styles.bookingLabel}>Party Size</Text>
                    <Text style={styles.bookingValue}>{createdBooking.party_size} guests</Text>
                  </View>
                  <View style={styles.bookingRow}>
                    <Text style={styles.bookingLabel}>Min Spend</Text>
                    <Text style={styles.bookingValue}>${createdBooking.min_spend}</Text>
                  </View>
                  <View style={[styles.bookingRow, styles.depositRow]}>
                    <Text style={styles.depositLabel}>DEPOSIT DUE</Text>
                    <Text style={styles.depositValue}>${createdBooking.deposit_amount}</Text>
                  </View>
                </View>
              )}

              <Text style={styles.expiryNote}>
                ⏰ Pay within 24 hours to confirm your booking
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.laterButton}
                  onPress={() => {
                    setShowConfirmModal(false);
                    router.push('/my-bookings');
                  }}
                >
                  <Text style={styles.laterButtonText}>Pay Later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.payNowButton}
                  onPress={handlePayDeposit}
                >
                  <LinearGradient
                    colors={[colors.success, '#1e7e34']}
                    style={styles.payNowGradient}
                  >
                    <Ionicons name="card" size={18} color="#FFF" />
                    <Text style={styles.payNowText}>PAY NOW</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.gold,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  dateScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  dateCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#1A1A1A',
    borderRadius: radius.md,
    marginRight: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateCardSelected: {
    backgroundColor: colors.gold + '20',
    borderColor: colors.gold,
  },
  dateDayName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dateTextSelected: {
    color: colors.gold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  tableCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableCardSelected: {
    borderColor: colors.accent,
  },
  tableCardUnavailable: {
    opacity: 0.5,
  },
  tableCardGradient: {
    padding: spacing.lg,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  tableName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tableLocation: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  unavailableBadge: {
    backgroundColor: colors.error + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  unavailableText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 1,
  },
  tableStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  tableStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tableStatText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tableFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  featureBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  featureText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  partySizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xl,
  },
  partySizeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  partySizeText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    minWidth: 100,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bookingSummary: {
    flex: 1,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summaryPrice: {
    fontSize: 12,
    color: colors.gold,
    marginTop: 2,
  },
  bookButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: spacing.xl,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  bookingDetails: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  bookingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bookingLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  bookingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  depositRow: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
  },
  depositLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 1,
  },
  depositValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.gold,
  },
  expiryNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  laterButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  laterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  payNowButton: {
    flex: 2,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  payNowGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  payNowText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
});
