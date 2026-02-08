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
  // Scale up the image significantly - the actual moon in the image is only ~30% of the canvas
  // We need to scale by about 5x to make just the moon visible
  const scale = 5;
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

  // Smooth spinning rotation - only rotate the image
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    width: innerSize,
    height: innerSize,
  }));

  return (
    <View style={[styles.outerContainer, { width: size, height: size }]}>
      <View style={[styles.clipContainer, { width: size, height: size, borderRadius: size / 2 }]}>
        <Animated.Image
          source={{ uri: LUNAR_MOON_IMAGE }}
          style={[styles.moonImage, animatedStyle]}
          resizeMode="contain"
        />
        {/* White tint overlay to make it look like a real lunar moon */}
        <View style={styles.whiteTint} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  clipContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  moonImage: {
    // Style is applied dynamically
  },
  whiteTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 1000,
  },
});

export default RotatingMoon;
