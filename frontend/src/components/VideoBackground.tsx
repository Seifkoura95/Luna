import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AppBackgroundProps {
  children?: React.ReactNode;
}

export const AppBackground: React.FC<AppBackgroundProps> = ({ children }) => {
  return (
    <View style={styles.container}>
      {/* Black background */}
      <View style={styles.blackBg} />
      
      {/* Subtle Luna glow in top left */}
      <LinearGradient
        colors={['rgba(227, 24, 55, 0.12)', 'rgba(227, 24, 55, 0.04)', 'transparent']}
        style={styles.glowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Subtle gold glow */}
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
        style={styles.glowTopRight}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Content */}
      {children && <View style={styles.content}>{children}</View>}
    </View>
  );
};

// Keep VideoBackground as an alias for backwards compatibility
export const VideoBackground = AppBackground;

export default AppBackground;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  blackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  glowTopLeft: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    opacity: 0.5,
  },
  glowTopRight: {
    position: 'absolute',
    top: -50,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.3,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
});
