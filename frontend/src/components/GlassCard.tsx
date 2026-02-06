import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing } from '../theme/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  onPress?: () => void;
  enableTilt?: boolean;
  glowColor?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity = 20,
  tint = 'dark',
  onPress,
  enableTilt = true,
  glowColor = colors.accent,
}) => {
  const pressed = useSharedValue(0);
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      pressed.value = withSpring(1, { damping: 15, stiffness: 400 });
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    })
    .onFinalize(() => {
      pressed.value = withSpring(0, { damping: 15, stiffness: 400 });
      if (onPress) {
        onPress();
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (enableTilt) {
        // Calculate tilt based on touch position
        rotateY.value = interpolate(event.translationX, [-100, 100], [-8, 8]);
        rotateX.value = interpolate(event.translationY, [-100, 100], [8, -8]);
      }
    })
    .onEnd(() => {
      rotateX.value = withSpring(0, { damping: 20 });
      rotateY.value = withSpring(0, { damping: 20 });
    });

  const composedGesture = Gesture.Simultaneous(tapGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, 0.97]);
    
    return {
      transform: [
        { scale },
        { perspective: 1000 },
        { rotateX: `${rotateX.value}deg` },
        { rotateY: `${rotateY.value}deg` },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(pressed.value, [0, 1], [0, 0.3]),
    };
  });

  // Fallback for web where BlurView might not work well
  if (Platform.OS === 'web') {
    return (
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.container, style, animatedStyle]}>
          <View style={[styles.webGlass, { backgroundColor: 'rgba(20, 20, 20, 0.8)' }]}>
            {children}
          </View>
          <Animated.View style={[styles.glow, { backgroundColor: glowColor }, glowStyle]} />
        </Animated.View>
      </GestureDetector>
    );
  }

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container, style, animatedStyle]}>
        <BlurView intensity={intensity} tint={tint} style={styles.blur}>
          <View style={styles.innerGradient}>
            <LinearGradient
              colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {children}
          </View>
        </BlurView>
        <Animated.View style={[styles.glow, { backgroundColor: glowColor }, glowStyle]} />
        <View style={styles.border} />
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  blur: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  webGlass: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  innerGradient: {
    position: 'relative',
  },
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    pointerEvents: 'none',
  },
  glow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: radius.lg + 20,
    opacity: 0,
  },
});

export default GlassCard;
