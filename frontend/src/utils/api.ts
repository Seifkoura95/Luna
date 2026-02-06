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
    const token = useAuthStore.getState().token;
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
  // Venues
  getVenues: (region?: string) => 
    apiFetch<any[]>(`/api/venues${region ? `?region=${region}` : ''}`, { auth: false }),
  
  getVenue: (venueId: string) => 
    apiFetch<any>(`/api/venues/${venueId}`, { auth: false }),
  
  // Auth
  register: (email: string, password: string, name: string) =>
    apiFetch<{ user: any; token: string }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, name }), auth: false }
    ),
  
  login: (email: string, password: string) =>
    apiFetch<{ user: any; token: string }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }), auth: false }
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
  
  // Auctions
  getAuctions: (status?: string) =>
    apiFetch<any[]>(`/api/auctions${status ? `?status=${status}` : ''}`, { auth: false }),
  getAuctionDetail: (auctionId: string) =>
    apiFetch<any>(`/api/auctions/${auctionId}`, { auth: false }),
  placeBid: (auctionId: string, bidAmount: number) =>
    apiFetch<any>('/api/auctions/bid', { 
      method: 'POST', 
      body: JSON.stringify({ auction_id: auctionId, bid_amount: bidAmount }) 
    }),
  getUserWonAuctions: () => apiFetch<any[]>('/api/auctions/user/won'),
  claimAuctionPrize: (auctionId: string) =>
    apiFetch<any>(`/api/auctions/${auctionId}/claim`, { method: 'POST' }),
  
  // Photos
  getUserPhotos: () => apiFetch<any[]>('/api/photos'),
  getPendingPhotos: () => apiFetch<any[]>('/api/photos/pending'),
  approvePhoto: (tagId: string, approved: boolean) =>
    apiFetch<any>('/api/photos/approve', { 
      method: 'POST', 
      body: JSON.stringify({ tag_id: tagId, approved }) 
    }),
  purchasePhotos: (photoIds: string[], aiEnhance: boolean = false) =>
    apiFetch<any>('/api/photos/purchase', { 
      method: 'POST', 
      body: JSON.stringify({ photo_ids: photoIds, ai_enhance: aiEnhance }) 
    }),
  getPurchasedPhotos: () => apiFetch<any[]>('/api/photos/purchased'),
  getNightRecap: () => apiFetch<any>('/api/photos/recap'),
};
