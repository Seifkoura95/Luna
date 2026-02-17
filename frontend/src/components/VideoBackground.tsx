import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { BlurView } from 'expo-blur';

interface VideoBackgroundProps {
  intensity?: number; // Blur intensity (0-100), default 25
  tint?: 'light' | 'dark' | 'default'; // Blur tint
  overlayOpacity?: number; // Additional dark overlay opacity (0-1)
  children?: React.ReactNode;
}

// Luna Group event video background
const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_2fca5f5e-e2fc-4a51-bccb-98ad0736e603/artifacts/72rbe8de_Darude%20Recap.mp4';

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  intensity = 30,
  tint = 'dark',
  overlayOpacity = 0.4,
  children,
}) => {
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    // Ensure video plays on mount
    const playVideo = async () => {
      if (videoRef.current) {
        try {
          await videoRef.current.playAsync();
        } catch (e) {
          console.log('Video autoplay error:', e);
        }
      }
    };
    playVideo();
  }, []);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    // Handle any playback errors silently
    if (!status.isLoaded) {
      if (status.error) {
        console.log('Video playback error:', status.error);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Video Layer */}
      <Video
        ref={videoRef}
        source={{ uri: VIDEO_URL }}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        // Performance optimizations
        useNativeControls={false}
        posterSource={{ uri: VIDEO_URL }}
        usePoster={true}
      />

      {/* Frosted Glass Overlay */}
      {Platform.OS !== 'web' ? (
        <BlurView
          style={styles.blurOverlay}
          intensity={intensity}
          tint={tint}
        />
      ) : (
        // Web fallback - CSS blur with backdrop-filter
        <View style={[styles.webBlurOverlay, { backgroundColor: `rgba(0,0,0,${overlayOpacity + 0.2})` }]} />
      )}

      {/* Additional dark overlay for text readability */}
      <View style={[styles.darkOverlay, { opacity: overlayOpacity }]} />

      {/* Content */}
      {children && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  webBlurOverlay: {
    ...StyleSheet.absoluteFillObject,
    // @ts-ignore - Web-specific property
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default VideoBackground;
