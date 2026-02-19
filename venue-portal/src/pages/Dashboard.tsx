import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { removeToken, getUser } from '../utils/auth';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const user = getUser();
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  
  const [revenueData, setRevenueData] = useState<any>(null);
  const [checkinData, setCheckinData] = useState<any>(null);
  const [demographicsData, setDemographicsData] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);

  useEffect(() => {
    fetchAllData();
  }, [period]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [revenue, checkins, demographics, dashboard] = await Promise.all([
        api.get(`/venue/analytics/revenue?period=${period}`),
        api.get(`/venue/analytics/checkins?period=${period}`),
        api.get('/venue/analytics/demographics'),
        api.get('/venue/dashboard'),
      ]);

      setRevenueData(revenue.data);
      setCheckinData(checkins.data);
      setDemographicsData(demographics.data);
      setDashboardData(dashboard.data);
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    removeToken();
    onLogout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}>Loading analytics...</div>
      </div>
    );
  }

  // Prepare chart data
  const dailyRevenueData = revenueData?.daily_revenue ? 
    Object.entries(revenueData.daily_revenue).map(([date, amount]) => ({
      date,
      revenue: amount,
    })).slice(-14) : [];

  const dailyCheckinData = checkinData?.daily_checkins ? 
    Object.entries(checkinData.daily_checkins).map(([date, count]) => ({
      date,
      checkins: count,
    })).slice(-14) : [];

  const categoryData = revenueData?.category_breakdown ? 
    Object.entries(revenueData.category_breakdown).map(([category, amount]) => ({
      name: category,
      value: amount,
    })) : [];

  const tierData = demographicsData?.membership_tiers ? 
    Object.entries(demographicsData.membership_tiers).map(([tier, count]) => ({
      name: tier,
      value: count,
    })) : [];

  const COLORS = ['#E31837', '#FF6B6B', '#FFD700', '#4CAF50', '#2196F3', '#9C27B0'];

  return (
    <div style={styles.dashboard}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.headerTitle}>LUNA VENUE PORTAL</h1>
            <p style={styles.headerSubtitle}>
              {user?.venue_id?.toUpperCase() || 'ALL VENUES'} · {user?.name}
            </p>
          </div>
          <div style={styles.headerRight}>
            <select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)}
              style={styles.periodSelect}
            >
              <option value=\"week\">Last 7 Days</option>
              <option value=\"month\">Last 30 Days</option>
              <option value=\"year\">Last Year</option>
            </select>
            <button onClick={handleLogout} style={styles.logoutButton}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Revenue</div>
          <div style={styles.statValue}>${revenueData?.combined_revenue?.toFixed(2) || '0.00'}</div>
          <div style={styles.statSub}>{revenueData?.total_transactions || 0} transactions</div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Check-ins</div>
          <div style={styles.statValue}>{checkinData?.total_checkins || 0}</div>
          <div style={styles.statSub}>{checkinData?.unique_visitors || 0} unique visitors</div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Avg Spend</div>
          <div style={styles.statValue}>${revenueData?.average_spend_per_customer?.toFixed(2) || '0.00'}</div>
          <div style={styles.statSub}>per customer</div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Redemptions</div>
          <div style={styles.statValue}>{dashboardData?.total_redemptions || 0}</div>
          <div style={styles.statSub}>rewards claimed</div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div style={styles.chartsGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Revenue Trend</h3>
          <ResponsiveContainer width=\"100%\" height={300}>
            <LineChart data={dailyRevenueData}>
              <CartesianGrid strokeDasharray=\"3 3\" stroke=\"#333\" />
              <XAxis dataKey=\"date\" stroke=\"#999\" fontSize={12} />
              <YAxis stroke=\"#999\" fontSize={12} />
              <Tooltip 
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line type=\"monotone\" dataKey=\"revenue\" stroke=\"#E31837\" strokeWidth={2} dot={{ fill: '#E31837' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Check-in Trend</h3>
          <ResponsiveContainer width=\"100%\" height={300}>
            <BarChart data={dailyCheckinData}>
              <CartesianGrid strokeDasharray=\"3 3\" stroke=\"#333\" />
              <XAxis dataKey=\"date\" stroke=\"#999\" fontSize={12} />
              <YAxis stroke=\"#999\" fontSize={12} />
              <Tooltip 
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey=\"checkins\" fill=\"#FFD700\" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={styles.chartsGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Revenue by Category</h3>
          <ResponsiveContainer width=\"100%\" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx=\"50%\"
                cy=\"50%\"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={100}
                fill=\"#8884d8\"
                dataKey=\"value\"
              >
                {categoryData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Membership Tiers</h3>
          <ResponsiveContainer width=\"100%\" height={300}>
            <PieChart>
              <Pie
                data={tierData}
                cx=\"50%\"
                cy=\"50%\"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill=\"#8884d8\"
                dataKey=\"value\"
              >
                {tierData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Peak Hours & Top Visitors */}
      <div style={styles.chartsGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Peak Hours</h3>
          <div style={styles.listContainer}>
            {checkinData?.peak_hours?.length > 0 ? (
              checkinData.peak_hours.map(([hour, count]: [number, number], idx: number) => (
                <div key={idx} style={styles.listItem}>
                  <span style={styles.listLabel}>{hour}:00 - {hour + 1}:00</span>
                  <span style={styles.listValue}>{count} check-ins</span>
                </div>
              ))
            ) : (
              <div style={styles.emptyState}>No data available</div>
            )}
          </div>
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Top Visitors</h3>
          <div style={styles.listContainer}>
            {checkinData?.top_visitors?.length > 0 ? (
              checkinData.top_visitors.map((visitor: any, idx: number) => (
                <div key={idx} style={styles.listItem}>
                  <span style={styles.listLabel}>{visitor.name}</span>
                  <span style={styles.listValue}>{visitor.checkins} visits</span>
                </div>
              ))
            ) : (
              <div style={styles.emptyState}>No visitors yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Redemptions */}
      <div style={styles.fullWidthCard}>
        <h3 style={styles.chartTitle}>Recent Redemptions</h3>
        <div style={styles.tableContainer}>
          {dashboardData?.pending_redemptions?.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>Reward</th>
                  <th style={styles.th}>User</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.pending_redemptions.slice(0, 10).map((redemption: any, idx: number) => (
                  <tr key={idx} style={styles.tr}>
                    <td style={styles.td}>{new Date(redemption.created_at).toLocaleString()}</td>
                    <td style={styles.td}>{redemption.reward_name}</td>
                    <td style={styles.td}>{redemption.user_id.slice(0, 8)}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: redemption.status === 'redeemed' ? '#1a4d2e' : '#4d2e1a'
                      }}>
                        {redemption.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={styles.emptyState}>No recent redemptions</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: any = {
  dashboard: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0f 100%)',
    padding: '0',
  },
  header: {
    background: '#1a1a1a',
    borderBottom: '1px solid #2a2a2a',
    padding: '20px 32px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerContent: {
    maxWidth: '1600px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '2px',
    marginBottom: '4px',
  },
  headerSubtitle: {
    fontSize: '13px',
    color: '#999999',
    letterSpacing: '1px',
  },
  headerRight: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  periodSelect: {
    background: '#0a0a0a',
    border: '1px solid #333333',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '14px',
    color: '#ffffff',
    cursor: 'pointer',
  },
  logoutButton: {
    background: 'transparent',
    border: '1px solid #E31837',
    color: '#E31837',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
  },
  loadingSpinner: {
    fontSize: '18px',
    color: '#ffffff',
  },
  statsGrid: {
    maxWidth: '1600px',
    margin: '32px auto',
    padding: '0 32px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
  },
  statCard: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #2a2a2a',
  },
  statLabel: {
    fontSize: '13px',
    color: '#999999',
    marginBottom: '8px',
    letterSpacing: '0.5px',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '4px',
  },
  statSub: {
    fontSize: '13px',
    color: '#666666',
  },
  chartsGrid: {
    maxWidth: '1600px',
    margin: '24px auto',
    padding: '0 32px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(550px, 1fr))',
    gap: '20px',
  },
  chartCard: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #2a2a2a',
  },
  chartTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '20px',
    letterSpacing: '0.5px',
  },
  fullWidthCard: {
    maxWidth: '1600px',
    margin: '24px auto',
    padding: '0 32px',
  },
  tableContainer: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #2a2a2a',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#999999',
    borderBottom: '1px solid #2a2a2a',
    letterSpacing: '0.5px',
  },
  tr: {
    borderBottom: '1px solid #1a1a1a',
  },
  td: {
    padding: '16px',
    fontSize: '14px',
    color: '#ffffff',
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
    display: 'inline-block',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#0a0a0a',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
  },
  listLabel: {
    fontSize: '14px',
    color: '#ffffff',
  },
  listValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#E31837',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '14px',
    color: '#666666',
  },
};