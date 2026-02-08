import React, { useEffect } from 'react';
import { Image, StyleSheet, View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// Use the original Luna moon
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
  // The moon in the image takes up roughly 40% of the canvas, 
  // so scale by ~3.5x to have the moon fill the container completely
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

  // The container clips to circular shape, and the image is scaled up
  // so the moon itself fills the circle
  return (
    <View 
      style={[
        styles.outerContainer, 
        { 
          width: size, 
          height: size, 
        }
      ]}
    >
      <View 
        style={[
          styles.clipContainer, 
          { 
            width: size, 
            height: size, 
            borderRadius: size / 2,
          }
        ]}
      >
        <Animated.View style={[animatedStyle, styles.imageContainer]}>
          <Image
            source={{ uri: LUNAR_MOON_IMAGE }}
            style={{ width: innerSize, height: innerSize }}
            resizeMode="contain"
          />
        </Animated.View>
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
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RotatingMoon;
