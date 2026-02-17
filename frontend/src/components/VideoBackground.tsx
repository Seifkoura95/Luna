import React, { useState, useCallback, memo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';

// Compressed video URL
const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_61cbe233-3cbf-4ea2-80f1-8c789a51854e/artifacts/rg18z6d5_Darude%20Recap%20compressed%20again.mp4';

interface VideoBackgroundProps {
  children?: React.ReactNode;
  intensity?: number;
  tint?: 'dark' | 'light';
  overlayOpacity?: number;
}

// Memoized video component to prevent re-renders
const VideoLayer = memo(() => {
  const [isReady, setIsReady] = useState(false);
  
  // Create video player with loop enabled
  const player = useVideoPlayer(VIDEO_URL, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const handleStatusChange = useCallback((status: any) => {
    if (status === 'readyToPlay') {
      setIsReady(true);
    }
  }, []);

  // Web doesn't support expo-video well, use black background
  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      {/* Dark overlay for readability */}
      <View style={[styles.overlay, { opacity: isReady ? 0.55 : 1 }]} />
    </>
  );
});

VideoLayer.displayName = 'VideoLayer';

export const VideoBackground: React.FC<VideoBackgroundProps> = memo(({ 
  children,
  intensity = 30,
  tint = 'dark',
  overlayOpacity = 0.5
}) => {
  return (
    <View style={styles.container}>
      {/* Base black background (always visible, acts as fallback) */}
      <View style={styles.blackBg} />
      
      {/* Video layer (native only) */}
      <VideoLayer />
      
      {/* Subtle Luna glow in top left */}
      <LinearGradient
        colors={['rgba(227, 24, 55, 0.15)', 'rgba(227, 24, 55, 0.05)', 'transparent']}
        style={styles.glowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Subtle gold glow on right */}
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
        style={styles.glowTopRight}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Content */}
      {children && <View style={styles.content}>{children}</View>}
    </View>
  );
});

VideoBackground.displayName = 'VideoBackground';

// Keep AppBackground as an alias for backwards compatibility
export const AppBackground = VideoBackground;

export default VideoBackground;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  blackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
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
    opacity: 0.6,
  },
  glowTopRight: {
    position: 'absolute',
    top: -50,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.4,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
});
