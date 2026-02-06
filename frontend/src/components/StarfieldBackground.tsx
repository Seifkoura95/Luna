import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Platform, Image } from 'react-native';
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
  showGalaxies?: boolean;
  showPlanets?: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  color: string;
  twinkleSpeed: number;
}

interface ShootingStar {
  id: number;
  startX: number;
  startY: number;
  delay: number;
  duration: number;
  angle: number;
}

// Hyperrealistic space images
const GALAXY_IMAGES = [
  'https://images.unsplash.com/photo-1709408635158-8d735f0395c4?w=200&q=80', // NGC 4214 dwarf galaxy
  'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=200&q=80', // Spiral galaxy
  'https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=150&q=80', // Galaxy cluster
];

const NEBULA_IMAGES = [
  'https://images.unsplash.com/photo-1762590322939-8e117e56f6b5?w=300&q=80', // Colorful nebula
  'https://images.pexels.com/photos/9160637/pexels-photo-9160637.jpeg?w=300', // Red nebula
  'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&q=80', // Milky way
];

const PLANET_IMAGES = [
  'https://images.unsplash.com/photo-1701486485364-edaa591075ea?w=100&q=80', // Saturn with rings
  'https://images.unsplash.com/photo-1701486485832-6d3af9ca0e60?w=100&q=80', // Jupiter style
  'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=80&q=80', // Mars
  'https://images.unsplash.com/photo-1630839437035-dac17da580d0?w=80&q=80', // Blue planet
];

// Star colors
const STAR_COLORS = [
  '#FFFFFF',
  '#FFFFFF',
  '#FFFFFF',
  '#E8E8FF',
  '#FFF8E8',
  '#FFE8E8',
  '#E8FFFF',
  '#00D4AA',
];

// Star component
const StarComponent = ({ star }: { star: Star }) => {
  const opacity = useSharedValue(star.opacity * 0.2);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(
        withSequence(
          withTiming(star.opacity, { duration: star.twinkleSpeed, easing: Easing.inOut(Easing.ease) }),
          withTiming(star.opacity * 0.15, { duration: star.twinkleSpeed, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    scale.value = withDelay(
      star.delay,
      withRepeat(
        withSequence(
          withTiming(1.4, { duration: star.twinkleSpeed * 1.1, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.6, { duration: star.twinkleSpeed * 1.1, easing: Easing.inOut(Easing.ease) })
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

// Shooting star component
const ShootingStarComponent = ({ shootingStar }: { shootingStar: ShootingStar }) => {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  const angle = shootingStar.angle;
  const distance = 280;

  const animate = () => {
    progress.value = 0;
    opacity.value = 0;

    opacity.value = withSequence(
      withTiming(1, { duration: 60, easing: Easing.out(Easing.ease) }),
      withDelay(shootingStar.duration - 200, withTiming(0, { duration: 140, easing: Easing.in(Easing.ease) }))
    );

    progress.value = withTiming(1, { duration: shootingStar.duration, easing: Easing.out(Easing.cubic) });
  };

  useEffect(() => {
    const initialTimeout = setTimeout(animate, shootingStar.delay);
    const intervalId = setInterval(animate, 6000 + Math.random() * 10000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [0, distance * Math.cos(angle)]);
    const translateY = interpolate(progress.value, [0, 1], [0, distance * Math.sin(angle)]);
    const scaleX = interpolate(progress.value, [0, 0.15, 0.85, 1], [0.1, 1, 0.7, 0.2]);

    return {
      transform: [{ translateX }, { translateY }, { rotate: `${(angle * 180) / Math.PI}deg` }, { scaleX }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[styles.shootingStar, { left: shootingStar.startX, top: shootingStar.startY }, animatedStyle]}>
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF80', 'transparent']}
        start={{ x: 1, y: 0.5 }}
        end={{ x: 0, y: 0.5 }}
        style={styles.shootingStarGradient}
      />
    </Animated.View>
  );
};

// Hyperrealistic galaxy image component
const GalaxyImageComponent = ({ x, y, size, imageUrl, rotation, delay }: any) => {
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(rotation);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.4, { duration: 2000 }));
    
    rotate.value = withRepeat(
      withTiming(rotation + 360, { duration: 180000, easing: Easing.linear }),
      -1,
      false
    );

    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 15000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 15000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotate.value}deg` }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.galaxyImage, { left: x, top: y, width: size, height: size }, animatedStyle]}>
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    </Animated.View>
  );
};

// Hyperrealistic planet image component - NO GLOW
const PlanetImageComponent = ({ x, y, size, imageUrl, delay }: any) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.7, { duration: 1500 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.planetContainer, { left: x, top: y }, animatedStyle]}>
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    </Animated.View>
  );
};

// Nebula image component
const NebulaImageComponent = ({ x, y, size, imageUrl, delay }: any) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.15, { duration: 3000 }));
    
    translateY.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 20000, easing: Easing.inOut(Easing.ease) }),
        withTiming(15, { duration: 20000, easing: Easing.inOut(Easing.ease) })
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
    <Animated.View style={[styles.nebulaImage, { left: x, top: y, width: size, height: size }, animatedStyle]}>
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size }}
        resizeMode="cover"
        blurRadius={Platform.OS === 'ios' ? 3 : 2}
      />
    </Animated.View>
  );
};

// Aurora wave component
const AuroraWave = ({ index }: { index: number }) => {
  const opacity = useSharedValue(0.02);
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.08 + index * 0.015, { duration: 6000 + index * 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.02, { duration: 6000 + index * 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(-25, { duration: 10000 + index * 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(25, { duration: 10000 + index * 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    translateX.value = withRepeat(
      withSequence(
        withTiming(15, { duration: 12000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-15, { duration: 12000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { translateX: translateX.value }],
  }));

  const colors = [
    ['transparent', '#00D4AA12', '#00D4AA30', '#00D4AA12', 'transparent'],
    ['transparent', '#8B00FF10', '#8B00FF22', '#8B00FF10', 'transparent'],
    ['transparent', '#E3183708', '#E3183715', '#E3183708', 'transparent'],
    ['transparent', '#3B82F608', '#3B82F615', '#3B82F608', 'transparent'],
  ];

  return (
    <Animated.View style={[styles.auroraWave, { top: 20 + index * 120, height: 300 }, animatedStyle]}>
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
  starCount = 150,
  shootingStarCount = 3,
  showAurora = true,
  showGalaxies = true,
  showPlanets = true,
}) => {
  // Generate stars
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 1.5,
      size: 0.5 + Math.random() * 2.8,
      opacity: 0.2 + Math.random() * 0.8,
      delay: Math.random() * 5000,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      twinkleSpeed: 1500 + Math.random() * 4000,
    }));
  }, [starCount]);

  // Generate shooting stars
  const shootingStars = useMemo<ShootingStar[]>(() => {
    return Array.from({ length: shootingStarCount }, (_, i) => ({
      id: i,
      startX: Math.random() * width * 0.6,
      startY: Math.random() * height * 0.2,
      delay: 2000 + Math.random() * 4000,
      duration: 450 + Math.random() * 350,
      angle: (Math.PI / 5) + (Math.random() * Math.PI / 7),
    }));
  }, [shootingStarCount]);

  // Galaxy positions
  const galaxyConfigs = useMemo(() => [
    { x: width * 0.05, y: height * 0.08, size: 70, imageUrl: GALAXY_IMAGES[0], rotation: 0, delay: 500 },
    { x: width * 0.7, y: height * 0.02, size: 55, imageUrl: GALAXY_IMAGES[1], rotation: 30, delay: 1000 },
    { x: width * 0.15, y: height * 0.65, size: 45, imageUrl: GALAXY_IMAGES[2], rotation: 45, delay: 1500 },
  ], []);

  // Planet positions
  const planetConfigs = useMemo(() => [
    { x: width * 0.85, y: height * 0.18, size: 35, imageUrl: PLANET_IMAGES[0], delay: 800 },
    { x: width * 0.05, y: height * 0.45, size: 28, imageUrl: PLANET_IMAGES[1], delay: 1200 },
    { x: width * 0.75, y: height * 0.72, size: 22, imageUrl: PLANET_IMAGES[2], delay: 1600 },
    { x: width * 0.4, y: height * 0.15, size: 18, imageUrl: PLANET_IMAGES[3], delay: 2000 },
  ], []);

  // Nebula positions
  const nebulaConfigs = useMemo(() => [
    { x: -80, y: -50, size: 450, imageUrl: NEBULA_IMAGES[0], delay: 0 },
    { x: width - 200, y: height * 0.5, size: 380, imageUrl: NEBULA_IMAGES[1], delay: 500 },
    { x: width * 0.2, y: height * 0.7, size: 320, imageUrl: NEBULA_IMAGES[2], delay: 1000 },
  ], []);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Deep space gradient */}
      <LinearGradient
        colors={['#000000', '#020206', '#040410', '#020206', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Nebula images - furthest back */}
      {showGalaxies && nebulaConfigs.map((config, i) => (
        <NebulaImageComponent key={`nebula-${i}`} {...config} />
      ))}

      {/* Aurora waves */}
      {showAurora && (
        <>
          <AuroraWave index={0} />
          <AuroraWave index={1} />
          <AuroraWave index={2} />
        </>
      )}

      {/* Galaxy images */}
      {showGalaxies && galaxyConfigs.map((config, i) => (
        <GalaxyImageComponent key={`galaxy-${i}`} {...config} />
      ))}

      {/* Stars */}
      {stars.map((star, index) => (
        <StarComponent key={`star-${index}`} star={star} />
      ))}

      {/* Planet images */}
      {showPlanets && planetConfigs.map((config, i) => (
        <PlanetImageComponent key={`planet-${i}`} {...config} />
      ))}

      {/* Shooting Stars */}
      {shootingStars.map((shootingStar) => (
        <ShootingStarComponent key={`shooting-${shootingStar.id}`} shootingStar={shootingStar} />
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
  star: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 5,
  },
  shootingStar: {
    position: 'absolute',
    width: 80,
    height: 3,
  },
  shootingStarGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  auroraWave: {
    position: 'absolute',
    left: -150,
    right: -150,
    borderRadius: 400,
  },
  galaxyImage: {
    position: 'absolute',
  },
  planetContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planetGlow: {
    position: 'absolute',
    backgroundColor: '#FFFFFF08',
  },
  nebulaImage: {
    position: 'absolute',
  },
});

export default StarfieldBackground;
