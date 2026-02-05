import { useAuthStore } from '../store/authStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface FetchOptions extends RequestInit {
  auth?: boolean;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { auth = true, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  
  if (auth) {
    const token = useAuthStore.getState().sessionToken;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  
  return response.json();
}

export const api = {
  // Auth
  exchangeSession: (sessionId: string) =>
    apiFetch<{ user_id: string; email: string; name: string; picture?: string; session_token: string }>(
      '/api/auth/session',
      { method: 'POST', body: JSON.stringify({ session_id: sessionId }), auth: false }
    ),
  
  getMe: () => apiFetch<any>('/api/auth/me'),
  
  // QR & Check-in
  getQRData: () => apiFetch<{ qr_data: string; expires_in: number }>('/api/checkin/qr'),
  
  // Rewards
  getRewards: (category?: string) =>
    apiFetch<any[]>(`/api/rewards${category ? `?category=${category}` : ''}`),
  redeemReward: (rewardId: string) =>
    apiFetch<any>('/api/rewards/redeem', { method: 'POST', body: JSON.stringify({ reward_id: rewardId }) }),
  getRedemptions: () => apiFetch<any[]>('/api/rewards/redemptions'),
  
  // Missions
  getMissions: () => apiFetch<any[]>('/api/missions'),
  
  // Boosts
  getActiveBoosts: () => apiFetch<any[]>('/api/boosts', { auth: false }),
  getUpcomingBoosts: () => apiFetch<any[]>('/api/boosts/upcoming', { auth: false }),
  
  // Events
  getEvents: () => apiFetch<any[]>('/api/events', { auth: false }),
  
  // Points
  getPointsHistory: (limit?: number) =>
    apiFetch<any[]>(`/api/points/history${limit ? `?limit=${limit}` : ''}`),
  getPointsStats: () => apiFetch<any>('/api/points/stats'),
  
  // Queue
  getQueueStatus: () => apiFetch<any>('/api/queue/status', { auth: false }),
  
  // Membership
  getMembershipTiers: () => apiFetch<any>('/api/membership/tiers', { auth: false }),
  upgradeMembership: (tier: string) =>
    apiFetch<any>('/api/membership/upgrade', { method: 'POST', body: JSON.stringify({ tier }) }),
  
  // Admin
  seedData: () => apiFetch<any>('/api/admin/seed', { method: 'POST', auth: false }),
  getAdminStats: () => apiFetch<any>('/api/admin/stats', { auth: false }),
};
