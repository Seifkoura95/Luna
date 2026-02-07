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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StarfieldBackground } from '../src/components/StarfieldBackground';
import * as Haptics from 'expo-haptics';
import { useFonts, fonts } from '../src/hooks/useFonts';

// Venues that offer table booking
const TABLE_VENUES = [
  { id: 'eclipse', name: 'Eclipse', type: 'Nightclub', color: '#E31837' },
  { id: 'after_dark', name: 'After Dark', type: 'Nightclub', color: '#8B00FF' },
  { id: 'su_casa_brisbane', name: 'Su Casa Brisbane', type: 'Rooftop Bar', color: '#FFB800' },
  { id: 'su_casa_gold_coast', name: 'Su Casa Gold Coast', type: 'Nightclub', color: '#FF6B35' },
  { id: 'juju', name: 'Juju Mermaid Beach', type: 'Restaurant', color: '#00D4AA' },
  { id: 'night_market', name: 'Night Market', type: 'Restaurant', color: '#FF4757' },
  { id: 'ember_and_ash', name: 'Ember & Ash', type: 'Restaurant', color: '#FFA502' },
];

export default function TableBookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const fontsLoaded = useFonts();
  
  // State
  const [selectedVenue, setSelectedVenue] = useState<any>(TABLE_VENUES[0]);
  const [venues, setVenues] = useState<any[]>([]);
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

  // Fetch venues with logos
  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const venuesData = await api.getVenues();
        setVenues(venuesData || []);
      } catch (e) {
        console.error('Failed to fetch venues:', e);
      }
    };
    fetchVenues();
  }, []);

  useEffect(() => {
    fetchTables();
    setSelectedTable(null); // Reset table selection when venue changes
  }, [selectedVenue, selectedDate]);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const response = await api.getVenueTables(selectedVenue.id, selectedDate || undefined);
      
      // Check if venue is closed on this date
      if (response.venue_closed) {
        setTables([]);
        // Show closed message
        if (response.closed_reason) {
          Alert.alert('Venue Closed', response.closed_reason);
        }
      } else {
        setTables(response.tables || []);
      }
    } catch (e) {
      console.error('Failed to fetch tables:', e);
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  const getVenueLogo = (venueId: string) => {
    const venue = venues.find(v => v.id === venueId);
    return venue?.logo_url;
  };

  const handleSelectVenue = (venue: any) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedVenue(venue);
    setSelectedTable(null);
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
        venue_id: selectedVenue.id,
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
          <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: fonts.display }]}>VIP Tables</Text>
          <Text style={[styles.headerSubtitle, fontsLoaded && { fontFamily: fonts.regular }]}>All Venues</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Venue Selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>SELECT VENUE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.venueScroll}>
            {TABLE_VENUES.map((venue) => {
              const isSelected = selectedVenue.id === venue.id;
              const logoUrl = getVenueLogo(venue.id);
              return (
                <TouchableOpacity
                  key={venue.id}
                  style={[
                    styles.venueCard,
                    isSelected && { borderColor: venue.color, borderWidth: 2 }
                  ]}
                  onPress={() => handleSelectVenue(venue)}
                >
                  {logoUrl ? (
                    <Image source={{ uri: logoUrl }} style={styles.venueLogo} resizeMode="contain" />
                  ) : (
                    <Text style={[styles.venueName, fontsLoaded && { fontFamily: fonts.semiBold }]}>{venue.name}</Text>
                  )}
                  <Text style={[styles.venueType, fontsLoaded && { fontFamily: fonts.regular }]}>{venue.type}</Text>
                  {isSelected && (
                    <View style={[styles.selectedDot, { backgroundColor: venue.color }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>SELECT DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
            {availableDates.map((date) => (
              <TouchableOpacity
                key={date.value}
                style={[
                  styles.dateCard,
                  selectedDate === date.value && [styles.dateCardSelected, { borderColor: selectedVenue.color }]
                ]}
                onPress={() => setSelectedDate(date.value)}
              >
                <Text style={[
                  styles.dateDayName,
                  selectedDate === date.value && styles.dateTextSelected,
                  fontsLoaded && { fontFamily: fonts.semiBold }
                ]}>
                  {date.dayName}
                </Text>
                <Text style={[
                  styles.dateLabel,
                  selectedDate === date.value && styles.dateTextSelected,
                  fontsLoaded && { fontFamily: fonts.regular }
                ]}>
                  {date.label.split(',')[1]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tables */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>
            AVAILABLE TABLES {tables.length > 0 && `(${tables.length})`}
          </Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={selectedVenue.color} />
            </View>
          ) : tables.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, fontsLoaded && { fontFamily: fonts.medium }]}>
                No tables available at {selectedVenue.name}
              </Text>
              <Text style={[styles.emptySubtext, fontsLoaded && { fontFamily: fonts.regular }]}>
                Please select a different date or venue
              </Text>
            </View>
          ) : (
            tables.map((table) => {
              const isSelected = selectedTable?.id === table.id;
              const isAvailable = table.available !== false;
              return (
                <TouchableOpacity
                  key={table.id}
                  style={[
                    styles.tableCard,
                    isSelected && { borderColor: selectedVenue.color, borderWidth: 2 },
                    !isAvailable && styles.tableUnavailable
                  ]}
                  onPress={() => isAvailable && handleSelectTable(table)}
                  disabled={!isAvailable}
                >
                  <Image source={{ uri: table.image_url }} style={styles.tableImage} />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.9)']}
                    style={styles.tableGradient}
                  >
                    <View style={styles.tableInfo}>
                      <Text style={[styles.tableName, fontsLoaded && { fontFamily: fonts.bold }]}>{table.name}</Text>
                      <Text style={[styles.tableLocation, fontsLoaded && { fontFamily: fonts.regular }]}>{table.location}</Text>
                      
                      <View style={styles.tableStats}>
                        <View style={styles.tableStat}>
                          <Ionicons name="people" size={14} color={colors.textSecondary} />
                          <Text style={[styles.tableStatText, fontsLoaded && { fontFamily: fonts.medium }]}>Up to {table.capacity}</Text>
                        </View>
                        <View style={styles.tableStat}>
                          <Ionicons name="card" size={14} color={colors.textSecondary} />
                          <Text style={[styles.tableStatText, fontsLoaded && { fontFamily: fonts.medium }]}>Min ${table.min_spend}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.tableFeatures}>
                        {table.features?.slice(0, 3).map((feature: string, i: number) => (
                          <View key={i} style={styles.featureBadge}>
                            <Text style={[styles.featureText, fontsLoaded && { fontFamily: fonts.medium }]}>{feature}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    
                    <View style={styles.tableRight}>
                      <Text style={[styles.depositLabel, fontsLoaded && { fontFamily: fonts.regular }]}>Deposit</Text>
                      <Text style={[styles.depositAmount, { color: selectedVenue.color }, fontsLoaded && { fontFamily: fonts.bold }]}>
                        ${table.deposit_amount}
                      </Text>
                      {isSelected && (
                        <View style={[styles.checkCircle, { backgroundColor: selectedVenue.color }]}>
                          <Ionicons name="checkmark" size={16} color="#FFF" />
                        </View>
                      )}
                      {!isAvailable && (
                        <Text style={[styles.bookedText, fontsLoaded && { fontFamily: fonts.medium }]}>BOOKED</Text>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Party Size */}
        {selectedTable && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>PARTY SIZE</Text>
            <View style={styles.partySizeContainer}>
              <TouchableOpacity
                style={styles.partySizeBtn}
                onPress={() => setPartySize(Math.max(1, partySize - 1))}
              >
                <Ionicons name="remove" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.partySizeText, fontsLoaded && { fontFamily: fonts.bold }]}>{partySize}</Text>
              <TouchableOpacity
                style={styles.partySizeBtn}
                onPress={() => setPartySize(Math.min(selectedTable.capacity, partySize + 1))}
              >
                <Ionicons name="add" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.capacityNote, fontsLoaded && { fontFamily: fonts.regular }]}>Max {selectedTable.capacity} guests</Text>
          </View>
        )}

        {/* Special Requests */}
        {selectedTable && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, fontsLoaded && { fontFamily: fonts.bold }]}>SPECIAL REQUESTS</Text>
            <TextInput
              style={[styles.textInput, fontsLoaded && { fontFamily: fonts.regular }]}
              placeholder="Any special requests or celebrations?"
              placeholderTextColor={colors.textMuted}
              value={specialRequests}
              onChangeText={setSpecialRequests}
              multiline
            />
          </View>
        )}

        {/* Book Button */}
        {selectedTable && selectedDate && (
          <TouchableOpacity
            style={styles.bookButton}
            onPress={handleBookTable}
            disabled={bookingLoading}
          >
            <LinearGradient
              colors={[selectedVenue.color, adjustColor(selectedVenue.color, -30)]}
              style={styles.bookButtonGradient}
            >
              {bookingLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                  <Text style={[styles.bookButtonText, fontsLoaded && { fontFamily: fonts.bold }]}>
                    RESERVE • ${selectedTable.deposit_amount} DEPOSIT
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { backgroundColor: selectedVenue.color }]}>
              <Ionicons name="checkmark-circle" size={48} color="#FFF" />
              <Text style={[styles.modalTitle, fontsLoaded && { fontFamily: fonts.bold }]}>Booking Created!</Text>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={[styles.modalVenue, fontsLoaded && { fontFamily: fonts.bold }]}>{selectedVenue.name}</Text>
              <Text style={[styles.modalTable, fontsLoaded && { fontFamily: fonts.semiBold }]}>{selectedTable?.name}</Text>
              <Text style={[styles.modalDate, fontsLoaded && { fontFamily: fonts.regular }]}>{selectedDate}</Text>
              <Text style={[styles.modalGuests, fontsLoaded && { fontFamily: fonts.regular }]}>{partySize} Guests</Text>
              
              <View style={styles.modalDivider} />
              
              <Text style={[styles.modalDeposit, fontsLoaded && { fontFamily: fonts.medium }]}>
                Deposit Required: <Text style={{ color: selectedVenue.color }}>${selectedTable?.deposit_amount}</Text>
              </Text>
              <Text style={[styles.modalMinSpend, fontsLoaded && { fontFamily: fonts.regular }]}>
                Minimum spend: ${selectedTable?.min_spend}
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={[styles.modalSecondaryText, fontsLoaded && { fontFamily: fonts.semiBold }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: selectedVenue.color }]}
                onPress={handlePayDeposit}
              >
                <Text style={[styles.modalPrimaryText, fontsLoaded && { fontFamily: fonts.bold }]}>Pay Deposit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Helper function to darken color
function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  
  // Venue Selector
  venueScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  venueCard: {
    width: 120,
    height: 90,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  venueLogo: {
    width: 80,
    height: 30,
    marginBottom: 4,
  },
  venueName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  venueType: {
    fontSize: 10,
    color: colors.textMuted,
  },
  selectedDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  // Date Selection
  dateScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  dateCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateCardSelected: {
    backgroundColor: 'rgba(227,24,55,0.1)',
    borderWidth: 2,
  },
  dateDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  dateLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  dateTextSelected: {
    color: colors.textPrimary,
  },
  
  // Tables
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  tableCard: {
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableUnavailable: {
    opacity: 0.5,
  },
  tableImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  tableGradient: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: spacing.md,
  },
  tableInfo: {
    flex: 1,
  },
  tableName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  tableLocation: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  tableStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  tableStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tableStatText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tableFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  featureBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  featureText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  tableRight: {
    alignItems: 'flex-end',
  },
  depositLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  depositAmount: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookedText: {
    fontSize: 10,
    color: colors.error,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  
  // Party Size
  partySizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  partySizeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  partySizeText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    minWidth: 60,
    textAlign: 'center',
  },
  capacityNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  
  // Text Input
  textInput: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  // Book Button
  bookButton: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginTop: spacing.sm,
  },
  modalBody: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  modalVenue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalTable: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  modalDate: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  modalGuests: {
    fontSize: 14,
    color: colors.textMuted,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    marginVertical: spacing.md,
  },
  modalDeposit: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  modalMinSpend: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalSecondaryText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  modalPrimaryText: {
    fontSize: 14,
    color: '#FFF',
  },
});
