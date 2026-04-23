import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { AppBackground } from '../../src/components/AppBackground';
import { useAuthStore } from '../../src/store/authStore';
import { apiFetch } from '../../src/utils/api';
import { PageHeader } from '../../src/components/PageHeader';

type Period = 'all_time' | 'monthly' | 'weekly';
type Category = 'points' | 'visits' | 'spend';

interface Leader {
  user_id: string;
  display_name: string;
  picture?: string;
  tier?: string;
  subscription_tier?: string;
  points_balance: number;
  total_visits: number;
  total_spend: number;
  rank: number;
  is_current_user: boolean;
}

interface Strategy {
  id: string;
  title: string;
  description: string;
  potential_points: number | string;
  difficulty: string;
  icon: string;
  category: string;
  tip: string;
  highlighted?: boolean;
  highlight_reason?: string;
}

interface DailyPrize {
  prize_amount: number;
  timezone: string;
  next_midnight_utc: string;
  next_midnight_local: string;
  current_leader: { display_name: string; points_balance: number; is_current_user: boolean } | null;
  last_winner: { display_name: string; day_key: string; amount: number; awarded_at: string; is_current_user: boolean } | null;
  recent_winners: { display_name: string; day_key: string; amount: number; is_current_user: boolean }[];
  promo: { title: string; tagline: string; description: string };
}

export default function LeaderboardPage() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuthStore();
  
  const [period, setPeriod] = useState<Period>('all_time');
  const [category, setCategory] = useState<Category>('points');
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [currentUser, setCurrentUser] = useState<Leader | null>(null);
  const [gapToFirst, setGapToFirst] = useState(0);
  const [firstPlaceScore, setFirstPlaceScore] = useState(0);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [quickWins, setQuickWins] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rankingsPage, setRankingsPage] = useState(0);
  const [dailyPrize, setDailyPrize] = useState<DailyPrize | null>(null);
  const [countdown, setCountdown] = useState<string>('--:--:--');

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data: any = await apiFetch(`/api/leaderboard?period=${period}&category=${category}`);
      setLeaders(data.leaders || []);
      setCurrentUser(data.current_user);
      setGapToFirst(data.gap_to_first || 0);
      setFirstPlaceScore(data.first_place_score || 0);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  }, [period, category]);

  const fetchStrategies = useCallback(async () => {
    try {
      const data: any = await apiFetch('/api/leaderboard/strategies');
      setStrategies(data.strategies || []);
      setQuickWins(data.quick_wins || []);
    } catch (error) {
      console.error('Error fetching strategies:', error);
    }
  }, []);

  const fetchDailyPrize = useCallback(async () => {
    try {
      const data: any = await apiFetch('/api/leaderboard/daily-prize');
      setDailyPrize(data as DailyPrize);
    } catch (error) {
      console.error('Error fetching daily prize:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchLeaderboard(), fetchStrategies(), fetchDailyPrize()]);
    setLoading(false);
  }, [fetchLeaderboard, fetchStrategies, fetchDailyPrize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchLeaderboard();
  }, [period, category]);

  // Live countdown to next midnight (Brisbane) + refetch prize just after midnight
  useEffect(() => {
    if (!dailyPrize?.next_midnight_utc) return;
    const target = new Date(dailyPrize.next_midnight_utc).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setCountdown('00:00:00');
        // Refetch 5s after midnight so the winner updates
        setTimeout(() => {
          fetchDailyPrize();
          fetchLeaderboard();
        }, 5000);
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dailyPrize?.next_midnight_utc, fetchDailyPrize, fetchLeaderboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { color: '#FFD700', icon: 'trophy', label: '1st' };
    if (rank === 2) return { color: '#C0C0C0', icon: 'medal', label: '2nd' };
    if (rank === 3) return { color: '#CD7F32', icon: 'medal-outline', label: '3rd' };
    return { color: colors.textMuted, icon: null, label: `#${rank}` };
  };

  const getScoreValue = (leader: Leader) => {
    if (category === 'points') return leader.points_balance?.toLocaleString() || '0';
    if (category === 'visits') return leader.total_visits?.toString() || '0';
    if (category === 'spend') return `$${leader.total_spend?.toLocaleString() || '0'}`;
    return '0';
  };

  const getCategoryLabel = () => {
    if (category === 'points') return 'pts';
    if (category === 'visits') return 'visits';
    if (category === 'spend') return 'spent';
    return '';
  };

  const getIconName = (iconStr: string): keyof typeof Ionicons.glyphMap => {
    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      'calendar': 'calendar',
      'flame': 'flame',
      'people': 'people',
      'gift': 'gift',
      'trophy': 'trophy',
      'trending-up': 'trending-up',
      'time': 'time',
      'share-social': 'share-social',
      'people-circle': 'people-circle',
      'wine': 'wine',
      'star': 'star',
      'sparkles': 'sparkles',
    };
    return iconMap[iconStr] || 'star';
  };

  const getDifficultyColor = (difficulty: string) => {
    if (difficulty === 'easy') return '#00D4AA';
    if (difficulty === 'medium') return colors.gold;
    if (difficulty === 'hard') return colors.accent;
    return colors.textMuted;
  };

  // Find current user's rank in leaders list
  const userRankInList = leaders.find(l => l.is_current_user)?.rank;
  const displayRank = userRankInList || currentUser?.rank || '-';

  return (
    <View style={styles.container}>
      <AppBackground />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Header matches Home */}
        <PageHeader title="LEADERBOARD" showAccent={false} />

        {/* Title */}
        <View style={styles.titleContainer}>
          <Icon name="trophy" size={28} color={colors.gold} />
          <Text style={styles.pageTitle}>LEADERBOARD</Text>
        </View>

        {/* Period Tabs */}
        <View style={styles.periodTabs}>
          {[
            { key: 'all_time', label: 'All Time' },
            { key: 'monthly', label: 'This Month' },
            { key: 'weekly', label: 'This Week' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.periodTab, period === tab.key && styles.periodTabActive]}
              onPress={() => setPeriod(tab.key as Period)}
            >
              <Text style={[styles.periodTabText, period === tab.key && styles.periodTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {[
            { key: 'points', label: 'Points', icon: 'star' },
            { key: 'visits', label: 'Visits', icon: 'location' },
            { key: 'spend', label: 'Spend', icon: 'cash' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.categoryTab, category === tab.key && styles.categoryTabActive]}
              onPress={() => setCategory(tab.key as Category)}
            >
              <Icon 
                name={tab.icon as any} 
                size={16} 
                color={category === tab.key ? colors.accent : colors.textMuted} 
              />
              <Text style={[styles.categoryTabText, category === tab.key && styles.categoryTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Nightly Crown — Daily Prize Promo */}
            {dailyPrize && (
              <View style={styles.crownCardWrap} data-testid="nightly-crown-card">
                <LinearGradient
                  colors={['#3A2A05', '#1A1205']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.crownCard}
                >
                  <View style={styles.crownGoldLine} />

                  <View style={styles.crownHeaderRow}>
                    <View style={styles.crownIconCircle}>
                      <Icon name="trophy" size={22} color="#FFD700" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.crownEyebrow}>NIGHTLY CROWN · DAILY PRIZE</Text>
                      <Text style={styles.crownTitle}>
                        Be #1 at midnight, win{' '}
                        <Text style={styles.crownTitleAccent}>+{dailyPrize.prize_amount} pts</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Countdown */}
                  <View style={styles.crownCountdownRow}>
                    <Text style={styles.crownCountdownLabel}>CROWN LOCKS IN</Text>
                    <View style={styles.crownCountdownDigits}>
                      {countdown.split(':').map((part, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <Text style={styles.crownCountdownColon}>:</Text>}
                          <View style={styles.crownDigitBox}>
                            <Text style={styles.crownDigitText} data-testid={`crown-countdown-${idx}`}>
                              {part}
                            </Text>
                          </View>
                        </React.Fragment>
                      ))}
                    </View>
                    <Text style={styles.crownCountdownTz}>12:00 AM · Brisbane (AEST)</Text>
                  </View>

                  {/* Promo text */}
                  <Text style={styles.crownDesc}>
                    Every night at midnight, whoever sits at{' '}
                    <Text style={styles.crownDescStrong}>#1 on points</Text> is crowned and instantly
                    awarded <Text style={styles.crownDescStrong}>+{dailyPrize.prize_amount} bonus points</Text>.
                    Climb the ranks before the clock runs out.
                  </Text>

                  {/* Current leader / Last winner row */}
                  <View style={styles.crownFooterRow}>
                    <View style={styles.crownFooterItem}>
                      <Text style={styles.crownFooterLabel}>ON THE THRONE</Text>
                      <View style={styles.crownFooterValueRow}>
                        <Icon name="flame" size={14} color="#FF6B35" />
                        <Text
                          style={[
                            styles.crownFooterValue,
                            dailyPrize.current_leader?.is_current_user && { color: colors.accent },
                          ]}
                          numberOfLines={1}
                        >
                          {dailyPrize.current_leader?.is_current_user
                            ? 'You'
                            : dailyPrize.current_leader?.display_name || '—'}
                        </Text>
                      </View>
                      {dailyPrize.current_leader && (
                        <Text style={styles.crownFooterSub}>
                          {dailyPrize.current_leader.points_balance.toLocaleString()} pts
                        </Text>
                      )}
                    </View>

                    <View style={styles.crownFooterDivider} />

                    <View style={styles.crownFooterItem}>
                      <Text style={styles.crownFooterLabel}>LAST NIGHT'S WINNER</Text>
                      {dailyPrize.last_winner ? (
                        <>
                          <View style={styles.crownFooterValueRow}>
                            <Icon name="trophy" size={14} color="#FFD700" />
                            <Text
                              style={[
                                styles.crownFooterValue,
                                dailyPrize.last_winner.is_current_user && { color: colors.accent },
                              ]}
                              numberOfLines={1}
                            >
                              {dailyPrize.last_winner.is_current_user
                                ? 'You'
                                : dailyPrize.last_winner.display_name}
                            </Text>
                          </View>
                          <Text style={styles.crownFooterSub}>+{dailyPrize.last_winner.amount} pts</Text>
                        </>
                      ) : (
                        <Text style={styles.crownFooterValueMuted}>First crown up for grabs</Text>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* Top 3 Podium */}
            {leaders.length >= 3 && (
              <View style={styles.podium}>
                {/* 2nd Place */}
                <View style={[styles.podiumItem, styles.podiumSecond]}>
                  <View style={[styles.podiumAvatar, { borderColor: '#C0C0C0' }]}>
                    <Icon name="person" size={24} color="#C0C0C0" />
                  </View>
                  <View style={[styles.podiumRankBadge, { backgroundColor: '#C0C0C0' }]}><Text style={styles.podiumRankText}>2</Text></View>
                  <Text style={styles.podiumName} numberOfLines={1}>{leaders[1]?.display_name}</Text>
                  <Text style={styles.podiumScore}>{getScoreValue(leaders[1])}</Text>
                  <View style={[styles.podiumBar, { height: 60, backgroundColor: '#C0C0C030' }]} />
                </View>

                {/* 1st Place */}
                <View style={[styles.podiumItem, styles.podiumFirst]}>
                  <View style={[styles.podiumAvatar, styles.podiumAvatarFirst, { borderColor: '#FFD700' }]}>
                    <Icon name="person" size={28} color="#FFD700" />
                  </View>
                  <View style={[styles.podiumRankBadge, styles.podiumRankBadgeFirst, { backgroundColor: '#FFD700' }]}><Text style={[styles.podiumRankText, { fontSize: 16 }]}>1</Text></View>
                  <Text style={[styles.podiumName, styles.podiumNameFirst]} numberOfLines={1}>{leaders[0]?.display_name}</Text>
                  <Text style={[styles.podiumScore, styles.podiumScoreFirst]}>{getScoreValue(leaders[0])}</Text>
                  <View style={[styles.podiumBar, { height: 80, backgroundColor: '#FFD70030' }]} />
                </View>

                {/* 3rd Place */}
                <View style={[styles.podiumItem, styles.podiumThird]}>
                  <View style={[styles.podiumAvatar, { borderColor: '#CD7F32' }]}>
                    <Icon name="person" size={24} color="#CD7F32" />
                  </View>
                  <View style={[styles.podiumRankBadge, { backgroundColor: '#CD7F32' }]}><Text style={styles.podiumRankText}>3</Text></View>
                  <Text style={styles.podiumName} numberOfLines={1}>{leaders[2]?.display_name}</Text>
                  <Text style={styles.podiumScore}>{getScoreValue(leaders[2])}</Text>
                  <View style={[styles.podiumBar, { height: 45, backgroundColor: '#CD7F3230' }]} />
                </View>
              </View>
            )}

            {/* Full Rankings List — paginated 5 per page */}
            <View style={styles.rankingsSection}>
              <Text style={styles.sectionTitle}>RANKINGS</Text>

              {leaders.slice(3).slice(rankingsPage * 5, rankingsPage * 5 + 5).map((leader) => {
                const badge = getRankBadge(leader.rank);
                return (
                  <View 
                    key={leader.user_id} 
                    style={[styles.rankItem, leader.is_current_user && styles.rankItemCurrentUser]}
                  >
                    <Text style={[styles.rankNumber, { color: badge.color }]}>{badge.label}</Text>
                    <View style={styles.rankAvatar}>
                      <Icon name="person" size={18} color={colors.textMuted} />
                    </View>
                    <View style={styles.rankInfo}>
                      <Text style={styles.rankName}>{leader.display_name}</Text>
                    </View>
                    <Text style={styles.rankScore}>{getScoreValue(leader)} {getCategoryLabel()}</Text>
                  </View>
                );
              })}

              {leaders.slice(3).length > 5 && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    style={[styles.paginationBtn, rankingsPage === 0 && styles.paginationBtnDisabled]}
                    onPress={() => setRankingsPage(Math.max(0, rankingsPage - 1))}
                    disabled={rankingsPage === 0}
                    data-testid="leaderboard-prev-page"
                  >
                    <Icon name="chevron-back" size={16} color={rankingsPage === 0 ? colors.textMuted : colors.textPrimary} />
                    <Text style={[styles.paginationBtnText, rankingsPage === 0 && { color: colors.textMuted }]}>Back</Text>
                  </TouchableOpacity>

                  <Text style={styles.paginationLabel}>
                    Page {rankingsPage + 1} of {Math.max(1, Math.ceil(leaders.slice(3).length / 5))}
                  </Text>

                  <TouchableOpacity
                    style={[styles.paginationBtn, (rankingsPage + 1) * 5 >= leaders.slice(3).length && styles.paginationBtnDisabled]}
                    onPress={() => setRankingsPage(rankingsPage + 1)}
                    disabled={(rankingsPage + 1) * 5 >= leaders.slice(3).length}
                    data-testid="leaderboard-next-page"
                  >
                    <Text style={[styles.paginationBtnText, (rankingsPage + 1) * 5 >= leaders.slice(3).length && { color: colors.textMuted }]}>Next</Text>
                    <Icon name="chevron-forward" size={16} color={(rankingsPage + 1) * 5 >= leaders.slice(3).length ? colors.textMuted : colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Your Position Card */}
            <View style={styles.yourPositionSection}>
              <Text style={styles.sectionTitle}>YOUR POSITION</Text>
              
              <LinearGradient
                colors={[colors.accent + '20', colors.accent + '05']}
                style={styles.positionCard}
              >
                <View style={styles.positionTop}>
                  <View style={styles.positionRank}>
                    <Text style={styles.positionRankLabel}>RANK</Text>
                    <Text style={styles.positionRankValue}>#{displayRank}</Text>
                  </View>
                  <View style={styles.positionDivider} />
                  <View style={styles.positionScore}>
                    <Text style={styles.positionScoreLabel}>YOUR {category.toUpperCase()}</Text>
                    <Text style={styles.positionScoreValue}>
                      {category === 'points' && user?.points_balance?.toLocaleString()}
                      {category === 'visits' && (currentUser?.total_visits || 0)}
                      {category === 'spend' && `$${currentUser?.total_spend || 0}`}
                    </Text>
                  </View>
                </View>
                
                {gapToFirst > 0 && (
                  <View style={styles.gapSection}>
                    <Icon name="trending-up" size={20} color={colors.gold} />
                    <Text style={styles.gapText}>
                      <Text style={styles.gapValue}>{gapToFirst.toLocaleString()}</Text>
                      {' '}{getCategoryLabel()} to reach #1
                    </Text>
                  </View>
                )}
                
                {/* Progress bar to first place */}
                {firstPlaceScore > 0 && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { width: `${Math.min(100, ((user?.points_balance || 0) / firstPlaceScore) * 100)}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {Math.round(((user?.points_balance || 0) / firstPlaceScore) * 100)}% to #1
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </View>

            {/* Point Earning Strategies */}
            <View style={styles.strategiesSection}>
              <Text style={styles.sectionTitle}>CLIMB FASTER</Text>
              <Text style={styles.sectionSubtitle}>Smart strategies to maximize your points</Text>
              
              {/* Quick Wins */}
              {quickWins.length > 0 && (
                <View style={styles.quickWinsContainer}>
                  <View style={styles.quickWinsHeader}>
                    <Icon name="flash" size={18} color="#00D4AA" />
                    <Text style={styles.quickWinsTitle}>Quick Wins</Text>
                  </View>
                  
                  {quickWins.map((strategy) => (
                    <View key={strategy.id} style={styles.quickWinItem}>
                      <Icon name={getIconName(strategy.icon)} size={20} color="#00D4AA" />
                      <View style={styles.quickWinInfo}>
                        <Text style={styles.quickWinTitle}>{strategy.title}</Text>
                        <Text style={styles.quickWinPoints}>+{strategy.potential_points} pts</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              
              {/* All Strategies */}
              {strategies.map((strategy) => (
                <View 
                  key={strategy.id} 
                  style={[styles.strategyCard, strategy.highlighted && styles.strategyCardHighlighted]}
                >
                  {strategy.highlighted && (
                    <View style={styles.highlightBadge}>
                      <Icon name="star" size={12} color="#000" />
                      <Text style={styles.highlightText}>Recommended</Text>
                    </View>
                  )}
                  
                  <View style={styles.strategyHeader}>
                    <View style={[styles.strategyIcon, { backgroundColor: getDifficultyColor(strategy.difficulty) + '20' }]}>
                      <Icon name={getIconName(strategy.icon)} size={22} color={getDifficultyColor(strategy.difficulty)} />
                    </View>
                    <View style={styles.strategyInfo}>
                      <Text style={styles.strategyTitle}>{strategy.title}</Text>
                      <View style={styles.strategyMeta}>
                        <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(strategy.difficulty) + '20' }]}>
                          <Text style={[styles.difficultyText, { color: getDifficultyColor(strategy.difficulty) }]}>
                            {strategy.difficulty.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.strategyPoints}>
                          {typeof strategy.potential_points === 'number' 
                            ? `+${strategy.potential_points} pts`
                            : strategy.potential_points
                          }
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <Text style={styles.strategyDescription}>{strategy.description}</Text>
                  
                  <View style={styles.tipContainer}>
                    <Icon name="bulb" size={14} color={colors.gold} />
                    <Text style={styles.tipText}>{strategy.tip}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
        
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 200,
    height: 50,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.full,
    padding: 4,
    marginBottom: spacing.md,
  },
  periodTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  periodTabActive: {
    backgroundColor: colors.accent,
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  periodTabTextActive: {
    color: '#fff',
  },
  categoryTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryTabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '15',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  categoryTabTextActive: {
    color: colors.accent,
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  // Nightly Crown card
  crownCardWrap: {
    marginBottom: spacing.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFD70040',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  crownCard: {
    padding: spacing.lg,
    position: 'relative',
  },
  crownGoldLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FFD700',
  },
  crownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  crownIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD70018',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD70055',
  },
  crownEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#FFD700',
    marginBottom: 2,
  },
  crownTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  crownTitleAccent: {
    color: '#FFD700',
  },
  crownCountdownRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FFD70022',
    marginBottom: spacing.md,
  },
  crownCountdownLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  crownCountdownDigits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  crownDigitBox: {
    minWidth: 44,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: '#FFD70010',
    borderWidth: 1,
    borderColor: '#FFD70030',
    alignItems: 'center',
  },
  crownDigitText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  crownCountdownColon: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFD70080',
    marginHorizontal: 2,
  },
  crownCountdownTz: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: 4,
  },
  crownDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  crownDescStrong: {
    color: '#FFD700',
    fontWeight: '700',
  },
  crownFooterRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  crownFooterItem: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  crownFooterDivider: {
    width: 1,
    backgroundColor: '#FFD70022',
    marginHorizontal: spacing.xs,
  },
  crownFooterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  crownFooterValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  crownFooterValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  crownFooterValueMuted: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  crownFooterSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD700',
    marginTop: 2,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  podiumFirst: {
    marginBottom: -10,
  },
  podiumSecond: {},
  podiumThird: {},
  podiumAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: spacing.xs,
  },
  podiumAvatarFirst: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
  },
  podiumRankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  podiumRankBadgeFirst: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  podiumRankText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#08080E',
  },
  podiumName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.xs,
    maxWidth: 80,
    textAlign: 'center',
  },
  podiumNameFirst: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  podiumScore: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  podiumScoreFirst: {
    fontSize: 14,
    color: colors.gold,
  },
  podiumBar: {
    width: '80%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    marginTop: spacing.sm,
  },
  rankingsSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rankItemCurrentUser: {
    backgroundColor: colors.accent + '15',
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  rankNumber: {
    width: 40,
    fontSize: 14,
    fontWeight: '700',
  },
  rankAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rankInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rankName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tierBadge: {
    display: 'none',
  },
  tierText: {
    display: 'none',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  paginationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 86,
    justifyContent: 'center',
  },
  paginationBtnDisabled: {
    opacity: 0.45,
  },
  paginationBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  paginationLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  rankScore: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  yourPositionSection: {
    marginBottom: spacing.xl,
  },
  positionCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  positionTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  positionRank: {
    flex: 1,
    alignItems: 'center',
  },
  positionRankLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  positionRankValue: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.accent,
  },
  positionDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  positionScore: {
    flex: 1,
    alignItems: 'center',
  },
  positionScoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  positionScoreValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  gapSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gapText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  gapValue: {
    fontWeight: '800',
    color: colors.gold,
  },
  progressContainer: {
    marginTop: spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  strategiesSection: {
    marginBottom: spacing.xl,
  },
  quickWinsContainer: {
    backgroundColor: '#00D4AA10',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#00D4AA30',
  },
  quickWinsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  quickWinsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00D4AA',
  },
  quickWinItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quickWinInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickWinTitle: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  quickWinPoints: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00D4AA',
  },
  strategyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  strategyCardHighlighted: {
    borderColor: colors.gold + '50',
    backgroundColor: colors.gold + '08',
  },
  highlightBadge: {
    position: 'absolute',
    top: -8,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  highlightText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
  },
  strategyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  strategyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  strategyInfo: {
    flex: 1,
  },
  strategyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  strategyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  difficultyBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  difficultyText: {
    fontSize: 9,
    fontWeight: '700',
  },
  strategyPoints: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold,
  },
  strategyDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
