import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/theme/colors';
import { useFonts } from '../src/hooks/useFonts';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { VideoSplashScreen } from '../src/components/VideoSplashScreen';

export default function RootLayout() {
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);
  const fontsLoaded = useFonts();
  const [showSplash, setShowSplash] = useState(true);
  
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

  // Handle splash screen completion
  const handleSplashReady = () => {
    // Wait for fonts too
    if (fontsLoaded) {
      setShowSplash(false);
    }
  };

  // Also hide splash when fonts are loaded after video
  useEffect(() => {
    if (fontsLoaded && !showSplash) {
      return;
    }
    if (fontsLoaded) {
      // Give minimum splash time
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  // Show video splash screen while loading
  if (showSplash || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="light" />
        <VideoSplashScreen onReady={handleSplashReady} />
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
