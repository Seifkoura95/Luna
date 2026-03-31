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
  register: (email: string, password: string, name: string, referralCode?: string) =>
    apiFetch<{ user: any; token: string; referral_bonus?: string }>(
      '/api/auth/register',
      { 
        method: 'POST', 
        body: JSON.stringify({ 
          email, 
          password, 
          name, 
          referral_code: referralCode || undefined 
        }), 
        auth: false 
      }
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
  
  // Events (Powered by Eventfinda - Real-time data)
  getEvents: (venueId?: string, location: string = 'brisbane', limit: number = 20) => 
    apiFetch<{events: any[], total: number, source: string}>(`/api/events?location=${location}&limit=${limit}${venueId ? `&venue_id=${venueId}` : ''}`, { auth: false }),
  
  getEventsFeed: (limit: number = 30) =>
    apiFetch<{
      tonight: any[];
      tomorrow: any[];
      featured: any[];
      upcoming: any[];
      total_count: number;
      source: string;
      updated_at: string;
    }>(`/api/events/feed?limit=${limit}`, { auth: false }),
  
  getFeaturedEvents: (location: string = 'brisbane', limit: number = 5) =>
    apiFetch<{events: any[], total: number}>(`/api/events/featured?location=${location}&limit=${limit}`, { auth: false }),
  
  getTonightEvents: (location: string = 'brisbane', limit: number = 10) =>
    apiFetch<{events: any[], total: number, date: string}>(`/api/events/tonight?location=${location}&limit=${limit}`, { auth: false }),
  
  getWeekendEvents: (location: string = 'brisbane', limit: number = 20) =>
    apiFetch<{events: any[], total: number}>(`/api/events/weekend?location=${location}&limit=${limit}`, { auth: false }),
  
  getUpcomingEvents: (location: string = 'brisbane', limit: number = 30) =>
    apiFetch<{events: any[], total: number}>(`/api/events/upcoming?location=${location}&limit=${limit}`, { auth: false }),
  
  searchEvents: (query: string, location: string = 'brisbane', limit: number = 20) =>
    apiFetch<{events: any[], total: number, query: string}>(`/api/events/search?q=${encodeURIComponent(query)}&location=${location}&limit=${limit}`, { auth: false }),
  
  getEventDetail: (eventId: string) =>
    apiFetch<any>(`/api/events/${eventId}`),
  
  // User Stats
  getUserStats: () => apiFetch<any>('/api/users/stats'),
  
  // Membership
  getMembershipTiers: () => apiFetch<any>('/api/membership/tiers', { auth: false }),
  upgradeMembership: (tier: string) =>
    apiFetch<any>('/api/membership/upgrade', { method: 'POST', body: JSON.stringify({ tier }) }),
  
  // Admin
  seedData: () => apiFetch<any>('/api/admin/seed', { method: 'POST', auth: false }),
  
  // ====== ENHANCED AUCTIONS ======
  getAuctions: (venueId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (venueId) params.append('venue_id', venueId);
    if (status) params.append('status', status);
    return apiFetch<any[]>(`/api/auctions${params.toString() ? `?${params.toString()}` : ''}`, { auth: false });
  },
  getAuctionDetail: (auctionId: string) =>
    apiFetch<any>(`/api/auctions/${auctionId}`, { auth: false }),
  getAuctionBids: (auctionId: string) =>
    apiFetch<any[]>(`/api/auctions/${auctionId}/bids`, { auth: false }),
  placeBid: (auctionId: string, amount: number, maxBid?: number, notifyOutbid: boolean = true) =>
    apiFetch<any>('/api/auctions/bid', { 
      method: 'POST', 
      body: JSON.stringify({ auction_id: auctionId, amount, max_bid: maxBid, notify_outbid: notifyOutbid }) 
    }),
  getUserWonAuctions: () => apiFetch<any[]>('/api/auctions/user/won'),
  claimAuctionPrize: (auctionId: string) =>
    apiFetch<any>(`/api/auctions/${auctionId}/claim`, { method: 'POST' }),
  
  // Auction Notifications
  subscribeToAuction: (auctionId: string, notifyOutbid: boolean = true) =>
    apiFetch<any>('/api/auctions/subscribe', { 
      method: 'POST', 
      body: JSON.stringify({ auction_id: auctionId, notify_outbid: notifyOutbid }) 
    }),
  getAuctionNotifications: () => apiFetch<any>('/api/auctions/notifications'),
  markNotificationsRead: () =>
    apiFetch<any>('/api/auctions/notifications/mark-read', { method: 'POST' }),
  
  // ====== TICKETS WALLET ======
  getTickets: (status?: string) => 
    apiFetch<any>(`/api/tickets${status ? `?status=${status}` : ''}`),
  purchaseTicket: (eventId: string, quantity: number = 1, ticketType: string = 'general') =>
    apiFetch<any>('/api/tickets/purchase', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, quantity, ticket_type: ticketType })
    }),
  addGuestToTicket: (ticketId: string, guestName: string, guestEmail?: string) =>
    apiFetch<any>('/api/tickets/add-guest', {
      method: 'POST',
      body: JSON.stringify({ ticket_id: ticketId, guest_name: guestName, guest_email: guestEmail })
    }),
  removeGuestFromTicket: (ticketId: string, guestId: string) =>
    apiFetch<any>(`/api/tickets/${ticketId}/guest/${guestId}`, { method: 'DELETE' }),
  
  // ====== CREW PLAN ======
  getCrews: () => apiFetch<any[]>('/api/crews'),
  getCrewDetail: (crewId: string) => apiFetch<any>(`/api/crews/${crewId}`),
  createCrew: (name: string, eventId?: string) =>
    apiFetch<any>('/api/crews/create', {
      method: 'POST',
      body: JSON.stringify({ name, event_id: eventId })
    }),
  inviteToCrew: (crewId: string, email?: string, userId?: string) =>
    apiFetch<any>('/api/crews/invite', {
      method: 'POST',
      body: JSON.stringify({ crew_id: crewId, email, user_id: userId })
    }),
  joinCrew: (crewId: string) =>
    apiFetch<any>(`/api/crews/${crewId}/join`, { method: 'POST' }),
  placeCrewBoothBid: (crewId: string, auctionId: string, totalAmount: number, contributions: any[]) =>
    apiFetch<any>('/api/crews/booth-bid', {
      method: 'POST',
      body: JSON.stringify({ crew_id: crewId, auction_id: auctionId, total_amount: totalAmount, contributions })
    }),
  
  // ====== SAFETY ======
  reportIncident: (venueId: string, incidentType: string, description: string, locationDetails?: string) =>
    apiFetch<any>('/api/safety/report-incident', {
      method: 'POST',
      body: JSON.stringify({ venue_id: venueId, incident_type: incidentType, description, location_details: locationDetails })
    }),
  reportLostProperty: (venueId: string, itemDescription: string, dateLost: string, contactPhone?: string) =>
    apiFetch<any>('/api/safety/lost-property', {
      method: 'POST',
      body: JSON.stringify({ venue_id: venueId, item_description: itemDescription, date_lost: dateLost, contact_phone: contactPhone })
    }),
  getRideshareLinks: (venueId: string) =>
    apiFetch<any>(`/api/safety/rideshare-links?venue_id=${venueId}`, { auth: false }),
  getEmergencyContacts: (venueId?: string) =>
    apiFetch<any>(`/api/safety/emergency-contacts${venueId ? `?venue_id=${venueId}` : ''}`, { auth: false }),
  
  // Photos
  getUserPhotos: (venueId?: string) => 
    apiFetch<any[]>(`/api/photos${venueId ? `?venue_id=${venueId}` : ''}`),
  getVenueGalleries: () => 
    apiFetch<any[]>('/api/photos/venues', { auth: false }),
  getVenuePhotos: (venueId: string) =>
    apiFetch<any[]>(`/api/photos/venue/${venueId}`, { auth: false }),
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
  
  // Bookings (SevenRooms Mock)
  getAvailability: (venueId: string, date: string, partySize: number = 2) =>
    apiFetch<any>(`/api/bookings/availability?venue_id=${venueId}&date=${date}&party_size=${partySize}`, { auth: false }),
  createReservation: (venueId: string, date: string, time: string, partySize: number, specialRequests?: string, occasion?: string) =>
    apiFetch<any>('/api/bookings/reserve', { 
      method: 'POST', 
      body: JSON.stringify({ venue_id: venueId, date, time, party_size: partySize, special_requests: specialRequests, occasion }) 
    }),
  addToGuestlist: (venueId: string, date: string, partySize: number, arrivalTime?: string, vipBooth: boolean = false) =>
    apiFetch<any>('/api/bookings/guestlist', { 
      method: 'POST', 
      body: JSON.stringify({ venue_id: venueId, date, party_size: partySize, arrival_time: arrivalTime, vip_booth: vipBooth }) 
    }),
  getMyReservations: () => apiFetch<any>('/api/bookings/my-reservations'),
  cancelBooking: (bookingId: string) =>
    apiFetch<any>(`/api/bookings/${bookingId}`, { method: 'DELETE' }),
  
  // ====== STRIPE PAYMENTS ======
  getStripePublishableKey: () => 
    apiFetch<{ publishableKey: string; testMode: boolean }>('/api/payments/publishable-key', { auth: false }),
  
  createPaymentIntent: (auctionId: string, bidAmount: number) =>
    apiFetch<{
      clientSecret: string;
      paymentIntentId: string;
      depositAmount: number;
      currency: string;
      bidId: string;
      testMode: boolean;
      message?: string;
    }>('/api/payments/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ auction_id: auctionId, bid_amount: bidAmount })
    }),
  
  confirmBidPayment: (bidId: string, paymentIntentId: string) =>
    apiFetch<{
      success: boolean;
      message: string;
      bidAmount?: number;
      depositPaid?: number;
    }>(`/api/payments/confirm-bid?bid_id=${bidId}&payment_intent_id=${paymentIntentId}`, {
      method: 'POST'
    }),
  
  // ====== PUSH NOTIFICATIONS ======
  registerPushToken: (pushToken: string, deviceType: string = 'expo') =>
    apiFetch<{ success: boolean; message: string }>('/api/notifications/register-push-token', {
      method: 'POST',
      body: JSON.stringify({ push_token: pushToken, device_type: deviceType })
    }),
  
  removePushToken: () =>
    apiFetch<{ success: boolean; message: string }>('/api/notifications/push-token', {
      method: 'DELETE'
    }),
  
  getPendingNotifications: () =>
    apiFetch<{ notifications: any[]; count: number }>('/api/notifications/pending'),
  
  markNotificationRead: (notificationId: string) =>
    apiFetch<{ success: boolean }>(`/api/notifications/mark-read/${notificationId}`, {
      method: 'POST'
    }),
  
  sendTestNotification: () =>
    apiFetch<{ success: boolean; notification: any }>('/api/notifications/test', {
      method: 'POST'
    }),
  
  // ====== CREW INVITE & EMAIL ======
  sendCrewInviteEmail: (crewId: string, email: string, name?: string, message?: string) =>
    apiFetch<{
      success: boolean;
      message: string;
      invite: any;
      email_preview: any;
      mock: boolean;
    }>(`/api/crews/${crewId}/send-invite-email`, {
      method: 'POST',
      body: JSON.stringify({ 
        crew_id: crewId,
        invitee_email: email, 
        invitee_name: name, 
        message 
      })
    }),
  
  getInviteByToken: (token: string) =>
    apiFetch<{ invite: any; crew: any }>(`/api/crews/invite/${token}`, { auth: false }),
  
  acceptInviteByToken: (token: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/crews/invite/${token}/accept`, {
      method: 'POST'
    }),
  
  declineInviteByToken: (token: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/crews/invite/${token}/decline`, {
      method: 'POST'
    }),
  
  getPendingCrewInvites: (crewId: string) =>
    apiFetch<{ invites: any[] }>(`/api/crews/${crewId}/pending-invites`),
  
  // ====== SPLIT PAYMENTS ======
  createSplitPayment: (crewId: string, auctionId: string, totalAmount: number, splits: any[]) =>
    apiFetch<{
      success: boolean;
      message: string;
      master_split: any;
      individual_splits: any[];
      testMode: boolean;
    }>('/api/payments/create-split-payment', {
      method: 'POST',
      body: JSON.stringify({
        crew_id: crewId,
        auction_id: auctionId,
        total_amount: totalAmount,
        splits
      })
    }),
  
  getCrewSplitStatus: (crewId: string) =>
    apiFetch<{ split: any | null }>(`/api/crews/${crewId}/split-status`),
  
  // ====== SUBSCRIPTIONS ======
  getSubscriptionTiers: () =>
    apiFetch<{ tiers: any[]; entry_venues: string[] }>('/api/subscriptions/tiers', { auth: false }),
  
  getMySubscription: () =>
    apiFetch<{ subscription: any | null; tier: any; is_subscribed: boolean }>('/api/subscriptions/my'),
  
  subscribeTo: (tierId: string, paymentMethodId?: string) =>
    apiFetch<{
      success: boolean;
      message: string;
      subscription: any;
      tier: any;
      mock: boolean;
    }>('/api/subscriptions/subscribe', {
      method: 'POST',
      body: JSON.stringify({ tier_id: tierId, payment_method_id: paymentMethodId })
    }),
  
  cancelSubscription: () =>
    apiFetch<{ success: boolean; message: string }>('/api/subscriptions/cancel', {
      method: 'POST'
    }),
  
  useFreeEntry: (venueId: string) =>
    apiFetch<{
      success: boolean;
      message: string;
      entries_remaining: number;
      unlimited: boolean;
    }>(`/api/subscriptions/use-entry?venue_id=${venueId}`, {
      method: 'POST'
    }),
  
  // ====== POINTS ======
  getPointsBalance: () =>
    apiFetch<{
      balance: number;
      multiplier: number;
      tier: string;
      recent_transactions: any[];
      points_per_dollar: number;
    }>('/api/points/balance'),
  
  getPointsHistory: (limit: number = 50) =>
    apiFetch<{
      transactions: any[];
      total_earned: number;
      total_spent: number;
      net_points: number;
    }>(`/api/points/history?limit=${limit}`),
  
  recordSpending: (amount: number, source: string, sourceId?: string, venueId?: string, description?: string) =>
    apiFetch<{
      success: boolean;
      message: string;
      amount_spent: number;
      base_points: number;
      bonus_points: number;
      total_points: number;
      multiplier: number;
    }>('/api/points/record-spending', {
      method: 'POST',
      body: JSON.stringify({ amount, source, source_id: sourceId, venue_id: venueId, description })
    }),
  
  simulatePurchase: (amount: number, description: string = 'Test Purchase') =>
    apiFetch<{
      success: boolean;
      message: string;
      amount_spent: number;
      base_points: number;
      bonus_points: number;
      total_points: number;
      multiplier: number;
      demo: boolean;
    }>(`/api/points/simulate-purchase?amount=${amount}&description=${encodeURIComponent(description)}`, {
      method: 'POST'
    }),
  
  // ====== LOCATION TRACKING ======
  updateLocation: (latitude: number, longitude: number, accuracy?: number, heading?: number, speed?: number) =>
    apiFetch<{ success: boolean; message: string }>('/api/location/update', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, accuracy, heading, speed })
    }),
  
  getMyLocation: () =>
    apiFetch<{ location: any | null }>('/api/location/me'),
  
  getCrewLocations: (crewId: string) =>
    apiFetch<{
      crew_id: string;
      crew_name: string;
      members: any[];
      count: number;
    }>(`/api/location/crew/${crewId}`),
  
  toggleLocationSharing: (crewId: string, enabled: boolean) =>
    apiFetch<{ success: boolean; message: string }>(`/api/location/share/${crewId}?enabled=${enabled}`, {
      method: 'POST'
    }),
  
  // ====== SAFETY ALERTS ======
  sendSafetyAlert: (alertType: string, latitude: number, longitude: number, venueId?: string, crewId?: string, message?: string) =>
    apiFetch<{
      success: boolean;
      alert_id: string;
      message: string;
      notified_crew_members: string[];
      notified_venues: string[];
      alert: any;
    }>('/api/safety/alert', {
      method: 'POST',
      body: JSON.stringify({
        alert_type: alertType,
        latitude,
        longitude,
        venue_id: venueId,
        crew_id: crewId,
        message
      })
    }),
  
  getActiveSafetyAlerts: () =>
    apiFetch<{ alerts: any[] }>('/api/safety/alerts/active'),
  
  acknowledgeSafetyAlert: (alertId: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/safety/alerts/${alertId}/acknowledge`, {
      method: 'POST'
    }),
  
  resolveSafetyAlert: (alertId: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/safety/alerts/${alertId}/resolve`, {
      method: 'POST'
    }),
  
  getSafetyNotifications: () =>
    apiFetch<{ notifications: any[] }>('/api/safety/notifications'),

  // ====== VIP TABLE BOOKING ======
  getVenueTables: (venueId: string, date?: string) =>
    apiFetch<{ tables: any[]; venue_id: string }>(`/api/venues/${venueId}/tables${date ? `?date=${date}` : ''}`),
  
  createTableBooking: (data: {
    venue_id: string;
    table_id: string;
    date: string;
    party_size: number;
    special_requests?: string;
    contact_phone?: string;
  }) =>
    apiFetch<{ success: boolean; booking: any; message: string }>('/api/bookings/table', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  getTableDepositIntent: (bookingId: string) =>
    apiFetch<{
      success: boolean;
      client_secret: string;
      payment_intent_id: string;
      amount: number;
      currency: string;
      demo_mode?: boolean;
    }>(`/api/bookings/table/${bookingId}/deposit`, {
      method: 'POST'
    }),
  
  confirmTableBooking: (bookingId: string, paymentIntentId: string) =>
    apiFetch<{ success: boolean; message: string; points_earned: number }>(`/api/bookings/table/${bookingId}/confirm?payment_intent_id=${paymentIntentId}`, {
      method: 'POST'
    }),
  
  getMyTableBookings: () =>
    apiFetch<{ bookings: any[] }>('/api/bookings/my-tables'),
  
  cancelTableBooking: (bookingId: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/bookings/table/${bookingId}`, {
      method: 'DELETE'
    }),

  // ====== SMART NOTIFICATIONS ======
  getNotifications: (unreadOnly: boolean = false, limit: number = 50) =>
    apiFetch<{ notifications: any[]; unread_count: number }>(`/api/notifications?unread_only=${unreadOnly}&limit=${limit}`),
  
  markNotificationRead: (notificationId: string) =>
    apiFetch<{ success: boolean }>(`/api/notifications/${notificationId}/read`, {
      method: 'POST'
    }),
  
  markAllNotificationsRead: () =>
    apiFetch<{ success: boolean; marked_read: number }>('/api/notifications/read-all', {
      method: 'POST'
    }),
  
  getNotificationPreferences: () =>
    apiFetch<any>('/api/notifications/preferences'),
  
  updateNotificationPreferences: (prefs: any) =>
    apiFetch<{ success: boolean; preferences: any }>('/api/notifications/preferences', {
      method: 'POST',
      body: JSON.stringify(prefs)
    }),
  
  getSmartSuggestions: () =>
    apiFetch<{ suggestions: any[]; generated_at: string }>('/api/notifications/smart-suggestions'),

  // ====== REFERRAL SYSTEM ======
  getReferralCode: () =>
    apiFetch<{
      referral_code: string;
      referral_link: string;
      stats: {
        successful_referrals: number;
        pending_referrals: number;
        total_points_earned: number;
        points_per_referral: number;
      }
    }>('/api/referral/code'),
  
  getReferralHistory: () =>
    apiFetch<{ referrals: any[]; total: number }>('/api/referral/history'),
  
  applyReferralCode: (code: string) =>
    apiFetch<{ success: boolean; message: string; referral: any }>(`/api/referral/apply?referral_code=${code}`, {
      method: 'POST'
    }),

  // ====== EMAIL VERIFICATION ======
  verifyEmail: (token: string) =>
    apiFetch<{ success: boolean; message: string; referral_bonus?: string }>(
      `/api/auth/verify-email?token=${token}`,
      { method: 'POST', auth: false }
    ),
  
  resendVerificationEmail: () =>
    apiFetch<{ success: boolean; message: string; demo_verification_link?: string }>(
      '/api/auth/resend-verification',
      { method: 'POST' }
    ),

  // ====== CHERRYHUB INTEGRATION ======
  // Register user with CherryHub membership system
  cherryHubRegister: (syncExisting: boolean = false) =>
    apiFetch<{
      status: string;
      member_key: string | null;
      cherryhub_data?: any;
      message: string;
    }>('/api/cherryhub/register', {
      method: 'POST',
      body: JSON.stringify({ sync_existing: syncExisting })
    }),

  // Get CherryHub membership status
  cherryHubStatus: () =>
    apiFetch<{
      registered: boolean;
      member_key: string | null;
      registered_at?: string;
      member_data?: any;
      message: string;
    }>('/api/cherryhub/status'),

  // Get digital wallet pass (Apple Wallet or Google Wallet)
  cherryHubGetWalletPass: (platform: 'ios' | 'android') =>
    apiFetch<{
      platform: string;
      pass_type: string;
      pass_content_base64?: string;  // For iOS
      google_wallet_url?: string;    // For Android
      message: string;
    }>('/api/cherryhub/wallet-pass', {
      method: 'POST',
      body: JSON.stringify({ platform })
    }),

  // Get CherryHub loyalty points balance
  cherryHubGetPoints: () =>
    apiFetch<{
      member_key: string;
      points: number;
      points_data?: any;
    }>('/api/cherryhub/points'),

  // ====== ACCOUNT MANAGEMENT ======
  // Delete user account (App Store requirement)
  deleteAccount: () =>
    apiFetch<{
      success: boolean;
      message: string;
      deletion_summary: Record<string, number>;
    }>('/api/user/delete', {
      method: 'DELETE'
    }),

  // ====== POINTS PURCHASE API ======
  buyPoints: (packageId: string, points: number, price: number, bonus: number = 0, paymentMethod: string = 'card') =>
    apiFetch<{
      success: boolean;
      transaction_id: string;
      points_added: number;
      base_points: number;
      bonus_points: number;
      new_balance: number;
      message: string;
    }>('/api/cherryhub/buy-points', {
      method: 'POST',
      body: JSON.stringify({
        package_id: packageId,
        points,
        price,
        bonus,
        payment_method: paymentMethod
      })
    }),

  // ====== PROMO CODE API ======
  validatePromoCode: (code: string) =>
    apiFetch<{
      valid: boolean;
      code?: string;
      type?: string;
      description?: string;
      message: string;
    }>(`/api/promo/validate/${encodeURIComponent(code)}`),

  applyPromoCode: (code: string) =>
    apiFetch<{
      success: boolean;
      code: string;
      description: string;
      rewards: string[];
      points_added: number;
      vouchers_added: number;
      message: string;
    }>('/api/promo/apply', {
      method: 'POST',
      body: JSON.stringify({ code })
    }),

  // ====== VOUCHERS API ======
  getVouchers: () =>
    apiFetch<{
      vouchers: any[];
      total: number;
    }>('/api/vouchers'),

  // ====== INSTAGRAM INTEGRATION API ======
  getInstagramFeed: (limit: number = 20) =>
    apiFetch<{
      posts: any[];
      total: number;
      accounts: string[];
      hashtags: string[];
      demo_mode: boolean;
      updated_at: string;
    }>(`/api/instagram/feed?limit=${limit}`),

  getInstagramAccount: (account: string, limit: number = 10) =>
    apiFetch<{
      account: string;
      account_info: any;
      posts: any[];
      total: number;
    }>(`/api/instagram/account/${account}?limit=${limit}`),

  getInstagramHashtag: (hashtag: string, limit: number = 10) =>
    apiFetch<{
      hashtag: string;
      posts: any[];
      total: number;
      is_tracked: boolean;
    }>(`/api/instagram/hashtag/${hashtag}?limit=${limit}`),

  getInstagramConfig: () =>
    apiFetch<{
      demo_mode: boolean;
      configured: boolean;
      accounts: Record<string, any>;
      hashtags: string[];
      api_connected: boolean;
    }>('/api/instagram/config'),

  // ====== QR REDEMPTION SYSTEM ======
  redeemRewardWithQR: (rewardId: string, venueId?: string) =>
    apiFetch<{
      success: boolean;
      message: string;
      redemption: any;
      qr_code: string;
      new_balance: number;
    }>(`/api/rewards/redeem-with-qr?reward_id=${rewardId}${venueId ? `&venue_id=${venueId}` : ''}`, {
      method: 'POST'
    }),

  getMyRedemptions: (status?: string) =>
    apiFetch<any[]>(`/api/redemptions/my${status ? `?status=${status}` : ''}`),

  getRedemption: (redemptionId: string) =>
    apiFetch<any>(`/api/redemptions/${redemptionId}`),

  // ====== MISSIONS API ======
  updateMissionProgress: (missionId: string, progressIncrement: number = 1) =>
    apiFetch<{
      message: string;
      progress: number;
      target: number;
      completed: boolean;
    }>('/api/missions/progress', {
      method: 'POST',
      body: JSON.stringify({ mission_id: missionId, progress_increment: progressIncrement })
    }),

  claimMissionReward: (missionId: string) =>
    apiFetch<{
      success: boolean;
      message: string;
      points_awarded: number;
      new_balance: number;
    }>(`/api/missions/${missionId}/claim`, {
      method: 'POST'
    }),

  // ====== VENUE DASHBOARD API ======
  venueLogin: (email: string, password: string) =>
    apiFetch<{
      token: string;
      user: any;
      is_venue_staff: boolean;
      venue_id: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      auth: false
    }),

  venueScanQR: (qrCode: string, venueId: string) =>
    apiFetch<{
      success: boolean;
      message: string;
      reward_name: string;
      customer_name: string;
      points_spent: number;
      redeemed_at: string;
    }>('/api/venue/scan-qr', {
      method: 'POST',
      body: JSON.stringify({ qr_code: qrCode, venue_id: venueId })
    }),

  getVenueDashboard: () =>
    apiFetch<{
      stats: {
        total_redemptions: number;
        today_redemptions: number;
        week_redemptions: number;
        pending_redemptions: number;
        unique_visitors: number;
      };
      recent_redemptions: any[];
      venue_id: string;
      is_admin: boolean;
    }>('/api/venue/dashboard'),

  getVenueRedemptions: (status?: string, limit: number = 50, offset: number = 0) =>
    apiFetch<{
      total: number;
      redemptions: any[];
    }>(`/api/venue/redemptions?limit=${limit}&offset=${offset}${status ? `&status=${status}` : ''}`),

  getVenueAnalytics: (period: string = 'week') =>
    apiFetch<{
      period: string;
      daily_stats: Record<string, { count: number; points: number }>;
      top_rewards: { name: string; count: number }[];
      total_redemptions: number;
      total_points_redeemed: number;
    }>(`/api/venue/analytics?period=${period}`),

  registerVenueStaff: (email: string, password: string, name: string, venueId: string, role: string = 'venue_staff') =>
    apiFetch<{
      success: boolean;
      message: string;
      user_id: string;
    }>('/api/venue/register-staff', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, venue_id: venueId, role })
    }),

  // ====== SAFETY & EMERGENCY API (Extended) ======
  addEmergencyContact: (name: string, phone: string, relationship: string, email?: string) =>
    apiFetch<{ success: boolean; contact: any }>('/api/safety/emergency-contacts', {
      method: 'POST',
      body: JSON.stringify({ name, phone, relationship, email })
    }),

  removeEmergencyContact: (contactId: string) =>
    apiFetch<{ success: boolean }>(`/api/safety/emergency-contacts/${contactId}`, {
      method: 'DELETE'
    }),

  sendSilentAlert: (latitude: number, longitude: number, venueId?: string, activationMethod: string = 'button') =>
    apiFetch<{
      success: boolean;
      alert_id: string;
      message: string;
      notified: { crew: string[]; emergency_contacts: string[]; venue: string | null };
      location_link: string;
    }>('/api/safety/silent-alert', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, venue_id: venueId, activation_method: activationMethod })
    }),

  // ====== FRIENDS & SOCIAL API ======
  getFriends: () =>
    apiFetch<{ friends: any[]; count: number }>('/api/friends'),

  sendFriendRequest: (email?: string, username?: string) =>
    apiFetch<{ success: boolean; message: string; request_id: string }>('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ email, username })
    }),

  getFriendRequests: () =>
    apiFetch<{ incoming: any[]; outgoing: any[] }>('/api/friends/requests'),

  acceptFriendRequest: (requestId: string) =>
    apiFetch<{ success: boolean }>(`/api/friends/requests/${requestId}/accept`, { method: 'POST' }),

  declineFriendRequest: (requestId: string) =>
    apiFetch<{ success: boolean }>(`/api/friends/requests/${requestId}/decline`, { method: 'POST' }),

  removeFriend: (friendId: string) =>
    apiFetch<{ success: boolean }>(`/api/friends/${friendId}`, { method: 'DELETE' }),

  getFriendsActivity: () =>
    apiFetch<{ activities: any[] }>('/api/friends/activity'),

  // ====== EVENT RSVP API ======
  rsvpToEvent: (eventId: string, status: string, isPrivate: boolean = false) =>
    apiFetch<{ success: boolean; status: string }>(`/api/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, status, is_private: isPrivate })
    }),

  getMyEventRsvp: (eventId: string) =>
    apiFetch<{ rsvp: any | null }>(`/api/events/${eventId}/rsvp`),

  getEventAttendees: (eventId: string) =>
    apiFetch<{
      going_count: number;
      interested_count: number;
      friends_going: any[];
      friends_interested: any[];
      others_going_count: number;
    }>(`/api/events/${eventId}/attendees`),

  // ====== LOST & FOUND API ======
  reportLostItem: (venueId: string, itemDescription: string, itemCategory: string, lostDate: string, lostTimeApprox?: string, contactPhone?: string, photoUrl?: string) =>
    apiFetch<{ success: boolean; item_id: string; potential_matches: number }>('/api/lost-found/report-lost', {
      method: 'POST',
      body: JSON.stringify({
        venue_id: venueId,
        item_description: itemDescription,
        item_category: itemCategory,
        lost_date: lostDate,
        lost_time_approx: lostTimeApprox,
        contact_phone: contactPhone,
        photo_url: photoUrl
      })
    }),

  reportFoundItem: (venueId: string, itemDescription: string, itemCategory: string, foundDate: string, foundLocation?: string, photoUrl?: string) =>
    apiFetch<{ success: boolean; item_id: string; matching_reports: number }>('/api/lost-found/report-found', {
      method: 'POST',
      body: JSON.stringify({
        venue_id: venueId,
        item_description: itemDescription,
        item_category: itemCategory,
        found_date: foundDate,
        found_location: foundLocation,
        photo_url: photoUrl
      })
    }),

  getMyLostReports: () =>
    apiFetch<{ reports: any[] }>('/api/lost-found/my-reports'),

  getVenueLostFound: (venueId: string, itemType?: string) =>
    apiFetch<{ items: any[] }>(`/api/lost-found/venue/${venueId}${itemType ? `?item_type=${itemType}` : ''}`),

  claimFoundItem: (itemId: string) =>
    apiFetch<{ success: boolean }>(`/api/lost-found/${itemId}/claim`, { method: 'POST' }),

  sendLostFoundMessage: (itemId: string, message: string) =>
    apiFetch<{ success: boolean; message_id: string }>('/api/lost-found/message', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId, message })
    }),

  getLostFoundMessages: (itemId: string) =>
    apiFetch<{ messages: any[] }>(`/api/lost-found/${itemId}/messages`),

  // ====== RIDE SHARING API ======
  getRideOptions: (latitude: number, longitude: number, venueId?: string) =>
    apiFetch<{
      pickup_location: { latitude: number; longitude: number };
      destination: string;
      options: any[];
    }>(`/api/rides/options?latitude=${latitude}&longitude=${longitude}${venueId ? `&venue_id=${venueId}` : ''}`),

  // ====== PRIVACY SETTINGS API ======
  getPrivacySettings: () =>
    apiFetch<{
      show_activity_to_friends: boolean;
      show_event_attendance: boolean;
      show_checkins: boolean;
      allow_friend_requests: boolean;
    }>('/api/settings/privacy'),

  updatePrivacySettings: (settings: {
    show_activity_to_friends?: boolean;
    show_event_attendance?: boolean;
    show_checkins?: boolean;
    allow_friend_requests?: boolean;
  }) =>
    apiFetch<{ success: boolean }>('/api/settings/privacy', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }),

  // ====== BIRTHDAY CLUB API ======
  getBirthdayStatus: () =>
    apiFetch<{
      has_birthday_set: boolean;
      date_of_birth?: string;
      is_birthday_today: boolean;
      is_birthday_week: boolean;
      days_until_birthday: number | null;
      available_rewards: any[];
      claimed_rewards: any[];
      message: string;
    }>('/api/birthday/status'),

  claimBirthdayReward: (rewardId: string) =>
    apiFetch<{
      success: boolean;
      message: string;
      reward: any;
    }>(`/api/birthday/claim/${rewardId}`, { method: 'POST' }),

  getMyBirthdayRewards: () =>
    apiFetch<{ rewards: any[] }>('/api/birthday/my-rewards'),

  redeemBirthdayReward: (rewardClaimId: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/birthday/redeem/${rewardClaimId}`, { method: 'POST' }),

  // ====== AI FEATURES API ======
  aiChat: (message: string, sessionId?: string) =>
    apiFetch<{ response: string; session_id: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, session_id: sessionId })
    }),

  aiSmartMission: () =>
    apiFetch<{ mission: any }>('/api/ai/smart-mission', { method: 'POST' }),

  aiPhotoCaption: (venueName: string, eventName?: string) =>
    apiFetch<{ caption: string; suggestions: string[] }>('/api/ai/photo-caption', {
      method: 'POST',
      body: JSON.stringify({ venue_name: venueName, event_name: eventName, time_of_day: 'night' })
    }),

  aiHealth: () =>
    apiFetch<{ status: string; ai_enabled: boolean; features: any }>('/api/ai/health', { auth: false }),

  // ====== PAYMENTS API ======
  getPaymentPackages: () =>
    apiFetch<{ packages: any[] }>('/api/payments/packages', { auth: false }),

  createCheckout: (packageId: string, originUrl: string, options?: { venueId?: string; bookingDate?: string; guests?: number }) =>
    apiFetch<{ checkout_url: string; session_id: string }>('/api/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({
        package_id: packageId,
        origin_url: originUrl,
        venue_id: options?.venueId,
        booking_date: options?.bookingDate,
        guests: options?.guests
      })
    }),

  getPaymentStatus: (sessionId: string) =>
    apiFetch<{ status: string; payment_status: string; amount: number; currency: string; package_name: string }>(`/api/payments/status/${sessionId}`),

  getPaymentHistory: () =>
    apiFetch<{ transactions: any[] }>('/api/payments/history'),

  // ====== STORIES API ======
  createStory: (photoUrl: string, venueId: string, venueName: string, caption?: string, eventName?: string) =>
    apiFetch<{ story: any }>('/api/stories/create', {
      method: 'POST',
      body: JSON.stringify({
        photo_url: photoUrl,
        venue_id: venueId,
        venue_name: venueName,
        caption,
        event_name: eventName
      })
    }),

  getMyStories: () =>
    apiFetch<{ stories: any[] }>('/api/stories/my-stories'),

  shareStory: (storyId: string, platform: string) =>
    apiFetch<{ success: boolean; points_earned: number; share_data: any }>('/api/stories/share', {
      method: 'POST',
      body: JSON.stringify({ story_id: storyId, platform })
    }),

  getStoryFeed: (limit?: number) =>
    apiFetch<{ stories: any[] }>(`/api/stories/feed?limit=${limit || 20}`),
};
