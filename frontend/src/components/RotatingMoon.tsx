import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
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

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { 
        duration: rotationDuration, 
        easing: Easing.linear 
      }),
      -1, // infinite
      false // don't reverse
    );
  }, [rotationDuration]);

  // Sideways rotation like a real moon - using scaleX to simulate Y-axis rotation
  const animatedStyle = useAnimatedStyle(() => {
    // Create a sideways "spin" effect by varying scaleX
    const scaleX = interpolate(
      rotation.value % 360,
      [0, 90, 180, 270, 360],
      [1, 0.85, 1, 0.85, 1]
    );
    
    // Add slight horizontal movement for more realism
    const translateX = interpolate(
      rotation.value % 360,
      [0, 90, 180, 270, 360],
      [0, -2, 0, 2, 0]
    );

    return {
      transform: [
        { scaleX },
        { translateX },
      ],
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={animatedStyle}>
        <Image
          source={{ uri: LUNAR_MOON_IMAGE }}
          style={[styles.moon, { width: size, height: size, borderRadius: size / 2 }]}
          resizeMode="cover"
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
  },
  moon: {
    // No glow, clean look
  },
});

export default RotatingMoon;
