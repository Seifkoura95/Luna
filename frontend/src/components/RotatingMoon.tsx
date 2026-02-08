import React, { useEffect } from 'react';
import { Image, StyleSheet, View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// Original Luna moon image
const LUNAR_MOON_IMAGE = 'https://customer-assets.emergentagent.com/job_cluboscenexus/artifacts/ekzz65x8_lunar%20moon.PNG';

interface RotatingMoonProps {
  size?: number;
  rotationDuration?: number;
}

export const RotatingMoon: React.FC<RotatingMoonProps> = ({ 
  size = 80, 
  rotationDuration = 30000 // 30 seconds for full rotation
}) => {
  const rotation = useSharedValue(0);
  // Scale up the image significantly to ensure moon fills the container
  const scale = 3.5;
  const innerSize = size * scale;

  useEffect(() => {
    // Simple continuous spin - like a planet rotating on its axis
    rotation.value = withRepeat(
      withTiming(360, { 
        duration: rotationDuration, 
        easing: Easing.linear 
      }),
      -1, // infinite
      false // don't reverse
    );
  }, [rotationDuration]);

  // Smooth spinning rotation
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Use clip-path for web, overflow hidden for native
  const containerStyle = Platform.select({
    web: {
      clipPath: 'circle(50%)',
    },
    default: {},
  });

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, containerStyle]}>
      <Animated.View style={[animatedStyle, styles.imageWrapper]}>
        {/* Moon image scaled up to fill container */}
        <Image
          source={{ uri: LUNAR_MOON_IMAGE }}
          style={{ width: innerSize, height: innerSize }}
          resizeMode="contain"
        />
      </Animated.View>
      {/* White tint overlay to make it look like a real lunar moon */}
      <View 
        style={[
          styles.whiteTint, 
          { 
            width: size,
            height: size,
            borderRadius: size / 2,
          }
        ]} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  whiteTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default RotatingMoon;
