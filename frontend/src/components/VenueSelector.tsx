import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
import { Icon } from './Icon';
import { api } from '../utils/api';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface Venue {
  id: string;
  name: string;
  type: string;
  region: string;
  accent_color: string;
  description: string;
  image_url: string;
}

interface VenueSelectorProps {
  selectedVenueId: string;
  onSelectVenue: (venueId: string) => void;
  compact?: boolean;
}

export const VenueSelector: React.FC<VenueSelectorProps> = ({
  selectedVenueId,
  onSelectVenue,
  compact = false,
}) => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  useEffect(() => {
    fetchVenues();
  }, []);

  useEffect(() => {
    if (venues.length > 0) {
      const venue = venues.find(v => v.id === selectedVenueId);
      setSelectedVenue(venue || venues[0]);
    }
  }, [selectedVenueId, venues]);

  const fetchVenues = async () => {
    try {
      const data = await api.getVenues();
      setVenues(data);
    } catch (e) {
      console.error('Failed to fetch venues:', e);
    }
  };

  const handleSelectVenue = (venue: Venue) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedVenue(venue);
    onSelectVenue(venue.id);
    setModalVisible(false);
  };

  if (!selectedVenue) return null;

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactSelector}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.compactText}>{selectedVenue.name}</Text>
        <Icon name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[colors.backgroundCard, colors.backgroundElevated]}
          style={styles.selectorGradient}
        >
          <View style={styles.selectorContent}>
            <View style={styles.venueInfo}>
              <Text style={styles.venueName}>{selectedVenue.name}</Text>
              <Text style={styles.venueLocation}>{selectedVenue.location}</Text>
            </View>
            <View style={styles.selectorIcon}>
              <Icon name="location" size={20} color={selectedVenue.accent_color} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Venue</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Icon name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.venuesList}
              >
                {/* Brisbane Venues */}
                <Text style={styles.regionTitle}>BRISBANE</Text>
                {venues
                  .filter(v => v.region === 'brisbane')
                  .map(venue => (
                    <TouchableOpacity
                      key={venue.id}
                      style={[
                        styles.venueCard,
                        selectedVenue?.id === venue.id && styles.venueCardSelected,
                      ]}
                      onPress={() => handleSelectVenue(venue)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: venue.image_url }} style={styles.venueImage} />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.9)']}
                        style={styles.venueOverlay}
                      >
                        <View style={styles.venueCardContent}>
                          <Text style={styles.venueCardName}>{venue.name}</Text>
                          <Text style={styles.venueCardType}>{venue.type.toUpperCase()}</Text>
                        </View>
                        {selectedVenue?.id === venue.id && (
                          <View style={styles.selectedBadge}>
                            <Icon name="checkmark-circle" size={24} color={colors.success} />
                          </View>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}

                {/* Gold Coast Venues */}
                <Text style={[styles.regionTitle, { marginTop: spacing.lg }]}>GOLD COAST</Text>
                {venues
                  .filter(v => v.region === 'gold_coast')
                  .map(venue => (
                    <TouchableOpacity
                      key={venue.id}
                      style={[
                        styles.venueCard,
                        selectedVenue?.id === venue.id && styles.venueCardSelected,
                      ]}
                      onPress={() => handleSelectVenue(venue)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: venue.image_url }} style={styles.venueImage} />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.9)']}
                        style={styles.venueOverlay}
                      >
                        <View style={styles.venueCardContent}>
                          <Text style={styles.venueCardName}>{venue.name}</Text>
                          <Text style={styles.venueCardType}>{venue.type.toUpperCase()}</Text>
                        </View>
                        {selectedVenue?.id === venue.id && (
                          <View style={styles.selectedBadge}>
                            <Icon name="checkmark-circle" size={24} color={colors.success} />
                          </View>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  compactSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  selectorButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  selectorGradient: {
    padding: spacing.md,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  venueInfo: {
    flex: 1,
  },
  venueName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  venueLocation: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  selectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
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
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
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
  venuesList: {
    paddingBottom: spacing.xl,
  },
  regionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  venueCard: {
    height: 140,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
  },
  venueCardSelected: {
    borderColor: colors.success,
  },
  venueImage: {
    width: '100%',
    height: '100%',
  },
  venueOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  venueCardContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  venueCardName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  venueCardType: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  selectedBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
});