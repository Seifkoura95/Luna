import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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
  
  // Create a single video player instance that persists across the app
  const player = useVideoPlayer(VIDEO_URL, player => {
    player.loop = true;
    player.muted = true;
    player.playbackRate = 1.0;
    player.play();
  });

  // Handle app state changes to keep video playing
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (player) {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          // App came to foreground - resume video
          player.play();
        }
        appState.current = nextAppState;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [player]);

  // Keep checking if video is playing and restart if needed
  useEffect(() => {
    if (!player) return;

    const checkInterval = setInterval(() => {
      if (player && !player.playing) {
        player.play();
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(checkInterval);
  }, [player]);

  // Handle video errors and restart
  useEffect(() => {
    if (!player) return;

    const handleStatusChange = () => {
      // If video stopped for any reason, try to restart
      if (player && !player.playing) {
        setTimeout(() => {
          player.play();
        }, 100);
      }
    };

    // Listen to status changes
    player.addListener('statusChange', handleStatusChange);

    return () => {
      player.removeListener('statusChange', handleStatusChange);
    };
  }, [player]);

  return (
    <VideoContext.Provider value={{ player }}>
      {children}
    </VideoContext.Provider>
  );
};

export { VIDEO_URL };
