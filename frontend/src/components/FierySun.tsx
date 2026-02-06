import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Circle, G, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface FierySunProps {
  size?: number;
}

export const FierySun: React.FC<FierySunProps> = ({ size = 20 }) => {
  const pulseScale = useSharedValue(1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Pulsing effect
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Slow rotation
    rotation.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const center = size / 2;
  const coreRadius = size * 0.25;
  const innerRadius = size * 0.35;
  const outerRadius = size * 0.45;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Main sun container */}
      <Animated.View style={[styles.sunContainer, containerStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            {/* Core gradient - bright yellow/white center */}
            <RadialGradient id="coreGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="40%" stopColor="#FFF8DC" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FFD700" stopOpacity="1" />
            </RadialGradient>
            
            {/* Inner flame gradient */}
            <RadialGradient id="innerFlame" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFD700" stopOpacity="1" />
              <Stop offset="60%" stopColor="#FFA500" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#FF6B00" stopOpacity="0.7" />
            </RadialGradient>
            
            {/* Outer corona gradient */}
            <RadialGradient id="outerCorona" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FF6B00" stopOpacity="0.6" />
              <Stop offset="50%" stopColor="#FF4500" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#DC143C" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          
          {/* Outer corona */}
          <Circle cx={center} cy={center} r={outerRadius} fill="url(#outerCorona)" />
          
          {/* Inner flame layer */}
          <Circle cx={center} cy={center} r={innerRadius} fill="url(#innerFlame)" />
          
          {/* Core */}
          <Circle cx={center} cy={center} r={coreRadius} fill="url(#coreGradient)" />
        </Svg>
        
        {/* Solar flares layer */}
        <Animated.View style={[styles.flaresContainer, { width: size, height: size }, rotationStyle]}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Small flare points */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, index) => {
              const rad = (angle * Math.PI) / 180;
              const x = center + Math.cos(rad) * (innerRadius + 2);
              const y = center + Math.sin(rad) * (innerRadius + 2);
              const flareLength = index % 2 === 0 ? 4 : 2;
              const endX = center + Math.cos(rad) * (innerRadius + flareLength + 2);
              const endY = center + Math.sin(rad) * (innerRadius + flareLength + 2);
              
              return (
                <Path
                  key={angle}
                  d={`M ${x} ${y} L ${endX} ${endY}`}
                  stroke="#FFD700"
                  strokeWidth={index % 2 === 0 ? 1.5 : 1}
                  strokeLinecap="round"
                  opacity={0.8}
                />
              );
            })}
          </Svg>
        </Animated.View>
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
  sunContainer: {
    position: 'relative',
  },
  flaresContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default FierySun;
