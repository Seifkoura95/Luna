/**
 * Geofencing Service for Luna Group VIP
 * Handles background location tracking and proximity notifications
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Lazy import api to break circular dependency
let apiModule: any = null;
const getApi = () => {
  if (!apiModule) {
    apiModule = require('./api').api;
  }
  return apiModule;
};

const LOCATION_TASK_NAME = 'luna-geofence-tracking';
const GEOFENCES_STORAGE_KEY = '@luna_geofences';
const LAST_CHECK_KEY = '@luna_last_location_check';

// Types
interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  notification_title: string;
  notification_body: string;
  venue_id?: string;
  is_active: boolean;
}

interface LocationCheckResult {
  triggered: Array<{
    id: string;
    name: string;
    distance: number;
  }>;
  notifications_sent: number;
  message: string;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Request location permissions
 */
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    // Request foreground permission first
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      console.log('Foreground location permission denied');
      return false;
    }

    // Request background permission for Android
    if (Platform.OS === 'android') {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.log('Background location permission denied');
        return false;
      }
    }

    // For iOS, background permission is included with foreground when specified in app.json
    return true;
  } catch (error) {
    console.error('Error requesting location permissions:', error);
    return false;
  }
}

/**
 * Check if location permissions are granted
 */
export async function checkLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
  const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();

  return {
    foreground: foregroundStatus === 'granted',
    background: backgroundStatus === 'granted',
  };
}

/**
 * Fetch geofences from API and cache them
 */
export async function fetchAndCacheGeofences(token: string): Promise<Geofence[]> {
  try {
    const response = await getApi().get('/geofences', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const geofences = response.data.geofences || [];
    
    // Cache geofences locally for background task
    await AsyncStorage.setItem(GEOFENCES_STORAGE_KEY, JSON.stringify(geofences));
    
    return geofences;
  } catch (error) {
    console.error('Error fetching geofences:', error);
    
    // Try to return cached geofences
    const cached = await AsyncStorage.getItem(GEOFENCES_STORAGE_KEY);
    return cached ? JSON.parse(cached) : [];
  }
}

/**
 * Get cached geofences
 */
export async function getCachedGeofences(): Promise<Geofence[]> {
  try {
    const cached = await AsyncStorage.getItem(GEOFENCES_STORAGE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('Error getting cached geofences:', error);
    return [];
  }
}

/**
 * Check current location against geofences (calls backend)
 */
export async function checkLocationAgainstGeofences(
  latitude: number,
  longitude: number,
  token: string
): Promise<LocationCheckResult | null> {
  try {
    const response = await getApi().post(
      '/geofences/check-location',
      { latitude, longitude },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
  } catch (error) {
    console.error('Error checking location:', error);
    return null;
  }
}

/**
 * Local geofence check (without API call) for background task
 * Returns geofences the user is within
 */
export function checkLocalGeofences(
  latitude: number,
  longitude: number,
  geofences: Geofence[]
): Geofence[] {
  return geofences.filter((geofence) => {
    const distance = calculateDistance(
      latitude,
      longitude,
      geofence.latitude,
      geofence.longitude
    );
    return distance <= geofence.radius;
  });
}

/**
 * Start background location tracking
 */
export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    const hasPermissions = await requestLocationPermissions();
    if (!hasPermissions) {
      console.log('Location permissions not granted');
      return false;
    }

    // Check if task is already running
    const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (hasStarted) {
      console.log('Background location tracking already running');
      return true;
    }

    // Start location updates
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000, // Check every 60 seconds
      distanceInterval: 50, // Or when moved 50 meters
      deferredUpdatesInterval: 60000,
      deferredUpdatesDistance: 50,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Luna Group VIP',
        notificationBody: 'Location tracking active for nearby venue alerts',
        notificationColor: '#9333ea',
      },
      activityType: Location.ActivityType.Other,
    });

    console.log('Background location tracking started');
    return true;
  } catch (error) {
    console.error('Error starting background location tracking:', error);
    return false;
  }
}

/**
 * Stop background location tracking
 */
export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('Background location tracking stopped');
    }
  } catch (error) {
    console.error('Error stopping background location tracking:', error);
  }
}

/**
 * Check if background location tracking is active
 */
export async function isBackgroundLocationTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (error) {
    console.error('Error checking background location status:', error);
    return false;
  }
}

/**
 * Get current location
 */
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return location;
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

/**
 * Define the background task handler
 * This must be called at the top level of your app (outside of components)
 */
export function defineGeofenceTask() {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('Background location task error:', error);
      return;
    }

    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] };
      
      if (locations && locations.length > 0) {
        const location = locations[0];
        const { latitude, longitude } = location.coords;

        console.log(`Background location update: ${latitude}, ${longitude}`);

        try {
          // Get stored auth token
          const token = await AsyncStorage.getItem('@luna_auth_token');
          
          if (token) {
            // Call the backend to check location and handle notifications
            const result = await checkLocationAgainstGeofences(latitude, longitude, token);
            
            if (result && result.triggered.length > 0) {
              console.log('Triggered geofences:', result.triggered);
              // Backend handles the push notification, so we just log here
            }
          } else {
            console.log('No auth token found, skipping geofence check');
          }
        } catch (error) {
          console.error('Error in background location task:', error);
        }
      }
    }
  });
}

/**
 * Save auth token for background task to use
 */
export async function saveAuthTokenForGeofencing(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem('@luna_auth_token', token);
  } catch (error) {
    console.error('Error saving auth token for geofencing:', error);
  }
}

/**
 * Clear auth token (call on logout)
 */
export async function clearGeofencingAuth(): Promise<void> {
  try {
    await AsyncStorage.removeItem('@luna_auth_token');
    await stopBackgroundLocationTracking();
  } catch (error) {
    console.error('Error clearing geofencing auth:', error);
  }
}

export default {
  requestLocationPermissions,
  checkLocationPermissions,
  fetchAndCacheGeofences,
  getCachedGeofences,
  checkLocationAgainstGeofences,
  checkLocalGeofences,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  isBackgroundLocationTrackingActive,
  getCurrentLocation,
  defineGeofenceTask,
  saveAuthTokenForGeofencing,
  clearGeofencingAuth,
  calculateDistance,
};
