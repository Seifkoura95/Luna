import React, { useRef, useCallback } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

// Use local video file for faster loading
const localVideo = require('../../assets/video/background.mp4');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoBackgroundProps {
  children?: React.ReactNode;
  intensity?: number;
  tint?: 'dark' | 'light';
  overlayOpacity?: number;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ 
  children,
  overlayOpacity = 0.45  // Reduced overlay so video is more visible
}) => {
  const videoRef = useRef<Video>(null);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded && !status.isPlaying) {
      videoRef.current?.playAsync();
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* Base black background */}
      <View style={styles.blackBg} />
      
      {/* Video background */}
      <Video
        ref={videoRef}
        source={localVideo}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        useNativeControls={false}
      />
      
      {/* Dark overlay for text readability */}
      <View style={[styles.overlay, { opacity: overlayOpacity }]} />
      
      {/* Subtle Luna glow in top left */}
      <LinearGradient
        colors={['rgba(227, 24, 55, 0.12)', 'rgba(227, 24, 55, 0.04)', 'transparent']}
        style={styles.glowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Subtle gold glow on right */}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
