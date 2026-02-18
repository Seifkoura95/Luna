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
  intensity = 30,
  tint = 'dark',
  overlayOpacity = 0.4,
  children,
}) => {
  const { player } = useSharedVideo();

  // Web fallback
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
            backdropFilter: `blur(${intensity}px)`,
            WebkitBackdropFilter: `blur(${intensity}px)`,
          }}
        />
        {children && <View style={styles.content}>{children}</View>}
      </View>
    );
  }

  // Native - expo-video with blur overlay
  return (
    <View style={styles.container}>
      {/* Video Layer */}
      {player && (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      {/* Glass/Blur effect overlay */}
      <BlurView
        style={styles.blur}
        intensity={intensity}
        tint={tint}
      />

      {/* Dark overlay for extra text readability */}
      <View style={[styles.darkOverlay, { opacity: overlayOpacity }]} />

      {/* Content */}
      {children && <View style={styles.content}>{children}</View>}
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
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  blur: {
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
