import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/theme/colors';
import { api } from '../src/utils/api';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    // Seed data on app start
    api.seedData().catch(console.error);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        // Show splash briefly then go to login
        setTimeout(() => {
          router.replace('/login');
        }, 1500);
      }
    }
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoMark}>
          <Text style={styles.logoLetter}>L</Text>
        </View>
        <Text style={styles.logo}>LUNA GROUP</Text>
        <Text style={styles.tagline}>Queensland's Premier Nightlife</Text>
      </View>
      <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
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
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundCard,
    borderWidth: 2,
    borderColor: colors.accent + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoLetter: {
    fontSize: 40,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 10,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  loader: {
    marginTop: 20,
  },
});
