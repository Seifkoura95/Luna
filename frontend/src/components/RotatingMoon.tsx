import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Subtle glow behind moon */}
      <View style={[styles.glow, { 
        width: size * 1.3, 
        height: size * 1.3,
        borderRadius: size * 0.65,
      }]} />
      
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
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(227, 24, 55, 0.1)',
  },
  moon: {
    // Shadow for depth
    shadowColor: '#E31837',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
});

export default RotatingMoon;
