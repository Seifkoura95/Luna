import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StarfieldBackground } from './StarfieldBackground';
import { AuroraBackground } from './AuroraBackground';

interface AmbientBackgroundProps {
  starCount?: number;
  shootingStarCount?: number;
  showAurora?: boolean;
  auroraIntensity?: 'subtle' | 'normal' | 'vibrant';
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({
  starCount = 60,
  shootingStarCount = 2,
  showAurora = true,
  auroraIntensity = 'subtle',
}) => {
  return (
    <View style={styles.container}>
      {/* Base aurora layer */}
      {showAurora && (
        <View style={styles.auroraLayer}>
          <AuroraBackground 
            intensity={auroraIntensity} 
            colorScheme="nightclub"
          />
        </View>
      )}
      
      {/* Stars on top */}
      <View style={styles.starLayer}>
        <StarfieldBackground 
          starCount={starCount} 
          shootingStarCount={shootingStarCount} 
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  auroraLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3, // Subtle aurora behind stars
  },
  starLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default AmbientBackground;
