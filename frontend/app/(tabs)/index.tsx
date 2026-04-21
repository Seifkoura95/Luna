/**
 * Luna Group VIP — Home Screen (Editorial redesign)
 *
 * Sections (top → bottom, between moon bg and tab bar):
 *   1. Hero swipeable featured events (55vh)
 *   2. News ticker (marquee)
 *   3. For You (1 big + horizontal small cards)
 *   4. Live Auctions (70% width horizontal scroll)
 *   5. VIP & Bottle Service promo banner (two CTAs)
 *   6. Our Venues (wide rectangular tiles)
 *   7. Trending this week (ranked list with oversized numeric watermark)
 *   8. What's New (editorial text cards, no images)
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  Platform,
  Animated,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { AppBackground } from '../../src/components/AppBackground';
import { api } from '../../src/utils/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_H * 0.55);

const LUNA_GOLD = '#FFD700';
const LUNA_RED = '#E31837';
const BG_1 = '#050505';
const BG_2 = '#0F0F0F';
const BG_3 = '#1A1A1A';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.55)';
const DEEP_MUTED = 'rgba(255,255,255,0.38)';

// --- Helpers ---------------------------------------------------------------

const SAMPLE_HERO_IMG =
  'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?auto=format&fit=crop&w=1200&q=80';
const SAMPLE_BOTTLE_IMG =
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80';

function fmtEventDate(ev: any): string {
  // Try multiple field combos used across Eventfinda + our own API
  const raw =
    ev?.datetime_start ||
    ev?.date_start ||
    ev?.starts_at ||
    (ev?.date && ev?.time ? `${ev.date}T${ev.time}:00` : null) ||
    ev?.date;
  if (!raw) return '';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return typeof raw === 'string' ? raw.slice(0, 10) : '';
    const day = d.toLocaleDateString('en-AU', { weekday: 'short' });
    const date = d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
    const time = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day}, ${date} · ${time}`;
  } catch {
    return '';
  }
}

// --- Animated bid ticker (Section 4) ---------------------------------------

function BidTicker({ value }: { value: number }) {
  const prev = useRef(value);
  const anim = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    if (prev.current !== value) {
      Animated.timing(anim, { toValue: value, duration: 600, useNativeDriver: false }).start();
      prev.current = value;
    }
  }, [value, anim]);
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => anim.removeListener(id);
  }, [anim]);
  return (
    <Text style={styles.auctionBid}>
      ${display.toLocaleString()}
    </Text>
  );
}

// --- Marquee ticker (Section 2) --------------------------------------------

function MarqueeTicker({ items }: { items: string[] }) {
  const text = items.join('   ·   ') + '   ·   ';
  const anim = useRef(new Animated.Value(0)).current;
  const [containerW, setContainerW] = useState(SCREEN_W);
  const [textW, setTextW] = useState(0);

  useEffect(() => {
    if (textW === 0) return;
    const duration = Math.max(12000, textW * 30);
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [textW, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -textW],
  });

  return (
    <View
      style={styles.ticker}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
    >
      <View style={styles.tickerLeft}>
        <View style={styles.tickerDot} />
        <Text style={styles.tickerLabel}>NEWS</Text>
      </View>
      <View style={styles.tickerTrackWrap}>
        <Animated.View style={[styles.tickerTrack, { transform: [{ translateX }] }]}>
          <Text
            style={styles.tickerText}
            numberOfLines={1}
            onLayout={(e) => textW === 0 && setTextW(e.nativeEvent.layout.width)}
          >
            {text}
          </Text>
          <Text style={styles.tickerText} numberOfLines={1}>{text}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

// --- Hero pager (Section 1) ------------------------------------------------

function HeroPager({
  items,
  insetTop,
  onBuy,
  onLearnMore,
}: {
  items: any[];
  insetTop: number;
  onBuy: (ev: any) => void;
  onLearnMore: (ev: any) => void;
}) {
  const [idx, setIdx] = useState(0);
  const data = items.length > 0 ? items.slice(0, 5) : [null];
  return (
    <View style={{ height: HERO_H, width: SCREEN_W }}>
      <FlatList
        data={data}
        keyExtractor={(it, i) => (it?.id ?? `hero-${i}`).toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setIdx(i);
        }}
        renderItem={({ item }) => {
          const img = item?.image_url || item?.image || SAMPLE_HERO_IMG;
          const venue = (item?.venue_name || item?.venue || 'ECLIPSE BRISBANE').toUpperCase();
          const title = item?.title || item?.name || 'Tonight at Eclipse';
          const when = item?.date_start || item?.starts_at || item?.date;
          return (
            <View style={{ width: SCREEN_W, height: HERO_H }}>
              <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              {/* FEATURED pill */}
              <View style={[styles.featuredPill, { top: insetTop + 16 }]} data-testid="hero-featured-pill">
                <Text style={styles.featuredPillText}>FEATURED</Text>
              </View>
              {/* Content */}
              <View style={styles.heroContent}>
                <Text style={styles.heroVenue}>{venue}</Text>
                <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>
                {!!when && <Text style={styles.heroDate}>{fmtEventDate(item)}</Text>}
                <View style={styles.heroCtaRow}>
                  <TouchableOpacity
                    style={styles.ctaPrimary}
                    onPress={() => onBuy(item)}
                    data-testid="hero-buy-tickets-btn"
                  >
                    <Text style={styles.ctaPrimaryText}>BUY TICKETS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.ctaGhost}
                    onPress={() => onLearnMore(item)}
                    data-testid="hero-learn-more-btn"
                  >
                    <Text style={styles.ctaGhostText}>LEARN MORE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />
      {data.length > 1 && (
        <View style={styles.heroDots}>
          {data.map((_, i) => (
            <View
              key={i}
              style={[
                styles.heroDot,
                i === idx ? styles.heroDotActive : undefined,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// --- Section header --------------------------------------------------------

function SectionHeader({
  label,
  sub,
  rightLabel,
  onRightPress,
  liveDot,
  testId,
}: {
  label: string;
  sub?: string;
  rightLabel?: string;
  onRightPress?: () => void;
  liveDot?: boolean;
  testId?: string;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!liveDot) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [liveDot, pulse]);
  return (
    <View style={styles.sectionHeader} data-testid={testId}>
      <View style={styles.sectionHeaderLeft}>
        {liveDot && <Animated.View style={[styles.liveDot, { opacity: pulse }]} />}
        <Text style={styles.sectionLabel}>{label}</Text>
        {!!sub && <Text style={styles.sectionSub}>{sub}</Text>}
      </View>
      {!!rightLabel && (
        <TouchableOpacity onPress={onRightPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.seeAll}>{rightLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ==========================================================================
// Home screen
// ==========================================================================

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [featured, setFeatured] = useState<any[]>([]);
  const [forYou, setForYou] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [tickerItems, setTickerItems] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const [feed, venuesData, auctionsData, tickerRes, annsRes] = await Promise.all([
        api.getEventsFeed(30).catch(() => ({} as any)),
        api.getVenues().catch(() => [] as any[]),
        api.getAuctions(undefined, 'active').catch(() => ({ auctions: [] } as any)),
        api.getAnnouncements(true).catch(() => ({ announcements: [] } as any)),
        api.getAnnouncements(false).catch(() => ({ announcements: [] } as any)),
      ]);

      // Eventfinda feed shape: { tonight, tomorrow, featured, upcoming }
      const f: any = feed || {};
      const featuredEvents = [...(f.featured || []), ...(f.tonight || []), ...(f.upcoming || [])];
      const allEvents: any[] = [
        ...(f.tonight || []),
        ...(f.tomorrow || []),
        ...(f.featured || []),
        ...(f.upcoming || []),
      ];
      // De-dupe by id
      const seen = new Set<string>();
      const uniqueAll = allEvents.filter((e) => {
        const k = e.id || e.eventfinda_id;
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      setFeatured((featuredEvents.length ? featuredEvents : uniqueAll).slice(0, 5));
      setForYou(uniqueAll.slice(0, 8));
      setTrending(uniqueAll.slice(0, 5));

      setVenues((venuesData as any[]) || []);
      const auctionList = (auctionsData as any).auctions || auctionsData || [];
      setAuctions(auctionList.slice(0, 6));

      const ticker = (tickerRes as any).announcements || [];
      setTickerItems(ticker.map((t: any) => `${(t.category || 'NEWS').toUpperCase()} — ${t.title}`));
      setAnnouncements(((annsRes as any).announcements || []));
    } catch (e) {
      // Keep defaults
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Section actions ---------------------------------------------------------

  const openTickets = (ev: any) => {
    if (ev?.ticket_url || ev?.url) Linking.openURL(ev.ticket_url || ev.url).catch(() => {});
    else router.push('/(tabs)/explore');
  };
  const openEvent = (ev: any) => router.push(`/event-detail?id=${ev?.id || ev?.event_id || ''}`);
  const openAuction = (a: any) => router.push(`/(tabs)/auctions`);
  const openVenue = (v: any) => router.push(`/venue/${v?.id}`);
  const openVIPBooking = () => {
    // Default to Eclipse; if a venue has a sevenrooms_url, open it; else navigate to booking flow.
    const eclipse = venues.find((v) => v?.id === 'eclipse');
    const url = eclipse?.sevenrooms_url;
    if (url) Linking.openURL(url).catch(() => router.push('/venue/eclipse'));
    else router.push('/venue/eclipse');
  };
  const openBottleService = () => router.push('/venue-menu?venue_id=eclipse');

  // --- Render --------------------------------------------------------------

  const largeForYou = forYou[0];
  const smallForYou = forYou.slice(1, 5);

  return (
    <View style={styles.root}>
      <AppBackground intensity={22} tint="dark" overlayOpacity={0.88} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LUNA_GOLD} />
        }
      >
        {/* SECTION 1 — HERO */}
        <HeroPager items={featured} insetTop={insets.top} onBuy={openTickets} onLearnMore={openEvent} />

        {/* SECTION 2 — TICKER */}
        <MarqueeTicker
          items={
            tickerItems.length > 0
              ? tickerItems
              : [
                  'ECLIPSE 2ND BIRTHDAY — FOUNDERS APP LAUNCH THIS SATURDAY',
                  'VENJENT (UK) RETURNING MAY 15',
                  'LUNA REWARDS NOW LIVE — EARN POINTS ON EVERY VISIT',
                  'DENZEL CURRY COMING SOON',
                ]
          }
        />

        {/* SECTION 3 — FOR YOU */}
        <View style={[styles.section, { backgroundColor: BG_2 }]}>
          <SectionHeader label="FOR YOU" sub="Personalised picks" testId="section-for-you" />
          {largeForYou && (
            <TouchableOpacity
              style={styles.forYouLarge}
              onPress={() => openEvent(largeForYou)}
              activeOpacity={0.85}
              data-testid="for-you-large-card"
            >
              <Image
                source={{ uri: largeForYou.image_url || largeForYou.image || SAMPLE_HERO_IMG }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.85)']}
                locations={[0.3, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.forYouLargeBadge}>
                <Text style={styles.forYouLargeBadgeText}>AI PICK</Text>
              </View>
              <View style={styles.forYouLargeContent}>
                <Text style={styles.forYouLargeVenue}>
                  {(largeForYou.venue_name || largeForYou.venue || 'ECLIPSE').toUpperCase()}
                </Text>
                <Text style={styles.forYouLargeTitle} numberOfLines={2}>
                  {largeForYou.title || largeForYou.name}
                </Text>
                <Text style={styles.forYouLargeDate}>
                  {fmtEventDate(largeForYou)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          <FlatList
            data={smallForYou}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(it, i) => (it?.id ?? i).toString()}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingTop: 14 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.forYouSmall}
                onPress={() => openEvent(item)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: item.image_url || item.image || SAMPLE_HERO_IMG }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.9)']}
                  locations={[0.3, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.forYouSmallContent}>
                  <Text style={styles.forYouSmallTitle} numberOfLines={2}>
                    {item.title || item.name}
                  </Text>
                  <Text style={styles.forYouSmallDate}>
                    {fmtEventDate(item)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* SECTION 4 — LIVE AUCTIONS */}
        <View style={[styles.section, { backgroundColor: BG_1 }]}>
          <SectionHeader
            label="LIVE AUCTIONS"
            liveDot
            rightLabel="SEE ALL"
            onRightPress={() => router.push('/(tabs)/auctions')}
            testId="section-live-auctions"
          />
          <FlatList
            data={auctions}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(it) => it.id || it.auction_id}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingTop: 4 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.auctionCard}
                onPress={() => openAuction(item)}
                activeOpacity={0.85}
                data-testid={`auction-card-${item.id || item.auction_id}`}
              >
                <Image
                  source={{ uri: item.image_url || item.image || SAMPLE_BOTTLE_IMG }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.92)']}
                  locations={[0.2, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.auctionLiveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.auctionLiveText}>LIVE</Text>
                </View>
                <View style={styles.auctionContent}>
                  <Text style={styles.auctionTitle} numberOfLines={2}>
                    {item.title || item.name || 'VIP Auction'}
                  </Text>
                  <Text style={styles.auctionVenue} numberOfLines={1}>
                    {item.venue_name || item.venue || ''}
                  </Text>
                  <View style={styles.auctionFooter}>
                    <View>
                      <Text style={styles.auctionFooterLabel}>CURRENT BID</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <BidTicker value={Number(item.current_bid || item.starting_bid || 0)} />
                        <Icon name="arrow-up" size={14} color={LUNA_GOLD} />
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* SECTION 5 — VIP BANNER */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={openVIPBooking}
          style={styles.vipBannerWrap}
          data-testid="vip-banner"
        >
          <LinearGradient
            colors={['#1A0000', '#0A0000']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.vipGlow} />
          <View style={styles.vipLeft}>
            <Icon name="ribbon" size={26} color={LUNA_GOLD} />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.vipTitle}>VIP BOOTHS</Text>
              <Text style={styles.vipPrice}>from $95/night</Text>
            </View>
          </View>
          <View style={styles.vipCtaRow}>
            <TouchableOpacity
              style={styles.vipBottleBtn}
              onPress={openBottleService}
              data-testid="vip-bottle-btn"
            >
              <Text style={styles.vipBottleText}>BOTTLES</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.vipBookBtn}
              onPress={openVIPBooking}
              data-testid="vip-book-btn"
            >
              <Text style={styles.vipBookText}>BOOK NOW</Text>
              <Icon name="arrow-forward" size={16} color={WHITE} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* SECTION 6 — VENUES */}
        <View style={[styles.section, { backgroundColor: BG_2 }]}>
          <SectionHeader label="OUR VENUES" testId="section-venues" />
          <FlatList
            data={venues.filter((v: any) => !v?.is_hidden)}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(it: any) => it.id}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
            renderItem={({ item }) => {
              const isClub = (item.type || '').toLowerCase().includes('club') || (item.type || '').toLowerCase().includes('bar');
              const accent = isClub ? LUNA_RED : LUNA_GOLD;
              return (
                <TouchableOpacity
                  style={styles.venueTile}
                  onPress={() => openVenue(item)}
                  activeOpacity={0.85}
                  data-testid={`venue-tile-${item.id}`}
                >
                  <Image
                    source={{ uri: item.hero_image || item.image_url || SAMPLE_HERO_IMG }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.9)']}
                    locations={[0.35, 1]}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={[styles.venueAccent, { backgroundColor: accent }]} />
                  <View style={styles.venueContent}>
                    <Text style={[styles.venueType, { color: accent }]}>
                      {(item.type || 'VENUE').toUpperCase()}
                    </Text>
                    <Text style={styles.venueName} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </View>
                  <View style={styles.venueArrow}>
                    <Icon name="arrow-forward" size={18} color={WHITE} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* SECTION 7 — TRENDING */}
        <View style={[styles.section, { backgroundColor: BG_1, paddingHorizontal: 20 }]}>
          <SectionHeader label="TRENDING" sub="This week" testId="section-trending" />
          <View>
            {trending.map((ev, i) => (
              <TouchableOpacity
                key={ev.id || i}
                style={styles.trendRow}
                onPress={() => openEvent(ev)}
                activeOpacity={0.75}
                data-testid={`trend-row-${i}`}
              >
                <Text style={styles.trendRank}>{String(i + 1).padStart(2, '0')}</Text>
                <Image
                  source={{ uri: ev.image_url || ev.image || SAMPLE_HERO_IMG }}
                  style={styles.trendThumb}
                />
                <View style={styles.trendTextBlock}>
                  <Text style={styles.trendTitle} numberOfLines={2}>
                    {ev.title || ev.name}
                  </Text>
                  <Text style={styles.trendVenue} numberOfLines={1}>
                    {ev.venue_name || ev.venue || ''}
                  </Text>
                  <Text style={styles.trendDate}>
                    {fmtEventDate(ev)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* SECTION 8 — WHAT'S NEW */}
        <View style={[styles.section, { backgroundColor: BG_2 }]}>
          <SectionHeader label="WHAT'S NEW" testId="section-whats-new" />
          <FlatList
            data={announcements.length > 0 ? announcements : [
              { id: 'news1', category: 'APP UPDATE', color: LUNA_GOLD, title: 'Luna Rewards are live — start earning tonight', date: '22 Feb' },
              { id: 'news2', category: 'ARTIST ANNOUNCED', color: LUNA_RED, title: 'Venjent returns from the UK · May 15', date: '21 Feb' },
              { id: 'news3', category: 'NEW VENUE', color: '#60A5FA', title: 'Su Casa Gold Coast opens its rooftop summer menu', date: '20 Feb' },
            ]}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(it: any) => it.id}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            renderItem={({ item }) => {
              const pillColor = item.color || LUNA_GOLD;
              return (
                <TouchableOpacity
                  style={styles.newsCard}
                  onPress={() => item.link_url && Linking.openURL(item.link_url).catch(() => {})}
                  activeOpacity={0.85}
                  data-testid={`news-card-${item.id}`}
                >
                  <View style={[styles.newsPill, { backgroundColor: `${pillColor}22`, borderColor: pillColor }]}>
                    <Text style={[styles.newsPillText, { color: pillColor }]}>{item.category}</Text>
                  </View>
                  <Text style={styles.newsTitle} numberOfLines={3}>{item.title}</Text>
                  <Text style={styles.newsDate}>{item.date || ''}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_1 },
  scroll: { flex: 1 },

  // ---- Hero --------------------------------------------------------------
  featuredPill: {
    position: 'absolute',
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: LUNA_GOLD,
  },
  featuredPillText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  heroContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
  },
  heroVenue: {
    color: LUNA_GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 8,
  },
  heroTitle: {
    color: WHITE,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: 0.3,
  },
  heroDate: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 10,
    fontWeight: '500',
  },
  heroCtaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  ctaPrimary: {
    flex: 1,
    backgroundColor: LUNA_RED,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 14,
  },
  ctaPrimaryText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 2,
  },
  ctaGhost: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    paddingVertical: 11.5,
    alignItems: 'center',
    borderRadius: 14,
  },
  ctaGhostText: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
  },
  heroDots: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  heroDot: {
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  heroDotActive: { backgroundColor: LUNA_GOLD, width: 28 },

  // ---- Ticker ------------------------------------------------------------
  ticker: {
    height: 36,
    backgroundColor: BG_3,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  tickerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LUNA_RED },
  tickerLabel: { color: LUNA_GOLD, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  tickerTrackWrap: { flex: 1, overflow: 'hidden' },
  tickerTrack: { flexDirection: 'row', paddingLeft: 12 },
  tickerText: {
    color: WHITE,
    fontSize: 12,
    letterSpacing: 1.2,
    paddingVertical: 11,
  },

  // ---- Section header ----------------------------------------------------
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 14,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  sectionLabel: {
    color: LUNA_GOLD,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sectionSub: {
    color: DEEP_MUTED,
    fontSize: 12,
    fontWeight: '500',
  },
  seeAll: {
    color: LUNA_RED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LUNA_RED,
    alignSelf: 'center',
  },

  section: {},

  // ---- For You -----------------------------------------------------------
  forYouLarge: {
    height: 200,
    marginHorizontal: 20,
    borderRadius: 14,
    overflow: 'hidden',
  },
  forYouLargeBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: LUNA_GOLD,
  },
  forYouLargeBadgeText: { color: '#000', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  forYouLargeContent: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  forYouLargeVenue: { color: LUNA_GOLD, fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },
  forYouLargeTitle: { color: WHITE, fontSize: 22, fontWeight: '900', marginTop: 6, lineHeight: 26 },
  forYouLargeDate: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },

  forYouSmall: {
    width: SCREEN_W * 0.55,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
  },
  forYouSmallContent: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  forYouSmallTitle: { color: WHITE, fontSize: 15, fontWeight: '900', lineHeight: 18 },
  forYouSmallDate: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 4 },

  // ---- Auctions ----------------------------------------------------------
  auctionCard: {
    width: SCREEN_W * 0.7,
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(227,24,55,0.25)',
  },
  auctionLiveBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(227,24,55,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  auctionLiveText: { color: WHITE, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  auctionContent: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  auctionTitle: { color: WHITE, fontSize: 17, fontWeight: '900', lineHeight: 20 },
  auctionVenue: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },
  auctionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  auctionFooterLabel: { color: MUTED, fontSize: 9, letterSpacing: 1.5, fontWeight: '800' },
  auctionBid: { color: LUNA_GOLD, fontSize: 19, fontWeight: '900', marginTop: 2 },

  // ---- VIP banner --------------------------------------------------------
  vipBannerWrap: {
    marginTop: 28,
    marginHorizontal: 20,
    borderRadius: 14,
    height: 100,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(227,24,55,0.30)',
  },
  vipGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(227,24,55,0.20)',
  },
  vipLeft: { flexDirection: 'row', alignItems: 'center' },
  vipTitle: { color: WHITE, fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  vipPrice: { color: LUNA_GOLD, fontSize: 12, marginTop: 2, fontWeight: '600' },
  vipCtaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  vipBottleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 100,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.5)',
  },
  vipBottleText: { color: LUNA_GOLD, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  vipBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LUNA_RED,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
  },
  vipBookText: { color: WHITE, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },

  // ---- Venues ------------------------------------------------------------
  venueTile: {
    width: SCREEN_W * 0.75,
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
  },
  venueAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  venueContent: { position: 'absolute', left: 16, right: 52, bottom: 16 },
  venueType: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  venueName: { color: WHITE, fontSize: 22, fontWeight: '900', marginTop: 4 },
  venueArrow: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Trending ----------------------------------------------------------
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  trendRank: {
    position: 'absolute',
    left: -8,
    top: 6,
    color: 'rgba(255,255,255,0.08)',
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: -2,
  },
  trendThumb: { width: 60, height: 60, borderRadius: 10, marginLeft: 48, marginRight: 14 },
  trendTextBlock: { flex: 1 },
  trendTitle: { color: WHITE, fontSize: 15, fontWeight: '800', lineHeight: 18 },
  trendVenue: { color: MUTED, fontSize: 11, marginTop: 2 },
  trendDate: { color: LUNA_GOLD, fontSize: 11, marginTop: 2, fontWeight: '700' },

  // ---- What's New (news cards, no images) -------------------------------
  newsCard: {
    width: SCREEN_W * 0.65,
    backgroundColor: BG_3,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    minHeight: 140,
    justifyContent: 'space-between',
  },
  newsPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  newsPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  newsTitle: { color: WHITE, fontSize: 16, fontWeight: '800', marginTop: 10, lineHeight: 20 },
  newsDate: { color: DEEP_MUTED, fontSize: 11, marginTop: 8 },
});
