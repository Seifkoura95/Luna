import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// High quality blood moon with true transparent background
const LUNAR_MOON_IMAGE = 'https://www.pngall.com/wp-content/uploads/13/Red-Moon-PNG-Clipart.png';

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

  return (
    <View style={[styles.container, { width: size, height: size }]}>
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
  },
});

export default RotatingMoon;
