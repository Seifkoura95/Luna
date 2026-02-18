import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/theme/colors';
import { useFonts } from '../src/hooks/useFonts';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { SharedVideoProvider } from '../src/context/VideoContext';

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
      </Stack>
    </>
  );
}
