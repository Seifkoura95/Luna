import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, shadows } from '../theme/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  borderGlow?: string;
  noPadding?: boolean;
  variant?: 'default' | 'subtle' | 'bold' | 'elevated';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity = 60,
  tint = 'dark',
  borderGlow,
  noPadding = false,
  variant = 'default',
}) => {
  // Get variant-specific styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'subtle':
        return {
          borderWidth: 0.5,
          borderColor: colors.glassBorder,
          borderRadius: radius.md,
        };
      case 'bold':
        return {
          borderWidth: 1.5,
          borderColor: colors.glassBorderStrong,
          borderRadius: radius.xl,
        };
      case 'elevated':
        return {
          borderWidth: 1,
          borderColor: colors.glassBorderStrong,
          borderRadius: radius.xxl,
          ...shadows.elevated,
        };
      default:
        return {
          borderWidth: 1,
          borderColor: colors.glassBorderStrong,
          borderRadius: radius.lg,
          ...shadows.card,
        };
    }
  };

  const variantStyles = getVariantStyles();

  const containerStyle = [
    styles.container,
    variantStyles,
    borderGlow && { borderColor: borderGlow, borderWidth: 1.5 },
    style,
  ];

  // Use BlurView on native, fallback on web
  if (Platform.OS !== 'web') {
    return (
      <BlurView intensity={intensity} tint={tint} style={containerStyle}>
        <View style={[styles.inner, noPadding && { padding: 0 }]}>
          {/* Top highlight line - the key detail for real glass feel */}
          <LinearGradient
            colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
            style={styles.highlight}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          {/* Subtle inner glow */}
          <View style={styles.innerGlow} />
          {children}
        </View>
      </BlurView>
    );
  }

  // Web fallback - use semi-transparent background with backdrop blur
  return (
    <View style={[containerStyle, styles.webFallback]}>
      <View style={[styles.inner, noPadding && { padding: 0 }]}>
        {/* Top highlight line */}
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
          style={styles.highlight}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        {/* Subtle inner glow */}
        <View style={styles.innerGlow} />
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  webFallback: {
    backgroundColor: colors.glass,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  } as any,
  inner: {
    padding: spacing.md,
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    zIndex: 1,
  },
  innerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    zIndex: 0,
  },
});

export default GlassCard;
