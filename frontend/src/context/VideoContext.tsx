import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useVideoPlayer, VideoPlayer } from 'expo-video';

// Compressed Luna Group video background
const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_2fca5f5e-e2fc-4a51-bccb-98ad0736e603/artifacts/xkebrois_Darude%20Recap%20compressed.mp4';

interface VideoContextType {
  player: VideoPlayer | null;
}

const VideoContext = createContext<VideoContextType>({ player: null });

export const useSharedVideo = () => useContext(VideoContext);

export const SharedVideoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const appState = useRef(AppState.currentState);
  const [isReady, setIsReady] = useState(false);
  
  // Create a single video player instance that persists across the app
  const player = useVideoPlayer(VIDEO_URL, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // Handle app state changes to keep video playing
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (player) {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          // App came to foreground - resume video
          try {
            player.play();
          } catch (e) {
            console.log('Error resuming video:', e);
          }
        }
        appState.current = nextAppState;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [player]);

  // Monitor player status and restart if stopped
  useEffect(() => {
    if (!player || Platform.OS === 'web') return;

    const subscription = player.addListener('statusChange', ({ status }) => {
      console.log('Video status:', status);
      
      if (status === 'readyToPlay') {
        setIsReady(true);
        if (!player.playing) {
          player.play();
        }
      } else if (status === 'idle' || status === 'error') {
        // Video stopped or errored - try to restart
        setTimeout(() => {
          try {
            player.play();
          } catch (e) {
            console.log('Error restarting video:', e);
          }
        }, 500);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [player]);

  // Polling fallback to ensure video keeps playing
  useEffect(() => {
    if (!player || Platform.OS === 'web') return;

    const checkInterval = setInterval(() => {
      try {
        if (player && !player.playing && isReady) {
          player.play();
        }
      } catch (e) {
        // Ignore errors
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(checkInterval);
  }, [player, isReady]);

  return (
    <VideoContext.Provider value={{ player }}>
      {children}
    </VideoContext.Provider>
  );
};

export { VIDEO_URL };
