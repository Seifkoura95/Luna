import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useVideoPlayer, VideoPlayer } from 'expo-video';

// Compressed Luna Group video background - NEW compressed version
export const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_61cbe233-3cbf-4ea2-80f1-8c789a51854e/artifacts/rg18z6d5_Darude%20Recap%20compressed%20again.mp4';

interface VideoContextType {
  player: VideoPlayer | null;
  currentTime: number;
}

const VideoContext = createContext<VideoContextType>({ player: null, currentTime: 0 });

export const useSharedVideo = () => useContext(VideoContext);

export const SharedVideoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const timeRef = useRef(0);
  
  // Create a single video player instance that persists across the app
  const player = useVideoPlayer(VIDEO_URL, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // Track current playback time
  useEffect(() => {
    if (player) {
      const interval = setInterval(() => {
        timeRef.current = player.currentTime;
      }, 100);
      return () => clearInterval(interval);
    }
  }, [player]);

  return (
    <VideoContext.Provider value={{ player, currentTime: timeRef.current }}>
      {children}
    </VideoContext.Provider>
  );
};
