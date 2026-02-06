import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface StarProps {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  maxOpacity: number;
}

const Star: React.FC<StarProps> = ({ x, y, size, delay, duration, maxOpacity }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(maxOpacity, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
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

interface ShootingStarProps {
  delay: number;
  startX: number;
  startY: number;
}

const ShootingStar: React.FC<ShootingStarProps> = ({ delay, startX, startY }) => {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const animate = () => {
      progress.value = 0;
      opacity.value = 0;
      
      progress.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }),
            withTiming(1, { duration: 8000 + Math.random() * 12000 }) // Wait before next
          ),
          -1,
          false
        )
      );
      
      opacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 200 }),
            withTiming(1, { duration: 800 }),
            withTiming(0, { duration: 500 }),
            withTiming(0, { duration: 8000 + Math.random() * 12000 }) // Wait synced
          ),
          -1,
          false
        )
      );
    };
    
    animate();
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [0, 300]);
    const translateY = interpolate(progress.value, [0, 1], [0, 180]);
    
    return {
      opacity: opacity.value,
      transform: [
        { translateX },
        { translateY },
        { rotate: '35deg' },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.shootingStar,
        {
          left: startX,
          top: startY,
        },
        animatedStyle,
      ]}
    >
      <View style={styles.shootingStarHead} />
      <View style={styles.shootingStarTail} />
    </Animated.View>
  );
};

interface StarfieldBackgroundProps {
  starCount?: number;
  shootingStarCount?: number;
}

export const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  starCount = 80,
  shootingStarCount = 3,
}) => {
  // Generate star positions once
  const stars = useMemo(() => {
    return Array.from({ length: starCount }, (_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 2 + 0.5, // 0.5 to 2.5px
      delay: Math.random() * 3000,
      duration: 2000 + Math.random() * 4000, // 2-6 seconds
      maxOpacity: 0.3 + Math.random() * 0.5, // 0.3 to 0.8
    }));
  }, [starCount]);

  // Generate shooting star start positions
  const shootingStars = useMemo(() => {
    return Array.from({ length: shootingStarCount }, (_, i) => ({
      id: i,
      delay: i * 5000 + Math.random() * 3000, // Stagger them
      startX: Math.random() * (SCREEN_WIDTH - 300),
      startY: Math.random() * (SCREEN_HEIGHT * 0.4),
    }));
  }, [shootingStarCount]);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Static background stars layer (very dim, many) */}
      {stars.map((star) => (
        <Star
          key={star.id}
          x={star.x}
          y={star.y}
          size={star.size}
          delay={star.delay}
          duration={star.duration}
          maxOpacity={star.maxOpacity}
        />
      ))}

      {/* Shooting stars */}
      {shootingStars.map((star) => (
        <ShootingStar
          key={`shooting-${star.id}`}
          delay={star.delay}
          startX={star.startX}
          startY={star.startY}
        />
      ))}

      {/* Subtle nebula glow spots */}
      <View style={[styles.nebula, styles.nebulaOne]} />
      <View style={[styles.nebula, styles.nebulaTwo]} />
      <View style={[styles.nebula, styles.nebulaThree]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  shootingStar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  shootingStarHead: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  shootingStarTail: {
    width: 60,
    height: 2,
    marginLeft: -2,
    borderRadius: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    // Gradient simulation using multiple layers would be better, but this works
    ...(Platform.OS === 'web'
      ? {
          background: 'linear-gradient(90deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%)',
        }
      : {
          backgroundColor: 'rgba(255,255,255,0.3)',
        }),
  },
  nebula: {
    position: 'absolute',
    borderRadius: 500,
    opacity: 0.03,
  },
  nebulaOne: {
    width: 400,
    height: 400,
    top: -100,
    right: -100,
    backgroundColor: '#E31837',
  },
  nebulaTwo: {
    width: 300,
    height: 300,
    bottom: 100,
    left: -80,
    backgroundColor: '#8B00FF',
  },
  nebulaThree: {
    width: 350,
    height: 350,
    top: '40%',
    left: '30%',
    backgroundColor: '#FFB800',
  },
});

export default StarfieldBackground;
