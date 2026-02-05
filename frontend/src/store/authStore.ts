import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  tier: string;
  points_balance: number;
}

interface AuthState {
  user: User | null;
  sessionToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  setUser: (user: User | null) => void;
  setSessionToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  updatePoints: (points: number) => void;
  updateTier: (tier: string) => void;
}

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      return AsyncStorage.setItem(key, value);
    }
    return SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  sessionToken: null,
  isLoading: true,
  isAuthenticated: false,
  
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSessionToken: (token) => set({ sessionToken: token }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  login: async (user, token) => {
    await storage.setItem('session_token', token);
    await storage.setItem('user', JSON.stringify(user));
    set({ user, sessionToken: token, isAuthenticated: true, isLoading: false });
  },
  
  logout: async () => {
    const { sessionToken } = get();
    const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });
    } catch (e) {
      console.error('Logout API error:', e);
    }
    
    await storage.removeItem('session_token');
    await storage.removeItem('user');
    set({ user: null, sessionToken: null, isAuthenticated: false });
  },
  
  loadStoredAuth: async () => {
    try {
      const token = await storage.getItem('session_token');
      const userStr = await storage.getItem('user');
      
      if (token && userStr) {
        const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
        
        // Verify token is still valid
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const user = await response.json();
          set({ user, sessionToken: token, isAuthenticated: true, isLoading: false });
          return;
        }
      }
    } catch (e) {
      console.error('Load auth error:', e);
    }
    
    await storage.removeItem('session_token');
    await storage.removeItem('user');
    set({ user: null, sessionToken: null, isAuthenticated: false, isLoading: false });
  },
  
  updatePoints: (points) => {
    const { user } = get();
    if (user) {
      set({ user: { ...user, points_balance: points } });
    }
  },
  
  updateTier: (tier) => {
    const { user } = get();
    if (user) {
      set({ user: { ...user, tier } });
    }
  },
}));
