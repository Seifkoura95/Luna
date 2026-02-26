import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, QrCode, Users, Gavel, Award, Bell, Settings, LogOut, 
  TrendingUp, TrendingDown, DollarSign, UserCheck, Gift, Clock, Download,
  ChevronRight, Search, Filter, RefreshCw, AlertTriangle, Crown, Zap,
  BarChart3, PieChart as PieChartIcon, Activity, Calendar, Menu, X
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../utils/api';
import { removeToken, getUser } from '../utils/auth';
import {
  mockRevenueData, mockHourlyData, mockPointsData, mockAuctionData,
  mockActivityFeed, mockTopSpenders, mockDemographics, mockVIPAlerts,
  mockWeeklyComparison
} from '../data/mockData';

interface DashboardProps {
  onLogout: () => void;
}

type TabType = 'overview' | 'scanner' | 'users' | 'revenue' | 'auctions' | 'points' | 'activity';

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

  const handleLogout = () => {
    removeToken();
    onLogout();
    navigate('/login');
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

  const renderOverview = () => (
    <div className="space-y-6">
      {/* VIP Alerts Banner */}
      {mockVIPAlerts.length > 0 && (
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
            {mockVIPAlerts.map(alert => <VIPAlert key={alert.id} alert={alert} />)}
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Revenue" 
          value={`$${mockWeeklyComparison.thisWeek.revenue.toLocaleString()}`}
          subtext="This week"
          icon={DollarSign}
          trend="up"
          trendValue={mockWeeklyComparison.change.revenue}
        />
        <StatCard 
          title="Check-ins" 
          value={mockWeeklyComparison.thisWeek.checkins.toLocaleString()}
          subtext="This week"
          icon={UserCheck}
          trend="up"
          trendValue={mockWeeklyComparison.change.checkins}
        />
        <StatCard 
          title="Avg Spend" 
          value={`$${mockWeeklyComparison.thisWeek.avgSpend.toFixed(2)}`}
          subtext="Per customer"
          icon={TrendingUp}
          trend="up"
          trendValue={mockWeeklyComparison.change.avgSpend}
        />
        <StatCard 
          title="Active Auctions" 
          value={mockAuctionData.filter(a => a.status === 'live').length}
          subtext={`${mockAuctionData.reduce((acc, a) => acc + a.bids, 0)} total bids`}
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
            <BarChart data={mockHourlyData}>
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
            {mockActivityFeed.map(item => <ActivityItem key={item.id} item={item} />)}
          </div>
        </div>

        {/* Top Spenders */}
        <div className="bg-card border border-border/50 rounded-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Top Spenders</h3>
            <Crown className="w-4 h-4 text-secondary" />
          </div>
          <div className="space-y-3">
            {mockTopSpenders.slice(0, 5).map((spender, idx) => (
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
  );

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
        <StatCard title="Total Users" value="2,335" subtext="All time" icon={Users} />
        <StatCard title="Active Today" value="847" subtext="+12% vs yesterday" icon={UserCheck} trend="up" trendValue={12} />
        <StatCard title="New This Week" value="156" subtext="Signups" icon={TrendingUp} trend="up" trendValue={8} />
        <StatCard title="Retention" value="78%" subtext="30-day retention" icon={RefreshCw} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Demographics */}
        <div className="bg-card border border-border/50 rounded-sm p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Age Demographics</h3>
          <div className="space-y-3">
            {mockDemographics.ageGroups.map((group, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{group.range}</span>
                  <span className="font-semibold text-white">{group.percentage}%</span>
                </div>
                <div className="h-2 bg-surface-highlight rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${group.percentage}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.1 }}
                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Membership Tiers */}
        <div className="bg-card border border-border/50 rounded-sm p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Membership Tiers</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={mockDemographics.membershipTiers}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="count"
                nameKey="tier"
              >
                {mockDemographics.membershipTiers.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {mockDemographics.membershipTiers.map((tier, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }} />
                <span className="text-xs text-muted-foreground">{tier.tier}: {tier.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Visitors Table */}
      <div className="bg-card border border-border/50 rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Top Visitors</h3>
          <button 
            data-testid="export-users-btn"
            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-border hover:border-primary/50 rounded-sm transition-colors"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tier</th>
                <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visits</th>
                <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Spend</th>
              </tr>
            </thead>
            <tbody>
              {mockTopSpenders.map((user, idx) => (
                <tr key={idx} className="border-b border-border/30 hover:bg-surface-highlight/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                      <span className="text-sm font-medium text-white">{user.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-sm ${
                      user.tier === 'platinum' ? 'bg-white/10 text-white' :
                      user.tier === 'gold' ? 'bg-secondary/20 text-secondary' :
                      'bg-gray-400/20 text-gray-300'
                    }`}>
                      {user.tier}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-muted-foreground">{user.visits}</td>
                  <td className="py-3 px-4 text-right text-sm font-semibold text-secondary">${user.spent.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <StatCard title="Live Auctions" value={mockAuctionData.filter(a => a.status === 'live').length} subtext="Currently active" icon={Gavel} />
        <StatCard title="Total Bids" value={mockAuctionData.reduce((acc, a) => acc + a.bids, 0)} subtext="This week" icon={Zap} />
        <StatCard title="Revenue" value={`$${mockAuctionData.reduce((acc, a) => acc + a.currentBid, 0).toLocaleString()}`} subtext="Current bids" icon={DollarSign} />
        <StatCard title="Conversion" value="68%" subtext="Winning bids" icon={TrendingUp} trend="up" trendValue={5} />
      </div>

      {/* Live Auctions */}
      <div className="bg-card border border-border/50 rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Live Auctions</h3>
          <span className="flex items-center gap-1 text-xs text-success">
            <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockAuctionData.map((auction) => (
            <motion.div 
              key={auction.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 bg-surface-highlight border rounded-sm ${
                auction.status === 'ending' ? 'border-primary/50 shadow-glow-red' : 'border-border/50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{auction.id}</p>
                  <p className="font-semibold text-white">{auction.item}</p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-sm ${
                  auction.status === 'ending' ? 'bg-primary/20 text-primary animate-pulse' : 'bg-success/20 text-success'
                }`}>
                  {auction.status === 'ending' ? 'ENDING SOON' : 'LIVE'}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Current Bid</p>
                  <p className="text-2xl font-heading font-black text-secondary">${auction.currentBid}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{auction.bids} bids</p>
                  <p className="text-sm text-white flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {auction.timeLeft}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
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
      default: return renderOverview();
    }
  };

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
    </div>
  );
}
