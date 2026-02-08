import React from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface StarfieldBackgroundProps {
  starCount?: number;
  shootingStarCount?: number;
  showAurora?: boolean;
  showGalaxies?: boolean;
  showPlanets?: boolean;
  overlayOpacity?: number;
}

/**
 * StarfieldBackground - Eclipse Brisbane-inspired background
 * A premium nightclub themed background with:
 * - High-quality nightclub photograph from Eclipse Brisbane
 * - Dark overlay for text readability
 * - Subtle vignette for depth
 */
export const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  overlayOpacity = 0.55,
}) => {
  // Eclipse Brisbane nightclub background image
  const backgroundImage = 'https://images.squarespace-cdn.com/content/v1/67f8ccf353df004660928ccc/ddb6daa6-eee7-4027-a2c0-ad54f6b324ed/%40CUTBYJACK-69.jpg';

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Background Image from Eclipse Brisbane */}
      <Image
        source={{ uri: backgroundImage }}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Dark overlay for text readability */}
      <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }]} />

      {/* Gradient vignette for depth */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'transparent', 'transparent', 'rgba(0,0,0,0.4)']}
        locations={[0, 0.2, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Side vignettes */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'transparent', 'transparent', 'rgba(0,0,0,0.3)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default StarfieldBackground;
