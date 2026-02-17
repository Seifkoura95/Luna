import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { VideoView } from 'expo-video';
import { BlurView } from 'expo-blur';
import { useSharedVideo, VIDEO_URL } from '../context/VideoContext';

interface VideoBackgroundProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  overlayOpacity?: number;
  children?: React.ReactNode;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  intensity = 25,
  tint = 'dark',
  overlayOpacity = 0.5,
  children,
}) => {
  // Use the shared video player from context
  const { player } = useSharedVideo();

  // Web fallback - use HTML video element
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <video
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
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        />
        {children && <View style={styles.content}>{children}</View>}
      </View>
    );
  }

  // Native - use expo-video with shared player
  return (
    <View style={styles.container}>
      {/* Video Layer - uses shared player for seamless transitions */}
      {player && (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      {/* Frosted Glass Overlay */}
      <BlurView
        style={styles.blurOverlay}
        intensity={intensity}
        tint={tint}
      />

      {/* Dark overlay for text readability */}
      <View style={[styles.darkOverlay, { opacity: overlayOpacity }]} />

      {/* Content */}
      {children && <View style={styles.content}>{children}</View>}
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
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default VideoBackground;
