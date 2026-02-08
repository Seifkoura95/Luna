import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

interface StarfieldBackgroundProps {
  starCount?: number;
  shootingStarCount?: number;
  showAurora?: boolean;
  showGalaxies?: boolean;
  showPlanets?: boolean;
  overlayOpacity?: number;
}

// Individual twinkling star component - smooth circular
const TwinklingStar = ({ x, y, size, delay, duration }: { 
  x: number; 
  y: number; 
  size: number; 
  delay: number;
  duration: number;
}) => {
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.9, { duration: duration, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: duration, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        animatedStyle,
      ]}
    />
  );
};

/**
 * StarfieldBackground - Clean black background with twinkling white stars
 * Stars are smooth circles that gently twinkle
 */
export const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  starCount = 80,
}) => {
  // Generate random star positions once
  const stars = useMemo(() => {
    return Array.from({ length: starCount }, (_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height * 1.5,
      size: Math.random() * 2.5 + 1, // 1-3.5px stars
      delay: Math.random() * 3000,
      duration: 2000 + Math.random() * 3000, // 2-5s twinkle duration
    }));
  }, [starCount]);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Pure black background */}
      <View style={styles.blackBackground} />
      
      {/* Twinkling stars */}
      {stars.map((star) => (
        <TwinklingStar
          key={star.id}
          x={star.x}
          y={star.y}
          size={star.size}
          delay={star.delay}
          duration={star.duration}
        />
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
  blackBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
});

export default StarfieldBackground;
