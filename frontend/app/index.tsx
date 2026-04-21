import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { colors } from '../src/theme/colors';
import { ONBOARDING_KEY } from './onboarding';
import { AGE_GATE_KEY } from './age-gate';

const LUNA_LOGO = 'https://customer-assets.emergentagent.com/job_c826baa4-6640-40ce-9e0d-38132d9944fc/artifacts/2k76js5m_luna-group-logo-2.webp';

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

    // Route sequence for unauth'd users: age-gate -> onboarding -> login
    let cancelled = false;
    const routeUnauthed = async () => {
      let agePassed: string | null = null;
      let seenOnboarding: string | null = null;
      try {
        agePassed = await AsyncStorage.getItem(AGE_GATE_KEY);
        seenOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
      } catch {
        // fall through and show login if storage broken
      }
      if (cancelled) return;
      // brief splash
      setTimeout(() => {
        if (cancelled) return;
        if (!agePassed) {
          router.replace('/age-gate');
        } else if (!seenOnboarding) {
          router.replace('/onboarding');
        } else {
          router.replace('/login');
        }
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
        source={{ uri: LUNA_LOGO }} 
        style={styles.logo} 
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
  logo: {
    width: 280,
    height: 80,
  },
  loader: {
    marginTop: 30,
  },
});
