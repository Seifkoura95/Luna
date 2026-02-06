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

interface StarfieldBackgroundProps {
  starCount?: number;
  shootingStarCount?: number;
  showAurora?: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  color: string;
}

interface ShootingStar {
  id: number;
  startX: number;
  startY: number;
  delay: number;
  duration: number;
  angle: number;
}

// Star colors for variety
const STAR_COLORS = [
  '#FFFFFF',
  '#FFFFFF',
  '#FFFFFF',
  '#E8E8FF', // Slightly blue
  '#FFF8E8', // Slightly warm
  '#FFE8E8', // Slightly pink
  '#00D4AA', // Accent color occasional
];

const StarComponent = ({ star }: { star: Star }) => {
  const opacity = useSharedValue(star.opacity * 0.2);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(
        withSequence(
          withTiming(star.opacity, {
            duration: 2000 + Math.random() * 3000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(star.opacity * 0.2, {
            duration: 2000 + Math.random() * 3000,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1,
        true
      )
    );

    scale.value = withDelay(
      star.delay,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 3000, easing: Easing.inOut(Easing.ease) })
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
        styles.star,
        {
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: star.color,
          shadowColor: star.color,
        },
        animatedStyle,
      ]}
    />
  );
};

const ShootingStarComponent = ({ shootingStar }: { shootingStar: ShootingStar }) => {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  const angle = shootingStar.angle;
  const distance = 250 + Math.random() * 200;

  const animate = () => {
    progress.value = 0;
    opacity.value = 0;

    // Fade in quickly, stay visible, fade out at end
    opacity.value = withSequence(
      withTiming(1, { duration: 100, easing: Easing.out(Easing.ease) }),
      withDelay(
        shootingStar.duration - 300,
        withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) })
      )
    );

    progress.value = withTiming(1, {
      duration: shootingStar.duration,
      easing: Easing.out(Easing.cubic),
    });
  };

  useEffect(() => {
    const initialTimeout = setTimeout(() => {
      animate();
    }, shootingStar.delay);

    const intervalId = setInterval(() => {
      animate();
    }, 6000 + Math.random() * 10000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [0, distance * Math.cos(angle)]);
    const translateY = interpolate(progress.value, [0, 1], [0, distance * Math.sin(angle)]);
    const scaleX = interpolate(progress.value, [0, 0.3, 1], [0.3, 1, 0.5]);

    return {
      transform: [
        { translateX },
        { translateY },
        { rotate: `${(angle * 180) / Math.PI}deg` },
        { scaleX },
      ],
      opacity: opacity.value,
    };
  });

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
      {/* Single rounded streak - no arrow shape */}
      <View style={styles.shootingStarStreak} />
    </Animated.View>
  );
};

// Aurora wave component
const AuroraWave = ({ index }: { index: number }) => {
  const opacity = useSharedValue(0.03);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.08, { duration: 4000 + index * 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.02, { duration: 4000 + index * 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(-20, { duration: 6000 + index * 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(20, { duration: 6000 + index * 500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const colors = [
    ['transparent', '#00D4AA20', '#00D4AA40', '#00D4AA20', 'transparent'],
    ['transparent', '#8B00FF15', '#8B00FF30', '#8B00FF15', 'transparent'],
    ['transparent', '#E3183710', '#E3183720', '#E3183710', 'transparent'],
  ];

  return (
    <Animated.View
      style={[
        styles.auroraWave,
        {
          top: 50 + index * 80,
          height: 200 + index * 50,
        },
        animatedStyle,
      ]}
    >
      <LinearGradient
        colors={colors[index % colors.length] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

export const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  starCount = 100,
  shootingStarCount = 3,
  showAurora = true,
}) => {
  // Generate more stars with variety
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: starCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height * 1.5,
      size: 0.5 + Math.random() * 2.5,
      opacity: 0.2 + Math.random() * 0.8,
      delay: Math.random() * 4000,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    }));
  }, [starCount]);

  // Generate shooting stars with proper angles
  const shootingStars = useMemo<ShootingStar[]>(() => {
    return Array.from({ length: shootingStarCount }, (_, i) => ({
      id: i,
      startX: Math.random() * width * 0.7,
      startY: Math.random() * height * 0.25,
      delay: 3000 + Math.random() * 6000,
      duration: 600 + Math.random() * 400,
      angle: (Math.PI / 5) + (Math.random() * Math.PI / 6), // 36-66 degrees downward
    }));
  }, [shootingStarCount]);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Deep space background gradient */}
      <LinearGradient
        colors={['#000000', '#050510', '#0A0A15', '#050510', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Aurora waves */}
      {showAurora && (
        <>
          <AuroraWave index={0} />
          <AuroraWave index={1} />
          <AuroraWave index={2} />
        </>
      )}

      {/* Stars */}
      {stars.map((star, index) => (
        <StarComponent key={`star-${index}`} star={star} />
      ))}

      {/* Shooting Stars - smooth streaks */}
      {shootingStars.map((shootingStar) => (
        <ShootingStarComponent key={`shooting-${shootingStar.id}`} shootingStar={shootingStar} />
      ))}

      {/* Subtle nebula clouds */}
      <View style={[styles.nebula, styles.nebula1]} />
      <View style={[styles.nebula, styles.nebula2]} />
      <View style={[styles.nebula, styles.nebula3]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  star: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 5,
  },
  shootingStar: {
    position: 'absolute',
  },
  shootingStarStreak: {
    width: 80,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
    // Gradient fade effect using shadow
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: -20, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 0 10px 2px rgba(255,255,255,0.6), -30px 0 20px 0 rgba(255,255,255,0.3)',
      },
    }),
  },
  auroraWave: {
    position: 'absolute',
    left: -50,
    right: -50,
    borderRadius: 200,
  },
  nebula: {
    position: 'absolute',
    borderRadius: 999,
  },
  nebula1: {
    width: 500,
    height: 500,
    top: -150,
    right: -200,
    backgroundColor: '#00D4AA',
    opacity: 0.02,
  },
  nebula2: {
    width: 400,
    height: 400,
    bottom: 100,
    left: -200,
    backgroundColor: '#8B00FF',
    opacity: 0.025,
  },
  nebula3: {
    width: 300,
    height: 300,
    top: height * 0.4,
    right: -100,
    backgroundColor: '#E31837',
    opacity: 0.015,
  },
});

export default StarfieldBackground;
