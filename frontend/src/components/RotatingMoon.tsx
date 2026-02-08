import React, { useEffect } from 'react';
import { Image, StyleSheet, View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

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
  // Scale the image up aggressively to crop out all black background
  const imageScale = 2.2;
  const imageSize = size * imageScale;

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
    transform: [
      { scale: imageScale },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Animated.View style={[animatedStyle, { width: size, height: size }]}>
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
  },
});

export default RotatingMoon;
