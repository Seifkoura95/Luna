import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme/colors';

const { width } = Dimensions.get('window');

interface ShimmerProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Shimmer: React.FC<ShimmerProps> = ({
  width: shimmerWidth = '100%',
  height = 20,
  borderRadius = radius.md,
  style,
}) => {
  const translateX = useSharedValue(-width);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(width * 2, {
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[
        styles.shimmerContainer,
        {
          width: shimmerWidth,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmer, animatedStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
};

// Card skeleton for loading states
interface CardSkeletonProps {
  style?: ViewStyle;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ style }) => {
  return (
    <View style={[styles.cardSkeleton, style]}>
      <Shimmer height={160} borderRadius={radius.lg} />
      <View style={styles.cardSkeletonContent}>
        <Shimmer width="60%" height={14} style={{ marginBottom: 8 }} />
        <Shimmer width="80%" height={20} style={{ marginBottom: 12 }} />
        <View style={styles.cardSkeletonRow}>
          <Shimmer width="30%" height={12} />
          <Shimmer width="20%" height={24} borderRadius={radius.sm} />
        </View>
      </View>
    </View>
  );
};

// List skeleton for loading lists
interface ListSkeletonProps {
  count?: number;
  itemHeight?: number;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  count = 3,
  itemHeight = 80,
}) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.listItem, { height: itemHeight }]}>
          <Shimmer width={50} height={50} borderRadius={25} />
          <View style={styles.listItemContent}>
            <Shimmer width="70%" height={16} style={{ marginBottom: 8 }} />
            <Shimmer width="50%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
};

// Pulse animation for elements
interface PulseProps {
  children: React.ReactNode;
  duration?: number;
}

export const Pulse: React.FC<PulseProps> = ({ children, duration = 1500 }) => {
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

const styles = StyleSheet.create({
  shimmerContainer: {
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  shimmerGradient: {
    width: 150,
    height: '100%',
  },
  cardSkeleton: {
    marginBottom: 16,
  },
  cardSkeletonContent: {
    padding: 12,
  },
  cardSkeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
});

export default Shimmer;
