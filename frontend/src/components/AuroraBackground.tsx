import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Ellipse, G } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

interface AuroraBackgroundProps {
  intensity?: 'subtle' | 'medium' | 'strong';
  colors?: string[];
}

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({
  intensity = 'subtle',
  colors = ['#E31837', '#8B00FF', '#00CED1', '#FF6B00'],
}) => {
  const opacityMap = {
    subtle: 0.15,
    medium: 0.25,
    strong: 0.4,
  };
  
  const baseOpacity = opacityMap[intensity];

  // Animation values for each aurora blob
  const blob1X = useSharedValue(0);
  const blob1Y = useSharedValue(0);
  const blob1Scale = useSharedValue(1);
  const blob1Opacity = useSharedValue(baseOpacity);

  const blob2X = useSharedValue(0);
  const blob2Y = useSharedValue(0);
  const blob2Scale = useSharedValue(1);
  const blob2Opacity = useSharedValue(baseOpacity * 0.8);

  const blob3X = useSharedValue(0);
  const blob3Y = useSharedValue(0);
  const blob3Scale = useSharedValue(1);
  const blob3Opacity = useSharedValue(baseOpacity * 0.6);

  useEffect(() => {
    // Blob 1 - slow, large movements
    blob1X.value = withRepeat(
      withSequence(
        withTiming(50, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-30, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    
    blob1Y.value = withRepeat(
      withSequence(
        withTiming(-40, { duration: 9000, easing: Easing.inOut(Easing.ease) }),
        withTiming(30, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    
    blob1Scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.9, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    blob1Opacity.value = withRepeat(
      withSequence(
        withTiming(baseOpacity * 1.3, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(baseOpacity * 0.7, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Blob 2 - medium speed
    blob2X.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(-60, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
          withTiming(40, { duration: 9000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    
    blob2Y.value = withDelay(
      1500,
      withRepeat(
        withSequence(
          withTiming(50, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
          withTiming(-35, { duration: 6000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    
    blob2Scale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1.3, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.85, { duration: 6000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    blob2Opacity.value = withDelay(
      2000,
      withRepeat(
        withSequence(
          withTiming(baseOpacity, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
          withTiming(baseOpacity * 0.5, { duration: 5000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    // Blob 3 - faster, smaller movements
    blob3X.value = withDelay(
      2000,
      withRepeat(
        withSequence(
          withTiming(70, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
          withTiming(-50, { duration: 6000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    
    blob3Y.value = withDelay(
      2500,
      withRepeat(
        withSequence(
          withTiming(-60, { duration: 5500, easing: Easing.inOut(Easing.ease) }),
          withTiming(40, { duration: 5000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    
    blob3Scale.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(1.4, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 4500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    blob3Opacity.value = withDelay(
      3000,
      withRepeat(
        withSequence(
          withTiming(baseOpacity * 0.9, { duration: 4500, easing: Easing.inOut(Easing.ease) }),
          withTiming(baseOpacity * 0.3, { duration: 4000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, [baseOpacity]);

  const blob1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: blob1X.value },
      { translateY: blob1Y.value },
      { scale: blob1Scale.value },
    ],
    opacity: blob1Opacity.value,
  }));

  const blob2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: blob2X.value },
      { translateY: blob2Y.value },
      { scale: blob2Scale.value },
    ],
    opacity: blob2Opacity.value,
  }));

  const blob3Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: blob3X.value },
      { translateY: blob3Y.value },
      { scale: blob3Scale.value },
    ],
    opacity: blob3Opacity.value,
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Aurora blob 1 - Top right, primary color */}
      <Animated.View style={[styles.blob, styles.blob1, blob1Style]}>
        <View style={[styles.blobInner, { backgroundColor: colors[0] }]} />
      </Animated.View>

      {/* Aurora blob 2 - Bottom left, secondary color */}
      <Animated.View style={[styles.blob, styles.blob2, blob2Style]}>
        <View style={[styles.blobInner, { backgroundColor: colors[1] }]} />
      </Animated.View>

      {/* Aurora blob 3 - Center, accent color */}
      <Animated.View style={[styles.blob, styles.blob3, blob3Style]}>
        <View style={[styles.blobInner, { backgroundColor: colors[2] }]} />
      </Animated.View>

      {/* Additional accent blob */}
      <Animated.View style={[styles.blob, styles.blob4, blob1Style]}>
        <View style={[styles.blobInner, { backgroundColor: colors[3] || colors[0] }]} />
      </Animated.View>
    </View>
  );
};

// Mesh gradient effect - more modern/futuristic
interface MeshGradientProps {
  intensity?: 'subtle' | 'medium' | 'strong';
}

export const MeshGradient: React.FC<MeshGradientProps> = ({ intensity = 'subtle' }) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  const opacityMap = {
    subtle: 0.1,
    medium: 0.2,
    strong: 0.35,
  };

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 60000, easing: Easing.linear }),
      -1,
      false
    );
    
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 12000, easing: Easing.inOut(Easing.ease) })
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
    opacity: opacityMap[intensity],
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.meshContainer, animatedStyle]}>
        <LinearGradient
          colors={['#E31837', '#8B00FF', '#00CED1', '#E31837']}
          locations={[0, 0.33, 0.66, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.meshGradient}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
      android: {
        elevation: 0,
      },
      web: {
        filter: 'blur(80px)',
      },
    }),
  },
  blob1: {
    top: -100,
    right: -50,
    width: 350,
    height: 350,
  },
  blob2: {
    bottom: 100,
    left: -100,
    width: 300,
    height: 300,
  },
  blob3: {
    top: '40%',
    left: '20%',
    width: 250,
    height: 250,
  },
  blob4: {
    bottom: -50,
    right: '30%',
    width: 200,
    height: 200,
  },
  meshContainer: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 2 }],
  },
  meshGradient: {
    width: '100%',
    height: '100%',
  },
});

export default AuroraBackground;
