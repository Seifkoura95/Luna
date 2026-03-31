import { create } from 'zustand';

// TTL duration in milliseconds (5 minutes)
const TTL_DURATION = 5 * 60 * 1000;

interface CachedData<T> {
  data: T;
  timestamp: number;
}

interface ProfileData {
  crews: any[];
  reservations: any[];
  userStats: any;
  cherryHubStatus: any;
  pointsBalance: number;
}

interface WalletData {
  leaderboard: any[];
  missions: any[];
  subscriptions: any[];
  upcomingEvents: any[];
}

interface DataState {
  // Profile data cache
  profileData: CachedData<ProfileData> | null;
  walletData: CachedData<WalletData> | null;
  
  // Set data with TTL
  setProfileData: (data: ProfileData) => void;
  setWalletData: (data: WalletData) => void;
  
  // Get data (returns null if expired)
  getProfileData: () => ProfileData | null;
  getWalletData: () => WalletData | null;
  
  // Check if cache is valid
  isProfileCacheValid: () => boolean;
  isWalletCacheValid: () => boolean;
  
  // Clear cache (on logout or forced refresh)
  clearCache: () => void;
}

const isCacheValid = (cached: CachedData<any> | null): boolean => {
  if (!cached) return false;
  const now = Date.now();
  return (now - cached.timestamp) < TTL_DURATION;
};

export const useDataStore = create<DataState>((set, get) => ({
  profileData: null,
  walletData: null,
  
  setProfileData: (data) => {
    set({
      profileData: {
        data,
        timestamp: Date.now()
      }
    });
  },
  
  setWalletData: (data) => {
    set({
      walletData: {
        data,
        timestamp: Date.now()
      }
    });
  },
  
  getProfileData: () => {
    const cached = get().profileData;
    if (isCacheValid(cached)) {
      return cached!.data;
    }
    return null;
  },
  
  getWalletData: () => {
    const cached = get().walletData;
    if (isCacheValid(cached)) {
      return cached!.data;
    }
    return null;
  },
  
  isProfileCacheValid: () => isCacheValid(get().profileData),
  isWalletCacheValid: () => isCacheValid(get().walletData),
  
  clearCache: () => {
    set({
      profileData: null,
      walletData: null
    });
  }
}));
