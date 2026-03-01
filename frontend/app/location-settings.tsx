import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius } from '../src/theme/colors';
import { AppBackground } from '../src/components/AppBackground';
import {
  requestLocationPermissions,
  checkLocationPermissions,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  isBackgroundLocationTrackingActive,
  getCurrentLocation,
} from '../src/utils/geofencing';

export default function LocationSettingsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [locationAlertsEnabled, setLocationAlertsEnabled] = useState(true);
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [permissions, setPermissions] = useState({ foreground: false, background: false });
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load location alerts preference
      const alertsEnabled = await AsyncStorage.getItem('@luna_location_alerts');
      setLocationAlertsEnabled(alertsEnabled !== 'false');
      
      // Check permissions
      if (Platform.OS !== 'web') {
        const perms = await checkLocationPermissions();
        setPermissions(perms);
        
        // Check if tracking is active
        const active = await isBackgroundLocationTrackingActive();
        setIsTrackingActive(active);
        
        // Get current location if permission granted
        if (perms.foreground) {
          const location = await getCurrentLocation();
          if (location) {
            setCurrentLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        }
      }
    } catch (e) {
      console.error('Error loading location settings:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggleLocationAlerts = async (value: boolean) => {
    try {
      setLocationAlertsEnabled(value);
      await AsyncStorage.setItem('@luna_location_alerts', value ? 'true' : 'false');
      
      if (Platform.OS !== 'web') {
        if (value) {
          // Request permissions and start tracking
          const hasPermission = await requestLocationPermissions();
          if (hasPermission) {
            const started = await startBackgroundLocationTracking();
            setIsTrackingActive(started);
            if (started) {
              Alert.alert(
                'Location Alerts Enabled',
                'You\'ll receive notifications when you\'re near Luna Group venues.'
              );
            }
          } else {
            setLocationAlertsEnabled(false);
            await AsyncStorage.setItem('@luna_location_alerts', 'false');
            Alert.alert(
              'Permission Required',
              'Location permission is required for venue proximity alerts. Please enable it in your device settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
            );
          }
        } else {
          // Stop tracking
          await stopBackgroundLocationTracking();
          setIsTrackingActive(false);
        }
        
        // Refresh permissions
        const perms = await checkLocationPermissions();
        setPermissions(perms);
      }
    } catch (e) {
      console.error('Error toggling location alerts:', e);
      Alert.alert('Error', 'Failed to update location settings');
    }
  };

  const openDeviceSettings = () => {
    Linking.openSettings();
  };

  const refreshLocation = async () => {
    if (Platform.OS === 'web') return;
    
    try {
      const location = await getCurrentLocation();
      if (location) {
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (e) {
      console.error('Error getting location:', e);
    }
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
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>LOCATION SETTINGS</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Main Toggle */}
        <View style={styles.section}>
          <View style={styles.mainToggleCard}>
            <View style={styles.toggleHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="location" size={28} color={colors.accent} />
              </View>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Venue Proximity Alerts</Text>
                <Text style={styles.toggleDesc}>
                  Get notified when you're near Luna Group venues
                </Text>
              </View>
            </View>
            <Switch
              value={locationAlertsEnabled}
              onValueChange={handleToggleLocationAlerts}
              trackColor={{ false: '#333', true: colors.accent }}
              thumbColor="#fff"
              disabled={isLoading}
            />
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HOW IT WORKS</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoBullet}>
                <Ionicons name="walk" size={18} color={colors.accent} />
              </View>
              <Text style={styles.infoText}>
                When you're within 200 meters of a Luna Group venue, you'll receive a notification
              </Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoBullet}>
                <Ionicons name="time" size={18} color={colors.gold} />
              </View>
              <Text style={styles.infoText}>
                Notifications are limited to once per venue per day to avoid spam
              </Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoBullet}>
                <Ionicons name="battery-half" size={18} color="#00D4AA" />
              </View>
              <Text style={styles.infoText}>
                Uses efficient background location tracking with minimal battery impact
              </Text>
            </View>
          </View>
        </View>

        {/* Permission Status */}
        {Platform.OS !== 'web' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PERMISSION STATUS</Text>
            <View style={styles.permissionCard}>
              <View style={styles.permissionRow}>
                <View style={styles.permissionInfo}>
                  <Ionicons 
                    name={permissions.foreground ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={permissions.foreground ? "#00D4AA" : colors.accent} 
                  />
                  <Text style={styles.permissionText}>Location Access</Text>
                </View>
                <Text style={[
                  styles.permissionStatus,
                  { color: permissions.foreground ? "#00D4AA" : colors.accent }
                ]}>
                  {permissions.foreground ? "Granted" : "Not Granted"}
                </Text>
              </View>
              
              <View style={styles.permissionRow}>
                <View style={styles.permissionInfo}>
                  <Ionicons 
                    name={permissions.background ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={permissions.background ? "#00D4AA" : colors.gold} 
                  />
                  <Text style={styles.permissionText}>Background Location</Text>
                </View>
                <Text style={[
                  styles.permissionStatus,
                  { color: permissions.background ? "#00D4AA" : colors.gold }
                ]}>
                  {permissions.background ? "Granted" : "Not Granted"}
                </Text>
              </View>
              
              <View style={styles.permissionRow}>
                <View style={styles.permissionInfo}>
                  <Ionicons 
                    name={isTrackingActive ? "radio" : "radio-outline"} 
                    size={20} 
                    color={isTrackingActive ? "#00D4AA" : colors.textMuted} 
                  />
                  <Text style={styles.permissionText}>Tracking Active</Text>
                </View>
                <Text style={[
                  styles.permissionStatus,
                  { color: isTrackingActive ? "#00D4AA" : colors.textMuted }
                ]}>
                  {isTrackingActive ? "Active" : "Inactive"}
                </Text>
              </View>
              
              {(!permissions.foreground || !permissions.background) && (
                <TouchableOpacity style={styles.settingsButton} onPress={openDeviceSettings}>
                  <Ionicons name="settings" size={18} color="#fff" />
                  <Text style={styles.settingsButtonText}>Open Device Settings</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Current Location Debug */}
        {currentLocation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CURRENT LOCATION</Text>
            <View style={styles.locationCard}>
              <View style={styles.locationInfo}>
                <Ionicons name="navigate" size={20} color={colors.accent} />
                <View>
                  <Text style={styles.locationCoord}>
                    Lat: {currentLocation.latitude.toFixed(6)}
                  </Text>
                  <Text style={styles.locationCoord}>
                    Lng: {currentLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.refreshButton} onPress={refreshLocation}>
                <Ionicons name="refresh" size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Supported Venues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORTED VENUES</Text>
          <View style={styles.venueList}>
            {[
              { name: 'Eclipse Brisbane', icon: 'moon' },
              { name: 'After Dark', icon: 'moon-outline' },
              { name: 'Su Casa Brisbane', icon: 'home' },
              { name: 'Su Casa Gold Coast', icon: 'home-outline' },
              { name: 'Juju Mermaid Beach', icon: 'fish' },
            ].map((venue, index) => (
              <View key={index} style={styles.venueItem}>
                <Ionicons name={venue.icon as any} size={18} color={colors.accent} />
                <Text style={styles.venueName}>{venue.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Privacy Note */}
        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark" size={20} color={colors.textMuted} />
          <Text style={styles.privacyText}>
            Your location data is only used to detect proximity to Luna Group venues. 
            We never share your precise location with third parties.
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
    paddingBottom: 100,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  mainToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  toggleDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  infoBullet: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    paddingTop: 4,
  },
  permissionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  permissionText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  permissionStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  settingsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  locationCoord: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  refreshButton: {
    padding: spacing.sm,
  },
  venueList: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  venueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  venueName: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  privacyNote: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
