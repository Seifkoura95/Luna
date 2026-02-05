import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/theme/colors';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { api } from '../src/utils/api';

const { width } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login, setLoading } = useAuthStore();
  const [processingAuth, setProcessingAuth] = useState(false);

  useEffect(() => {
    // Seed data on app start
    api.seedData().catch(console.error);
  }, []);

  useEffect(() => {
    const handleAuth = async () => {
      // Check for session_id in URL (after OAuth redirect)
      let sessionId: string | null = null;

      if (Platform.OS === 'web') {
        // Check hash fragment
        const hash = window.location.hash;
        if (hash.includes('session_id=')) {
          sessionId = hash.split('session_id=')[1]?.split('&')[0];
        }
        // Also check query params
        const params = new URLSearchParams(window.location.search);
        if (!sessionId) {
          sessionId = params.get('session_id');
        }
      } else {
        // Mobile - check initial URL
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const url = new URL(initialUrl);
          sessionId = url.searchParams.get('session_id');
          if (!sessionId && url.hash) {
            sessionId = url.hash.split('session_id=')[1]?.split('&')[0];
          }
        }
      }

      if (sessionId && !processingAuth) {
        setProcessingAuth(true);
        setLoading(true);
        try {
          const data = await api.exchangeSession(sessionId);
          await login(
            {
              user_id: data.user_id,
              email: data.email,
              name: data.name,
              picture: data.picture,
              tier: 'bronze',
              points_balance: 0,
            },
            data.session_token
          );
          
          // Clean URL
          if (Platform.OS === 'web') {
            window.history.replaceState({}, '', '/');
          }
          
          // Fetch fresh user data
          const user = await api.getMe();
          useAuthStore.getState().setUser(user);
          
          router.replace('/(tabs)');
        } catch (e) {
          console.error('Auth exchange failed:', e);
          setProcessingAuth(false);
          setLoading(false);
        }
        return;
      }

      // If already authenticated, go to tabs
      if (!isLoading && isAuthenticated) {
        router.replace('/(tabs)');
      } else if (!isLoading && !isAuthenticated) {
        // Show splash briefly then go to login
        setTimeout(() => {
          router.replace('/login');
        }, 1500);
      }
    };

    handleAuth();
  }, [isLoading, isAuthenticated, processingAuth]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>ECLIPSE</Text>
        <Text style={styles.tagline}>VIP Experience</Text>
      </View>
      <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
      {processingAuth && (
        <Text style={styles.authText}>Signing you in...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 8,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  loader: {
    marginTop: 20,
  },
  authText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 20,
  },
});
