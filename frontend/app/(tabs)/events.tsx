import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

export default function EventsScreen() {
  const [events, setEvents] = useState<any[]>([]);
  const [boosts, setBoosts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [eventsData, boostsData] = await Promise.all([
        api.getEvents(),
        api.getUpcomingBoosts(),
      ]);
      setEvents(eventsData);
      setBoosts(boostsData);
    } catch (e) {
      console.error('Failed to fetch events:', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Upcoming Boosts */}
        {boosts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>POINT BOOSTS</Text>
            </View>
            {boosts.map((boost) => (
              <View key={boost.id} style={styles.boostCard}>
                <LinearGradient
                  colors={[colors.warningGlow, colors.backgroundCard]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.boostGradient}
                >
                  <View style={styles.boostIconContainer}>
                    <Ionicons name="flash" size={28} color={colors.warning} />
                  </View>
                  <View style={styles.boostContent}>
                    <Text style={styles.boostName}>{boost.name}</Text>
                    <Text style={styles.boostDesc}>{boost.description}</Text>
                  </View>
                  <View style={styles.multiplierBadge}>
                    <Text style={styles.multiplierText}>{boost.multiplier}x</Text>
                    <Text style={styles.multiplierLabel}>POINTS</Text>
                  </View>
                </LinearGradient>
              </View>
            ))}
          </View>
        )}

        {/* Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>UPCOMING EVENTS</Text>
          </View>
          {events.map((event) => {
            const eventDate = new Date(event.event_date);
            return (
              <View key={event.id} style={styles.eventCard}>
                <LinearGradient
                  colors={[colors.backgroundCard, colors.backgroundElevated]}
                  style={styles.eventGradient}
                >
                  {/* Date Badge */}
                  <View style={styles.dateBadge}>
                    <LinearGradient
                      colors={[colors.accent, colors.accentDark]}
                      style={styles.dateBadgeGradient}
                    >
                      <Text style={styles.dateDay}>{format(eventDate, 'dd')}</Text>
                      <Text style={styles.dateMonth}>{format(eventDate, 'MMM')}</Text>
                    </LinearGradient>
                  </View>

                  {/* Content */}
                  <View style={styles.eventContent}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventDesc} numberOfLines={2}>
                      {event.description}
                    </Text>
                    <View style={styles.eventFooter}>
                      <View style={styles.venueTag}>
                        <Ionicons name="location" size={12} color={colors.accent} />
                        <Text style={styles.venueName}>
                          {event.venue_room.toUpperCase()}
                        </Text>
                      </View>
                      {event.ticket_url && (
                        <TouchableOpacity
                          style={styles.ticketButton}
                          onPress={() => Linking.openURL(event.ticket_url)}
                          activeOpacity={0.8}
                        >
                          <LinearGradient
                            colors={[colors.accent, colors.accentDark]}
                            style={styles.ticketGradient}
                          >
                            <Text style={styles.ticketText}>Tickets</Text>
                            <Ionicons name="arrow-forward" size={14} color={colors.textPrimary} />
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </View>
            );
          })}

          {events.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Upcoming Events</Text>
              <Text style={styles.emptyText}>Check back soon for exciting events!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionAccent: {
    width: 3,
    height: 16,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  boostCard: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  boostGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  boostIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  boostContent: {
    flex: 1,
  },
  boostName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  boostDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  multiplierBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  multiplierText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.background,
  },
  multiplierLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.background,
    letterSpacing: 1,
  },
  eventCard: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventGradient: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  dateBadge: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  dateBadgeGradient: {
    width: 60,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dateMonth: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  eventDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  venueTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  venueName: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    marginLeft: spacing.xs,
    letterSpacing: 1.5,
  },
  ticketButton: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  ticketGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ticketText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
