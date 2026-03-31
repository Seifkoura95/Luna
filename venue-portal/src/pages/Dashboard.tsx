import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, QrCode, Users, Gavel, Award, Bell, Settings, LogOut, 
  TrendingUp, TrendingDown, DollarSign, UserCheck, Gift, Clock, Download,
  ChevronRight, Search, Filter, RefreshCw, AlertTriangle, Crown, Zap,
  BarChart3, PieChart as PieChartIcon, Activity, Calendar, Menu, X, Plus, Edit, Eye
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../utils/api';
import { removeToken, getUser } from '../utils/auth';
import AuctionModal from '../components/AuctionModal';
import UserProfileDrawer from '../components/UserProfileDrawer';
import {
  mockRevenueData, mockHourlyData, mockPointsData, mockAuctionData,
  mockActivityFeed, mockTopSpenders, mockDemographics, mockVIPAlerts,
  mockWeeklyComparison
} from '../data/mockData';

interface DashboardProps {
  onLogout: () => void;
}

type TabType = 'overview' | 'scanner' | 'users' | 'revenue' | 'auctions' | 'points' | 'activity' | 'ai-insights';

const COLORS = {
  primary: '#E31837',
  secondary: '#FFD700',
  success: '#10B981',
  warning: '#F59E0B',
  muted: '#525252',
};

const CHART_COLORS = ['#E31837', '#FFD700', '#FFFFFF', '#525252', '#10B981'];

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-sm p-3 border border-white/10">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' && entry.name.toLowerCase().includes('revenue') 
              ? `$${entry.value.toLocaleString()}` 
              : entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard({ onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const user = getUser();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  
  // API Data State
  const [revenueData, setRevenueData] = useState<any>(null);
  const [checkinsData, setCheckinsData] = useState<any>(null);
  const [demographicsData, setDemographicsData] = useState<any>(null);
  const [auctionsData, setAuctionsData] = useState<any>(null);
  const [pointsData, setPointsData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any>(null);
  const [topSpendersData, setTopSpendersData] = useState<any>(null);
  const [vipAlertsData, setVipAlertsData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  
  // Auction Management State
  const [auctionModalOpen, setAuctionModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [auctionsList, setAuctionsList] = useState<any[]>([]);
  
  // User Profile State
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [usersListData, setUsersListData] = useState<any>({ users: [], total: 0 });
  const [usersSearch, setUsersSearch] = useState('');
  
  // Fetch analytics data on mount and when period changes
  useEffect(() => {
    const fetchAllData = async () => {
      setDataLoading(true);
      try {
        const [revenue, checkins, demographics, auctions, points, activity, topSpenders, vipAlerts] = await Promise.all([
          api.get(`/venue/analytics/revenue?period=${period}`).catch(() => ({ data: null })),
          api.get(`/venue/analytics/checkins?period=${period}`).catch(() => ({ data: null })),
          api.get('/venue/analytics/demographics').catch(() => ({ data: null })),
          api.get(`/venue/analytics/auctions?period=${period}`).catch(() => ({ data: null })),
          api.get(`/venue/analytics/points?period=${period}`).catch(() => ({ data: null })),
          api.get('/venue/analytics/activity?limit=50').catch(() => ({ data: null })),
          api.get(`/venue/analytics/top-spenders?period=${period}`).catch(() => ({ data: null })),
          api.get('/venue/analytics/vip-alerts').catch(() => ({ data: null })),
        ]);
        
        setRevenueData(revenue.data);
        setCheckinsData(checkins.data);
        setDemographicsData(demographics.data);
        setAuctionsData(auctions.data);
        setPointsData(points.data);
        setActivityData(activity.data);
        setTopSpendersData(topSpenders.data);
        setVipAlertsData(vipAlerts.data);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setDataLoading(false);
      }
    };
    
    fetchAllData();
  }, [period]);
  
  // Fetch auctions for management
  const fetchAuctions = async () => {
    try {
      const res = await api.get('/venue-admin/auctions');
      setAuctionsList(res.data || []);
    } catch (error) {
      console.error('Error fetching auctions:', error);
    }
  };
  
  // Fetch users for management
  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (usersSearch) params.append('search', usersSearch);
      const res = await api.get(`/venue-admin/users?${params.toString()}`);
      setUsersListData(res.data || { users: [], total: 0 });
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };
  
  // Fetch auctions and users when switching to those tabs
  useEffect(() => {
    if (activeTab === 'auctions') {
      fetchAuctions();
    } else if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, usersSearch]);
  
  // Helper functions to get data with fallback to mock
  const getRevenueStats = () => {
    if (revenueData) {
      return {
        revenue: revenueData.combined_revenue || revenueData.total_revenue || 0,
        avgSpend: revenueData.average_spend_per_customer || 0,
        transactions: revenueData.total_transactions || 0
      };
    }
    return {
      revenue: mockWeeklyComparison.thisWeek.revenue,
      avgSpend: mockWeeklyComparison.thisWeek.avgSpend,
      transactions: 2847
    };
  };
  
  const getCheckinsStats = () => {
    if (checkinsData) {
      return {
        total: checkinsData.total_checkins || 0,
        unique: checkinsData.unique_visitors || 0,
        hourlyData: checkinsData.peak_hours ? checkinsData.peak_hours.map((h: any) => ({
          hour: `${h[0]}:00`,
          checkins: h[1]
        })) : mockHourlyData
      };
    }
    return {
      total: mockWeeklyComparison.thisWeek.checkins,
      unique: 890,
      hourlyData: mockHourlyData
    };
  };
  
  const getTopSpenders = () => {
    if (topSpendersData?.top_spenders?.length) {
      return topSpendersData.top_spenders;
    }
    return mockTopSpenders;
  };
  
  const getActivityFeed = () => {
    if (activityData?.activities?.length) {
      return activityData.activities.map((a: any, idx: number) => ({
        id: idx,
        ...a
      }));
    }
    return mockActivityFeed;
  };
  
  const getVIPAlerts = () => {
    if (vipAlertsData?.alerts?.length) {
      return vipAlertsData.alerts;
    }
    return mockVIPAlerts;
  };
  
  const getAuctions = () => {
    if (auctionsData?.live_auctions?.length) {
      return auctionsData.live_auctions;
    }
    return mockAuctionData;
  };
  
  const getPointsStats = () => {
    if (pointsData) {
      return {
        issued: pointsData.points_issued || 0,
        redeemed: pointsData.points_redeemed || 0,
        expired: pointsData.points_expired || 0,
        redemptionRate: pointsData.redemption_rate || 0,
        topEarners: pointsData.top_earners || []
      };
    }
    return {
      issued: mockPointsData[0].value,
      redeemed: mockPointsData[1].value,
      expired: mockPointsData[2].value,
      redemptionRate: 71,
      topEarners: mockTopSpenders.map(s => ({ ...s, points: s.spent * 10 }))
    };
  };
  
  const getDemographics = () => {
    if (demographicsData) {
      const tiers = demographicsData.membership_tiers || {};
      return {
        ageGroups: Object.entries(demographicsData.age_distribution || {}).map(([range, count]) => ({
          range,
          percentage: Math.round((count as number) / Math.max(demographicsData.total_customers || 1, 1) * 100)
        })),
        membershipTiers: [
          { tier: 'Lunar', count: tiers.lunar || 0, color: '#CD7F32' },
          { tier: 'Stellar', count: tiers.stellar || 0, color: '#C0C0C0' },
          { tier: 'Celestial', count: tiers.celestial || 0, color: '#FFD700' },
          { tier: 'Nova', count: tiers.nova || 0, color: '#E5E4E2' },
        ]
      };
    }
    return mockDemographics;
  };

  const handleLogout = () => {
    // Clear all stored data first
    removeToken();
    // Then notify parent to update auth state
    onLogout();
    // Force navigation to login
    window.location.href = '/api/venue-portal/login';
  };

  // QR Scanner setup
  useEffect(() => {
    if (activeTab === 'scanner' && !scannerRef.current) {
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        
        scanner.render(
          (decodedText) => {
            setScanResult({ success: true, data: decodedText, time: new Date().toLocaleTimeString() });
            // Here you would call your API to validate the QR code
          },
          (error) => {
            // Scan error - usually just means no QR code in view
          }
        );
        
        scannerRef.current = scanner;
        setScannerActive(true);
      }, 100);
    }
    
    return () => {
      if (scannerRef.current && activeTab !== 'scanner') {
        scannerRef.current.clear();
        scannerRef.current = null;
        setScannerActive(false);
      }
    };
  }, [activeTab]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'scanner', label: 'QR Scanner', icon: QrCode },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'auctions', label: 'Auctions', icon: Gavel },
    { id: 'points', label: 'Points', icon: Award },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'ai-insights', label: 'AI Insights', icon: Zap },
  ];

  const StatCard = ({ title, value, subtext, icon: Icon, trend, trendValue }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="stat-card bg-card border border-border/50 rounded-sm p-5 relative overflow-hidden group"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{title}</span>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="text-3xl font-heading font-black text-white mb-1">{value}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{subtext}</span>
          {trend && (
            <span className={`flex items-center text-xs font-medium ${trend === 'up' ? 'text-success' : 'text-primary'}`}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {trendValue}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );

  const VIPAlert = ({ alert }: { alert: any }) => (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 bg-secondary/10 border border-secondary/30 rounded-sm"
    >
      <div className="relative">
        <img src={alert.avatar} alt={alert.name} className="w-10 h-10 rounded-full object-cover" />
        <Crown className="absolute -top-1 -right-1 w-4 h-4 text-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{alert.name}</p>
        <p className="text-xs text-secondary">Lifetime: ${alert.totalSpend.toLocaleString()}</p>
      </div>
      <span className={`px-2 py-1 text-xs font-medium rounded-sm ${
        alert.status === 'arriving' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
      }`}>
        {alert.status.toUpperCase()}
      </span>
    </motion.div>
  );

  const ActivityItem = ({ item }: { item: any }) => {
    const typeColors: any = {
      checkin: 'bg-success',
      redemption: 'bg-secondary',
      purchase: 'bg-primary',
      bid: 'bg-purple-500',
      vip_arrival: 'bg-secondary',
    };
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 p-3 bg-surface-highlight/50 rounded-sm border border-border/30 hover:border-border/60 transition-colors"
      >
        <div className="relative">
          <img src={item.avatar} alt={item.user} className="w-9 h-9 rounded-full object-cover" />
          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${typeColors[item.type]} border-2 border-background`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">
            <span className="font-semibold">{item.user}</span>
            <span className="text-muted-foreground"> {item.action}</span>
          </p>
          <p className="text-xs text-muted-foreground">{item.time}</p>
        </div>
        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-sm ${
          item.tier === 'platinum' ? 'bg-white/10 text-white' :
          item.tier === 'gold' ? 'bg-secondary/20 text-secondary' :
          item.tier === 'silver' ? 'bg-gray-400/20 text-gray-300' :
          'bg-amber-700/20 text-amber-600'
        }`}>
          {item.tier}
        </span>
      </motion.div>
    );
  };

  const renderOverview = () => {
    const revenueStats = getRevenueStats();
    const checkinsStats = getCheckinsStats();
    const vipAlerts = getVIPAlerts();
    const auctions = getAuctions();
    const activityFeed = getActivityFeed();
    const topSpenders = getTopSpenders();
    
    return (
    <div className="space-y-6">
      {/* VIP Alerts Banner */}
      {vipAlerts.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-gradient-to-r from-secondary/10 via-secondary/5 to-transparent border border-secondary/30 rounded-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-secondary" />
            <span className="text-sm font-semibold text-secondary uppercase tracking-wider">VIP Alerts</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {vipAlerts.map((alert: any) => <VIPAlert key={alert.id} alert={alert} />)}
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Revenue" 
          value={`$${revenueStats.revenue.toLocaleString()}`}
          subtext={`This ${period}`}
          icon={DollarSign}
          trend="up"
          trendValue={11.5}
        />
        <StatCard 
          title="Check-ins" 
          value={checkinsStats.total.toLocaleString()}
          subtext={`This ${period}`}
          icon={UserCheck}
          trend="up"
          trendValue={7.3}
        />
        <StatCard 
          title="Avg Spend" 
          value={`$${revenueStats.avgSpend.toFixed(2)}`}
          subtext="Per customer"
          icon={TrendingUp}
          trend="up"
          trendValue={3.9}
        />
        <StatCard 
          title="Active Auctions" 
          value={auctions.filter((a: any) => a.status === 'live' || a.status === 'ending').length}
          subtext={`${auctionsData?.total_bids || auctions.reduce((acc: number, a: any) => acc + (a.bids || 0), 0)} total bids`}
          icon={Gavel}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Trend */}
        <div className="bg-card border border-border/50 rounded-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Revenue Trend</h3>
            <span className="text-xs text-muted-foreground">vs Last Week</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={mockRevenueData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="date" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#525252" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="lastWeek" stroke="#525252" strokeWidth={1} fill="transparent" strokeDasharray="4 4" name="Last Week" />
              <Area type="monotone" dataKey="revenue" stroke={COLORS.primary} strokeWidth={2} fill="url(#revenueGradient)" name="This Week" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Hours Heatmap */}
        <div className="bg-card border border-border/50 rounded-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Peak Hours</h3>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={checkinsStats.hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="hour" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="checkins" fill={COLORS.secondary} radius={[2, 2, 0, 0]} name="Check-ins" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Activity Feed */}
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Live Activity</h3>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-success">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                Live
              </span>
            </div>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {activityFeed.map((item: any) => <ActivityItem key={item.id} item={item} />)}
          </div>
        </div>

        {/* Top Spenders */}
        <div className="bg-card border border-border/50 rounded-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Top Spenders</h3>
            <Crown className="w-4 h-4 text-secondary" />
          </div>
          <div className="space-y-3">
            {topSpenders.slice(0, 5).map((spender: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-4">{idx + 1}</span>
                <img src={spender.avatar} alt={spender.name} className="w-8 h-8 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{spender.name}</p>
                  <p className="text-xs text-muted-foreground">{spender.visits} visits</p>
                </div>
                <span className="text-sm font-semibold text-secondary">${spender.spent.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );};

  const renderScanner = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card border border-border/50 rounded-sm p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <QrCode className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-heading font-bold text-white mb-2">QR Code Scanner</h2>
          <p className="text-sm text-muted-foreground">Scan customer check-in codes or reward redemptions</p>
        </div>
        
        <div id="qr-reader" className="mb-6 rounded-sm overflow-hidden" style={{ minHeight: 300 }} />
        
        {scanResult && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-4 rounded-sm border ${
              scanResult.success 
                ? 'bg-success/10 border-success/30' 
                : 'bg-primary/10 border-primary/30'
            }`}
          >
            <div className="flex items-center gap-3">
              {scanResult.success ? (
                <UserCheck className="w-6 h-6 text-success" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-primary" />
              )}
              <div>
                <p className="font-semibold text-white">
                  {scanResult.success ? 'Code Scanned Successfully' : 'Invalid Code'}
                </p>
                <p className="text-xs text-muted-foreground font-mono">{scanResult.data}</p>
                <p className="text-xs text-muted-foreground mt-1">Scanned at {scanResult.time}</p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button 
            data-testid="scan-checkin-btn"
            className="flex items-center justify-center gap-2 p-4 bg-surface-highlight border border-border/50 rounded-sm hover:border-primary/50 transition-colors"
          >
            <UserCheck className="w-5 h-5 text-success" />
            <span className="text-sm font-medium">Check-in</span>
          </button>
          <button 
            data-testid="scan-redemption-btn"
            className="flex items-center justify-center gap-2 p-4 bg-surface-highlight border border-border/50 rounded-sm hover:border-secondary/50 transition-colors"
          >
            <Gift className="w-5 h-5 text-secondary" />
            <span className="text-sm font-medium">Redemption</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      {/* User Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={usersListData.total.toLocaleString()} subtext="All time" icon={Users} />
        <StatCard title="Active Today" value="847" subtext="+12% vs yesterday" icon={UserCheck} trend="up" trendValue={12} />
        <StatCard title="New This Week" value="156" subtext="Signups" icon={TrendingUp} trend="up" trendValue={8} />
        <StatCard title="Retention" value="78%" subtext="30-day retention" icon={RefreshCw} />
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users by name, email, or phone..."
            value={usersSearch}
            onChange={(e) => setUsersSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-highlight border border-border rounded-lg text-white text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <button 
          data-testid="export-users-btn"
          className="flex items-center gap-2 px-4 py-2.5 text-sm border border-border hover:border-primary/50 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Users Table */}
      <div className="glass-card rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full table-premium">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">User</th>
                <th className="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Contact</th>
                <th className="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Tier</th>
                <th className="text-right py-4 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Points</th>
                <th className="text-right py-4 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Total Spend</th>
                <th className="text-center py-4 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersListData.users.map((user: any, idx: number) => (
                <tr 
                  key={user.user_id || idx} 
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedUserId(user.user_id);
                    setUserDrawerOpen(true);
                  }}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E31837] to-[#B8142D] flex items-center justify-center text-sm font-bold text-white">
                        {user.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{user.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">Since {new Date(user.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-sm text-gray-300">{user.email}</p>
                    <p className="text-xs text-gray-500">{user.phone || 'No phone'}</p>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded ${
                      user.subscription_tier === 'nova' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
                      user.subscription_tier === 'celestial' ? 'bg-[#FFD700]/20 text-[#FFD700]' :
                      user.subscription_tier === 'stellar' ? 'bg-gray-400/20 text-gray-300' :
                      'bg-amber-700/20 text-amber-500'
                    }`}>
                      {user.subscription_tier || 'Lunar'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-semibold text-[#E31837]">{(user.points_balance || 0).toLocaleString()}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-semibold text-[#FFD700]">${(user.total_spend || 0).toLocaleString()}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button 
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUserId(user.user_id);
                        setUserDrawerOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                  </td>
                </tr>
              ))}
              {usersListData.users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
          <p className="text-sm text-gray-500">Showing {usersListData.users.length} of {usersListData.total} users</p>
        </div>
      </div>
    </div>
  );

  const renderRevenue = () => (
    <div className="space-y-6">
      {/* Revenue Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Revenue" 
          value={`$${mockWeeklyComparison.thisWeek.revenue.toLocaleString()}`}
          subtext="This week"
          icon={DollarSign}
          trend="up"
          trendValue={mockWeeklyComparison.change.revenue}
        />
        <StatCard title="Transactions" value="2,847" subtext="This week" icon={Activity} />
        <StatCard 
          title="Avg Transaction" 
          value={`$${mockWeeklyComparison.thisWeek.avgSpend.toFixed(2)}`}
          subtext="Per transaction"
          icon={TrendingUp}
          trend="up"
          trendValue={mockWeeklyComparison.change.avgSpend}
        />
        <StatCard title="Refunds" value="$1,240" subtext="3 transactions" icon={RefreshCw} />
      </div>

      {/* Revenue Chart */}
      <div className="bg-card border border-border/50 rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Revenue Comparison</h3>
          <div className="flex items-center gap-2">
            <button 
              data-testid="export-revenue-btn"
              className="flex items-center gap-2 px-3 py-1.5 text-xs border border-border hover:border-primary/50 rounded-sm transition-colors"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={mockRevenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="date" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#525252" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke={COLORS.primary} strokeWidth={2} dot={{ fill: COLORS.primary, r: 4 }} name="This Week Revenue" />
            <Line type="monotone" dataKey="lastWeek" stroke={COLORS.muted} strokeWidth={2} strokeDasharray="4 4" dot={{ fill: COLORS.muted, r: 3 }} name="Last Week Revenue" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border/50 rounded-sm p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">This Week vs Last Week</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-heading font-black text-white">
              ${mockWeeklyComparison.thisWeek.revenue.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">
              vs ${mockWeeklyComparison.lastWeek.revenue.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-2 text-success text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>+{mockWeeklyComparison.change.revenue}% increase</span>
          </div>
        </div>
        <div className="bg-card border border-border/50 rounded-sm p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Best Day</div>
          <div className="text-2xl font-heading font-black text-secondary">Saturday</div>
          <div className="text-sm text-muted-foreground mt-1">$45,600 revenue</div>
        </div>
        <div className="bg-card border border-border/50 rounded-sm p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Peak Hour</div>
          <div className="text-2xl font-heading font-black text-white">11PM - 12AM</div>
          <div className="text-sm text-muted-foreground mt-1">156 transactions</div>
        </div>
      </div>
    </div>
  );

  const renderAuctions = () => (
    <div className="space-y-6">
      {/* Auction Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Live Auctions" value={auctionsList.filter(a => a.status === 'active').length} subtext="Currently active" icon={Gavel} />
        <StatCard title="Total Bids" value={auctionsList.reduce((acc, a) => acc + (a.total_bids || 0), 0)} subtext="All auctions" icon={Zap} />
        <StatCard title="Revenue" value={`$${auctionsList.reduce((acc, a) => acc + (a.current_bid || 0), 0).toLocaleString()}`} subtext="Current bids" icon={DollarSign} />
        <StatCard title="Draft Auctions" value={auctionsList.filter(a => a.status === 'draft').length} subtext="Ready to publish" icon={Clock} />
      </div>

      {/* Create New Auction Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Auction Management</h3>
        <button
          onClick={() => {
            setSelectedAuction(null);
            setAuctionModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 btn-primary text-white rounded-xl font-medium"
          data-testid="create-auction-btn"
        >
          <Plus className="w-4 h-4" />
          Create Auction
        </button>
      </div>

      {/* Auctions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {auctionsList.map((auction) => (
          <motion.div 
            key={auction.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-card rounded-xl overflow-hidden ${
              auction.status === 'active' ? 'border-green-500/30' : 
              auction.status === 'draft' ? 'border-yellow-500/30' : 'border-white/10'
            }`}
          >
            {/* Auction Image */}
            <div className="relative h-40 bg-gradient-to-br from-surface to-black">
              {auction.image_url && (
                <img src={auction.image_url} alt={auction.title} className="w-full h-full object-cover opacity-80" />
              )}
              <div className="absolute top-3 right-3">
                <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded ${
                  auction.status === 'active' ? 'badge-live' : 
                  auction.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                  auction.status === 'ended' ? 'bg-gray-500/20 text-gray-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {auction.status === 'active' ? 'LIVE' : auction.status?.toUpperCase()}
                </span>
              </div>
              {auction.status === 'active' && auction.end_time && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 bg-black/60 rounded text-xs text-white">
                  <Clock className="w-3 h-3" />
                  {(() => {
                    const end = new Date(auction.end_time);
                    const now = new Date();
                    const diff = end.getTime() - now.getTime();
                    if (diff <= 0) return 'Ended';
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
                  })()}
                </div>
              )}
            </div>

            {/* Auction Details */}
            <div className="p-4">
              <p className="font-mono text-xs text-gray-500 mb-1">#{auction.id}</p>
              <h4 className="font-semibold text-white mb-2">{auction.title}</h4>
              <p className="text-xs text-gray-400 mb-3 capitalize">{auction.venue_name}</p>
              
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500">Current Bid</p>
                  <p className="text-2xl font-bold text-[#FFD700]">${(auction.current_bid || auction.starting_bid || 0).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{auction.total_bids || 0} bids</p>
                  <p className="text-xs text-gray-400">Min: ${auction.min_increment}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedAuction(auction);
                    setAuctionModalOpen(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Edit className="w-3 h-3" />
                  Edit
                </button>
                {auction.status === 'draft' && (
                  <button
                    onClick={async () => {
                      await api.post(`/venue-admin/auctions/${auction.id}/publish`);
                      fetchAuctions();
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    Publish
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        
        {/* Empty State */}
        {auctionsList.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <Gavel className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No auctions yet</p>
            <button
              onClick={() => {
                setSelectedAuction(null);
                setAuctionModalOpen(true);
              }}
              className="px-4 py-2 btn-primary text-white rounded-xl font-medium"
            >
              Create Your First Auction
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderPoints = () => (
    <div className="space-y-6">
      {/* Points Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Points Issued" value="45,600" subtext="This week" icon={Award} trend="up" trendValue={12} />
        <StatCard title="Points Redeemed" value="32,400" subtext="This week" icon={Gift} />
        <StatCard title="Redemption Rate" value="71%" subtext="Of issued points" icon={TrendingUp} trend="up" trendValue={3} />
        <StatCard title="Expired" value="5,200" subtext="Points lost" icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Points Distribution */}
        <div className="bg-card border border-border/50 rounded-sm p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Points Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={mockPointsData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                nameKey="name"
              >
                {mockPointsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4">
            {mockPointsData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[idx] }} />
                <span className="text-xs text-muted-foreground">{item.name}: {item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Earners */}
        <div className="bg-card border border-border/50 rounded-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Top Point Earners</h3>
            <Award className="w-4 h-4 text-secondary" />
          </div>
          <div className="space-y-3">
            {mockTopSpenders.map((user, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-surface-highlight/30 rounded-sm">
                <span className="text-lg font-heading font-black text-secondary w-6">{idx + 1}</span>
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.visits} visits</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-secondary">{(user.spent * 10).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">points</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderActivity = () => (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text"
            placeholder="Search activity..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-sm text-sm focus:border-primary/50 focus:outline-none"
            data-testid="activity-search"
          />
        </div>
        <button 
          data-testid="activity-filter-btn"
          className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-sm text-sm hover:border-primary/50 transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filter
        </button>
        <button 
          data-testid="activity-export-btn"
          className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-sm text-sm hover:border-primary/50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Activity Feed */}
      <div className="bg-card border border-border/50 rounded-sm">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Real-time Activity Feed</h3>
          <span className="flex items-center gap-1 text-xs text-success">
            <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
            Live Updates
          </span>
        </div>
        <div className="divide-y divide-border/30">
          {[...mockActivityFeed, ...mockActivityFeed].map((item, idx) => (
            <motion.div 
              key={`${item.id}-${idx}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-4 p-4 hover:bg-surface-highlight/30 transition-colors"
            >
              <img src={item.avatar} alt={item.user} className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  <span className="font-semibold">{item.user}</span>
                  <span className="text-muted-foreground"> {item.action}</span>
                </p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
              <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-sm ${
                item.tier === 'platinum' ? 'bg-white/10 text-white' :
                item.tier === 'gold' ? 'bg-secondary/20 text-secondary' :
                item.tier === 'silver' ? 'bg-gray-400/20 text-gray-300' :
                'bg-amber-700/20 text-amber-600'
              }`}>
                {item.tier}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'scanner': return renderScanner();
      case 'users': return renderUsers();
      case 'revenue': return renderRevenue();
      case 'auctions': return renderAuctions();
      case 'points': return renderPoints();
      case 'activity': return renderActivity();
      case 'ai-insights': return renderAIInsights();
      default: return renderOverview();
    }
  };

  // AI Insights Tab
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiChatMessages, setAiChatMessages] = useState<Array<{role: string, content: string}>>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    
    const userMessage = aiInput.trim();
    setAiInput('');
    setAiChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiLoading(true);
    
    try {
      const response = await api.post('/ai/chat', { 
        message: `As a venue manager for Luna Group, I need help with: ${userMessage}`,
        session_id: `venue-${user?.venue_id || 'dashboard'}`
      });
      setAiChatMessages(prev => [...prev, { role: 'ai', content: response.data.response }]);
    } catch (error) {
      setAiChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I couldn\'t process your request. Please try again.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  const renderAIInsights = () => (
    <div className="space-y-6">
      {/* AI Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-white">Luna AI Insights</h3>
          <p className="text-sm text-muted-foreground">Powered by Claude AI for venue intelligence</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Chat */}
        <div className="bg-card border border-border/50 rounded-sm p-6">
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Ask Luna AI
          </h4>
          
          <div className="h-80 overflow-y-auto mb-4 space-y-3 bg-surface rounded-sm p-4">
            {aiChatMessages.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">
                Ask me about venue performance, customer trends, or get recommendations...
              </p>
            )}
            {aiChatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary/20 border border-primary/30 text-white' 
                    : 'bg-surface-highlight border border-border/50 text-white'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-surface-highlight border border-border/50 p-3 rounded-sm">
                  <p className="text-sm text-muted-foreground animate-pulse">Luna is thinking...</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendAiMessage()}
              placeholder="Ask about revenue trends, customer insights..."
              className="flex-1 px-4 py-2 bg-surface border border-border rounded-sm text-sm focus:border-primary/50 focus:outline-none text-white"
              data-testid="ai-chat-input"
            />
            <button
              onClick={sendAiMessage}
              disabled={aiLoading || !aiInput.trim()}
              className="px-4 py-2 bg-primary hover:bg-primary/80 disabled:bg-primary/30 text-white rounded-sm transition-colors"
              data-testid="ai-send-btn"
            >
              Send
            </button>
          </div>
        </div>

        {/* Quick Insights */}
        <div className="space-y-4">
          <div className="bg-card border border-border/50 rounded-sm p-6">
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" />
              Quick Actions
            </h4>
            <div className="space-y-2">
              {[
                { q: "What's our peak hours analysis?", icon: Clock },
                { q: "Show me at-risk VIP customers", icon: AlertTriangle },
                { q: "Revenue optimization suggestions", icon: DollarSign },
                { q: "Top performing promotions", icon: Award },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => { setAiInput(item.q); sendAiMessage(); }}
                  className="w-full flex items-center gap-3 p-3 bg-surface-highlight hover:bg-surface border border-border/50 hover:border-primary/30 rounded-sm transition-all text-left"
                  data-testid={`quick-insight-${idx}`}
                >
                  <item.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">{item.q}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Capabilities */}
          <div className="bg-card border border-border/50 rounded-sm p-6">
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-secondary" />
              AI Capabilities
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Churn Prediction', status: 'Active', color: 'text-success' },
                { label: 'Smart Missions', status: 'Active', color: 'text-success' },
                { label: 'Bid Nudging', status: 'Active', color: 'text-success' },
                { label: 'Photo Captions', status: 'Active', color: 'text-success' },
              ].map((cap, idx) => (
                <div key={idx} className="p-3 bg-surface rounded-sm border border-border/50">
                  <p className="text-xs text-muted-foreground">{cap.label}</p>
                  <p className={`text-sm font-semibold ${cap.color}`}>{cap.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Noise overlay */}
      <div className="noise-overlay" />
      
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-heading font-bold text-lg text-white tracking-tight">LUNA PORTAL</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{user?.venue_id || 'All Venues'}</p>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-white/5 rounded-sm"
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.nav 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden fixed top-14 left-0 right-0 z-40 glass border-b border-white/5 p-4"
          >
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as TabType); setMobileMenuOpen(false); }}
                  data-testid={`mobile-nav-${item.id}`}
                  className={`flex items-center gap-2 p-3 rounded-sm transition-colors ${
                    activeTab === item.id 
                      ? 'bg-primary/10 border border-primary/30 text-primary' 
                      : 'bg-surface-highlight border border-border/50 text-muted-foreground hover:text-white'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
            <button 
              onClick={handleLogout}
              data-testid="mobile-logout-btn"
              className="w-full mt-3 flex items-center justify-center gap-2 p-3 border border-primary/50 text-primary rounded-sm hover:bg-primary/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-card border-r border-border/50 z-40">
        <div className="p-6 border-b border-border/50">
          <h1 className="font-heading font-black text-xl text-white tracking-tight">LUNA VENUE</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Analytics Portal</p>
        </div>
        
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3 p-3 bg-surface-highlight rounded-sm">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="font-heading font-bold text-primary">{user?.name?.charAt(0) || 'V'}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{user?.name || 'Venue Manager'}</p>
              <p className="text-xs text-muted-foreground uppercase">{user?.venue_id || 'All Venues'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as TabType)}
              data-testid={`nav-${item.id}`}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm transition-all ${
                activeTab === item.id 
                  ? 'bg-primary/10 border-l-2 border-primary text-white' 
                  : 'text-muted-foreground hover:text-white hover:bg-surface-highlight'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
              {item.id === 'scanner' && (
                <span className="ml-auto w-2 h-2 bg-success rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border/50">
          <button 
            onClick={handleLogout}
            data-testid="logout-btn"
            className="w-full flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-primary rounded-sm transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-border/50 glass sticky top-0 z-30">
          <div>
            <h2 className="font-heading font-bold text-xl text-white capitalize">{activeTab}</h2>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              data-testid="period-select"
              className="px-4 py-2 bg-surface border border-border rounded-sm text-sm focus:border-primary/50 focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
            <button 
              data-testid="refresh-btn"
              className="p-2 hover:bg-surface-highlight rounded-sm transition-colors"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      
      {/* Auction Modal */}
      <AuctionModal
        isOpen={auctionModalOpen}
        onClose={() => {
          setAuctionModalOpen(false);
          setSelectedAuction(null);
        }}
        auction={selectedAuction}
        onSuccess={() => {
          fetchAuctions();
        }}
      />
      
      {/* User Profile Drawer */}
      <UserProfileDrawer
        isOpen={userDrawerOpen}
        onClose={() => {
          setUserDrawerOpen(false);
          setSelectedUserId(null);
        }}
        userId={selectedUserId}
      />
    </div>
  );
}
