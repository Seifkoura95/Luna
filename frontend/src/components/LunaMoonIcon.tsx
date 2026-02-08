import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

// Luna moon image for points icon
const LUNA_MOON_IMAGE = 'https://customer-assets.emergentagent.com/job_cluboscenexus/artifacts/ekzz65x8_lunar%20moon.PNG';

interface LunaMoonIconProps {
  size?: number;
}

/**
 * LunaMoonIcon - A static moon icon used for displaying Luna Points
 * Uses the original Luna moon image with a white tint overlay
 */
export const LunaMoonIcon: React.FC<LunaMoonIconProps> = ({ 
  size = 24
}) => {
  // Scale up the image to crop out black background
  const scale = 5;
  const innerSize = size * scale;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={{ uri: LUNA_MOON_IMAGE }}
        style={{ width: innerSize, height: innerSize }}
        resizeMode="contain"
      />
      {/* White tint overlay for lunar appearance */}
      <View style={styles.whiteTint} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  whiteTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 1000,
  },
});

export default LunaMoonIcon;
