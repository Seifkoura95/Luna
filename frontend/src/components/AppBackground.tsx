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
    '#D4AF5A',      // Gold
    '#D4AF5A',      // More gold
    '#2563EB',      // Blue
    '#8B5CF6',      // Purple
    '#00D4AA',      // Cyan
    '#ffffff',      // White
    '#FF6B35',      // Orange
    '#ffffff',      // White
  ];

  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      size: Math.random() * 4 + 1, // 1-5px
      initialX: Math.random() * SCREEN_WIDTH,
      initialY: SCREEN_HEIGHT + Math.random() * SCREEN_HEIGHT,
      duration: 12000 + Math.random() * 18000, // 12-30 seconds
      delay: Math.random() * 8000,
      opacity: Math.random() * 0.7 + 0.15, // 0.15-0.85 opacity
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  return particles;
};

export const AppBackground: React.FC<BackgroundProps> = ({ children }) => {
  // More particles for a livelier feel
  const particles = useMemo(() => generateParticles(65), []);

  return (
    <View style={styles.container}>
      {/* Base dark background - Luna UI Kit color with subtle brightness */}
      <LinearGradient
        colors={['#101018', '#0A0A10', '#101018']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Subtle ambient glows for depth */}
      <LinearGradient
        colors={['rgba(59, 130, 246, 0.25)', 'transparent']}
        style={styles.topLeftGlow}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <LinearGradient
        colors={['rgba(212, 175, 90, 0.15)', 'transparent']}
        style={styles.topRightGlow}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <LinearGradient
        colors={['rgba(139, 92, 246, 0.12)', 'transparent']}
        style={styles.bottomLeftGlow}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
      />

      <LinearGradient
        colors={['rgba(212, 175, 90, 0.10)', 'transparent']}
        style={styles.centerGlow}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 0, y: 0 }}
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
    backgroundColor: '#101018',
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
  bottomLeftGlow: {
    position: 'absolute',
    bottom: -50,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  centerGlow: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.35,
    left: SCREEN_WIDTH * 0.2,
    width: 250,
    height: 250,
    borderRadius: 125,
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
