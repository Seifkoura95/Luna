import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/theme/colors';
import { useFonts } from '../src/hooks/useFonts';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { defineGeofenceTask } from '../src/utils/geofencing';

// Define background task at module level (required for expo-task-manager)
if (Platform.OS !== 'web') {
  defineGeofenceTask();
}

const LUNA_LOGO = 'https://customer-assets.emergentagent.com/job_c826baa4-6640-40ce-9e0d-38132d9944fc/artifacts/2k76js5m_luna-group-logo-2.webp';

export default function RootLayout() {
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);
  const fontsLoaded = useFonts();
  
  // Initialize push notifications
  const { expoPushToken, notification } = usePushNotifications();

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Log push token for debugging (can be removed in production)
  useEffect(() => {
    if (expoPushToken) {
      console.log('📱 Push token registered:', expoPushToken);
    }
  }, [expoPushToken]);

  // Show simple loading screen while fonts are loading
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <StatusBar style="light" />
        <Image source={{ uri: LUNA_LOGO }} style={{ width: 260, height: 75, marginBottom: 30 }} contentFit="contain" />
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="payment-success" />
        <Stack.Screen name="payment-cancelled" />
        <Stack.Screen name="ai-concierge" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="rewards-shop" />
        <Stack.Screen name="subscriptions" />
        <Stack.Screen name="table-booking" />
        <Stack.Screen name="bottle-service" />
        <Stack.Screen name="milestones" />
        <Stack.Screen name="safety" />
        <Stack.Screen name="events" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="refer-friend" />
        <Stack.Screen name="birthday-club" />
        <Stack.Screen name="lost-found" />
        <Stack.Screen name="photos" />
        <Stack.Screen name="venue-dashboard" />
        <Stack.Screen name="about" />
        <Stack.Screen name="help-support" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="terms-of-service" />
        <Stack.Screen name="payment-methods" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="location-settings" />
        <Stack.Screen name="safety-settings" />
        <Stack.Screen name="stories" />
        <Stack.Screen name="staff-portal" />
        <Stack.Screen name="member-card" />
      </Stack>
    </>
  );
}
