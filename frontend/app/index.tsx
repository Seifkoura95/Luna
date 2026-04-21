import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';
import { colors } from '../src/theme/colors';

const LUNA_SPLASH_VIDEO = require('../assets/videos/luna-splash.mp4');

// Maximum time to wait for the splash — if the video fails to play for any
// reason (codec, low-power mode, etc.) we route onward anyway.
const MAX_SPLASH_MS = 6000;

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [videoDone, setVideoDone] = useState(false);
  const routedRef = useRef(false);

  const player = useVideoPlayer(LUNA_SPLASH_VIDEO, (p) => {
    p.loop = false;
    p.muted = Platform.OS === 'web';
    p.play();
  });

  useEffect(() => {
    // Seed data on app start (non-blocking)
    api.seedData().catch(() => {});
  }, []);

  // Mark done when the video ends
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => setVideoDone(true));
    return () => sub.remove();
  }, [player]);

  // Safety timeout — never get stuck on the splash
  useEffect(() => {
    const t = setTimeout(() => setVideoDone(true), MAX_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // Route once both auth has resolved AND the video has finished (or timed out)
  useEffect(() => {
    if (routedRef.current) return;
    if (isLoading) return;
    if (!videoDone) return;
    routedRef.current = true;
    router.replace(isAuthenticated ? '/(tabs)' : '/login');
  }, [isAuthenticated, isLoading, videoDone, router]);

  return (
    <View style={styles.container} data-testid="luna-splash-root">
      <VideoView
        style={StyleSheet.absoluteFillObject}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        data-testid="luna-splash-video"
      />
      {/* Subtle loader while routing if user waits for auth to resolve after video */}
      {videoDone && isLoading && (
        <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    position: 'absolute',
    bottom: 80,
  },
});
