import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { colors } from '../../src/theme/colors';
import { api } from '../../src/utils/api';
import { EventCard } from '../../src/components/EventCard';
import { Ionicons } from '@expo/vector-icons';

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
    <SafeAreaView style={styles.container}>
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
            <Text style={styles.sectionTitle}>UPCOMING BOOSTS</Text>
            {boosts.map((boost) => (
              <View key={boost.id} style={styles.boostCard}>
                <View style={styles.boostIcon}>
                  <Ionicons name="flash" size={24} color={colors.warning} />
                </View>
                <View style={styles.boostContent}>
                  <Text style={styles.boostName}>{boost.name}</Text>
                  <Text style={styles.boostDesc}>{boost.description}</Text>
                  <View style={styles.boostBadge}>
                    <Text style={styles.boostMultiplier}>{boost.multiplier}x Points</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Events */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UPCOMING EVENTS</Text>
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
          
          {events.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No upcoming events</Text>
              <Text style={styles.emptySubtext}>Check back soon for exciting events!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 12,
  },
  boostCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  boostIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  boostContent: {
    flex: 1,
  },
  boostName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  boostDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  boostBadge: {
    backgroundColor: colors.warning + '20',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  boostMultiplier: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
});
