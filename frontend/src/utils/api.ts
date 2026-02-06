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
  getQRData: (venueId: string) => apiFetch<{ qr_data: string; expires_at: number }>(`/api/checkin/qr?venue_id=${venueId}`),
  
  // Rewards
  getRewards: (category?: string, venueId?: string) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (venueId) params.append('venue_id', venueId);
    return apiFetch<any[]>(`/api/rewards${params.toString() ? `?${params.toString()}` : ''}`);
  },
  redeemReward: (rewardId: string, venueId?: string) =>
    apiFetch<any>('/api/rewards/redeem', { method: 'POST', body: JSON.stringify({ reward_id: rewardId, venue_id: venueId }) }),
  getRedemptions: () => apiFetch<any[]>('/api/rewards/redemptions'),
  
  // Missions
  getMissions: (venueId?: string) =>
    apiFetch<any[]>(`/api/missions${venueId ? `?venue_id=${venueId}` : ''}`),
  
  // Boosts
  getActiveBoosts: (venueId?: string) => 
    apiFetch<any[]>(`/api/boosts${venueId ? `?venue_id=${venueId}` : ''}`, { auth: false }),
  getUpcomingBoosts: (venueId?: string) => 
    apiFetch<any[]>(`/api/boosts/upcoming${venueId ? `?venue_id=${venueId}` : ''}`, { auth: false }),
  
  // Events
  getEvents: (venueId?: string) => 
    apiFetch<any[]>(`/api/events${venueId ? `?venue_id=${venueId}` : ''}`, { auth: false }),
  
  // Points
  getPointsHistory: (venueId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (venueId) params.append('venue_id', venueId);
    if (limit) params.append('limit', limit.toString());
    return apiFetch<any[]>(`/api/points/history${params.toString() ? `?${params.toString()}` : ''}`);
  },
  getPointsStats: () => apiFetch<any>('/api/points/stats'),
  
  // Venue Status (removed queue)
  getVenueStatus: (venueId: string) => apiFetch<any>(`/api/venues/${venueId}`, { auth: false }),
  
  // Membership
  getMembershipTiers: () => apiFetch<any>('/api/membership/tiers', { auth: false }),
  upgradeMembership: (tier: string) =>
    apiFetch<any>('/api/membership/upgrade', { method: 'POST', body: JSON.stringify({ tier }) }),
  
  // Admin
  seedData: () => apiFetch<any>('/api/admin/seed', { method: 'POST', auth: false }),
  getAdminStats: () => apiFetch<any>('/api/admin/stats', { auth: false }),
  
  // Auctions
  getAuctions: (venueId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (venueId) params.append('venue_id', venueId);
    if (status) params.append('status', status);
    return apiFetch<any[]>(`/api/auctions${params.toString() ? `?${params.toString()}` : ''}`, { auth: false });
  },
  getAuctionDetail: (auctionId: string) =>
    apiFetch<any>(`/api/auctions/${auctionId}`, { auth: false }),
  placeBid: (auctionId: string, bidAmount: number) =>
    apiFetch<any>('/api/auctions/bid', { 
      method: 'POST', 
      body: JSON.stringify({ auction_id: auctionId, amount: bidAmount }) 
    }),
  getUserWonAuctions: () => apiFetch<any[]>('/api/auctions/user/won'),
  claimAuctionPrize: (auctionId: string) =>
    apiFetch<any>(`/api/auctions/${auctionId}/claim`, { method: 'POST' }),
  
  // Photos
  getUserPhotos: (venueId?: string) => 
    apiFetch<any[]>(`/api/photos${venueId ? `?venue_id=${venueId}` : ''}`),
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
