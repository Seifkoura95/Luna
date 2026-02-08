import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface NightlifeBokehBackgroundProps {
  bokehCount?: number;
  showGlow?: boolean;
  colorScheme?: 'default' | 'warm' | 'cool' | 'gold';
}

interface BokehOrb {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  delay: number;
  driftSpeed: number;
  pulseSpeed: number;
  blur: number;
}

// Nightclub/bar ambient light colors
const BOKEH_COLORS = {
  default: [
    '#E31837',    // Luna Red
    '#8B5CF6',    // Purple
    '#FF6B9D',    // Pink
    '#FFB800',    // Gold
    '#00D4AA',    // Teal
    '#3B82F6',    // Blue
    '#FF4D6D',    // Coral
    '#C084FC',    // Light Purple
  ],
  warm: [
    '#E31837',
    '#FF6B9D',
    '#FFB800',
    '#FF4D6D',
    '#FFA500',
    '#FF7F50',
  ],
  cool: [
    '#8B5CF6',
    '#3B82F6',
    '#00D4AA',
    '#06B6D4',
    '#C084FC',
    '#818CF8',
  ],
  gold: [
    '#FFB800',
    '#FFD700',
    '#FFA500',
    '#E31837',
    '#FF6B9D',
    '#C084FC',
  ],
};

// Individual Bokeh Orb Component
const BokehOrbComponent = ({ orb }: { orb: BokehOrb }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    // Fade in
    opacity.value = withDelay(
      orb.delay,
      withTiming(orb.opacity, { duration: 2000, easing: Easing.out(Easing.ease) })
    );

    // Gentle pulse
    scale.value = withDelay(
      orb.delay,
      withRepeat(
        withSequence(
          withTiming(1.15, { duration: orb.pulseSpeed, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.85, { duration: orb.pulseSpeed, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    // Slow drift up/down
    translateY.value = withDelay(
      orb.delay,
      withRepeat(
        withSequence(
          withTiming(-20, { duration: orb.driftSpeed, easing: Easing.inOut(Easing.ease) }),
          withTiming(20, { duration: orb.driftSpeed, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    // Slow drift left/right
    translateX.value = withDelay(
      orb.delay + 1000,
      withRepeat(
        withSequence(
          withTiming(15, { duration: orb.driftSpeed * 1.2, easing: Easing.inOut(Easing.ease) }),
          withTiming(-15, { duration: orb.driftSpeed * 1.2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.bokehOrb,
        {
          left: orb.x,
          top: orb.y,
          width: orb.size,
          height: orb.size,
          borderRadius: orb.size / 2,
          backgroundColor: orb.color,
          shadowColor: orb.color,
          shadowRadius: orb.blur,
          shadowOpacity: 0.8,
        },
        animatedStyle,
      ]}
    />
  );
};

// Ambient glow layer component
const AmbientGlowLayer = ({ index, color }: { index: number; color: string }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      index * 500,
      withRepeat(
        withSequence(
          withTiming(0.12 + index * 0.02, { duration: 8000 + index * 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.04, { duration: 8000 + index * 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(-30, { duration: 12000 + index * 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(30, { duration: 12000 + index * 1500, easing: Easing.inOut(Easing.ease) })
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
    <Animated.View style={[styles.glowLayer, { top: 50 + index * 200 }, animatedStyle]}>
      <LinearGradient
        colors={['transparent', color + '15', color + '25', color + '15', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

// Light streak component (like club lasers but subtle)
const LightStreak = ({ index }: { index: number }) => {
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(-30 + index * 15);

  useEffect(() => {
    opacity.value = withDelay(
      index * 800,
      withRepeat(
        withSequence(
          withTiming(0.08, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    rotation.value = withRepeat(
      withSequence(
        withTiming(-30 + index * 15 + 10, { duration: 15000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-30 + index * 15 - 10, { duration: 15000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const colors = ['#E31837', '#8B5CF6', '#FFB800', '#00D4AA'];

  return (
    <Animated.View style={[styles.lightStreak, animatedStyle]}>
      <LinearGradient
        colors={['transparent', colors[index % colors.length] + '30', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

export const NightlifeBokehBackground: React.FC<NightlifeBokehBackgroundProps> = ({
  bokehCount = 25,
  showGlow = true,
  colorScheme = 'default',
}) => {
  const colors = BOKEH_COLORS[colorScheme];

  // Generate bokeh orbs
  const bokehOrbs = useMemo<BokehOrb[]>(() => {
    return Array.from({ length: bokehCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 1.3,
      size: 30 + Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 0.15 + Math.random() * 0.25,
      delay: Math.random() * 3000,
      driftSpeed: 8000 + Math.random() * 6000,
      pulseSpeed: 4000 + Math.random() * 4000,
      blur: 20 + Math.random() * 40,
    }));
  }, [bokehCount, colorScheme]);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Deep dark gradient base */}
      <LinearGradient
        colors={['#000000', '#050508', '#0A0A12', '#050508', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle vignette effect */}
      <LinearGradient
        colors={['transparent', 'transparent', '#00000050']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow layers */}
      {showGlow && (
        <>
          <AmbientGlowLayer index={0} color="#E31837" />
          <AmbientGlowLayer index={1} color="#8B5CF6" />
          <AmbientGlowLayer index={2} color="#FFB800" />
        </>
      )}

      {/* Light streaks (subtle club laser effect) */}
      <LightStreak index={0} />
      <LightStreak index={1} />
      <LightStreak index={2} />

      {/* Bokeh orbs */}
      {bokehOrbs.map((orb, index) => (
        <BokehOrbComponent key={`bokeh-${index}`} orb={orb} />
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
  bokehOrb: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  glowLayer: {
    position: 'absolute',
    left: -100,
    right: -100,
    height: 200,
    borderRadius: 100,
  },
  lightStreak: {
    position: 'absolute',
    top: 0,
    left: -width,
    right: -width,
    height: 3,
    transformOrigin: 'center',
  },
});

// Also export as default for easy import
export default NightlifeBokehBackground;
