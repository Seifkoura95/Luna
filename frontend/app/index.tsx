import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { colors } from '../src/theme/colors';
import { ONBOARDING_KEY } from './onboarding';

const LUNA_SPLASH = require('../assets/images/luna-splash.png');

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    // Seed data on app start
    api.seedData().catch(console.error);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      router.replace('/(tabs)');
      return;
    }

    // Route sequence for unauth'd users: onboarding -> login (age is collected at signup)
    let cancelled = false;
    const routeUnauthed = async () => {
      let seenOnboarding: string | null = null;
      try {
        seenOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
      } catch {
        // fall through and show login if storage broken
      }
      if (cancelled) return;
      // brief splash
      setTimeout(() => {
        if (cancelled) return;
        router.replace(seenOnboarding ? '/login' : '/onboarding');
      }, 1200);
    };
    routeUnauthed();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <Image
        source={LUNA_SPLASH}
        style={styles.splashImage}
        contentFit="contain"
      />
      <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    bottom: 80,
  },
});
