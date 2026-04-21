import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../src/components/Icon';
import { colors, radius } from '../src/theme/colors';

const Section: React.FC<{ title: string; tag?: string; children: React.ReactNode }> = ({
  title,
  tag,
  children,
}) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {tag ? (
        <View style={styles.sectionTag}>
          <Text style={styles.sectionTagText}>{tag}</Text>
        </View>
      ) : null}
    </View>
    {children}
  </View>
);

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.bulletRow}>
    <View style={styles.bulletDot} />
    <Text style={styles.bulletText}>{children}</Text>
  </View>
);

export default function HowPointsWorkScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={['#0A0C14', '#050709', colors.background]}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          data-testid="how-points-back-btn"
        >
          <Icon name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HOW POINTS WORK</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>REWARDS PROGRAM</Text>
        <Text style={styles.h1}>
          Earn <Text style={{ color: colors.gold }}>25% back</Text> on every dollar.
        </Text>
        <Text style={styles.lede}>
          Luna Points = real money back at Luna venues. Here's exactly how you earn
          them, how we verify them, and how to redeem.
        </Text>

        {/* Rate card */}
        <View style={styles.rateCard}>
          <Text style={styles.rateCardLabel}>THE RATE</Text>
          <View style={styles.rateRow}>
            <Text style={styles.rateBig}>$1 spent</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.rateBig}>10 pts</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.rateBig}>$0.25 back</Text>
          </View>
          <Text style={styles.rateFine}>
            Silver = 2× (20 pts/$1)   ·   Gold = 3× (30 pts/$1)
          </Text>
        </View>

        <Section title="When Points Are Awarded">
          <Text style={styles.body}>
            There are <Text style={styles.bold}>three ways</Text> to earn Luna
            Points. Each has a different flow to keep the system fair:
          </Text>

          <Text style={styles.h3}>1. In-app (instant)</Text>
          <Bullet>Subscribing to Luna+ Silver or Gold</Bullet>
          <Bullet>Completing a mission — verified server-side</Bullet>
          <Bullet>Hitting a milestone tier (e.g. Rising Star, Luna Elite)</Bullet>

          <Text style={styles.h3}>2. Purchases at the venue</Text>
          <Text style={styles.body}>
            When you book a bottle service or win an auction in the app, you pay a{' '}
            <Text style={styles.bold}>deposit</Text> via Stripe. The full balance
            and your Luna Points are only settled once our staff confirm what you
            actually consumed that night.
          </Text>
          <View style={styles.flowCard}>
            <View style={styles.flowStep}>
              <View style={styles.flowNum}>
                <Text style={styles.flowNumText}>1</Text>
              </View>
              <Text style={styles.flowText}>
                You book a bottle in the app — Stripe charges the $50 (or 10%)
                deposit
              </Text>
            </View>
            <View style={styles.flowStep}>
              <View style={styles.flowNum}>
                <Text style={styles.flowNumText}>2</Text>
              </View>
              <Text style={styles.flowText}>
                You show up at the venue — staff see your order in their portal
              </Text>
            </View>
            <View style={styles.flowStep}>
              <View style={styles.flowNum}>
                <Text style={styles.flowNumText}>3</Text>
              </View>
              <Text style={styles.flowText}>
                Staff confirm the final total you consumed — balance charged,
                Luna Points awarded at 10 pts/$1
              </Text>
            </View>
          </View>
          <View style={styles.info}>
            <Icon name="info" size={14} color={colors.gold} />
            <Text style={styles.infoText}>
              This means points always reflect real spend, not just deposits. No
              gaming the system.
            </Text>
          </View>

          <Text style={styles.h3}>3. Check-ins</Text>
          <Text style={styles.body}>
            Walking into a Luna venue earns a small "show up" bonus, but the staff
            scanner or door QR must mark you present — location alone won't
            trigger points.
          </Text>
        </Section>

        <Section title="Missions" tag="AUTO-VERIFIED">
          <Text style={styles.body}>
            Missions are small time-boxed challenges. The server checks every
            criterion, then drops points the moment they're all met.
          </Text>

          <View style={styles.missionCard}>
            <Text style={styles.missionTitle}>Early Bird Special · +150 pts</Text>
            <Text style={styles.missionDesc}>
              Check in before 10:30pm at any Luna nightclub tonight.
            </Text>
            <Text style={styles.missionVerify}>
              Verified by the geofence timestamp. One instance per week.
            </Text>
          </View>

          <View style={styles.missionCard}>
            <Text style={styles.missionTitle}>Luna Explorer · +750 pts</Text>
            <Text style={styles.missionDesc}>
              Visit 3 different Luna venues this week.
            </Text>
            <Text style={styles.missionVerify}>
              Distinct venue check-ins over a 7-day rolling window.
            </Text>
          </View>

          <View style={styles.missionCard}>
            <Text style={styles.missionTitle}>Dine & Dance · +400 pts</Text>
            <Text style={styles.missionDesc}>
              Eat at a restaurant + dance at a nightclub the same night.
            </Text>
            <Text style={styles.missionVerify}>
              Requires one restaurant-type + one nightclub-type check-in within
              24h.
            </Text>
          </View>

          <View style={styles.missionCard}>
            <Text style={styles.missionTitle}>Eclipse Loyalist · +500 pts</Text>
            <Text style={styles.missionDesc}>
              Check in at Eclipse 3 times this month.
            </Text>
            <Text style={styles.missionVerify}>
              Monthly Eclipse check-ins. Same-day duplicates collapse to 1.
            </Text>
          </View>

          <View style={styles.missionCard}>
            <Text style={styles.missionTitle}>Weekend Warrior · +600 pts</Text>
            <Text style={styles.missionDesc}>
              Hit a Luna venue 4 Saturdays in a row.
            </Text>
            <Text style={styles.missionVerify}>
              Saturday check-in streak tracked by the server. Miss one, counter
              resets.
            </Text>
          </View>

          <View style={styles.missionCard}>
            <Text style={styles.missionTitle}>Social Butterfly · +800 pts</Text>
            <Text style={styles.missionDesc}>
              Invite 5 friends who accept AND visit a Luna venue.
            </Text>
            <Text style={styles.missionVerify}>
              Points release only on the 5th verified venue visit — not the 5th
              sign-up.
            </Text>
          </View>
        </Section>

        <Section title="Milestones" tag="LIFETIME POINTS">
          <Text style={styles.body}>
            Milestones unlock forever from your lifetime Luna Points total. Each
            gives a one-time QR-ticket reward that scans at the venue.
          </Text>

          {[
            { name: 'Newbie', threshold: 0, reward: 'Welcome pack', color: '#8B8B8B' },
            { name: 'Rising Star', threshold: 500, reward: '5 free drinks', color: '#CD7F32' },
            { name: 'VIP Status', threshold: 1000, reward: '10 drinks + 4 entries', color: '#C0C0C0' },
            { name: 'Luna Elite', threshold: 5000, reward: 'VIP booth + 20 drinks + 5 entries', color: colors.gold },
            { name: 'Supernova', threshold: 10000, reward: 'VIP booth + 30 drinks + exclusive perks', color: '#B794F4' },
            { name: 'Legend', threshold: 25000, reward: 'Gold VIP, unlimited entries, monthly booth', color: colors.goldBright },
          ].map((m) => (
            <View key={m.name} style={styles.milestoneRow}>
              <View style={[styles.milestoneDot, { backgroundColor: m.color }]} />
              <Text style={styles.milestoneName}>{m.name}</Text>
              <Text style={styles.milestoneThresh}>
                {m.threshold.toLocaleString()}+ pts
              </Text>
              <Text style={styles.milestoneReward} numberOfLines={2}>
                {m.reward}
              </Text>
            </View>
          ))}
        </Section>

        <Section title="Why Points Can't Be Gamed">
          <Bullet>
            <Text style={styles.bold}>Nothing is user-reported.</Text> You never
            type in what you spent. Only Stripe webhooks or staff in the portal
            can trigger point awards.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>Stripe is the source of truth.</Text> Points
            only flow after payment is confirmed.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>Idempotency keys.</Text> Replaying the same
            action 100 times still awards points once.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>Single-use QR redemptions.</Text>{' '}
            Screenshotting a redeemed QR and showing it to another venue = it
            won't scan.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>Rate limits.</Text> 1 check-in per venue
            per 4 hours per user.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>Staff revoke.</Text> Fraudulent points can
            be clawed back — you'll see why in your activity feed.
          </Bullet>
        </Section>

        <View style={{ height: 30 }} />
        <TouchableOpacity
          onPress={() => router.push('/subscriptions')}
          style={styles.ctaBtn}
          data-testid="how-points-cta-subscribe"
        >
          <LinearGradient
            colors={[colors.goldBright, colors.gold]}
            style={styles.ctaGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.ctaText}>UPGRADE TO LUNA+</Text>
            <Icon name="arrow-forward" size={16} color={colors.textInverse} />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: colors.textPrimary,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    color: colors.gold,
    marginBottom: 10,
    marginTop: 6,
  },
  h1: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 36,
    marginBottom: 12,
  },
  lede: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: 24,
  },

  rateCard: {
    backgroundColor: 'rgba(212, 168, 50, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 50, 0.28)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
  },
  rateCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: colors.gold,
    marginBottom: 10,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  rateBig: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.goldBright,
  },
  arrow: { color: colors.textMuted, fontSize: 14 },
  rateFine: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 10,
    letterSpacing: 0.5,
  },

  section: {
    backgroundColor: 'rgba(18, 18, 28, 0.6)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionTag: {
    backgroundColor: 'rgba(212, 168, 50, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.gold,
  },

  h3: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 14,
    marginBottom: 8,
  },
  body: {
    fontSize: 13,
    color: '#CCCCD2',
    lineHeight: 20,
    marginBottom: 6,
  },
  bold: { fontWeight: '700', color: colors.textPrimary },

  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 5,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#CCCCD2',
    lineHeight: 20,
  },

  flowCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    marginBottom: 10,
    gap: 10,
  },
  flowStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flowNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowNumText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
  },
  flowText: { flex: 1, fontSize: 12, color: '#CCCCD2', lineHeight: 18 },

  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(212, 168, 50, 0.06)',
    borderRadius: 10,
    marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: colors.goldBright, lineHeight: 18 },

  missionCard: {
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
    paddingLeft: 12,
    marginVertical: 8,
  },
  missionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  missionDesc: {
    fontSize: 12,
    color: '#CCCCD2',
    marginTop: 2,
    lineHeight: 17,
  },
  missionVerify: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 15,
  },

  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  milestoneDot: { width: 10, height: 10, borderRadius: 5 },
  milestoneName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    width: 95,
  },
  milestoneThresh: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.goldBright,
    width: 80,
  },
  milestoneReward: {
    flex: 1,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },

  ctaBtn: { borderRadius: 14, overflow: 'hidden' },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.5,
    color: colors.textInverse,
  },
});
