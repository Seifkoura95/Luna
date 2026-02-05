import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description: string;
    event_date: string;
    venue_room: string;
    ticket_url?: string;
  };
}

export const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const eventDate = new Date(event.event_date);
  
  const handleTickets = () => {
    if (event.ticket_url) {
      Linking.openURL(event.ticket_url);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dateContainer}>
        <Text style={styles.dateDay}>{format(eventDate, 'dd')}</Text>
        <Text style={styles.dateMonth}>{format(eventDate, 'MMM')}</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.description}>{event.description}</Text>
        <View style={styles.footer}>
          <View style={styles.venueTag}>
            <Ionicons name="location" size={12} color={colors.accent} />
            <Text style={styles.venueName}>{event.venue_room.toUpperCase()}</Text>
          </View>
          {event.ticket_url && (
            <TouchableOpacity style={styles.ticketButton} onPress={handleTickets}>
              <Text style={styles.ticketText}>Tickets</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dateMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  venueTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  venueName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
    marginLeft: 4,
    letterSpacing: 1,
  },
  ticketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  ticketText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
});
