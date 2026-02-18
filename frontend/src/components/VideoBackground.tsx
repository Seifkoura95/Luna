import React, { useRef, useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AVPlaybackStatus, Video, ResizeMode } from 'expo-av';
import Constants from 'expo-constants';

// Get backend URL from environment
const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || 
                    'https://luna-vip-app-1.preview.emergentagent.com';

// Video URL from our backend
const VIDEO_URL = `${BACKEND_URL}/api/video/background`;

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
      if (!isReady) {
        setIsReady(true);
        console.log('Video loaded and ready');
      }
      if (!status.isPlaying) {
        videoRef.current?.playAsync();
      }
    } else if (status.error) {
      console.log('Video playback error:', status.error);
    }
  };

  const onLoad = () => {
    console.log('Video onLoad called');
  };

  const onError = (error: string) => {
    console.log('Video onError:', error);
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
          onLoad={onLoad}
          onError={onError}
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
