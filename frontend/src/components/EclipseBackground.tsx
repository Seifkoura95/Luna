import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Image, ImageBackground } from 'react-native';
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

interface EclipseBackgroundProps {
  overlayOpacity?: number;
  showAmbientGlow?: boolean;
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
          withTiming(0.15 + index * 0.02, { duration: 6000 + index * 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.05, { duration: 6000 + index * 1500, easing: Easing.inOut(Easing.ease) })
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
        colors={['transparent', color + '20', color + '35', color + '20', 'transparent']}
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
          withTiming(0.25, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.08, { duration: 4000, easing: Easing.inOut(Easing.ease) })
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

export const EclipseBackground: React.FC<EclipseBackgroundProps> = ({
  overlayOpacity = 0.6,
  showAmbientGlow = true,
}) => {
  // Eclipse Brisbane nightclub background image
  const backgroundImage = 'https://images.squarespace-cdn.com/content/v1/67f8ccf353df004660928ccc/ddb6daa6-eee7-4027-a2c0-ad54f6b324ed/%40CUTBYJACK-69.jpg';

  // Generate a few bokeh orbs for ambient nightclub feel
  const bokehOrbs = [
    { x: width * 0.1, y: height * 0.15, size: 80, color: '#E31837', delay: 0 },
    { x: width * 0.8, y: height * 0.25, size: 60, color: '#8B5CF6', delay: 500 },
    { x: width * 0.3, y: height * 0.5, size: 100, color: '#FFB800', delay: 1000 },
    { x: width * 0.7, y: height * 0.65, size: 70, color: '#00D4AA', delay: 1500 },
    { x: width * 0.15, y: height * 0.8, size: 90, color: '#C084FC', delay: 2000 },
    { x: width * 0.85, y: height * 0.9, size: 55, color: '#FF6B9D', delay: 2500 },
  ];

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Background Image */}
      <Image
        source={{ uri: backgroundImage }}
        style={styles.backgroundImage}
        resizeMode="cover"
        blurRadius={2}
      />

      {/* Dark overlay for text readability */}
      <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }]} />

      {/* Gradient vignette for depth */}
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
        locations={[0, 0.2, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Side vignettes */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.5)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow layers */}
      {showAmbientGlow && (
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
    height: 180,
    borderRadius: 90,
  },
});

export default EclipseBackground;
