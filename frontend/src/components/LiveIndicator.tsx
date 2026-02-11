import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, radius } from '../theme/colors';

interface LiveIndicatorProps {
  text?: string;
  color?: string;
  size?: 'small' | 'medium' | 'large';
  pulse?: boolean;
}

export const LiveIndicator: React.FC<LiveIndicatorProps> = ({
  text = 'LIVE',
  color = colors.accent,
  size = 'medium',
  pulse = true,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (pulse) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 600, easing: Easing.ease }),
          withTiming(1, { duration: 600, easing: Easing.ease })
        ),
        -1,
        false
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 600, easing: Easing.ease }),
          withTiming(1, { duration: 600, easing: Easing.ease })
        ),
        -1,
        false
      );
    }
  }, [pulse]);

  const dotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const getDotSize = () => {
    switch (size) {
      case 'small': return 6;
      case 'large': return 10;
      default: return 8;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small': return 9;
      case 'large': return 12;
      default: return 10;
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.dotContainer, { width: getDotSize() + 8, height: getDotSize() + 8 }]}>
        <Animated.View
          style={[
            styles.dot,
            {
              width: getDotSize(),
              height: getDotSize(),
              borderRadius: getDotSize() / 2,
              backgroundColor: color,
            },
            dotAnimatedStyle,
          ]}
        />
        {/* Glow effect */}
        <View
          style={[
            styles.glow,
            {
              width: getDotSize() * 2,
              height: getDotSize() * 2,
              borderRadius: getDotSize(),
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={[styles.text, { fontSize: getFontSize(), color }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dotContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    zIndex: 2,
  },
  glow: {
    position: 'absolute',
    opacity: 0.3,
    zIndex: 1,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});

export default LiveIndicator;
