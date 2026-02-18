import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useVideoPlayer, VideoPlayer } from 'expo-video';

// New 5MB compressed Luna Group video
export const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_61cbe233-3cbf-4ea2-80f1-8c789a51854e/artifacts/4nftis8n_Darude%20Recap%20compressed%205mb.mp4';

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
    }, 2000);

    return () => clearInterval(checkInterval);
  }, [player]);

  // Handle video errors and restart
  useEffect(() => {
    if (!player) return;

    const handleStatusChange = () => {
      if (player && !player.playing) {
        setTimeout(() => {
          player.play();
        }, 100);
      }
    };

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
