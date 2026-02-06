import React, { useEffect, useState } from 'react';
import { Text, TextStyle, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  style?: TextStyle;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  formatCommas?: boolean;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1000,
  style,
  prefix = '',
  suffix = '',
  decimals = 0,
  formatCommas = true,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration]);

  useDerivedValue(() => {
    const current = animatedValue.value;
    runOnJS(setDisplayValue)(current);
  });

  const formatNumber = (num: number): string => {
    const fixed = num.toFixed(decimals);
    if (!formatCommas) return fixed;
    
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  return (
    <Text style={style}>
      {prefix}{formatNumber(displayValue)}{suffix}
    </Text>
  );
};

// Spring-based counter with bounce effect
interface SpringCounterProps {
  value: number;
  style?: TextStyle;
  prefix?: string;
  suffix?: string;
}

export const SpringCounter: React.FC<SpringCounterProps> = ({
  value,
  style,
  prefix = '',
  suffix = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Bounce effect when value changes
    scale.value = withSpring(1.15, { damping: 8 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 10 });
    }, 150);

    animatedValue.value = withSpring(value, {
      damping: 15,
      stiffness: 100,
    });
  }, [value]);

  useDerivedValue(() => {
    runOnJS(setDisplayValue)(Math.round(animatedValue.value));
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text style={[style, animatedStyle]}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </Animated.Text>
  );
};

// Slot machine style counter - digits roll individually
interface SlotCounterProps {
  value: number;
  digitStyle?: TextStyle;
  containerStyle?: any;
}

export const SlotCounter: React.FC<SlotCounterProps> = ({
  value,
  digitStyle,
  containerStyle,
}) => {
  const digits = String(value).padStart(4, '0').split('');
  
  return (
    <View style={[{ flexDirection: 'row' }, containerStyle]}>
      {digits.map((digit, index) => (
        <SlotDigit key={index} digit={parseInt(digit, 10)} style={digitStyle} />
      ))}
    </View>
  );
};

const SlotDigit: React.FC<{ digit: number; style?: TextStyle }> = ({ digit, style }) => {
  const translateY = useSharedValue(0);

  useEffect(() => {
    // Animate to new digit position
    translateY.value = withSpring(-digit * 24, {
      damping: 12,
      stiffness: 100,
    });
  }, [digit]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={{ height: 24, overflow: 'hidden' }}>
      <Animated.View style={animatedStyle}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <Text key={num} style={[{ height: 24, lineHeight: 24 }, style]}>
            {num}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
};

export default AnimatedCounter;
