import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const MOON_SIZE = Math.min(width, height) * 0.45;

const LUNAR_MOON_IMAGE = 'https://customer-assets.emergentagent.com/job_cluboscenexus/artifacts/ekzz65x8_lunar%20moon.PNG';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  
  // Spinning animation
  const rotation = useSharedValue(0);
  
  useEffect(() => {
    // Start continuous rotation
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 20000, // 20 seconds for full rotation - slow and realistic
        easing: Easing.linear,
      }),
      -1, // Infinite
      false // Don't reverse
    );
  }, []);

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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      {/* Subtle glow behind moon */}
      <View style={styles.glowOuter} />
      <View style={styles.glowInner} />
      
      {/* Spinning Moon */}
      <Animated.View style={[styles.moonContainer, animatedStyle]}>
        <Image
          source={{ uri: LUNAR_MOON_IMAGE }}
          style={styles.moonImage}
          resizeMode="contain"
        />
      </Animated.View>
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
  glowOuter: {
    position: 'absolute',
    width: MOON_SIZE * 1.8,
    height: MOON_SIZE * 1.8,
    borderRadius: MOON_SIZE * 0.9,
    backgroundColor: 'rgba(227, 24, 55, 0.08)',
  },
  glowInner: {
    position: 'absolute',
    width: MOON_SIZE * 1.3,
    height: MOON_SIZE * 1.3,
    borderRadius: MOON_SIZE * 0.65,
    backgroundColor: 'rgba(227, 24, 55, 0.12)',
  },
  moonContainer: {
    width: MOON_SIZE,
    height: MOON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moonImage: {
    width: MOON_SIZE,
    height: MOON_SIZE,
    borderRadius: MOON_SIZE / 2,
  },
});
