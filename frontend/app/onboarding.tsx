import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Animated,
  ViewToken,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing } from '../src/theme/colors';
import { Icon } from '../src/components/Icon';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ONBOARDING_KEY = 'luna_onboarding_complete';

// Brand-consistent accents (app uses blue + gold, not red)
const ACCENT_BLUE = colors.accent;        // #2563EB
const ACCENT_GOLD = colors.gold;          // #D4A832
const LUNA_WHITE = colors.text;
const LUNA_MUTED = colors.textMuted;
const LUNA_BLACK = colors.background;
const LUNA_BORDER = 'rgba(255,255,255,0.10)';
const LUNA_SURFACE = colors.surface;

interface Slide {
  id: string;
  tag: string;
  headline: string;
  sub: string;
  accentColor: string;
  gradientColors: [string, string, string];
  illustration: 'splash' | 'venues' | 'events' | 'rewards' | 'vip';
}

const SLIDES: Slide[] = [
  {
    id: '0',
    tag: 'WELCOME',
    headline: 'Your Night\nStarts Here.',
    sub: "Luna Group Hospitality — Brisbane's premier nightlife destination. One app for every experience we create.",
    accentColor: ACCENT_BLUE,
    gradientColors: ['#0D1230', '#070918', LUNA_BLACK],
    illustration: 'splash',
  },
  {
    id: '1',
    tag: 'OUR VENUES',
    headline: 'Eclipse.\nKenjin.\nAll Under Luna.',
    sub: 'From Eclipse Superclub to Kenjin Afterdark — access every Luna venue, every night, from a single app.',
    accentColor: ACCENT_BLUE,
    gradientColors: ['#0A1028', '#060914', LUNA_BLACK],
    illustration: 'venues',
  },
  {
    id: '2',
    tag: 'EVENTS & TICKETS',
    headline: 'World-Class\nArtists.\nYour City.',
    sub: "Travis Scott. Skepta. Vintage Culture. Peking Duk. Book tables and tickets for Brisbane's biggest nights.",
    accentColor: ACCENT_BLUE,
    gradientColors: ['#0A1028', '#050712', LUNA_BLACK],
    illustration: 'events',
  },
  {
    id: '3',
    tag: 'LUNA REWARDS',
    headline: 'Every Visit\nEarns More.',
    sub: 'Collect Luna Points on every visit. Unlock exclusive perks, free entry, and bottle upgrades as you level up.',
    accentColor: ACCENT_GOLD,
    gradientColors: ['#1A1400', '#0A0900', LUNA_BLACK],
    illustration: 'rewards',
  },
  {
    id: '4',
    tag: 'VIP ACCESS',
    headline: 'The Night\nIs Yours.',
    sub: 'Reserve booths, skip queues, and get personalised service at every Luna venue. This is how nightlife should feel.',
    accentColor: ACCENT_BLUE,
    gradientColors: ['#0D1230', '#070918', LUNA_BLACK],
    illustration: 'vip',
  },
];

// ─── Illustrations ────────────────────────────────────────────────────────────
const SplashIllustration: React.FC = () => (
  <View style={styles.illustrationContainer}>
    <View style={styles.logoGlowRing}>
      <LinearGradient colors={['rgba(37,99,235,0.25)', 'transparent']} style={styles.glowCircle} />
    </View>
    <View style={styles.logoCircle}>
      <LinearGradient colors={[colors.accent, colors.accentDark]} style={styles.logoInner}>
        <Text style={styles.logoStar}>✦</Text>
        <Text style={styles.logoWordmark}>LUNA</Text>
      </LinearGradient>
    </View>
    {['Eclipse', 'Kenjin', 'After Dark', 'Rooftop VIP', 'Rewards'].map((tag, i) => {
      const angles = [20, 80, 150, 220, 310];
      const radii = [130, 145, 138, 142, 128];
      const angle = (angles[i] * Math.PI) / 180;
      const r = radii[i];
      return (
        <View
          key={tag}
          style={[
            styles.floatingTag,
            {
              left: SCREEN_WIDTH / 2 + r * Math.cos(angle) - 45,
              top: SCREEN_HEIGHT * 0.22 + r * Math.sin(angle) - 16,
            },
          ]}
          testID={`onboarding-splash-tag-${tag}`}
        >
          <BlurView intensity={40} tint="dark" style={styles.tagBlur}>
            <Text style={styles.tagText}>{tag}</Text>
          </BlurView>
        </View>
      );
    })}
  </View>
);

const VenuesIllustration: React.FC = () => (
  <View style={styles.illustrationContainer}>
    {[
      { name: 'ECLIPSE', sub: 'Brunswick St, Fortitude Valley', color: colors.accent, offset: 0 },
      { name: 'KENJIN', sub: 'Afterdark Room', color: colors.accentDark, offset: 20 },
      { name: 'AFTER DARK', sub: 'Lower Level', color: colors.accentBright, offset: 40 },
    ].map((venue, i) => (
      <View
        key={venue.name}
        style={[
          styles.venueCard,
          {
            top: 60 + i * 72,
            left: 20 + i * 12,
            right: 20 - i * 12,
            zIndex: 3 - i,
            opacity: 1 - i * 0.15,
          },
        ]}
      >
        <LinearGradient
          colors={[venue.color + '33', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.venueCardAccent, { backgroundColor: venue.color }]} />
        <View style={styles.venueCardContent}>
          <Text style={styles.venueCardName}>{venue.name}</Text>
          <Text style={styles.venueCardSub}>{venue.sub}</Text>
        </View>
        <View style={styles.venueCardDot}>
          <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
          <Text style={styles.dotLabel}>OPEN</Text>
        </View>
      </View>
    ))}
  </View>
);

const EventsIllustration: React.FC = () => (
  <View style={styles.illustrationContainer}>
    <View style={styles.eventsGrid}>
      {[
        { name: 'SKEPTA', genre: 'Grime / Hip-Hop', date: 'OCT 5' },
        { name: 'VINTAGE\nCULTURE', genre: 'House', date: 'MAY 4' },
        { name: 'PEKING DUK', genre: 'Electro / House', date: 'FRI' },
        { name: 'CHASE B', genre: 'Hip-Hop', date: 'OCT 26' },
      ].map((artist, i) => (
        <View
          key={artist.name}
          style={[
            styles.artistCard,
            i === 0 && styles.artistCardLarge,
            i > 0 && { marginTop: i === 2 ? -10 : 0 },
          ]}
        >
          <LinearGradient
            colors={[colors.accent + '44', colors.surface]}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.artistName}>{artist.name}</Text>
          <Text style={styles.artistGenre}>{artist.genre}</Text>
          <View style={styles.artistDateBadge}>
            <Text style={styles.artistDate}>{artist.date}</Text>
          </View>
        </View>
      ))}
    </View>
  </View>
);

const RewardsIllustration: React.FC = () => (
  <View style={styles.illustrationContainer}>
    <View style={styles.pointsCard}>
      <LinearGradient colors={['#1A1400', '#0A0900']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.pointsCardBorder} />
      <Text style={styles.pointsLabel}>LUNA POINTS</Text>
      <Text style={styles.pointsValue}>20,329</Text>
      <View style={styles.tierRow}>
        <View style={[styles.tierBadge, { borderColor: colors.bronze }]}>
          <Text style={[styles.tierText, { color: colors.bronze }]}>BRONZE</Text>
        </View>
        <Text style={styles.tierMult}>1.0×</Text>
      </View>
      <View style={styles.progressTrack}>
        <LinearGradient
          colors={[colors.goldBright, colors.gold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: '31%' }]}
        />
      </View>
      <Text style={styles.progressLabel}>31% to Silver</Text>
    </View>
    {['Free Entry', 'VIP Upgrade', 'Bottle Service', 'Priority Queue'].map((perk, i) => (
      <View key={perk} style={[styles.perkPill, { top: 240 + i * 44, left: 20 + (i % 2) * 30 }]}>
        <Text style={styles.perkStar}>✦</Text>
        <Text style={styles.perkText}>{perk}</Text>
      </View>
    ))}
  </View>
);

const VipIllustration: React.FC = () => (
  <View style={styles.illustrationContainer}>
    <View style={styles.vipCard}>
      <LinearGradient
        colors={['rgba(37,99,235,0.15)', 'rgba(18,18,30,0.95)']}
        style={StyleSheet.absoluteFillObject}
      />
      <Text style={styles.vipCardLabel}>VIP BOOTH</Text>
      <Text style={styles.vipCardName}>TABLE 8 — FLOOR 2</Text>
      <View style={styles.vipDivider} />
      <View style={styles.vipDetails}>
        {[
          ['GUESTS', '4 pax'],
          ['ARRIVAL', '10:00 PM'],
          ['HOST', 'Assigned'],
          ['STATUS', 'Confirmed'],
        ].map(([k, v]) => (
          <View key={k} style={styles.vipDetailRow}>
            <Text style={styles.vipDetailKey}>{k}</Text>
            <Text style={styles.vipDetailVal}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
    <View style={styles.qrTile}>
      <View style={styles.qrGrid}>
        {Array.from({ length: 49 }).map((_, idx) => {
          const on = [0, 1, 2, 5, 6, 7, 9, 11, 12, 14, 16, 18, 21, 22, 24, 25, 27, 28, 30, 35, 36, 37, 38, 42, 43, 44, 46, 48].includes(idx);
          return (
            <View key={idx} style={[styles.qrCell, on && { backgroundColor: LUNA_WHITE }]} />
          );
        })}
      </View>
      <Text style={styles.qrLabel}>SCAN AT DOOR</Text>
    </View>
  </View>
);

const ILLUSTRATIONS = {
  splash: SplashIllustration,
  venues: VenuesIllustration,
  events: EventsIllustration,
  rewards: RewardsIllustration,
  vip: VipIllustration,
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    },
    []
  );

  // Auto-advance slides every 6s until the user interacts or reaches the last slide
  useEffect(() => {
    if (userInteracted) return;
    if (currentIndex >= SLIDES.length - 1) return;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }, 6000);
    return () => clearTimeout(timer);
  }, [currentIndex, userInteracted]);

  const completeAndGoToLogin = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // ignore storage failure — still navigate
    }
    router.replace('/login');
  };

  const goNext = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setUserInteracted(true);
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeAndGoToLogin();
    }
  };

  const skip = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setUserInteracted(true);
    completeAndGoToLogin();
  };

  const renderSlide = ({ item }: { item: Slide }) => {
    const Illustration = ILLUSTRATIONS[item.illustration];
    return (
      <View style={styles.slide}>
        <LinearGradient
          colors={item.gradientColors}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.illustrationZone, { paddingTop: insets.top + 20 }]}>
          <Illustration />
        </View>
        <View style={[styles.contentCard, { paddingBottom: insets.bottom + 120 }]}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={styles.contentCardBorder} />
          <Text style={[styles.slideTag, { color: item.accentColor }]}>{item.tag}</Text>
          <Text style={styles.slideHeadline}>{item.headline}</Text>
          <Text style={styles.slideSub}>{item.sub}</Text>
        </View>
      </View>
    );
  };

  const accent = SLIDES[currentIndex]?.accentColor ?? ACCENT_BLUE;
  const isLast = currentIndex === SLIDES.length - 1;
  const ctaGradient: [string, string] =
    accent === ACCENT_GOLD
      ? [colors.goldBright, colors.goldDark]
      : [colors.accentBright, colors.accentDark];
  const ctaTextColor = accent === ACCENT_GOLD ? colors.textInverse : LUNA_WHITE;

  return (
    <View style={styles.container} testID="onboarding-screen">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setUserInteracted(true)}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        renderItem={renderSlide}
        testID="onboarding-slides"
      />

      {/* Bottom nav bar */}
      <View style={[styles.navBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [6, 24, 6],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: i <= currentIndex ? accent : LUNA_BORDER,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.ctaRow}>
          <TouchableOpacity
            onPress={skip}
            style={styles.skipBtn}
            activeOpacity={0.7}
            testID="onboarding-skip-btn"
          >
            <Text style={styles.skipText}>{isLast ? '' : 'Skip'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={goNext}
            activeOpacity={0.85}
            style={styles.nextBtnWrap}
            testID="onboarding-next-btn"
          >
            <LinearGradient
              colors={ctaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextBtn}
            >
              <Text style={[styles.nextBtnText, { color: ctaTextColor }]}>
                {isLast ? 'GET STARTED' : 'NEXT'}
              </Text>
              {!isLast && (
                <Icon name="arrow-forward" size={16} color={ctaTextColor} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LUNA_BLACK },
  slide: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, overflow: 'hidden' },

  illustrationZone: { height: SCREEN_HEIGHT * 0.55, overflow: 'visible' },
  illustrationContainer: { flex: 1, position: 'relative' },

  contentCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: SCREEN_HEIGHT * 0.45,
    paddingTop: 28,
    paddingHorizontal: 28,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  contentCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  slideTag: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 12,
  },
  slideHeadline: {
    fontSize: 36,
    fontWeight: '900',
    color: LUNA_WHITE,
    letterSpacing: -0.5,
    lineHeight: 42,
    marginBottom: 16,
  },
  slideSub: {
    fontSize: 15,
    color: LUNA_MUTED,
    lineHeight: 24,
    letterSpacing: 0.1,
  },

  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  dot: { height: 6, borderRadius: 3 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipBtn: { padding: 8, minWidth: 60 },
  skipText: { fontSize: 14, color: LUNA_MUTED, letterSpacing: 0.5, fontWeight: '500' },
  nextBtnWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
  },
  nextBtnText: { fontSize: 13, fontWeight: '900', letterSpacing: 2 },

  // Splash
  logoGlowRing: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    left: SCREEN_WIDTH / 2 - 140,
    top: SCREEN_HEIGHT * 0.02,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glowCircle: { width: 280, height: 280, borderRadius: 140 },
  logoCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    left: SCREEN_WIDTH / 2 - 70,
    top: SCREEN_HEIGHT * 0.02 + 70,
    overflow: 'hidden',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
  },
  logoInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  logoStar: { fontSize: 32, color: LUNA_WHITE },
  logoWordmark: {
    fontSize: 16,
    fontWeight: '900',
    color: LUNA_WHITE,
    letterSpacing: 4,
  },
  floatingTag: { position: 'absolute', borderRadius: 20, overflow: 'hidden' },
  tagBlur: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tagText: { fontSize: 11, fontWeight: '600', color: LUNA_WHITE, letterSpacing: 0.5 },

  // Venues
  venueCard: {
    position: 'absolute',
    height: 72,
    borderRadius: 16,
    backgroundColor: LUNA_SURFACE,
    borderWidth: 0.5,
    borderColor: LUNA_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  venueCardAccent: { width: 3, height: '60%', borderRadius: 2, marginLeft: 14 },
  venueCardContent: { flex: 1, paddingLeft: 12 },
  venueCardName: { fontSize: 16, fontWeight: '900', color: LUNA_WHITE, letterSpacing: 1 },
  venueCardSub: { fontSize: 12, color: LUNA_MUTED, marginTop: 2 },
  venueCardDot: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 16 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotLabel: { fontSize: 10, fontWeight: '700', color: colors.success, letterSpacing: 1 },

  // Events
  eventsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 10,
    alignContent: 'flex-start',
  },
  artistCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    height: 120,
    borderRadius: 14,
    backgroundColor: LUNA_SURFACE,
    borderWidth: 0.5,
    borderColor: LUNA_BORDER,
    padding: 14,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  artistCardLarge: { width: SCREEN_WIDTH - 32, height: 140 },
  artistName: { fontSize: 18, fontWeight: '900', color: LUNA_WHITE, letterSpacing: 0.5 },
  artistGenre: { fontSize: 11, color: LUNA_MUTED, marginTop: 2 },
  artistDateBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  artistDate: { fontSize: 10, fontWeight: '700', color: LUNA_WHITE, letterSpacing: 1 },

  // Rewards
  pointsCard: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 20,
    padding: 22,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#3A3000',
  },
  pointsCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(212,168,50,0.3)',
  },
  pointsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    color: ACCENT_GOLD,
    marginBottom: 6,
  },
  pointsValue: {
    fontSize: 44,
    fontWeight: '900',
    color: LUNA_WHITE,
    letterSpacing: -1,
    lineHeight: 48,
  },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 14 },
  tierBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tierText: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  tierMult: { fontSize: 14, fontWeight: '700', color: LUNA_MUTED },
  progressTrack: { height: 4, backgroundColor: '#272727', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 11, color: LUNA_MUTED, marginTop: 6 },
  perkPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LUNA_SURFACE,
    borderWidth: 0.5,
    borderColor: LUNA_BORDER,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  perkStar: { fontSize: 10, color: ACCENT_GOLD },
  perkText: { fontSize: 12, fontWeight: '500', color: LUNA_WHITE },

  // VIP
  vipCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(37,99,235,0.3)',
  },
  vipCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    color: ACCENT_BLUE,
    marginBottom: 6,
  },
  vipCardName: { fontSize: 20, fontWeight: '900', color: LUNA_WHITE, letterSpacing: 0.5 },
  vipDivider: { height: 0.5, backgroundColor: LUNA_BORDER, marginVertical: 14 },
  vipDetails: { gap: 8 },
  vipDetailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  vipDetailKey: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: LUNA_MUTED },
  vipDetailVal: { fontSize: 13, fontWeight: '500', color: LUNA_WHITE },
  qrTile: {
    position: 'absolute',
    right: 20,
    bottom: -10,
    backgroundColor: LUNA_SURFACE,
    borderWidth: 0.5,
    borderColor: LUNA_BORDER,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  qrGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 84, gap: 2 },
  qrCell: { width: 10, height: 10, borderRadius: 1, backgroundColor: 'transparent' },
  qrLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 2, color: LUNA_MUTED },
});
