import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '../theme/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  borderGlow?: string;
  noPadding?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity = 50,
  tint = 'dark',
  borderGlow,
  noPadding = false,
}) => {
  const containerStyle = [
    styles.container,
    borderGlow && { borderColor: borderGlow, borderWidth: 1 },
    style,
  ];

  // Use BlurView on native, fallback on web
  if (Platform.OS !== 'web') {
    return (
      <BlurView intensity={intensity} tint={tint} style={containerStyle}>
        <View style={[styles.inner, noPadding && { padding: 0 }]}>
          {/* Top highlight line */}
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
            style={styles.highlight}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          {children}
        </View>
      </BlurView>
    );
  }

  // Web fallback - use semi-transparent background
  return (
    <View style={[containerStyle, styles.webFallback]}>
      <View style={[styles.inner, noPadding && { padding: 0 }]}>
        {/* Top highlight line */}
        <LinearGradient
          colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0)']}
          style={styles.highlight}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  webFallback: {
    backgroundColor: colors.glass,
    backdropFilter: 'blur(20px)',
  },
  inner: {
    padding: spacing.md,
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
});

export default GlassCard;
