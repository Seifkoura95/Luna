import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
import { api } from '../utils/api';
import { Icon } from './Icon';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface CrewMapProps {
  crewId: string;
  crewName: string;
  onClose: () => void;
}

interface MemberLocation {
  user_id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  is_live: boolean;
  no_location?: boolean;
  updated_at?: string;
}

// Web version - shows list of crew members instead of map
export const CrewMapWeb: React.FC<CrewMapProps> = ({ crewId, crewName, onClose }) => {
  const insets = useSafeAreaInsets();
  const [memberLocations, setMemberLocations] = useState<MemberLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharingLocation, setIsSharingLocation] = useState(false);

  useEffect(() => {
    initializeMap();
    const interval = setInterval(fetchCrewLocations, 10000);
    return () => clearInterval(interval);
  }, [crewId]);

  const initializeMap = async () => {
    setIsLoading(true);
    await getCurrentLocation();
    await fetchCrewLocations();
    setIsLoading(false);
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await api.updateLocation(
        location.coords.latitude,
        location.coords.longitude,
        location.coords.accuracy || undefined,
        location.coords.heading || undefined,
        location.coords.speed || undefined
      );
      setIsSharingLocation(true);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const fetchCrewLocations = async () => {
    try {
      const response = await api.getCrewLocations(crewId);
      setMemberLocations(response.members || []);
    } catch (error) {
      console.error('Error fetching crew locations:', error);
    }
  };

  const getMarkerColor = (member: MemberLocation) => {
    if (member.is_live) return colors.accent;
    return colors.textMuted;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading crew locations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#000', '#0A0A0A']} style={styles.webContainer}>
        {/* Header */}
        <View style={styles.webHeader}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{crewName}</Text>
            <Text style={styles.headerSubtitle}>
              {memberLocations.filter(m => m.is_live).length} live • {memberLocations.length} total
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchCrewLocations}>
            <Icon name="refresh" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Web Notice */}
        <View style={styles.webNotice}>
          <Icon name="phone-portrait-outline" size={24} color={colors.accent} />
          <Text style={styles.webNoticeText}>
            Map view is available on the mobile app. Here's your crew's location status:
          </Text>
        </View>

        {/* Member List */}
        <ScrollView style={styles.webMemberList}>
          {memberLocations.map((member) => (
            <View key={member.user_id} style={styles.webMemberCard}>
              <View style={[styles.webMemberAvatar, { borderColor: getMarkerColor(member) }]}>
                <Text style={styles.webMemberAvatarText}>{member.name?.charAt(0) || '?'}</Text>
              </View>
              <View style={styles.webMemberInfo}>
                <Text style={styles.webMemberName}>{member.name}</Text>
                <Text style={styles.webMemberStatus}>
                  {member.is_live ? '🟢 Location live' : member.no_location ? '⚪ No location shared' : '⚪ Last known location'}
                </Text>
              </View>
              {member.is_live && (
                <View style={styles.liveBadgeLarge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Location Sharing Status */}
        <View style={styles.webSharingStatus}>
          <View style={[styles.sharingDot, { backgroundColor: isSharingLocation ? '#00FF00' : colors.textMuted }]} />
          <Text style={styles.sharingText}>
            {isSharingLocation ? 'Your location is being shared' : 'Location sharing disabled'}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  webContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '15',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  webNoticeText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  webMemberList: {
    flex: 1,
    marginTop: spacing.lg,
  },
  webMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  webMemberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  webMemberAvatarText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  webMemberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  webMemberName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  webMemberStatus: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  liveBadgeLarge: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#000',
  },
  webSharingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  sharingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sharingText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});

export default CrewMapWeb;
