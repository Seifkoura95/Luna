import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, Platform, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AVPlaybackStatus, Video, ResizeMode } from 'expo-av';

// Remote video URL
const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_61cbe233-3cbf-4ea2-80f1-8c789a51854e/artifacts/rg18z6d5_Darude%20Recap%20compressed%20again.mp4';

const { width, height } = Dimensions.get('window');

interface VideoBackgroundProps {
  children?: React.ReactNode;
  intensity?: number;
  tint?: 'dark' | 'light';
  overlayOpacity?: number;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ 
  children,
  overlayOpacity = 0.35
}) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      // If loaded but not playing, try to play
      if (!status.isPlaying && !status.isBuffering) {
        videoRef.current?.playAsync().catch(console.error);
      }
    } else if (status.error) {
      console.log('Playback error:', status.error);
      setError(status.error);
    }
  };

  const handleError = (err: string) => {
    console.log('Video error:', err);
    setError(err);
  };

  const handleLoad = async () => {
    console.log('Video loaded, attempting to play...');
    try {
      await videoRef.current?.playAsync();
    } catch (e) {
      console.log('Play failed:', e);
    }
  };

  return (
    <View style={styles.container}>
      {/* Video layer - positioned BEHIND everything */}
      {isNative ? (
        <Video
          ref={videoRef}
          source={{ uri: VIDEO_URL }}
          style={styles.backgroundVideo}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted
          shouldPlay
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onError={handleError}
          onLoad={handleLoad}
          useNativeControls={false}
        />
      ) : (
        <View style={styles.blackBg} />
      )}
      
      {/* Dark overlay - only show when video is playing */}
      <View style={[styles.overlay, { opacity: isPlaying ? overlayOpacity : 0.8 }]} />
      
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

      {/* Content on top */}
      {children && <View style={styles.content}>{children}</View>}
    </View>
  );
};

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
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
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
  content: {
    ...StyleSheet.absoluteFillObject,
  },
});
