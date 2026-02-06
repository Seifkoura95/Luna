import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

interface StarfieldBackgroundProps {
  starCount?: number;
  shootingStarCount?: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
}

interface ShootingStar {
  id: number;
  startX: number;
  startY: number;
  delay: number;
  duration: number;
}

const StarComponent = ({ star }: { star: Star }) => {
  const opacity = useSharedValue(star.opacity * 0.3);

  useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(
        withSequence(
          withTiming(star.opacity, {
            duration: 1500 + Math.random() * 2000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(star.opacity * 0.3, {
            duration: 1500 + Math.random() * 2000,
            easing: Easing.inOut(Easing.ease),
          })
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
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
        },
        animatedStyle,
      ]}
    />
  );
};

const ShootingStarComponent = ({ shootingStar }: { shootingStar: ShootingStar }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  const animate = () => {
    // Random starting position in upper portion of screen
    const startX = Math.random() * width;
    const startY = Math.random() * (height * 0.4);
    
    // Direction and distance
    const angle = (Math.PI / 6) + (Math.random() * Math.PI / 6); // 30-60 degrees
    const distance = 200 + Math.random() * 300;
    const endX = startX + distance * Math.cos(angle);
    const endY = startY + distance * Math.sin(angle);

    // Reset position
    translateX.value = 0;
    translateY.value = 0;
    opacity.value = 0;

    // Animate
    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(
        shootingStar.duration - 200,
        withTiming(0, { duration: 100 })
      )
    );

    translateX.value = withTiming(endX - startX, {
      duration: shootingStar.duration,
      easing: Easing.out(Easing.quad),
    });

    translateY.value = withTiming(endY - startY, {
      duration: shootingStar.duration,
      easing: Easing.out(Easing.quad),
    });
  };

  useEffect(() => {
    // Initial animation after delay
    const initialTimeout = setTimeout(() => {
      animate();
    }, shootingStar.delay);

    // Repeat at random intervals
    const intervalId = setInterval(() => {
      animate();
    }, 4000 + Math.random() * 8000); // Every 4-12 seconds

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: '30deg' },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.shootingStar,
        {
          left: shootingStar.startX,
          top: shootingStar.startY,
        },
        animatedStyle,
      ]}
    >
      {/* Shooting star head */}
      <View style={styles.shootingStarHead} />
      {/* Shooting star tail */}
      <View style={styles.shootingStarTail} />
    </Animated.View>
  );
};

export const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  starCount = 60,
  shootingStarCount = 2,
}) => {
  // Generate stars once
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: starCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height * 1.5,
      size: 1 + Math.random() * 2,
      opacity: 0.3 + Math.random() * 0.7,
      delay: Math.random() * 3000,
    }));
  }, [starCount]);

  // Generate shooting stars data
  const shootingStars = useMemo<ShootingStar[]>(() => {
    return Array.from({ length: shootingStarCount }, (_, i) => ({
      id: i,
      startX: Math.random() * width * 0.8,
      startY: Math.random() * height * 0.3,
      delay: 2000 + Math.random() * 5000, // Initial delay 2-7 seconds
      duration: 800 + Math.random() * 400, // Duration 0.8-1.2 seconds
    }));
  }, [shootingStarCount]);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Gradient background */}
      <View style={styles.gradientOverlay} />
      
      {/* Stars */}
      {stars.map((star, index) => (
        <StarComponent key={`star-${index}`} star={star} />
      ))}

      {/* Shooting Stars */}
      {shootingStars.map((shootingStar) => (
        <ShootingStarComponent key={`shooting-${shootingStar.id}`} shootingStar={shootingStar} />
      ))}

      {/* Subtle nebula effects */}
      <View style={[styles.nebula, styles.nebula1]} />
      <View style={[styles.nebula, styles.nebula2]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 5,
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
    shadowRadius: 6,
    elevation: 10,
  },
  shootingStarTail: {
    width: 60,
    height: 2,
    marginLeft: -2,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    // Gradient effect via opacity
    opacity: 0.7,
    // Create tapered effect
    transform: [{ scaleX: 1 }],
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: -30, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  nebula: {
    position: 'absolute',
    borderRadius: 500,
    opacity: 0.03,
  },
  nebula1: {
    width: 400,
    height: 400,
    top: -100,
    right: -100,
    backgroundColor: '#E31837',
  },
  nebula2: {
    width: 300,
    height: 300,
    bottom: 200,
    left: -150,
    backgroundColor: '#8B00FF',
  },
});

export default StarfieldBackground;
