import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useVideoPlayer, VideoPlayer } from 'expo-video';

// Compressed Luna Group video background - OLD working version
export const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_2fca5f5e-e2fc-4a51-bccb-98ad0736e603/artifacts/xkebrois_Darude%20Recap%20compressed.mp4';

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
