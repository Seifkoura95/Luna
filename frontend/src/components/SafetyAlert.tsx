import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
import { api } from '../utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface SafetyAlertProps {
  visible: boolean;
  onClose: () => void;
  crews: any[];
  venues: any[];
  currentVenueId?: string;
}

interface AlertType {
  id: string;
  icon: string;
  label: string;
  description: string;
  color: string;
  urgent: boolean;
}

const ALERT_TYPES: AlertType[] = [
  {
    id: 'emergency',
    icon: 'warning',
    label: 'Emergency',
    description: 'I need immediate help',
    color: '#FF0000',
    urgent: true,
  },
  {
    id: 'uncomfortable',
    icon: 'alert-circle',
    label: 'Uncomfortable',
    description: 'Someone is making me uncomfortable',
    color: '#FF6600',
    urgent: false,
  },
  {
    id: 'need_help',
    icon: 'hand-left',
    label: 'Need Help',
    description: 'I need assistance',
    color: '#FFAA00',
    urgent: false,
  },
  {
    id: 'lost',
    icon: 'locate',
    label: 'Lost / Separated',
    description: "I can't find my group",
    color: '#00AAFF',
    urgent: false,
  },
];

export const SafetyAlert: React.FC<SafetyAlertProps> = ({
  visible,
  onClose,
  crews,
  venues,
  currentVenueId,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedAlertType, setSelectedAlertType] = useState<string | null>(null);
  const [selectedCrew, setSelectedCrew] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(currentVenueId || null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [sentResult, setSentResult] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      getLocation();
      // Auto-select first crew if only one
      if (crews.length === 1) {
        setSelectedCrew(crews[0].id);
      }
    } else {
      // Reset state when closing
      setSelectedAlertType(null);
      setMessage('');
      setAlertSent(false);
      setSentResult(null);
    }
  }, [visible, crews]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(true);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      setLocationError(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError(true);
    }
  };

  const confirmAndSendAlert = () => {
    if (!selectedAlertType) {
      Alert.alert('Select Alert Type', 'Please select what kind of help you need.');
      return;
    }

    if (!location) {
      Alert.alert('Location Required', 'We need your location to help you. Please enable location services.');
      return;
    }

    const alertType = ALERT_TYPES.find(a => a.id === selectedAlertType);
    const alertName = alertType?.label || 'Safety Alert';
    
    Alert.alert(
      'Confirm Alert',
      `Are you sure you want to send a "${alertName}" alert? This will notify ${selectedCrew ? 'your crew and ' : ''}${selectedVenue ? 'venue staff' : 'emergency contacts'} with your current location.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send Alert', 
          style: 'destructive',
          onPress: handleSendAlert 
        },
      ]
    );
  };

  const handleSendAlert = async () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    setIsSending(true);

    try {
      const result = await api.sendSafetyAlert(
        selectedAlertType!,
        location!.latitude,
        location!.longitude,
        selectedVenue || undefined,
        selectedCrew || undefined,
        message || undefined
      );

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setSentResult(result);
      setAlertSent(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send alert. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const renderAlertTypeButton = (alertType: AlertType) => {
    const isSelected = selectedAlertType === alertType.id;
    return (
      <TouchableOpacity
        key={alertType.id}
        style={[
          styles.alertTypeButton,
          isSelected && { borderColor: alertType.color, backgroundColor: alertType.color + '20' },
        ]}
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedAlertType(alertType.id);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.alertTypeIcon, { backgroundColor: alertType.color + '30' }]}>
          <Ionicons name={alertType.icon as any} size={28} color={alertType.color} />
        </View>
        <View style={styles.alertTypeText}>
          <Text style={[styles.alertTypeLabel, isSelected && { color: alertType.color }]}>
            {alertType.label}
          </Text>
          <Text style={styles.alertTypeDesc}>{alertType.description}</Text>
        </View>
        {alertType.urgent && (
          <View style={[styles.urgentBadge, { backgroundColor: alertType.color }]}>
            <Text style={styles.urgentText}>URGENT</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (alertSent) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <LinearGradient colors={['#000', '#0A0A0A']} style={styles.gradient}>
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={80} color="#00FF00" />
              </View>
              <Text style={styles.successTitle}>Alert Sent!</Text>
              <Text style={styles.successSubtitle}>Help is on the way</Text>
              
              {sentResult?.notified_crew_members?.length > 0 && (
                <View style={styles.notifiedSection}>
                  <Text style={styles.notifiedLabel}>Crew members notified:</Text>
                  <Text style={styles.notifiedList}>
                    {sentResult.notified_crew_members.join(', ')}
                  </Text>
                </View>
              )}
              
              {sentResult?.notified_venues?.length > 0 && (
                <View style={styles.notifiedSection}>
                  <Text style={styles.notifiedLabel}>Venue staff alerted:</Text>
                  <Text style={styles.notifiedList}>
                    {sentResult.notified_venues.join(', ')}
                  </Text>
                </View>
              )}

              <View style={styles.locationSent}>
                <Ionicons name="location" size={20} color={colors.accent} />
                <Text style={styles.locationSentText}>
                  Your live location has been shared
                </Text>
              </View>

              <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                <Text style={styles.doneButtonText}>DONE</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sendAnotherButton} onPress={() => setAlertSent(false)}>
                <Text style={styles.sendAnotherText}>Send Another Alert</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient colors={['#000', '#0A0A0A']} style={styles.gradient}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Ionicons name="shield-checkmark" size={32} color={colors.accent} />
              <Text style={styles.headerTitle}>SAFETY ALERT</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Location Status */}
            <View style={[styles.locationStatus, locationError && styles.locationError]}>
              <Ionicons 
                name={locationError ? 'location-outline' : 'location'} 
                size={20} 
                color={locationError ? colors.textMuted : '#00FF00'} 
              />
              <Text style={[styles.locationText, locationError && styles.locationTextError]}>
                {locationError 
                  ? 'Location unavailable - please enable' 
                  : 'Location ready to share'}
              </Text>
              {locationError && (
                <TouchableOpacity onPress={getLocation}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Alert Type Selection */}
            <Text style={styles.sectionLabel}>What's happening?</Text>
            <View style={styles.alertTypes}>
              {ALERT_TYPES.map(renderAlertTypeButton)}
            </View>

            {/* Notify Options */}
            <Text style={styles.sectionLabel}>Who should be notified?</Text>
            
            {/* Crews */}
            {crews.length > 0 && (
              <View style={styles.optionSection}>
                <Text style={styles.optionLabel}>Your Crews</Text>
                <View style={styles.optionButtons}>
                  {crews.map((crew) => (
                    <TouchableOpacity
                      key={crew.id}
                      style={[
                        styles.optionButton,
                        selectedCrew === crew.id && styles.optionButtonSelected,
                      ]}
                      onPress={() => setSelectedCrew(selectedCrew === crew.id ? null : crew.id)}
                    >
                      <Ionicons 
                        name={selectedCrew === crew.id ? 'checkbox' : 'square-outline'} 
                        size={20} 
                        color={selectedCrew === crew.id ? colors.accent : colors.textMuted} 
                      />
                      <Text style={styles.optionButtonText}>{crew.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Venues */}
            <View style={styles.optionSection}>
              <Text style={styles.optionLabel}>Alert Venue Staff</Text>
              <View style={styles.optionButtons}>
                {venues.slice(0, 4).map((venue) => (
                  <TouchableOpacity
                    key={venue.id}
                    style={[
                      styles.optionButton,
                      selectedVenue === venue.id && styles.optionButtonSelected,
                    ]}
                    onPress={() => setSelectedVenue(selectedVenue === venue.id ? null : venue.id)}
                  >
                    <Ionicons 
                      name={selectedVenue === venue.id ? 'checkbox' : 'square-outline'} 
                      size={20} 
                      color={selectedVenue === venue.id ? colors.accent : colors.textMuted} 
                    />
                    <Text style={styles.optionButtonText}>{venue.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Optional Message */}
            <Text style={styles.sectionLabel}>Additional message (optional)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Tell us more..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={200}
            />

            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Send Button */}
          <View style={[styles.sendButtonContainer, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!selectedAlertType || !location) && styles.sendButtonDisabled,
              ]}
              onPress={handleSendAlert}
              disabled={isSending || !selectedAlertType || !location}
            >
              {isSending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send" size={22} color="#FFF" />
                  <Text style={styles.sendButtonText}>SEND ALERT</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
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
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,255,0,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  locationError: {
    backgroundColor: 'rgba(255,0,0,0.1)',
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: '#00FF00',
  },
  locationTextError: {
    color: colors.textMuted,
  },
  retryText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  alertTypes: {
    gap: spacing.sm,
  },
  alertTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  alertTypeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTypeText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  alertTypeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  alertTypeDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  urgentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
  optionSection: {
    marginTop: spacing.sm,
  },
  optionLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  optionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  optionButtonSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(227,24,55,0.1)',
  },
  optionButtonText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  messageInput: {
    backgroundColor: '#111',
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  successIcon: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  notifiedSection: {
    width: '100%',
    backgroundColor: '#111',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  notifiedLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  notifiedList: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  locationSent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  locationSentText: {
    fontSize: 14,
    color: colors.accent,
  },
  doneButton: {
    width: '100%',
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  sendAnotherButton: {
    paddingVertical: spacing.sm,
  },
  sendAnotherText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default SafetyAlert;
