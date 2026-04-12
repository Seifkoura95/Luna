import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../src/components/Icon';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { AppBackground } from '../src/components/AppBackground';
import { useAuthStore } from '../src/store/authStore';

export default function SafetyPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [alertSent, setAlertSent] = useState(false);

  const fetchContacts = useCallback(async () => {
    try {
      const data = await api.getEmergencyContacts();
      setEmergencyContacts(data.contacts || []);
    } catch (e) {
      console.error('Failed to fetch contacts:', e);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const sendSilentAlert = async () => {
    setLoading(true);
    try {
      // Get location
      const { status } = await Location.requestForegroundPermissionsAsync();
      let latitude = -27.4698;  // Brisbane default
      let longitude = 153.0251;
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      }

      // Vibrate to confirm
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Vibration.vibrate([0, 100, 50, 100]);
      }

      const result = await api.sendSilentAlert(latitude, longitude, undefined, 'button');
      
      setAlertSent(true);
      Alert.alert(
        '🚨 Alert Sent',
        `Your location has been shared with:\n• ${result.notified.crew.length} crew members\n• ${result.notified.emergency_contacts.length} emergency contacts${result.notified.venue ? `\n• ${result.notified.venue} staff` : ''}`,
        [{ text: 'OK' }]
      );

      // Reset after 30 seconds
      setTimeout(() => setAlertSent(false), 30000);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send alert');
    } finally {
      setLoading(false);
    }
  };

  const confirmSendAlert = () => {
    Alert.alert(
      '🚨 Send Emergency Alert?',
      'This will send your location to your crew members, emergency contacts, and nearby venue staff.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Alert', style: 'destructive', onPress: sendSilentAlert },
      ]
    );
  };

  const callEmergency = () => {
    Alert.alert(
      'Call 000',
      'This will call emergency services.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call 000', style: 'destructive', onPress: () => {
          if (Platform.OS !== 'web') {
            Linking.openURL('tel:000');
          }
        }},
      ]
    );
  };

  return (
    <View style={styles.container}>
      <AppBackground />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SAFETY</Text>
          <TouchableOpacity onPress={() => router.push('/safety-settings')} style={styles.settingsButton}>
            <Icon name="settings-outline" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Emergency Alert Button */}
        <TouchableOpacity
          style={[styles.emergencyButton, alertSent && styles.emergencyButtonSent]}
          onPress={confirmSendAlert}
          disabled={loading || alertSent}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={alertSent ? ['#00D4AA', '#00A080'] : ['#E31837', '#B01030']}
            style={styles.emergencyGradient}
          >
            <Icon 
              name={alertSent ? 'checkmark-circle' : 'warning'} 
              size={48} 
              color="#fff" 
            />
            <Text style={styles.emergencyText}>
              {alertSent ? 'ALERT SENT' : loading ? 'SENDING...' : 'SEND ALERT'}
            </Text>
            <Text style={styles.emergencySubtext}>
              {alertSent ? 'Help is on the way' : 'Tap to alert crew & contacts'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Call 000 Button */}
        <TouchableOpacity style={styles.call000Button} onPress={callEmergency}>
          <Icon name="call" size={24} color="#fff" />
          <Text style={styles.call000Text}>CALL 000</Text>
        </TouchableOpacity>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>WHAT HAPPENS WHEN YOU ALERT</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: colors.accent + '20' }]}>
                <Icon name="location" size={20} color={colors.accent} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Location Shared</Text>
                <Text style={styles.infoText}>Your GPS location is sent to all recipients</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: '#8B5CF6' + '20' }]}>
                <Icon name="people" size={20} color="#8B5CF6" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Crew Notified</Text>
                <Text style={styles.infoText}>All your crew members get an instant alert</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: colors.gold + '20' }]}>
                <Icon name="call" size={20} color={colors.gold} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Contacts Alerted</Text>
                <Text style={styles.infoText}>Emergency contacts receive SMS (if configured)</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: '#00D4AA' + '20' }]}>
                <Icon name="business" size={20} color="#00D4AA" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Venue Staff</Text>
                <Text style={styles.infoText}>Staff at nearby Luna venues are notified</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.contactsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>EMERGENCY CONTACTS</Text>
            <TouchableOpacity onPress={() => router.push('/safety-settings')}>
              <Text style={styles.manageText}>Manage</Text>
            </TouchableOpacity>
          </View>

          {emergencyContacts.length === 0 ? (
            <View style={styles.noContacts}>
              <Icon name="person-add-outline" size={32} color={colors.textMuted} />
              <Text style={styles.noContactsText}>No emergency contacts set up</Text>
              <TouchableOpacity 
                style={styles.addContactButton}
                onPress={() => router.push('/safety-settings')}
              >
                <Text style={styles.addContactText}>Add Contact</Text>
              </TouchableOpacity>
            </View>
          ) : (
            emergencyContacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactIcon}>
                  <Icon name="person" size={20} color={colors.accent} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                </View>
                <Text style={styles.contactRelation}>{contact.relationship}</Text>
              </View>
            ))
          )}
        </View>

        {/* Discreet Alert Tip */}
        <View style={styles.tipSection}>
          <Icon name="bulb" size={20} color={colors.gold} />
          <Text style={styles.tipText}>
            Tip: You can also send a silent alert by shaking your phone 3 times quickly (enable in Safety Settings)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const Linking = require('react-native').Linking;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  settingsButton: {
    padding: spacing.xs,
  },
  emergencyButton: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  emergencyButtonSent: {
    opacity: 0.9,
  },
  emergencyGradient: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginTop: spacing.md,
    letterSpacing: 2,
  },
  emergencySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  call000Button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  call000Text: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  infoSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  infoText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  contactsSection: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  manageText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  noContacts: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
  },
  noContactsText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  addContactButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  addContactText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  contactPhone: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  contactRelation: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  tipSection: {
    flexDirection: 'row',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: colors.gold,
    lineHeight: 18,
  },
});
