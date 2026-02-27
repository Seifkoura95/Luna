import React, { useState, useEffect } from 'react';
import { 
  X, User, Mail, Phone, Calendar, MapPin, CreditCard, Award, Gift, 
  TrendingUp, Clock, DollarSign, Gavel, Ticket, Plus, Minus, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import api from '../utils/api';

interface UserProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

const COLORS = ['#E31837', '#FFD700', '#10B981', '#3B82F6', '#8B5CF6'];

export default function UserProfileDrawer({ isOpen, onClose, userId }: UserProfileDrawerProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'spending' | 'activity'>('overview');
  const [pointsToAdd, setPointsToAdd] = useState(0);
  const [pointsReason, setPointsReason] = useState('');

  useEffect(() => {
    if (isOpen && userId) {
      fetchUser();
    }
  }, [isOpen, userId]);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/venue-admin/users/${userId}`);
      setUser(res.data);
    } catch (err) {
      console.error('Failed to fetch user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPoints = async () => {
    if (!pointsToAdd || !userId) return;
    try {
      await api.post(`/venue-admin/users/${userId}/add-points?points=${pointsToAdd}&reason=${encodeURIComponent(pointsReason || 'Manual adjustment')}`);
      fetchUser();
      setPointsToAdd(0);
      setPointsReason('');
    } catch (err) {
      console.error('Failed to add points:', err);
    }
  };

  if (!isOpen) return null;

  const analytics = user?.analytics || {};
  const history = user?.history || {};

  const spendingByCategory = Object.entries(analytics.spending_by_category || {}).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value
  }));

  const venueVisits = Object.entries(analytics.venue_visit_count || {}).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    visits: value
  }));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 modal-overlay"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 bottom-0 w-full max-w-2xl glass-heavy overflow-y-auto"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-[#E31837] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : user ? (
            <>
              {/* Header */}
              <div className="sticky top-0 z-10 p-6 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#E31837] to-[#B8142D] flex items-center justify-center text-2xl font-bold text-white">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{user.name}</h2>
                      <p className="text-sm text-gray-400">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                          user.subscription_tier === 'nova' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
                          user.subscription_tier === 'celestial' ? 'bg-[#FFD700]/20 text-[#FFD700]' :
                          user.subscription_tier === 'stellar' ? 'bg-gray-400/20 text-gray-300' :
                          'bg-amber-700/20 text-amber-500'
                        }`}>
                          {user.subscription_tier || 'Lunar'}
                        </span>
                        <span className="text-xs text-gray-500">
                          Member since {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3 mt-6">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <DollarSign className="w-4 h-4 text-[#FFD700] mb-1" />
                    <p className="text-lg font-bold text-white">${(analytics.total_spend || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Total Spend</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <Award className="w-4 h-4 text-[#E31837] mb-1" />
                    <p className="text-lg font-bold text-white">{(user.points_balance || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Points</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <MapPin className="w-4 h-4 text-green-400 mb-1" />
                    <p className="text-lg font-bold text-white">{analytics.total_visits || 0}</p>
                    <p className="text-xs text-gray-400">Visits</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <Gavel className="w-4 h-4 text-purple-400 mb-1" />
                    <p className="text-lg font-bold text-white">{analytics.auctions_won || 0}</p>
                    <p className="text-xs text-gray-400">Auctions Won</p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-4 p-1 bg-white/5 rounded-xl">
                  {(['overview', 'spending', 'activity'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === tab 
                          ? 'bg-[#E31837] text-white' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {activeTab === 'overview' && (
                  <>
                    {/* Contact Details */}
                    <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Contact Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-sm text-white">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Phone</p>
                            <p className="text-sm text-white">{user.phone || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Age</p>
                            <p className="text-sm text-white">{user.age || 'Not provided'} {user.date_of_birth ? `(${user.date_of_birth})` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Gender</p>
                            <p className="text-sm text-white capitalize">{user.gender || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 col-span-2">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Location</p>
                            <p className="text-sm text-white">{user.address ? `${user.address}, ` : ''}{user.city || 'Brisbane'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Favorite Venue */}
                    {analytics.favorite_venue && (
                      <div className="p-5 rounded-xl bg-gradient-to-r from-[#E31837]/10 to-transparent border border-[#E31837]/20">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-2">Favorite Venue</h3>
                        <p className="text-xl font-bold text-white capitalize">{analytics.favorite_venue.replace(/_/g, ' ')}</p>
                      </div>
                    )}

                    {/* Add Points */}
                    <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Adjust Points</h3>
                      <div className="flex gap-3">
                        <input
                          type="number"
                          value={pointsToAdd || ''}
                          onChange={(e) => setPointsToAdd(Number(e.target.value))}
                          placeholder="Points (+/-)"
                          className="flex-1 px-4 py-2.5 rounded-xl input-premium text-white"
                        />
                        <input
                          type="text"
                          value={pointsReason}
                          onChange={(e) => setPointsReason(e.target.value)}
                          placeholder="Reason (optional)"
                          className="flex-1 px-4 py-2.5 rounded-xl input-premium text-white"
                        />
                        <button
                          onClick={handleAddPoints}
                          disabled={!pointsToAdd}
                          className="px-4 py-2.5 btn-primary text-white rounded-xl font-medium disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Venue Visits Chart */}
                    {venueVisits.length > 0 && (
                      <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Venue Visits</h3>
                        <ResponsiveContainer width="100%" height={150}>
                          <BarChart data={venueVisits} layout="vertical">
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                            <Tooltip 
                              contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            />
                            <Bar dataKey="visits" fill="#E31837" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'spending' && (
                  <>
                    {/* Spending by Category */}
                    {spendingByCategory.length > 0 && (
                      <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Spending by Category</h3>
                        <div className="flex items-center gap-6">
                          <ResponsiveContainer width={150} height={150}>
                            <PieChart>
                              <Pie
                                data={spendingByCategory}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                dataKey="value"
                              >
                                {spendingByCategory.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex-1 space-y-2">
                            {spendingByCategory.map((cat, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                  <span className="text-sm text-gray-300">{cat.name}</span>
                                </div>
                                <span className="text-sm font-semibold text-white">${(cat.value as number).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recent Spending */}
                    <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Recent Transactions</h3>
                      <div className="space-y-2">
                        {(history.recent_spending || []).length > 0 ? (
                          history.recent_spending.map((s: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                              <div>
                                <p className="text-sm text-white capitalize">{s.category?.replace(/_/g, ' ') || 'Purchase'}</p>
                                <p className="text-xs text-gray-500">{new Date(s.created_at).toLocaleDateString()}</p>
                              </div>
                              <span className="text-sm font-semibold text-[#FFD700]">${s.amount?.toFixed(2)}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 py-4">No spending history</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'activity' && (
                  <>
                    {/* Recent Redemptions */}
                    <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
                        <Gift className="w-4 h-4 inline mr-2" />
                        Recent Redemptions
                      </h3>
                      <div className="space-y-2">
                        {(history.recent_redemptions || []).length > 0 ? (
                          history.recent_redemptions.map((r: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                              <div>
                                <p className="text-sm text-white">{r.reward_name}</p>
                                <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                r.status === 'redeemed' ? 'bg-green-500/20 text-green-400' :
                                r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {r.status}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 py-4">No redemptions</p>
                        )}
                      </div>
                    </div>

                    {/* Recent Bids */}
                    <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
                        <Gavel className="w-4 h-4 inline mr-2" />
                        Recent Bids
                      </h3>
                      <div className="space-y-2">
                        {(history.recent_bids || []).length > 0 ? (
                          history.recent_bids.map((b: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                              <div>
                                <p className="text-sm text-white">Auction #{b.auction_id}</p>
                                <p className="text-xs text-gray-500">{new Date(b.timestamp).toLocaleDateString()}</p>
                              </div>
                              <span className="text-sm font-semibold text-[#E31837]">${b.amount}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 py-4">No bids</p>
                        )}
                      </div>
                    </div>

                    {/* Points History */}
                    <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
                        <Award className="w-4 h-4 inline mr-2" />
                        Points History
                      </h3>
                      <div className="space-y-2">
                        {(history.recent_points || []).length > 0 ? (
                          history.recent_points.map((p: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                              <div>
                                <p className="text-sm text-white capitalize">{p.description || p.source?.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()}</p>
                              </div>
                              <span className={`text-sm font-semibold ${p.total_points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {p.total_points >= 0 ? '+' : ''}{p.total_points}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 py-4">No points history</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              User not found
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
