import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing } from '../theme/colors';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'gold' | 'outline' | 'glass';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  fullWidth = false,
}) => {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
    glow.value = withTiming(1, { duration: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    glow.value = withTiming(0, { duration: 200 });
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Pulse animation
    scale.value = withSequence(
      withSpring(0.92, { damping: 10 }),
      withSpring(1, { damping: 15 })
    );
    onPress();
  };

  const getGradientColors = (): string[] => {
    switch (variant) {
      case 'primary':
        return [colors.accent, colors.accentDark];
      case 'gold':
        return [colors.goldLight, colors.gold, colors.goldDark];
      case 'secondary':
        return ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)'];
      case 'glass':
        return ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)'];
      case 'outline':
        return ['transparent', 'transparent'];
      default:
        return [colors.accent, colors.accentDark];
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: spacing.sm, paddingHorizontal: spacing.md };
      case 'large':
        return { paddingVertical: spacing.md + 4, paddingHorizontal: spacing.xl };
      default:
        return { paddingVertical: spacing.md, paddingHorizontal: spacing.lg };
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'small':
        return 12;
      case 'large':
        return 16;
      default:
        return 14;
    }
  };

  return (
    <AnimatedTouchable
      style={[
        animatedStyle,
        fullWidth && { width: '100%' },
        style,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={1}
    >
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          getSizeStyles(),
          variant === 'outline' && styles.outline,
          disabled && styles.disabled,
        ]}
      >
        {icon && <>{icon}</>}
        <Text
          style={[
            styles.text,
            { fontSize: getTextSize() },
            variant === 'gold' && { color: colors.background },
            disabled && styles.disabledText,
            textStyle,
          ]}
        >
          {loading ? 'Loading...' : title}
        </Text>
      </LinearGradient>
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  text: {
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: colors.textMuted,
  },
});

export default AnimatedButton;
