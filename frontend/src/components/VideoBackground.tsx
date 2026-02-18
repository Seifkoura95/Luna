import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

// Compressed video URL
const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_61cbe233-3cbf-4ea2-80f1-8c789a51854e/artifacts/rg18z6d5_Darude%20Recap%20compressed%20again.mp4';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoBackgroundProps {
  children?: React.ReactNode;
  intensity?: number;
  tint?: 'dark' | 'light';
  overlayOpacity?: number;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ 
  children,
  overlayOpacity = 0.5
}) => {
  const videoRef = useRef<Video>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setVideoLoaded(true);
      if (!status.isPlaying) {
        videoRef.current?.playAsync();
      }
    }
  };

  const onError = (error: string) => {
    console.log('Video error:', error);
  };

  return (
    <View style={styles.container}>
      {/* Base black background */}
      <View style={styles.blackBg} />
      
      {/* Video - render on all platforms */}
      <Video
        ref={videoRef}
        source={{ uri: VIDEO_URL }}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        onError={onError}
        useNativeControls={false}
        posterSource={{ uri: VIDEO_URL }}
      />
      
      {/* Dark overlay */}
      <View style={[styles.overlay, { opacity: overlayOpacity }]} />
      
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
};

// Aliases for backwards compatibility
export const AppBackground = VideoBackground;
export default VideoBackground;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  blackBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
