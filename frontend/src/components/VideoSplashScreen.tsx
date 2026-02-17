import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BlurView } from 'expo-blur';

const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_2fca5f5e-e2fc-4a51-bccb-98ad0736e603/artifacts/xkebrois_Darude%20Recap%20compressed.mp4';
const LUNA_LOGO = 'https://customer-assets.emergentagent.com/job_c826baa4-6640-40ce-9e0d-38132d9944fc/artifacts/2k76js5m_luna-group-logo-2.webp';

interface VideoSplashScreenProps {
  onReady?: () => void;
}

export const VideoSplashScreen: React.FC<VideoSplashScreenProps> = ({ onReady }) => {
  const [isVideoReady, setIsVideoReady] = useState(false);

  // Create video player for splash screen
  const player = useVideoPlayer(VIDEO_URL, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // Listen for video ready state
  useEffect(() => {
    if (!player || Platform.OS === 'web') {
      // On web, just show after a delay
      const timer = setTimeout(() => {
        setIsVideoReady(true);
        onReady?.();
      }, 1000);
      return () => clearTimeout(timer);
    }

    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        setIsVideoReady(true);
        // Give a bit more time for smooth transition
        setTimeout(() => {
          onReady?.();
        }, 2000);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [player, onReady]);

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
        <View style={styles.overlay} />
        <View style={styles.logoContainer}>
          <Image source={{ uri: LUNA_LOGO }} style={styles.logo} contentFit="contain" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Background */}
      {player && (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      {/* Frosted overlay for better logo visibility */}
      <BlurView style={styles.blurOverlay} intensity={20} tint="dark" />
      
      {/* Dark overlay */}
      <View style={styles.overlay} />

      {/* Centered Luna Group Logo */}
      <View style={styles.logoContainer}>
        <Image source={{ uri: LUNA_LOGO }} style={styles.logo} contentFit="contain" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  logoContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 280,
    height: 80,
  },
});

export default VideoSplashScreen;
