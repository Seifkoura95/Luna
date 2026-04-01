import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../src/components/AppBackground';
import DateTimePicker from '@react-native-community/datetimepicker';

const MUSIC_GENRES = [
  'house', 'techno', 'hip-hop', 'rnb', 'pop', 'latin', 'edm', 'dnb', 'disco', 'afrobeats', 'rock', 'indie'
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState(user?.gender || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [instagramHandle, setInstagramHandle] = useState(user?.instagram_handle || '');
  const [musicPreferences, setMusicPreferences] = useState<string[]>(user?.music_preferences || []);
  
  // Notification preferences
  const [pushEnabled, setPushEnabled] = useState(user?.notification_preferences?.push_enabled ?? true);
  const [emailEnabled, setEmailEnabled] = useState(user?.notification_preferences?.email_enabled ?? true);
  const [eventsEnabled, setEventsEnabled] = useState(user?.notification_preferences?.events ?? true);
  const [auctionsEnabled, setAuctionsEnabled] = useState(user?.notification_preferences?.auctions ?? true);
  const [rewardsEnabled, setRewardsEnabled] = useState(user?.notification_preferences?.rewards ?? true);
  
  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Email change state
  const [showEmailSection, setShowEmailSection] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    
    setSaving(true);
    try {
      const result = await api.updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        date_of_birth: dateOfBirth || undefined,
        gender: gender || undefined,
        bio: bio.trim() || undefined,
        instagram_handle: instagramHandle.trim() || undefined,
        music_preferences: musicPreferences.length > 0 ? musicPreferences : undefined,
        notification_preferences: {
          push_enabled: pushEnabled,
          email_enabled: emailEnabled,
          events: eventsEnabled,
          auctions: auctionsEnabled,
          rewards: rewardsEnabled,
        },
      });
      
      if (result.success && result.user) {
        setUser(result.user);
        Alert.alert('Success', 'Profile updated successfully');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      Alert.alert('Success', 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !emailPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    setChangingEmail(true);
    try {
      const result = await api.changeEmail(newEmail, emailPassword);
      if (result.success) {
        // Update local user state
        setUser({ ...user, email: result.new_email });
        Alert.alert('Success', 'Email changed successfully');
        setNewEmail('');
        setEmailPassword('');
        setShowEmailSection(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change email');
    } finally {
      setChangingEmail(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAccount();
              const { logout } = useAuthStore.getState();
              logout();
              router.replace('/login');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const toggleMusicGenre = (genre: string) => {
    if (musicPreferences.includes(genre)) {
      setMusicPreferences(musicPreferences.filter(g => g !== genre));
    } else {
      setMusicPreferences([...musicPreferences, genre]);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const formatted = selectedDate.toISOString().split('T')[0];
      setDateOfBirth(formatted);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Not set';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <AppBackground />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Photo Section */}
          <View style={styles.photoSection}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={[colors.accent, colors.accentDark]}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </Text>
              </LinearGradient>
            </View>
            <Text style={styles.photoHint}>Tap to change photo</Text>
          </View>

          {/* Basic Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.emailRow}>
                <Text style={styles.emailText}>{user?.email || 'Not set'}</Text>
                <TouchableOpacity onPress={() => setShowEmailSection(!showEmailSection)}>
                  <Text style={styles.changeLink}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {showEmailSection && (
              <View style={styles.changeSection}>
                <TextInput
                  style={styles.input}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="New email address"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, { marginTop: spacing.sm }]}
                  value={emailPassword}
                  onChangeText={setEmailPassword}
                  placeholder="Current password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                />
                <TouchableOpacity 
                  style={styles.changeButton}
                  onPress={handleChangeEmail}
                  disabled={changingEmail}
                >
                  {changingEmail ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.changeButtonText}>Update Email</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+61 4XX XXX XXX"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date of Birth</Text>
              {Platform.OS === 'web' ? (
                // Web fallback - use text input with date format
                <TextInput
                  style={styles.input}
                  value={dateOfBirth}
                  onChangeText={(text) => {
                    // Accept format YYYY-MM-DD
                    setDateOfBirth(text);
                  }}
                  placeholder="YYYY-MM-DD (e.g., 1995-06-15)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="default"
                />
              ) : (
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {formatDisplayDate(dateOfBirth)}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            
            {showDatePicker && Platform.OS !== 'web' && (
              <DateTimePicker
                value={dateOfBirth ? new Date(dateOfBirth) : new Date(2000, 0, 1)}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate())}
                minimumDate={new Date(1920, 0, 1)}
              />
            )}
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gender</Text>
              <View style={styles.genderOptions}>
                {GENDER_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.genderOption,
                      gender === option.value && styles.genderOptionSelected
                    ]}
                    onPress={() => setGender(option.value)}
                  >
                    <Text style={[
                      styles.genderOptionText,
                      gender === option.value && styles.genderOptionTextSelected
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About You</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
              />
              <Text style={styles.charCount}>{bio.length}/500</Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Instagram Handle</Text>
              <View style={styles.handleInputContainer}>
                <Text style={styles.handlePrefix}>@</Text>
                <TextInput
                  style={styles.handleInput}
                  value={instagramHandle}
                  onChangeText={setInstagramHandle}
                  placeholder="username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Music Preferences</Text>
              <View style={styles.genreGrid}>
                {MUSIC_GENRES.map(genre => (
                  <TouchableOpacity
                    key={genre}
                    style={[
                      styles.genreChip,
                      musicPreferences.includes(genre) && styles.genreChipSelected
                    ]}
                    onPress={() => toggleMusicGenre(genre)}
                  >
                    <Text style={[
                      styles.genreChipText,
                      musicPreferences.includes(genre) && styles.genreChipTextSelected
                    ]}>
                      {genre.charAt(0).toUpperCase() + genre.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Notifications Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="notifications" size={20} color={colors.textSecondary} />
                <Text style={styles.toggleLabel}>Push Notifications</Text>
              </View>
              <TouchableOpacity 
                style={[styles.toggle, pushEnabled && styles.toggleActive]}
                onPress={() => setPushEnabled(!pushEnabled)}
              >
                <View style={[styles.toggleKnob, pushEnabled && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="mail" size={20} color={colors.textSecondary} />
                <Text style={styles.toggleLabel}>Email Updates</Text>
              </View>
              <TouchableOpacity 
                style={[styles.toggle, emailEnabled && styles.toggleActive]}
                onPress={() => setEmailEnabled(!emailEnabled)}
              >
                <View style={[styles.toggleKnob, emailEnabled && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="calendar" size={20} color={colors.textSecondary} />
                <Text style={styles.toggleLabel}>Event Reminders</Text>
              </View>
              <TouchableOpacity 
                style={[styles.toggle, eventsEnabled && styles.toggleActive]}
                onPress={() => setEventsEnabled(!eventsEnabled)}
              >
                <View style={[styles.toggleKnob, eventsEnabled && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="pricetag" size={20} color={colors.textSecondary} />
                <Text style={styles.toggleLabel}>Auction Alerts</Text>
              </View>
              <TouchableOpacity 
                style={[styles.toggle, auctionsEnabled && styles.toggleActive]}
                onPress={() => setAuctionsEnabled(!auctionsEnabled)}
              >
                <View style={[styles.toggleKnob, auctionsEnabled && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="gift" size={20} color={colors.textSecondary} />
                <Text style={styles.toggleLabel}>Rewards & Points</Text>
              </View>
              <TouchableOpacity 
                style={[styles.toggle, rewardsEnabled && styles.toggleActive]}
                onPress={() => setRewardsEnabled(!rewardsEnabled)}
              >
                <View style={[styles.toggleKnob, rewardsEnabled && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Security Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            
            <TouchableOpacity 
              style={styles.securityRow}
              onPress={() => setShowPasswordSection(!showPasswordSection)}
            >
              <View style={styles.securityInfo}>
                <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
                <Text style={styles.securityLabel}>Change Password</Text>
              </View>
              <Ionicons 
                name={showPasswordSection ? "chevron-up" : "chevron-forward"} 
                size={20} 
                color={colors.textMuted} 
              />
            </TouchableOpacity>
            
            {showPasswordSection && (
              <View style={styles.changeSection}>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Current password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                />
                <TextInput
                  style={[styles.input, { marginTop: spacing.sm }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                />
                <TextInput
                  style={[styles.input, { marginTop: spacing.sm }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                />
                <TouchableOpacity 
                  style={styles.changeButton}
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.changeButtonText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Danger Zone */}
          <View style={[styles.section, styles.dangerSection]}>
            <Text style={[styles.sectionTitle, { color: colors.error }]}>Danger Zone</Text>
            
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDeleteAccount}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </TouchableOpacity>
            
            <Text style={styles.deleteWarning}>
              This will permanently delete your account and all associated data.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  saveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    marginBottom: spacing.sm,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
  },
  photoHint: {
    fontSize: 14,
    color: colors.textMuted,
  },
  section: {
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.sm + 2,
  },
  charCount: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  emailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emailText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  changeLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  changeSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  changeButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  genderOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  genderOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genderOptionSelected: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  genderOptionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  genderOptionTextSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
  handleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
  },
  handlePrefix: {
    fontSize: 16,
    color: colors.textMuted,
  },
  handleInput: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.textPrimary,
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  genreChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genreChipSelected: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  genreChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  genreChipTextSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggleLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.textMuted,
  },
  toggleKnobActive: {
    backgroundColor: '#fff',
    marginLeft: 'auto',
  },
  securityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  securityLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  dangerSection: {
    borderColor: colors.error + '30',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
  deleteWarning: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
