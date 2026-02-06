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

interface Galaxy {
  x: number;
  y: number;
  size: number;
  rotation: number;
  opacity: number;
  type: 'spiral' | 'elliptical' | 'cluster';
  color: string;
}

interface Planet {
  x: number;
  y: number;
  size: number;
  color: string;
  ringColor?: string;
  hasRing: boolean;
  glowColor: string;
  opacity: number;
}

// Star colors for variety
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

// Galaxy colors
const GALAXY_COLORS = [
  '#8B5CF6',
  '#06B6D4',
  '#F59E0B',
  '#EC4899',
  '#10B981',
];

// Planet configurations
const PLANET_CONFIGS = [
  { color: '#E67E22', glowColor: '#F39C12', hasRing: false }, // Mars-like
  { color: '#5DADE2', glowColor: '#3498DB', hasRing: false }, // Neptune-like
  { color: '#F4D03F', glowColor: '#F7DC6F', hasRing: true, ringColor: '#D4AC0D' }, // Saturn-like
  { color: '#8E44AD', glowColor: '#9B59B6', hasRing: false }, // Purple gas giant
  { color: '#1ABC9C', glowColor: '#16A085', hasRing: true, ringColor: '#1ABC9C50' }, // Teal with ring
  { color: '#E74C3C', glowColor: '#C0392B', hasRing: false }, // Red dwarf
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
            duration: star.twinkleSpeed,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(star.opacity * 0.2, {
            duration: star.twinkleSpeed,
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
          withTiming(1.3, { duration: star.twinkleSpeed * 1.2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.7, { duration: star.twinkleSpeed * 1.2, easing: Easing.inOut(Easing.ease) })
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

    opacity.value = withSequence(
      withTiming(1, { duration: 80, easing: Easing.out(Easing.ease) }),
      withDelay(
        shootingStar.duration - 250,
        withTiming(0, { duration: 170, easing: Easing.in(Easing.ease) })
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
    }, 5000 + Math.random() * 8000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [0, distance * Math.cos(angle)]);
    const translateY = interpolate(progress.value, [0, 1], [0, distance * Math.sin(angle)]);
    const scaleX = interpolate(progress.value, [0, 0.2, 0.8, 1], [0.2, 1, 0.8, 0.3]);

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
        { left: shootingStar.startX, top: shootingStar.startY },
        animatedStyle,
      ]}
    >
      <View style={styles.shootingStarStreak} />
    </Animated.View>
  );
};

// Galaxy component
const GalaxyComponent = ({ galaxy }: { galaxy: Galaxy }) => {
  const rotation = useSharedValue(galaxy.rotation);
  const opacity = useSharedValue(galaxy.opacity * 0.5);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    // Slow rotation for spiral galaxies
    if (galaxy.type === 'spiral') {
      rotation.value = withRepeat(
        withTiming(galaxy.rotation + 360, { duration: 120000, easing: Easing.linear }),
        -1,
        false
      );
    }

    opacity.value = withRepeat(
      withSequence(
        withTiming(galaxy.opacity, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        withTiming(galaxy.opacity * 0.5, { duration: 8000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 10000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  if (galaxy.type === 'spiral') {
    return (
      <Animated.View
        style={[
          styles.galaxy,
          { left: galaxy.x, top: galaxy.y, width: galaxy.size, height: galaxy.size },
          animatedStyle,
        ]}
      >
        {/* Spiral arms */}
        <View style={[styles.spiralArm, { backgroundColor: galaxy.color + '40' }]} />
        <View style={[styles.spiralArm, { backgroundColor: galaxy.color + '40', transform: [{ rotate: '90deg' }] }]} />
        <View style={[styles.spiralArm, { backgroundColor: galaxy.color + '30', transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.spiralArm, { backgroundColor: galaxy.color + '30', transform: [{ rotate: '135deg' }] }]} />
        {/* Core */}
        <View style={[styles.galaxyCore, { backgroundColor: galaxy.color + '60' }]} />
      </Animated.View>
    );
  }

  if (galaxy.type === 'elliptical') {
    return (
      <Animated.View
        style={[
          styles.ellipticalGalaxy,
          {
            left: galaxy.x,
            top: galaxy.y,
            width: galaxy.size,
            height: galaxy.size * 0.6,
            backgroundColor: galaxy.color + '20',
            shadowColor: galaxy.color,
          },
          animatedStyle,
        ]}
      />
    );
  }

  // Star cluster
  return (
    <Animated.View
      style={[
        styles.starCluster,
        {
          left: galaxy.x,
          top: galaxy.y,
          width: galaxy.size,
          height: galaxy.size,
        },
        animatedStyle,
      ]}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.clusterStar,
            {
              left: Math.random() * galaxy.size * 0.8,
              top: Math.random() * galaxy.size * 0.8,
              width: 1 + Math.random() * 2,
              height: 1 + Math.random() * 2,
              backgroundColor: galaxy.color,
              opacity: 0.3 + Math.random() * 0.5,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
};

// Planet component
const PlanetComponent = ({ planet }: { planet: Planet }) => {
  const glowOpacity = useSharedValue(0.3);
  const rotation = useSharedValue(0);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    if (planet.hasRing) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 60000, easing: Easing.linear }),
        -1,
        false
      );
    }
  }, []);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { rotateX: '70deg' }],
  }));

  return (
    <View style={[styles.planetContainer, { left: planet.x, top: planet.y }]}>
      {/* Glow */}
      <Animated.View
        style={[
          styles.planetGlow,
          {
            width: planet.size * 2,
            height: planet.size * 2,
            backgroundColor: planet.glowColor,
            opacity: planet.opacity * 0.3,
          },
          animatedGlowStyle,
        ]}
      />
      
      {/* Planet body */}
      <View
        style={[
          styles.planet,
          {
            width: planet.size,
            height: planet.size,
            backgroundColor: planet.color,
            opacity: planet.opacity,
          },
        ]}
      >
        {/* Surface detail - lighter hemisphere */}
        <View style={[styles.planetHighlight, { backgroundColor: '#FFFFFF20' }]} />
      </View>

      {/* Ring */}
      {planet.hasRing && (
        <Animated.View
          style={[
            styles.planetRing,
            {
              width: planet.size * 2,
              height: planet.size * 0.4,
              borderColor: planet.ringColor || planet.color + '60',
            },
            animatedRingStyle,
          ]}
        />
      )}
    </View>
  );
};

// Aurora wave component
const AuroraWave = ({ index }: { index: number }) => {
  const opacity = useSharedValue(0.03);
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.1 + index * 0.02, { duration: 5000 + index * 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.02, { duration: 5000 + index * 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(-30, { duration: 8000 + index * 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(30, { duration: 8000 + index * 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    translateX.value = withRepeat(
      withSequence(
        withTiming(20, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-20, { duration: 10000, easing: Easing.inOut(Easing.ease) })
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
    ['transparent', '#00D4AA15', '#00D4AA35', '#00D4AA15', 'transparent'],
    ['transparent', '#8B00FF10', '#8B00FF25', '#8B00FF10', 'transparent'],
    ['transparent', '#E3183708', '#E3183718', '#E3183708', 'transparent'],
    ['transparent', '#3B82F610', '#3B82F620', '#3B82F610', 'transparent'],
  ];

  return (
    <Animated.View
      style={[
        styles.auroraWave,
        { top: 30 + index * 100, height: 250 + index * 30 },
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

// Nebula cloud component
const NebulaCloud = ({ x, y, size, color, opacity }: any) => {
  const animOpacity = useSharedValue(opacity * 0.5);

  useEffect(() => {
    animOpacity.value = withRepeat(
      withSequence(
        withTiming(opacity, { duration: 12000, easing: Easing.inOut(Easing.ease) }),
        withTiming(opacity * 0.4, { duration: 12000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: animOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.nebulaCloud,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
};

export const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  starCount = 120,
  shootingStarCount = 3,
  showAurora = true,
  showGalaxies = true,
  showPlanets = true,
}) => {
  // Generate stars
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: starCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height * 1.5,
      size: 0.5 + Math.random() * 2.5,
      opacity: 0.2 + Math.random() * 0.8,
      delay: Math.random() * 5000,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      twinkleSpeed: 2000 + Math.random() * 4000,
    }));
  }, [starCount]);

  // Generate shooting stars
  const shootingStars = useMemo<ShootingStar[]>(() => {
    return Array.from({ length: shootingStarCount }, (_, i) => ({
      id: i,
      startX: Math.random() * width * 0.7,
      startY: Math.random() * height * 0.25,
      delay: 2000 + Math.random() * 5000,
      duration: 500 + Math.random() * 400,
      angle: (Math.PI / 5) + (Math.random() * Math.PI / 6),
    }));
  }, [shootingStarCount]);

  // Generate galaxies
  const galaxies = useMemo<Galaxy[]>(() => {
    if (!showGalaxies) return [];
    return [
      { x: width * 0.1, y: height * 0.15, size: 60, rotation: 0, opacity: 0.4, type: 'spiral', color: GALAXY_COLORS[0] },
      { x: width * 0.75, y: height * 0.08, size: 45, rotation: 45, opacity: 0.35, type: 'spiral', color: GALAXY_COLORS[1] },
      { x: width * 0.85, y: height * 0.55, size: 35, rotation: 0, opacity: 0.3, type: 'elliptical', color: GALAXY_COLORS[2] },
      { x: width * 0.15, y: height * 0.7, size: 50, rotation: 30, opacity: 0.25, type: 'spiral', color: GALAXY_COLORS[3] },
      { x: width * 0.5, y: height * 0.3, size: 30, rotation: 0, opacity: 0.3, type: 'cluster', color: '#FFFFFF' },
      { x: width * 0.3, y: height * 0.45, size: 25, rotation: 0, opacity: 0.25, type: 'cluster', color: GALAXY_COLORS[4] },
      { x: width * 0.65, y: height * 0.85, size: 40, rotation: 60, opacity: 0.3, type: 'spiral', color: GALAXY_COLORS[0] },
    ];
  }, [showGalaxies]);

  // Generate planets
  const planets = useMemo<Planet[]>(() => {
    if (!showPlanets) return [];
    const configs = PLANET_CONFIGS;
    return [
      { x: width * 0.88, y: height * 0.25, size: 18, ...configs[0], opacity: 0.7 },
      { x: width * 0.08, y: height * 0.42, size: 25, ...configs[3], opacity: 0.6 },
      { x: width * 0.72, y: height * 0.68, size: 14, ...configs[1], opacity: 0.5 },
      { x: width * 0.35, y: height * 0.12, size: 20, ...configs[2], opacity: 0.55 },
      { x: width * 0.55, y: height * 0.78, size: 12, ...configs[5], opacity: 0.45 },
      { x: width * 0.2, y: height * 0.88, size: 16, ...configs[4], opacity: 0.5 },
    ];
  }, [showPlanets]);

  // Nebula clouds
  const nebulaClouds = useMemo(() => [
    { x: -100, y: -50, size: 400, color: '#00D4AA', opacity: 0.03 },
    { x: width - 150, y: height * 0.3, size: 350, color: '#8B00FF', opacity: 0.025 },
    { x: -50, y: height * 0.6, size: 300, color: '#E31837', opacity: 0.02 },
    { x: width * 0.4, y: -100, size: 450, color: '#3B82F6', opacity: 0.02 },
    { x: width * 0.6, y: height * 0.8, size: 280, color: '#F59E0B', opacity: 0.015 },
  ], []);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Deep space gradient */}
      <LinearGradient
        colors={['#000000', '#030308', '#050510', '#030308', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Nebula clouds - furthest back */}
      {nebulaClouds.map((cloud, i) => (
        <NebulaCloud key={`nebula-${i}`} {...cloud} />
      ))}

      {/* Aurora waves */}
      {showAurora && (
        <>
          <AuroraWave index={0} />
          <AuroraWave index={1} />
          <AuroraWave index={2} />
          <AuroraWave index={3} />
        </>
      )}

      {/* Galaxies - mid layer */}
      {galaxies.map((galaxy, i) => (
        <GalaxyComponent key={`galaxy-${i}`} galaxy={galaxy} />
      ))}

      {/* Stars */}
      {stars.map((star, index) => (
        <StarComponent key={`star-${index}`} star={star} />
      ))}

      {/* Planets - front layer */}
      {planets.map((planet, i) => (
        <PlanetComponent key={`planet-${i}`} planet={planet} />
      ))}

      {/* Shooting Stars - top layer */}
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
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 5,
  },
  shootingStar: {
    position: 'absolute',
  },
  shootingStarStreak: {
    width: 70,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: -15, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 0 8px 2px rgba(255,255,255,0.5), -25px 0 15px 0 rgba(255,255,255,0.3)',
      },
    }),
  },
  auroraWave: {
    position: 'absolute',
    left: -100,
    right: -100,
    borderRadius: 300,
  },
  galaxy: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spiralArm: {
    position: 'absolute',
    width: '100%',
    height: '30%',
    borderRadius: 50,
  },
  galaxyCore: {
    width: '30%',
    height: '30%',
    borderRadius: 100,
  },
  ellipticalGalaxy: {
    position: 'absolute',
    borderRadius: 100,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  starCluster: {
    position: 'absolute',
  },
  clusterStar: {
    position: 'absolute',
    borderRadius: 10,
  },
  planetContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planetGlow: {
    position: 'absolute',
    borderRadius: 100,
  },
  planet: {
    borderRadius: 100,
    overflow: 'hidden',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  planetHighlight: {
    width: '60%',
    height: '60%',
    borderRadius: 100,
    marginTop: '10%',
    marginRight: '10%',
  },
  planetRing: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  nebulaCloud: {
    position: 'absolute',
    borderRadius: 999,
  },
});

export default StarfieldBackground;
