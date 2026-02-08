import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

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

  // Create a stylized blood moon using gradients
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={[animatedStyle, { width: size, height: size }]}>
        <LinearGradient
          colors={['#8B0000', '#DC143C', '#CD5C5C', '#B22222', '#8B0000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.moon, { width: size, height: size, borderRadius: size / 2 }]}
        >
          {/* Moon texture overlay */}
          <View style={[styles.crater, { top: size * 0.15, left: size * 0.25, width: size * 0.15, height: size * 0.15 }]} />
          <View style={[styles.crater, { top: size * 0.4, left: size * 0.55, width: size * 0.2, height: size * 0.2 }]} />
          <View style={[styles.crater, { top: size * 0.6, left: size * 0.2, width: size * 0.12, height: size * 0.12 }]} />
          <View style={[styles.craterSmall, { top: size * 0.3, left: size * 0.7, width: size * 0.08, height: size * 0.08 }]} />
          <View style={[styles.craterSmall, { top: size * 0.75, left: size * 0.6, width: size * 0.1, height: size * 0.1 }]} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  moon: {
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#DC143C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  crater: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'rgba(80, 0, 0, 0.4)',
  },
  craterSmall: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'rgba(60, 0, 0, 0.3)',
  },
});

export default RotatingMoon;
