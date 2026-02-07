import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/theme/colors';
import { useFonts } from '../src/hooks/useFonts';
import { usePushNotifications } from '../src/hooks/usePushNotifications';

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

  // Show loading screen while fonts are loading
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
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
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
