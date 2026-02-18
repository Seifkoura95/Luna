import React, { createContext, useContext, useRef } from 'react';
import { useVideoPlayer, VideoPlayer } from 'expo-video';

// New 5MB compressed video
export const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_61cbe233-3cbf-4ea2-80f1-8c789a51854e/artifacts/4nftis8n_Darude%20Recap%20compressed%205mb.mp4';

interface VideoContextType {
  player: VideoPlayer | null;
}

const VideoContext = createContext<VideoContextType>({ player: null });

export const useSharedVideo = () => useContext(VideoContext);

export const SharedVideoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Create a single video player instance
  const player = useVideoPlayer(VIDEO_URL, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  return (
    <VideoContext.Provider value={{ player }}>
      {children}
    </VideoContext.Provider>
  );
};
