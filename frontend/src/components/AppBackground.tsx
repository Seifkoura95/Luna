import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface BackgroundProps {
  children?: React.ReactNode;
}

export const AppBackground: React.FC<BackgroundProps> = ({ children }) => {
  return (
    <View style={styles.container}>
      {/* Base black background */}
      <View style={styles.blackBg} />
      
      {/* Subtle Luna red glow - top left */}
      <LinearGradient
        colors={['rgba(227, 24, 55, 0.15)', 'rgba(227, 24, 55, 0.05)', 'transparent']}
        style={styles.glowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Subtle gold accent - top right */}
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
        style={styles.glowTopRight}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      
      {/* Very subtle bottom gradient for depth */}
      <LinearGradient
        colors={['transparent', 'rgba(0, 0, 0, 0.3)']}
        style={styles.bottomGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Content */}
      {children && <View style={styles.content}>{children}</View>}
    </View>
  );
};

export const AppBackground = AppBackground;
export default AppBackground;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  blackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
  },
  glowTopLeft: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    opacity: 0.7,
  },
  glowTopRight: {
    position: 'absolute',
    top: -50,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.5,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
});
