import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BackgroundProps {
  children?: React.ReactNode;
}

// Single particle/star component
const Particle = ({ 
  size, 
  initialX, 
  initialY, 
  duration,
  delay,
  opacity,
  color,
}: { 
  size: number;
  initialX: number;
  initialY: number;
  duration: number;
  delay: number;
  opacity: number;
  color: string;
}) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const particleOpacity = useSharedValue(0);

  useEffect(() => {
    // Floating up animation
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-SCREEN_HEIGHT - 100, { 
          duration: duration, 
          easing: Easing.linear 
        }),
        -1,
        false
      )
    );

    // Subtle horizontal drift
    translateX.value = withDelay(
      delay,
      withRepeat(
        withTiming(Math.random() > 0.5 ? 50 : -50, { 
          duration: duration / 2, 
          easing: Easing.inOut(Easing.sin) 
        }),
        -1,
        true
      )
    );

    // Twinkling effect
    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(1.5, { 
          duration: 2000 + Math.random() * 2000, 
          easing: Easing.inOut(Easing.sin) 
        }),
        -1,
        true
      )
    );

    // Fade in
    particleOpacity.value = withDelay(
      delay,
      withTiming(opacity, { duration: 1000 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: initialX + translateX.value },
      { translateY: initialY + translateY.value },
      { scale: scale.value },
    ],
    opacity: particleOpacity.value,
  }));

  return (
    <Animated.View 
      style={[
        styles.particle, 
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: size * 2,
        },
        animatedStyle
      ]} 
    />
  );
};

// Generate random particles
const generateParticles = (count: number) => {
  const particles = [];
  const colors = [
    '#ffffff',      // White
    '#E31837',      // Luna Red
    '#D4AF37',      // Gold
    '#8B5CF6',      // Purple
    '#00D4AA',      // Cyan
    '#ffffff',      // More white for balance
    '#ffffff',
  ];

  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      size: Math.random() * 3 + 1, // 1-4px
      initialX: Math.random() * SCREEN_WIDTH,
      initialY: SCREEN_HEIGHT + Math.random() * SCREEN_HEIGHT, // Start below screen
      duration: 15000 + Math.random() * 20000, // 15-35 seconds to float up
      delay: Math.random() * 10000, // Stagger start times
      opacity: Math.random() * 0.6 + 0.2, // 0.2-0.8 opacity
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  return particles;
};

export const AppBackground: React.FC<BackgroundProps> = ({ children }) => {
  // Memoize particles so they don't regenerate on every render
  const particles = useMemo(() => generateParticles(65), []);

  return (
    <View style={styles.container}>
      {/* Base dark background */}
      <LinearGradient
        colors={['#0a0a0c', '#050508', '#0a0a0c']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Subtle ambient glows for depth */}
      <LinearGradient
        colors={['rgba(227, 24, 55, 0.15)', 'transparent']}
        style={styles.topLeftGlow}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.1)', 'transparent']}
        style={styles.topRightGlow}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Floating particles/stars */}
      <View style={styles.particlesContainer} pointerEvents="none">
        {particles.map((particle) => (
          <Particle
            key={particle.id}
            size={particle.size}
            initialX={particle.initialX}
            initialY={particle.initialY}
            duration={particle.duration}
            delay={particle.delay}
            opacity={particle.opacity}
            color={particle.color}
          />
        ))}
      </View>

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
  topLeftGlow: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
  },
  topRightGlow: {
    position: 'absolute',
    top: -80,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
});
