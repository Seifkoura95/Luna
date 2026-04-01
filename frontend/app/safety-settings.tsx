import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { AppBackground } from '../src/components/AppBackground';

export default function SafetySettingsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', relationship: 'friend' });
  const [settings, setSettings] = useState({
    shakeToAlert: true,
    shareLocationWithCrew: true,
    notifyVenueStaff: true,
    silentMode: false,
  });

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

  const addContact = async () => {
    if (!newContact.name || !newContact.phone) {
      Alert.alert('Error', 'Please enter name and phone number');
      return;
    }

    try {
      await api.addEmergencyContact(
        newContact.name,
        newContact.phone,
        newContact.relationship,
        newContact.email || undefined
      );
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setShowAddContact(false);
      setNewContact({ name: '', phone: '', email: '', relationship: 'friend' });
      fetchContacts();
      Alert.alert('Success', 'Emergency contact added');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add contact');
    }
  };

  const removeContact = async (contactId: string, contactName: string) => {
    Alert.alert(
      'Remove Contact',
      `Are you sure you want to remove ${contactName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removeEmergencyContact(contactId);
              fetchContacts();
            } catch (e) {
              Alert.alert('Error', 'Failed to remove contact');
            }
          },
        },
      ]
    );
  };

  const relationships = ['friend', 'family', 'partner', 'roommate', 'other'];

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
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SAFETY SETTINGS</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Alert Activation Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ALERT ACTIVATION</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="phone-portrait" size={20} color={colors.accent} />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Shake to Alert</Text>
                  <Text style={styles.settingDesc}>Shake phone 3 times to send alert</Text>
                </View>
              </View>
              <Switch
                value={settings.shakeToAlert}
                onValueChange={(v) => setSettings({ ...settings, shakeToAlert: v })}
                trackColor={{ false: '#333', true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="volume-mute" size={20} color={colors.gold} />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Silent Mode</Text>
                  <Text style={styles.settingDesc}>No sound or vibration when alerting</Text>
                </View>
              </View>
              <Switch
                value={settings.silentMode}
                onValueChange={(v) => setSettings({ ...settings, silentMode: v })}
                trackColor={{ false: '#333', true: colors.accent }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Who Gets Notified */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHO GETS NOTIFIED</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="people" size={20} color="#8B5CF6" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Share Location with Crew</Text>
                  <Text style={styles.settingDesc}>Crew members see your GPS location</Text>
                </View>
              </View>
              <Switch
                value={settings.shareLocationWithCrew}
                onValueChange={(v) => setSettings({ ...settings, shareLocationWithCrew: v })}
                trackColor={{ false: '#333', true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="business" size={20} color="#00D4AA" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Notify Venue Staff</Text>
                  <Text style={styles.settingDesc}>Alert staff at Luna Group venues</Text>
                </View>
              </View>
              <Switch
                value={settings.notifyVenueStaff}
                onValueChange={(v) => setSettings({ ...settings, notifyVenueStaff: v })}
                trackColor={{ false: '#333', true: colors.accent }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>EMERGENCY CONTACTS</Text>
            <TouchableOpacity onPress={() => setShowAddContact(true)}>
              <Ionicons name="add-circle" size={24} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {emergencyContacts.length === 0 ? (
            <View style={styles.emptyContacts}>
              <Text style={styles.emptyText}>No emergency contacts added</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => setShowAddContact(true)}>
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add Contact</Text>
              </TouchableOpacity>
            </View>
          ) : (
            emergencyContacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactIcon}>
                  <Ionicons name="person" size={20} color={colors.accent} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                  <Text style={styles.contactRelation}>{contact.relationship}</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeContact(contact.id, contact.name)}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Add Contact Form */}
        {showAddContact && (
          <View style={styles.addContactForm}>
            <Text style={styles.formTitle}>Add Emergency Contact</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={colors.textMuted}
              value={newContact.name}
              onChangeText={(t) => setNewContact({ ...newContact, name: t })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor={colors.textMuted}
              value={newContact.phone}
              onChangeText={(t) => setNewContact({ ...newContact, phone: t })}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email (optional)"
              placeholderTextColor={colors.textMuted}
              value={newContact.email}
              onChangeText={(t) => setNewContact({ ...newContact, email: t })}
              keyboardType="email-address"
            />
            
            <Text style={styles.inputLabel}>Relationship</Text>
            <View style={styles.relationshipPicker}>
              {relationships.map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[
                    styles.relationshipOption,
                    newContact.relationship === rel && styles.relationshipSelected,
                  ]}
                  onPress={() => setNewContact({ ...newContact, relationship: rel })}
                >
                  <Text
                    style={[
                      styles.relationshipText,
                      newContact.relationship === rel && styles.relationshipTextSelected,
                    ]}
                  >
                    {rel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddContact(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={addContact}>
                <Text style={styles.saveButtonText}>Add Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.textMuted} />
          <Text style={styles.infoText}>
            Emergency contacts will receive an SMS with your location when you trigger an alert. Make sure phone numbers are correct.
          </Text>
        </View>
      </ScrollView>
    </View>
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
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  settingCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  settingDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyContacts: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  addButtonText: {
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  contactPhone: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  contactRelation: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  removeButton: {
    padding: spacing.sm,
  },
  addContactForm: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  relationshipPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  relationshipOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  relationshipSelected: {
    backgroundColor: colors.accent,
  },
  relationshipText: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  relationshipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  formButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
