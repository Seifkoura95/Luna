import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform, Image } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Luna Group hero video from their website
const HERO_VIDEO_URL = 'https://video.squarespace-cdn.com/content/v1/682b007e29e69572a0c49049/5785cbac-b042-479d-ab6c-569c17498ec3/1920:1080';

// Fallback image if video fails
const FALLBACK_IMAGE_URL = 'https://images.squarespace-cdn.com/content/v1/682b007e29e69572a0c49049/1747772324326-UZRRKMQJ4CT6D0TPJBS6/%40CUTBYJACK-69.jpg';

interface StarfieldBackgroundProps {
  starCount?: number;
  shootingStarCount?: number;
  showAurora?: boolean;
  showGalaxies?: boolean;
  showPlanets?: boolean;
  overlayOpacity?: number;
}

/**
 * StarfieldBackground - Luna Group branded background
 * Uses the hero video from lunagroup.com.au as background
 * Falls back to a static image if video fails to load
 */
export const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  overlayOpacity = 0.5,
}) => {
  const videoRef = useRef<Video>(null);
  const [videoError, setVideoError] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  // For web platform, we'll use the image fallback as video may not work well
  const useImageFallback = Platform.OS === 'web' || videoError;

  const handleVideoError = () => {
    console.log('Video failed to load, using fallback image');
    setVideoError(true);
  };

  const handleVideoLoad = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsVideoLoaded(true);
    }
  };

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Background Video or Image */}
      {useImageFallback ? (
        <Image
          source={{ uri: FALLBACK_IMAGE_URL }}
          style={styles.backgroundMedia}
          resizeMode="cover"
        />
      ) : (
        <Video
          ref={videoRef}
          source={{ uri: HERO_VIDEO_URL }}
          style={styles.backgroundMedia}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
          onError={handleVideoError}
          onPlaybackStatusUpdate={handleVideoLoad}
        />
      )}

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
        colors={['rgba(0,0,0,0.25)', 'transparent', 'transparent', 'rgba(0,0,0,0.25)']}
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
  backgroundMedia: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default StarfieldBackground;
