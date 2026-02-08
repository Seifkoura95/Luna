import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface StarfieldBackgroundProps {
  starCount?: number;
  shootingStarCount?: number;
  showAurora?: boolean;
  showGalaxies?: boolean;
  showPlanets?: boolean;
  overlayOpacity?: number;
}

// Ambient glow layer component - subtle pulsing colored lights
const AmbientGlowLayer = ({ index, color }: { index: number; color: string }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      index * 800,
      withRepeat(
        withSequence(
          withTiming(0.12 + index * 0.02, { duration: 6000 + index * 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.04, { duration: 6000 + index * 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(-25, { duration: 10000 + index * 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(25, { duration: 10000 + index * 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.glowLayer, { top: 100 + index * 250 }, animatedStyle]}>
      <LinearGradient
        colors={['transparent', color + '18', color + '28', color + '18', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

// Subtle bokeh orb for ambiance
const BokehOrb = ({ x, y, size, color, delay }: { x: number; y: number; size: number; color: string; delay: number }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.2, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.06, { duration: 4000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.9, { duration: 5000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: size / 3,
          elevation: 8,
        },
        animatedStyle,
      ]}
    />
  );
};

/**
 * StarfieldBackground - Now renders Eclipse Brisbane-inspired background
 * A premium nightclub themed background with:
 * - High-quality nightclub photograph from Eclipse Brisbane
 * - Dark overlay for text readability
 * - Subtle animated bokeh lights
 * - Ambient glow layers for atmosphere
 */
export const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  starCount = 50,
  shootingStarCount = 2,
  showAurora = true,
  showGalaxies = true,
  showPlanets = true,
  overlayOpacity = 0.55,
}) => {
  // Eclipse Brisbane nightclub background image
  const backgroundImage = 'https://images.squarespace-cdn.com/content/v1/67f8ccf353df004660928ccc/ddb6daa6-eee7-4027-a2c0-ad54f6b324ed/%40CUTBYJACK-69.jpg';

  // Generate a few bokeh orbs for ambient nightclub feel
  const bokehOrbs = [
    { x: width * 0.1, y: height * 0.12, size: 70, color: '#E31837', delay: 0 },
    { x: width * 0.85, y: height * 0.2, size: 50, color: '#8B5CF6', delay: 600 },
    { x: width * 0.25, y: height * 0.45, size: 85, color: '#FFB800', delay: 1200 },
    { x: width * 0.75, y: height * 0.55, size: 60, color: '#00D4AA', delay: 1800 },
    { x: width * 0.1, y: height * 0.75, size: 75, color: '#C084FC', delay: 2400 },
    { x: width * 0.9, y: height * 0.85, size: 45, color: '#FF6B9D', delay: 3000 },
  ];

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Background Image from Eclipse Brisbane */}
      <Image
        source={{ uri: backgroundImage }}
        style={styles.backgroundImage}
        resizeMode="cover"
        blurRadius={1.5}
      />

      {/* Dark overlay for text readability */}
      <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }]} />

      {/* Gradient vignette for depth */}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(0,0,0,0.5)']}
        locations={[0, 0.15, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Side vignettes */}
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', 'rgba(0,0,0,0.4)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow layers */}
      {showAurora && (
        <>
          <AmbientGlowLayer index={0} color="#E31837" />
          <AmbientGlowLayer index={1} color="#8B5CF6" />
          <AmbientGlowLayer index={2} color="#FFB800" />
        </>
      )}

      {/* Bokeh orbs for nightclub ambiance */}
      {bokehOrbs.map((orb, index) => (
        <BokehOrb key={index} {...orb} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  glowLayer: {
    position: 'absolute',
    left: -100,
    right: -100,
    height: 160,
    borderRadius: 80,
  },
});

export default StarfieldBackground;
