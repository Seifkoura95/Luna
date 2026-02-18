import React, { useRef, useState } from 'react';
import { StyleSheet, View, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AVPlaybackStatus, Video, ResizeMode } from 'expo-av';

// Try a known working test video first, then fall back to Luna video
const TEST_VIDEO = 'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4';
const LUNA_VIDEO = 'https://customer-assets.emergentagent.com/job_61cbe233-3cbf-4ea2-80f1-8c789a51854e/artifacts/rg18z6d5_Darude%20Recap%20compressed%20again.mp4';

// Use Luna video
const VIDEO_URL = LUNA_VIDEO;

interface VideoBackgroundProps {
  children?: React.ReactNode;
  intensity?: number;
  tint?: 'dark' | 'light';
  overlayOpacity?: number;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ 
  children,
  overlayOpacity = 0.4
}) => {
  const videoRef = useRef<Video>(null);
  const [isReady, setIsReady] = useState(false);
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (!isReady) setIsReady(true);
      if (!status.isPlaying) {
        videoRef.current?.playAsync();
      }
    }
  };

  return (
    <View style={styles.container}>
      {isNative && (
        <Video
          ref={videoRef}
          source={{ uri: VIDEO_URL }}
          rate={1.0}
          volume={0}
          isMuted={true}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          isLooping={true}
          style={StyleSheet.absoluteFill}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          useNativeControls={false}
        />
      )}
      
      {/* Black overlay - less opaque when video is ready */}
      <View style={[styles.overlay, { opacity: isReady ? overlayOpacity : 0.9 }]} />
      
      {/* Luna glow effects */}
      <LinearGradient
        colors={['rgba(227, 24, 55, 0.12)', 'rgba(227, 24, 55, 0.04)', 'transparent']}
        style={styles.glowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
        style={styles.glowTopRight}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {children && <View style={StyleSheet.absoluteFill}>{children}</View>}
    </View>
  );
};

export const AppBackground = VideoBackground;
export default VideoBackground;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
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
});
