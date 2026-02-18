import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';

// Remote video URL
const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_61cbe233-3cbf-4ea2-80f1-8c789a51854e/artifacts/rg18z6d5_Darude%20Recap%20compressed%20again.mp4';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

interface VideoBackgroundProps {
  children?: React.ReactNode;
  intensity?: number;
  tint?: 'dark' | 'light';
  overlayOpacity?: number;
}

// Native video component using expo-video
const NativeVideoBackground = () => {
  const player = useVideoPlayer(VIDEO_URL, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="cover"
      nativeControls={false}
    />
  );
};

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ 
  children,
  overlayOpacity = 0.4
}) => {
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  return (
    <View style={styles.container}>
      {/* Base black background */}
      <View style={styles.blackBg} />
      
      {/* Video - only render on native */}
      {isNative && <NativeVideoBackground />}
      
      {/* Semi-transparent overlay for text readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.35)']}
        style={styles.gradientOverlay}
      />
      
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
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
