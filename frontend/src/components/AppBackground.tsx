import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BackgroundProps {
  children?: React.ReactNode;
  intensity?: 'low' | 'medium' | 'high';
}

// Pulsing Orb Component
const PulsingOrb = ({ 
  color, 
  size, 
  initialX, 
  initialY, 
  delay = 0,
  duration = 8000,
}: { 
  color: string; 
  size: number; 
  initialX: number; 
  initialY: number;
  delay?: number;
  duration?: number;
}) => {
  const pulse = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    // Pulsing animation
    pulse.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    // Subtle drift animation
    drift.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: duration * 1.5, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: duration * 1.5, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [0.8, 1.2]);
    const opacity = interpolate(pulse.value, [0, 1], [0.3, 0.6]);
    const translateX = interpolate(drift.value, [0, 1], [-15, 15]);
    const translateY = interpolate(drift.value, [0, 1], [-10, 10]);

    return {
      transform: [
        { translateX: initialX + translateX },
        { translateY: initialY + translateY },
        { scale },
      ],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }, animatedStyle]}>
      <LinearGradient
        colors={[color, 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
};

// SVG-based noise pattern overlay
const NoiseOverlay = () => {
  return (
    <View style={styles.noiseContainer} pointerEvents="none">
      <View style={styles.noisePattern} />
    </View>
  );
};

export const AppBackground: React.FC<BackgroundProps> = ({ children, intensity = 'medium' }) => {
  const orbOpacity = intensity === 'low' ? 0.5 : intensity === 'high' ? 1 : 0.75;

  return (
    <View style={styles.container}>
      {/* Base dark background with subtle gradient */}
      <LinearGradient
        colors={['#0a0a0a', '#050508', '#0a0a0a']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Pulsing gradient orbs */}
      <View style={[styles.orbsContainer, { opacity: orbOpacity }]} pointerEvents="none">
        {/* Main Luna Red orb - top left */}
        <PulsingOrb
          color="rgba(227, 24, 55, 0.25)"
          size={400}
          initialX={-150}
          initialY={-100}
          delay={0}
          duration={10000}
        />
        
        {/* Gold accent orb - top right */}
        <PulsingOrb
          color="rgba(212, 175, 55, 0.15)"
          size={300}
          initialX={SCREEN_WIDTH - 150}
          initialY={-50}
          delay={2000}
          duration={12000}
        />
        
        {/* Deep purple orb - center left */}
        <PulsingOrb
          color="rgba(139, 92, 246, 0.12)"
          size={350}
          initialX={-100}
          initialY={SCREEN_HEIGHT * 0.4}
          delay={4000}
          duration={14000}
        />
        
        {/* Subtle red orb - bottom right */}
        <PulsingOrb
          color="rgba(227, 24, 55, 0.15)"
          size={280}
          initialX={SCREEN_WIDTH - 100}
          initialY={SCREEN_HEIGHT * 0.6}
          delay={3000}
          duration={11000}
        />

        {/* Cyan accent orb - bottom center */}
        <PulsingOrb
          color="rgba(0, 212, 170, 0.08)"
          size={250}
          initialX={SCREEN_WIDTH * 0.3}
          initialY={SCREEN_HEIGHT * 0.8}
          delay={5000}
          duration={13000}
        />
      </View>

      {/* Film grain noise texture overlay */}
      <NoiseOverlay />

      {/* Vignette effect */}
      <LinearGradient
        colors={['transparent', 'transparent', 'rgba(0,0,0,0.4)']}
        style={styles.vignette}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Content */}
      {children && <View style={styles.content}>{children}</View>}
    </View>
  );
};

export default AppBackground;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  orbsContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: 'absolute',
  },
  noiseContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  noisePattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.035,
    backgroundColor: 'transparent',
    // Creates a subtle noise texture effect
    ...(Platform.OS === 'web' ? {
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'repeat',
    } : {}),
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
});
