import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { RotatingMoon } from '../src/components/RotatingMoon';

const { width, height } = Dimensions.get('window');
const MOON_SIZE = Math.min(width, height) * 0.45;

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
        }, 2000);
      }
    }
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      {/* Spinning Moon - using the gradient-based component */}
      <RotatingMoon size={MOON_SIZE} rotationDuration={20000} />
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
});
