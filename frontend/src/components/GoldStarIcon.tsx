import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface GoldStarIconProps {
  size?: number;
}

/**
 * GoldStarIcon - A filled gold star icon used for displaying Luna Points
 * Features a glowing gold appearance with gradient effect
 */
export const GoldStarIcon: React.FC<GoldStarIconProps> = ({ 
  size = 24
}) => {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Ionicons 
        name="star" 
        size={size} 
        color="#FFD700" 
        style={styles.icon}
      />
      {/* Glow effect */}
      <View style={[styles.glow, { width: size * 1.2, height: size * 1.2, borderRadius: size * 0.6 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  icon: {
    zIndex: 2,
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    zIndex: 1,
  },
});

export default GoldStarIcon;
