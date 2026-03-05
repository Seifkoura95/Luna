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

// Pulsing Orb Component with stronger visibility
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
    const scale = interpolate(pulse.value, [0, 1], [0.85, 1.15]);
    const opacity = interpolate(pulse.value, [0, 1], [0.5, 0.9]);
    const translateX = interpolate(drift.value, [0, 1], [-20, 20]);
    const translateY = interpolate(drift.value, [0, 1], [-15, 15]);

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
        colors={[color, color.replace(/[\d.]+\)$/, '0)')]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
};

export const AppBackground: React.FC<BackgroundProps> = ({ children }) => {
  return (
    <View style={styles.container}>
      {/* Base dark background */}
      <View style={styles.baseBg} />

      {/* Static ambient glow layers for guaranteed visibility */}
      <LinearGradient
        colors={['rgba(227, 24, 55, 0.4)', 'rgba(227, 24, 55, 0.15)', 'transparent']}
        style={styles.topLeftGlow}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.3)', 'rgba(212, 175, 55, 0.1)', 'transparent']}
        style={styles.topRightGlow}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <LinearGradient
        colors={['rgba(139, 92, 246, 0.25)', 'rgba(139, 92, 246, 0.08)', 'transparent']}
        style={styles.centerLeftGlow}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* Animated pulsing orbs on top of static glows */}
      <View style={styles.orbsContainer} pointerEvents="none">
        <PulsingOrb
          color="rgba(227, 24, 55, 0.6)"
          size={450}
          initialX={-80}
          initialY={-30}
          delay={0}
          duration={8000}
        />
        
        <PulsingOrb
          color="rgba(212, 175, 55, 0.5)"
          size={380}
          initialX={SCREEN_WIDTH - 80}
          initialY={20}
          delay={1500}
          duration={10000}
        />
        
        <PulsingOrb
          color="rgba(139, 92, 246, 0.4)"
          size={400}
          initialX={-30}
          initialY={SCREEN_HEIGHT * 0.35}
          delay={3000}
          duration={12000}
        />
        
        <PulsingOrb
          color="rgba(227, 24, 55, 0.45)"
          size={350}
          initialX={SCREEN_WIDTH - 40}
          initialY={SCREEN_HEIGHT * 0.55}
          delay={2000}
          duration={9000}
        />

        <PulsingOrb
          color="rgba(0, 212, 170, 0.3)"
          size={320}
          initialX={SCREEN_WIDTH * 0.2}
          initialY={SCREEN_HEIGHT * 0.75}
          delay={4000}
          duration={11000}
        />
      </View>

      {/* Vignette effect */}
      <LinearGradient
        colors={['transparent', 'transparent', 'rgba(0,0,0,0.5)']}
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
  baseBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050508',
  },
  topLeftGlow: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  topRightGlow: {
    position: 'absolute',
    top: -60,
    right: -80,
    width: 350,
    height: 350,
    borderRadius: 175,
  },
  centerLeftGlow: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.3,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
  },
  orbsContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: 'absolute',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
});
