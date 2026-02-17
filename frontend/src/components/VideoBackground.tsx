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

// Web-specific video component using HTML5 video
const WebVideoBackground: React.FC<{ overlayOpacity: number }> = ({ overlayOpacity }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(e => console.log('Autoplay blocked:', e));
    }
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <video
        ref={videoRef}
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {/* Frosted glass effect for web */}
      <View 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `rgba(0, 0, 0, ${overlayOpacity + 0.3})`,
          // @ts-ignore - Web-specific properties
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      />
    </View>
  );
};

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  intensity = 30,
  tint = 'dark',
  overlayOpacity = 0.4,
  children,
}) => {
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    // Ensure video plays on mount (native only)
    if (Platform.OS !== 'web') {
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
    }
  }, []);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    // Handle any playback errors silently
    if (!status.isLoaded) {
      if (status.error) {
        console.log('Video playback error:', status.error);
      }
    }
  };

  // Web uses HTML5 video element
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <WebVideoBackground overlayOpacity={overlayOpacity} />
        {children && (
          <View style={styles.content}>
            {children}
          </View>
        )}
      </View>
    );
  }

  // Native uses expo-av Video
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
        useNativeControls={false}
      />

      {/* Frosted Glass Overlay (Native) */}
      <BlurView
        style={styles.blurOverlay}
        intensity={intensity}
        tint={tint}
      />

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
