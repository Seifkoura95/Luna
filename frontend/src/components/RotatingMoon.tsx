import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

// Original Luna moon image
const LUNAR_MOON_IMAGE = 'https://customer-assets.emergentagent.com/job_cluboscenexus/artifacts/ekzz65x8_lunar%20moon.PNG';

// Global rotation duration (30 seconds for full rotation)
const GLOBAL_ROTATION_DURATION = 30000;

// Global start time reference - all moons sync to this
const GLOBAL_START_TIME = Date.now();

interface RotatingMoonProps {
  size?: number;
  rotationDuration?: number;
}

export const RotatingMoon: React.FC<RotatingMoonProps> = ({ 
  size = 80, 
  rotationDuration = GLOBAL_ROTATION_DURATION
}) => {
  const rotation = useSharedValue(0);
  const animationRef = useRef<any>(null);
  // Scale up the image significantly - the actual moon in the image is only ~30% of the canvas
  const scale = 5;
  const innerSize = size * scale;

  useEffect(() => {
    // Calculate the current rotation based on global time
    // This ensures all moons are in sync regardless of when the component mounts
    const elapsed = Date.now() - GLOBAL_START_TIME;
    const currentRotation = (elapsed / rotationDuration) * 360 % 360;
    
    // Set initial rotation to sync with global time
    rotation.value = currentRotation;
    
    // Start continuous animation from current position
    const startAnimation = () => {
      const remainingDegrees = 360 - (rotation.value % 360);
      const remainingTime = (remainingDegrees / 360) * rotationDuration;
      
      // First, complete the current rotation
      rotation.value = withTiming(rotation.value + remainingDegrees, {
        duration: remainingTime,
        easing: Easing.linear,
      });
      
      // Then start infinite loop
      setTimeout(() => {
        const animate = () => {
          rotation.value = 0;
          rotation.value = withTiming(360, {
            duration: rotationDuration,
            easing: Easing.linear,
          });
        };
        animate();
        
        // Set up interval for continuous rotation
        animationRef.current = setInterval(() => {
          rotation.value = 0;
          rotation.value = withTiming(360, {
            duration: rotationDuration,
            easing: Easing.linear,
          });
        }, rotationDuration);
      }, remainingTime);
    };
    
    startAnimation();
    
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
      cancelAnimation(rotation);
    };
  }, [rotationDuration]);

  // Smooth spinning rotation
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
