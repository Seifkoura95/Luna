import React, { useEffect } from 'react';
import { Image, StyleSheet, View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// Use the original Luna moon but scale it so only the moon shows
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
  // The moon in the image is centered but smaller than the canvas
  // Scale up to fill the container and crop out the black background
  const scale = 2.5;

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

  // Smooth spinning rotation with scale
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={[animatedStyle, styles.imageContainer]}>
        <Image
          source={{ uri: LUNAR_MOON_IMAGE }}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 1000, // Circular clip
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RotatingMoon;
