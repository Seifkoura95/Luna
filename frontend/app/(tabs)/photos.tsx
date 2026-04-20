import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  TextInput, Modal, Platform, RefreshControl, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../../src/theme/colors';
import { api, apiFetch } from '../../src/utils/api';
import { Icon } from '../../src/components/Icon';
import { AppBackground } from '../../src/components/AppBackground';

const isNative = Platform.OS !== 'web';

const VENUES_SHORT = [
  { id: 'eclipse', name: 'Eclipse', color: '#E31837', type: 'nightclub' },
  { id: 'after_dark', name: 'After Dark', color: '#8B00FF', type: 'nightclub' },
  { id: 'su_casa_brisbane', name: 'Su Casa BNE', color: '#FFB800', type: 'bar' },
  { id: 'su_casa_gold_coast', name: 'Su Casa GC', color: '#FF6B35', type: 'bar' },
  { id: 'pump', name: 'Pump', color: '#FF1493', type: 'nightclub' },
  { id: 'mamacita', name: 'Mamacita', color: '#FF4500', type: 'nightclub' },
  { id: 'juju', name: 'Juju', color: '#00D4AA', type: 'restaurant' },
  { id: 'night_market', name: 'Night Market', color: '#FF4757', type: 'restaurant' },
  { id: 'ember_and_ash', name: 'Ember & Ash', color: '#FFA502', type: 'restaurant' },
];

type SocialTab = 'feed' | 'planner';

export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<SocialTab>('feed');
  const [refreshing, setRefreshing] = useState(false);

  // Feed state
  const [feed, setFeed] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  // Planner state
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);

  // New plan form
  const [planTitle, setPlanTitle] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [planStops, setPlanStops] = useState<{venue_id: string; time: string; notes: string}[]>([]);
  const [creating, setCreating] = useState(false);

  // Poll modal
  const [showPoll, setShowPoll] = useState(false);
  const [pollPlanId, setPollPlanId] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<{label: string; venue_id?: string}[]>([{ label: '' }, { label: '' }]);
  const [creatingPoll, setCreatingPoll] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const res = await apiFetch<{feed: any[]}>('/api/social/feed');
      setFeed(res.feed || []);
    } catch (e) { console.error(e); }
    finally { setFeedLoading(false); }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const res = await apiFetch<{plans: any[]}>('/api/social/night-plans');
      setPlans(res.plans || []);
    } catch (e) { console.error(e); }
    finally { setPlansLoading(false); }
  }, []);

  useEffect(() => { loadFeed(); loadPlans(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFeed(), loadPlans()]);
    setRefreshing(false);
  };

  const handleLike = async (activityId: string, liked: boolean) => {
    if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (liked) {
        await apiFetch(`/api/social/like/${activityId}`, { method: 'DELETE' });
      } else {
        await apiFetch(`/api/social/like/${activityId}`, { method: 'POST' });
      }
      setFeed(prev => prev.map(f => f.id === activityId ? {
        ...f,
        liked_by_me: !liked,
        likes_count: liked ? Math.max(0, f.likes_count - 1) : f.likes_count + 1,
      } : f));
    } catch (e: any) {
      if (!e.message?.includes('Already liked')) console.error(e);
    }
  };

  const handleCreatePlan = async () => {
    if (!planTitle.trim()) { Alert.alert('Name your night!'); return; }
    if (planStops.length === 0) { Alert.alert('Add at least one stop'); return; }

    setCreating(true);
    try {
      // Generate date if empty
      const date = planDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const res = await apiFetch<any>('/api/social/night-plan', {
        method: 'POST',
        body: JSON.stringify({ title: planTitle, date, stops: planStops }),
      });
      if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Night Planned!', res.message);
      setShowNewPlan(false);
      setPlanTitle(''); setPlanDate(''); setPlanStops([]);
      loadPlans();
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed'); }
    finally { setCreating(false); }
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim()) { Alert.alert('Enter a question'); return; }
    const validOpts = pollOptions.filter(o => o.label.trim());
    if (validOpts.length < 2) { Alert.alert('Need at least 2 options'); return; }

    setCreatingPoll(true);
    try {
      await apiFetch('/api/social/poll', {
        method: 'POST',
        body: JSON.stringify({ plan_id: pollPlanId, question: pollQuestion, options: validOpts }),
      });
      if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Poll Created!', 'Your crew can now vote.');
      setShowPoll(false);
      setPollQuestion(''); setPollOptions([{ label: '' }, { label: '' }]);
      loadPlans();
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed'); }
    finally { setCreatingPoll(false); }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiFetch(`/api/social/poll/${pollId}/vote?option_id=${optionId}`, { method: 'POST' });
      loadPlans();
    } catch (e: any) { Alert.alert('Error', e.message || 'Vote failed'); }
  };

  const addStop = (venueId: string) => {
    const venue = VENUES_SHORT.find(v => v.id === venueId);
    setPlanStops(prev => [...prev, { venue_id: venueId, time: '', notes: venue?.name || '' }]);
  };

  const removeStop = (idx: number) => {
    setPlanStops(prev => prev.filter((_, i) => i !== idx));
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const tierColors: Record<string, string> = {
    bronze: '#CD7F32', silver: '#C0C0C0', gold: '#D4A832',
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} data-testid="social-screen">
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SOCIAL</Text>
        <Text style={styles.headerSub}>See what Luna members are up to</Text>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'feed' && styles.tabBtnActive]} onPress={() => setTab('feed')} data-testid="social-tab-feed">
          <Icon name="people" size={16} color={tab === 'feed' ? colors.accent : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'feed' && styles.tabTextActive]}>Activity</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'planner' && styles.tabBtnActive]} onPress={() => setTab('planner')} data-testid="social-tab-planner">
          <Icon name="calendar" size={16} color={tab === 'planner' ? '#FF6B35' : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'planner' && { color: '#FF6B35' }]}>Night Builder</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* ═══ ACTIVITY FEED ═══ */}
        {tab === 'feed' && (
          <>
            {feedLoading ? (
              <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 60 }} />
            ) : feed.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="people" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptySub}>Be the first! Mark an event as "Interested" and it'll show up here.</Text>
              </View>
            ) : (
              feed.map(item => {
                const tColor = tierColors[item.user_tier] || colors.textMuted;
                return (
                  <View key={item.id} style={styles.feedCard} data-testid={`feed-item-${item.id}`}>
                    {/* User header */}
                    <View style={styles.feedHeader}>
                      <View style={[styles.feedAvatar, { borderColor: tColor }]}>
                        <Icon name="person" size={18} color={tColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.feedNameRow}>
                          <Text style={styles.feedName}>{item.user_name}</Text>
                          <View style={[styles.feedTierDot, { backgroundColor: tColor }]} />
                        </View>
                        <Text style={styles.feedTime}>{getTimeAgo(item.created_at)}</Text>
                      </View>
                      {item.visibility === 'friends' && <Icon name="people" size={14} color={colors.textMuted} />}
                    </View>

                    {/* Content */}
                    <View style={styles.feedContent}>
                      <Text style={styles.feedAction}>is interested in</Text>
                      <TouchableOpacity style={styles.feedEvent} onPress={() => router.push(`/event/${item.event_id}`)}>
                        {item.event_image ? (
                          <Image source={{ uri: item.event_image }} style={styles.feedEventImg} />
                        ) : (
                          <View style={[styles.feedEventImg, { backgroundColor: colors.glassMid, justifyContent: 'center', alignItems: 'center' }]}>
                            <Icon name="musical-notes" size={20} color={colors.textMuted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.feedEventTitle}>{item.event_title}</Text>
                          {item.event_venue ? <Text style={styles.feedEventVenue}>{item.event_venue}</Text> : null}
                          {item.event_date ? <Text style={styles.feedEventDate}>{item.event_date}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Actions */}
                    <View style={styles.feedActions}>
                      <TouchableOpacity
                        style={styles.feedActionBtn}
                        onPress={() => handleLike(item.id, item.liked_by_me)}
                        data-testid={`like-${item.id}`}
                      >
                        <Icon name={item.liked_by_me ? 'heart' : 'heart-outline'} size={18} color={item.liked_by_me ? '#E31837' : colors.textMuted} />
                        <Text style={[styles.feedActionText, item.liked_by_me && { color: '#E31837' }]}>{item.likes_count || 0}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.feedActionBtn} onPress={() => router.push(`/event/${item.event_id}`)}>
                        <Icon name="arrow-forward" size={16} color={colors.textMuted} />
                        <Text style={styles.feedActionText}>View Event</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ═══ NIGHT BUILDER ═══ */}
        {tab === 'planner' && (
          <>
            {/* New Plan Button */}
            <TouchableOpacity style={styles.newPlanBtn} onPress={() => setShowNewPlan(true)} data-testid="new-night-plan-btn">
              <LinearGradient colors={['#FF6B35', '#FF4500']} style={styles.newPlanGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Icon name="add-circle" size={22} color="#FFF" />
                <View>
                  <Text style={styles.newPlanText}>Build Your Night</Text>
                  <Text style={styles.newPlanSub}>Plan stops, invite friends, vote on venues</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {plansLoading ? (
              <ActivityIndicator size="large" color="#FF6B35" style={{ marginTop: 40 }} />
            ) : plans.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="calendar" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No nights planned yet</Text>
                <Text style={styles.emptySub}>Tap "Build Your Night" to plan dinner, drinks, and dancing with your crew.</Text>
              </View>
            ) : (
              plans.map(plan => (
                <View key={plan.id} style={styles.planCard} data-testid={`plan-${plan.id}`}>
                  {/* Plan Header */}
                  <View style={styles.planHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>{plan.title}</Text>
                      <Text style={styles.planDate}>{plan.date} - {plan.members?.length || 1} people</Text>
                    </View>
                    {plan.is_crew_plan && (
                      <View style={[styles.crewBadge]}>
                        <Icon name="people" size={12} color="#FF6B35" />
                        <Text style={styles.crewBadgeText}>CREW</Text>
                      </View>
                    )}
                  </View>

                  {/* Stops Timeline */}
                  <View style={styles.timeline}>
                    {(plan.stops || []).map((stop: any, i: number) => {
                      const venueInfo = VENUES_SHORT.find(v => v.id === stop.venue_id);
                      const vColor = venueInfo?.color || colors.accent;
                      return (
                        <View key={i} style={styles.timelineStop}>
                          <View style={styles.timelineDot}>
                            <View style={[styles.dot, { backgroundColor: vColor }]} />
                            {i < plan.stops.length - 1 && <View style={[styles.lineDown, { backgroundColor: vColor + '40' }]} />}
                          </View>
                          <View style={styles.stopInfo}>
                            <Text style={[styles.stopVenue, { color: vColor }]}>{stop.venue_name}</Text>
                            <Text style={styles.stopTime}>{stop.time || 'TBD'} {stop.notes ? `- ${stop.notes}` : ''}</Text>
                          </View>
                          <Text style={styles.stopOrder}>#{stop.order}</Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Members */}
                  <View style={styles.planMembers}>
                    {(plan.members || []).slice(0, 5).map((m: any, i: number) => (
                      <View key={i} style={[styles.memberChip, m.status === 'confirmed' ? styles.memberConfirmed : m.status === 'declined' ? styles.memberDeclined : {}]}>
                        <Text style={styles.memberName}>{m.name?.split(' ')[0] || '?'}</Text>
                        <Text style={styles.memberStatus}>{m.status === 'confirmed' ? 'In' : m.status === 'declined' ? 'Out' : '?'}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Actions */}
                  <View style={styles.planActions}>
                    <TouchableOpacity
                      style={[styles.planActionBtn, plan.likes?.includes('current') && { backgroundColor: '#E3183720', borderColor: '#E31837' }]}
                      onPress={async () => {
                        try {
                          const liked = plan.likes_count > 0;
                          if (liked) {
                            await apiFetch(`/api/social/night-plan/${plan.id}/like`, { method: 'DELETE' });
                          } else {
                            await apiFetch(`/api/social/night-plan/${plan.id}/like`, { method: 'POST' });
                          }
                          if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          loadPlans();
                        } catch {}
                      }}
                      data-testid={`like-plan-${plan.id}`}
                    >
                      <Icon name={plan.likes_count > 0 ? 'heart' : 'heart-outline'} size={16} color={plan.likes_count > 0 ? '#E31837' : colors.textMuted} />
                      <Text style={[styles.planActionText, plan.likes_count > 0 && { color: '#E31837' }]}>{plan.likes_count || 0} Like{plan.likes_count !== 1 ? 's' : ''}</Text>
                    </TouchableOpacity>
                    {plan.is_crew_plan && (
                      <TouchableOpacity style={styles.planActionBtn} onPress={() => { setPollPlanId(plan.id); setShowPoll(true); }} data-testid={`create-poll-${plan.id}`}>
                        <Icon name="stats-chart" size={16} color="#8B5CF6" />
                        <Text style={[styles.planActionText, { color: '#8B5CF6' }]}>Create Poll</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.planActionBtn}>
                      <Icon name="share" size={16} color={colors.accent} />
                      <Text style={[styles.planActionText, { color: colors.accent }]}>Share</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Polls */}
                  {(plan.polls || []).length > 0 && (
                    <PollSection planId={plan.id} pollIds={plan.polls} onVote={handleVote} />
                  )}
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* New Night Plan Modal */}
      <Modal visible={showNewPlan} transparent animationType="slide" onRequestClose={() => setShowNewPlan(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Build Your Night</Text>
              <TouchableOpacity onPress={() => setShowNewPlan(false)} data-testid="close-new-plan">
                <Icon name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>NAME YOUR NIGHT</Text>
              <TextInput style={styles.formInput} value={planTitle} onChangeText={setPlanTitle} placeholder="Friday Night Out, Birthday Bash..." placeholderTextColor={colors.textMuted} data-testid="plan-title-input" />

              <Text style={styles.formLabel}>DATE</Text>
              <TextInput style={styles.formInput} value={planDate} onChangeText={setPlanDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} data-testid="plan-date-input" />

              <Text style={styles.formLabel}>ADD STOPS</Text>
              <Text style={styles.formHint}>Tap venues to build your route</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {VENUES_SHORT.map(v => (
                  <TouchableOpacity key={v.id} style={[styles.venueAddBtn, { borderColor: v.color }]} onPress={() => addStop(v.id)} data-testid={`add-stop-${v.id}`}>
                    <Icon name={v.type === 'restaurant' ? 'restaurant' : 'musical-notes'} size={14} color={v.color} />
                    <Text style={[styles.venueAddText, { color: v.color }]}>{v.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Stop list */}
              {planStops.map((stop, i) => {
                const vi = VENUES_SHORT.find(v => v.id === stop.venue_id);
                return (
                  <View key={i} style={styles.stopRow}>
                    <View style={[styles.stopNum, { backgroundColor: (vi?.color || colors.accent) + '20' }]}>
                      <Text style={[styles.stopNumText, { color: vi?.color || colors.accent }]}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stopRowName, { color: vi?.color }]}>{vi?.name || stop.venue_id}</Text>
                      <TextInput style={styles.stopTimeInput} value={stop.time} onChangeText={t => {
                        const updated = [...planStops]; updated[i].time = t; setPlanStops(updated);
                      }} placeholder="Time (e.g. 7:30pm)" placeholderTextColor={colors.textMuted} />
                    </View>
                    <TouchableOpacity onPress={() => removeStop(i)}>
                      <Icon name="close-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {planStops.length > 0 && (
                <View style={styles.routeSummary}>
                  <Icon name="navigate" size={16} color="#FF6B35" />
                  <Text style={styles.routeSummaryText}>{planStops.length} stop{planStops.length > 1 ? 's' : ''} planned</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.createPlanBtn} onPress={handleCreatePlan} disabled={creating} data-testid="create-plan-btn">
                {creating ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={styles.createPlanText}>Plan This Night (+10 pts)</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Poll Modal */}
      <Modal visible={showPoll} transparent animationType="slide" onRequestClose={() => setShowPoll(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { backgroundColor: '#8B5CF6' }]}>
              <Text style={styles.modalTitle}>Create Poll</Text>
              <TouchableOpacity onPress={() => setShowPoll(false)} data-testid="close-poll-modal">
                <Icon name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>QUESTION</Text>
              <TextInput style={styles.formInput} value={pollQuestion} onChangeText={setPollQuestion} placeholder="Where should we pre-drink?" placeholderTextColor={colors.textMuted} data-testid="poll-question-input" />

              <Text style={styles.formLabel}>OPTIONS</Text>
              {pollOptions.map((opt, i) => (
                <View key={i} style={styles.pollOptRow}>
                  <TextInput style={[styles.formInput, { flex: 1, marginBottom: 0 }]} value={opt.label} onChangeText={t => {
                    const updated = [...pollOptions]; updated[i].label = t; setPollOptions(updated);
                  }} placeholder={`Option ${i + 1}`} placeholderTextColor={colors.textMuted} />
                  {i > 1 && <TouchableOpacity onPress={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}><Icon name="close-circle" size={20} color={colors.error} /></TouchableOpacity>}
                </View>
              ))}
              <TouchableOpacity style={styles.addOptionBtn} onPress={() => setPollOptions(prev => [...prev, { label: '' }])}>
                <Icon name="add" size={16} color={colors.accent} />
                <Text style={styles.addOptionText}>Add Option</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.createPlanBtn, { backgroundColor: '#8B5CF6' }]} onPress={handleCreatePoll} disabled={creatingPoll} data-testid="submit-poll-btn">
                {creatingPoll ? <ActivityIndicator color="#FFF" /> : <Text style={styles.createPlanText}>Create Poll</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PollSection({ planId, pollIds, onVote }: { planId: string; pollIds: string[]; onVote: (pollId: string, optId: string) => void }) {
  const [polls, setPolls] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const loaded = [];
      for (const pid of pollIds) {
        try {
          const p = await apiFetch<any>(`/api/social/poll/${pid}`);
          loaded.push(p);
        } catch {}
      }
      setPolls(loaded);
    })();
  }, [pollIds]);

  if (polls.length === 0) return null;

  return (
    <View style={pollStyles.container}>
      {polls.map(poll => (
        <View key={poll.id} style={pollStyles.card}>
          <Text style={pollStyles.question}>{poll.question}</Text>
          {poll.options.map((opt: any) => {
            const pct = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
            const isMyVote = poll.my_vote === opt.id;
            return (
              <TouchableOpacity key={opt.id} style={[pollStyles.option, isMyVote && pollStyles.optionVoted]} onPress={() => onVote(poll.id, opt.id)}>
                <View style={[pollStyles.optionFill, { width: `${pct}%` }]} />
                <Text style={[pollStyles.optionLabel, isMyVote && { color: '#8B5CF6' }]}>{opt.label}</Text>
                <Text style={pollStyles.optionPct}>{pct}%</Text>
              </TouchableOpacity>
            );
          })}
          <Text style={pollStyles.totalVotes}>{poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''}</Text>
        </View>
      ))}
    </View>
  );
}

const pollStyles = StyleSheet.create({
  container: { marginTop: spacing.sm },
  card: { backgroundColor: colors.glassMid, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: '#8B5CF620' },
  question: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  option: { position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.md, marginBottom: 6, backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  optionVoted: { borderColor: '#8B5CF6' },
  optionFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#8B5CF610', borderRadius: radius.md },
  optionLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, zIndex: 1 },
  optionPct: { fontSize: 12, fontWeight: '700', color: colors.textMuted, zIndex: 1 },
  totalVotes: { fontSize: 11, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: 1.5 },
  headerSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  scroll: { flex: 1 },

  // Tabs
  tabRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.glass, borderRadius: radius.lg, padding: 4, borderWidth: 1, borderColor: colors.glassBorderSubtle },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md },
  tabBtnActive: { backgroundColor: colors.backgroundElevated },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.accent },

  // Empty state
  emptyState: { alignItems: 'center', padding: 40, gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },

  // Feed
  feedCard: { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.glass, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.glassBorderSubtle, padding: spacing.md },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  feedAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.glassMid },
  feedNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  feedName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  feedTierDot: { width: 8, height: 8, borderRadius: 4 },
  feedTime: { fontSize: 11, color: colors.textMuted },
  feedContent: { marginBottom: spacing.sm },
  feedAction: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  feedEvent: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.backgroundCard, borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  feedEventImg: { width: 56, height: 56, borderRadius: radius.md },
  feedEventTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  feedEventVenue: { fontSize: 12, color: colors.accent, marginTop: 2 },
  feedEventDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  feedActions: { flexDirection: 'row', gap: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.glassBorderSubtle },
  feedActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feedActionText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  // Night builder
  newPlanBtn: { marginHorizontal: spacing.md, marginBottom: spacing.lg, borderRadius: radius.xl, overflow: 'hidden' },
  newPlanGrad: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  newPlanText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  newPlanSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Plan card
  planCard: { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.glass, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.glassBorderSubtle },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  planTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  planDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  crewBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: '#FF6B3515', borderWidth: 1, borderColor: '#FF6B3540' },
  crewBadgeText: { fontSize: 10, fontWeight: '800', color: '#FF6B35', letterSpacing: 1 },

  // Timeline
  timeline: { marginBottom: spacing.md },
  timelineStop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  timelineDot: { alignItems: 'center', width: 20 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  lineDown: { width: 2, height: 28, marginTop: 4 },
  stopInfo: { flex: 1, paddingBottom: spacing.md },
  stopVenue: { fontSize: 14, fontWeight: '700' },
  stopTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  stopOrder: { fontSize: 11, fontWeight: '700', color: colors.textMuted },

  // Members
  planMembers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  memberChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.glassMid, flexDirection: 'row', gap: 4 },
  memberConfirmed: { backgroundColor: '#10B98115', borderWidth: 1, borderColor: '#10B98140' },
  memberDeclined: { backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444440' },
  memberName: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
  memberStatus: { fontSize: 11, color: colors.textMuted },

  // Plan actions
  planActions: { flexDirection: 'row', gap: spacing.md },
  planActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border },
  planActionText: { fontSize: 12, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.backgroundCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: '#FF6B35' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  modalBody: { padding: spacing.lg },
  modalFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },

  // Form
  formLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 6 },
  formHint: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm },
  formInput: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  venueAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, marginRight: 8, backgroundColor: colors.glass },
  venueAddText: { fontSize: 12, fontWeight: '600' },

  // Stop row
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, padding: spacing.sm, backgroundColor: colors.glass, borderRadius: radius.md },
  stopNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stopNumText: { fontSize: 14, fontWeight: '800' },
  stopRowName: { fontSize: 14, fontWeight: '700' },
  stopTimeInput: { fontSize: 12, color: colors.textSecondary, padding: 0, marginTop: 2 },
  routeSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.md, backgroundColor: '#FF6B3510', borderRadius: radius.md, marginTop: spacing.sm },
  routeSummaryText: { fontSize: 13, fontWeight: '600', color: '#FF6B35' },
  createPlanBtn: { backgroundColor: '#FF6B35', paddingVertical: 16, borderRadius: radius.lg, alignItems: 'center' },
  createPlanText: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },

  // Poll form
  pollOptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.sm },
  addOptionText: { fontSize: 13, fontWeight: '600', color: colors.accent },
});
