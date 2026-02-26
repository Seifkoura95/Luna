// Mock data for the venue dashboard
export const mockRevenueData = [
  { date: 'Mon', revenue: 12500, lastWeek: 10200 },
  { date: 'Tue', revenue: 8900, lastWeek: 7800 },
  { date: 'Wed', revenue: 15600, lastWeek: 14200 },
  { date: 'Thu', revenue: 18200, lastWeek: 16800 },
  { date: 'Fri', revenue: 32400, lastWeek: 28900 },
  { date: 'Sat', revenue: 45600, lastWeek: 42100 },
  { date: 'Sun', revenue: 22300, lastWeek: 19500 },
];

export const mockHourlyData = [
  { hour: '6PM', checkins: 12 },
  { hour: '7PM', checkins: 28 },
  { hour: '8PM', checkins: 45 },
  { hour: '9PM', checkins: 78 },
  { hour: '10PM', checkins: 124 },
  { hour: '11PM', checkins: 156 },
  { hour: '12AM', checkins: 142 },
  { hour: '1AM', checkins: 98 },
  { hour: '2AM', checkins: 45 },
];

export const mockPointsData = [
  { name: 'Issued', value: 45600 },
  { name: 'Redeemed', value: 32400 },
  { name: 'Expired', value: 5200 },
];

export const mockAuctionData = [
  { id: 'AUC-001', item: 'VIP Booth Upgrade', currentBid: 450, bids: 12, timeLeft: '2h 15m', status: 'live' },
  { id: 'AUC-002', item: 'Fast Lane Pass x4', currentBid: 280, bids: 8, timeLeft: '45m', status: 'live' },
  { id: 'AUC-003', item: 'Bottle Service Credit', currentBid: 620, bids: 15, timeLeft: '5h 30m', status: 'live' },
  { id: 'AUC-004', item: 'Meet & Greet Package', currentBid: 890, bids: 22, timeLeft: '1h 10m', status: 'ending' },
];

export const mockActivityFeed = [
  { id: 1, type: 'checkin', user: 'Sarah M.', action: 'checked in', time: '2 min ago', tier: 'gold', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
  { id: 2, type: 'redemption', user: 'James K.', action: 'redeemed Free Drink', time: '5 min ago', tier: 'platinum', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
  { id: 3, type: 'purchase', user: 'Emily R.', action: 'purchased $250 table', time: '8 min ago', tier: 'silver', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
  { id: 4, type: 'bid', user: 'Michael T.', action: 'bid $450 on VIP Booth', time: '12 min ago', tier: 'gold', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' },
  { id: 5, type: 'vip_arrival', user: 'Jessica L.', action: 'VIP arrived', time: '15 min ago', tier: 'platinum', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
  { id: 6, type: 'checkin', user: 'David W.', action: 'checked in', time: '18 min ago', tier: 'bronze', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100' },
];

export const mockTopSpenders = [
  { name: 'Jessica L.', spent: 4250, visits: 12, tier: 'platinum', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
  { name: 'Michael T.', spent: 3890, visits: 8, tier: 'gold', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' },
  { name: 'Sarah M.', spent: 3450, visits: 15, tier: 'gold', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
  { name: 'James K.', spent: 2980, visits: 6, tier: 'platinum', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
  { name: 'Emily R.', spent: 2650, visits: 10, tier: 'silver', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
];

export const mockDemographics = {
  ageGroups: [
    { range: '18-24', percentage: 35 },
    { range: '25-34', percentage: 42 },
    { range: '35-44', percentage: 18 },
    { range: '45+', percentage: 5 },
  ],
  membershipTiers: [
    { tier: 'Bronze', count: 1250, color: '#CD7F32' },
    { tier: 'Silver', count: 680, color: '#C0C0C0' },
    { tier: 'Gold', count: 320, color: '#FFD700' },
    { tier: 'Platinum', count: 85, color: '#E5E4E2' },
  ],
};

export const mockVIPAlerts = [
  { id: 1, name: 'Jessica L.', tier: 'platinum', totalSpend: 45000, lastVisit: '3 days ago', status: 'arriving', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
  { id: 2, name: 'Marcus R.', tier: 'platinum', totalSpend: 38500, lastVisit: '1 week ago', status: 'expected', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100' },
];

export const mockWeeklyComparison = {
  thisWeek: { revenue: 155500, checkins: 2340, avgSpend: 66.45 },
  lastWeek: { revenue: 139400, checkins: 2180, avgSpend: 63.94 },
  change: { revenue: 11.5, checkins: 7.3, avgSpend: 3.9 },
};
