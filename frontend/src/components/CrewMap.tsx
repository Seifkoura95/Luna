import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
import { api } from '../utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

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

export const CrewMap: React.FC<CrewMapProps> = ({ crewId, crewName, onClose }) => {
  const mapRef = useRef<MapView>(null);
  const [memberLocations, setMemberLocations] = useState<MemberLocation[]>([]);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberLocation | null>(null);

  useEffect(() => {
    initializeMap();
    const interval = setInterval(fetchCrewLocations, 10000); // Refresh every 10 seconds
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
        Alert.alert('Permission Denied', 'Location permission is required to show your position on the map.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setMyLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Update server with my location
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

  const centerOnMember = (member: MemberLocation) => {
    if (member.latitude && member.longitude && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: member.latitude,
        longitude: member.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
      setSelectedMember(member);
    }
  };

  const centerOnAll = () => {
    const validLocations = memberLocations.filter(m => m.latitude && m.longitude);
    if (validLocations.length === 0 && !myLocation) return;

    const allLats = validLocations.map(m => m.latitude!);
    const allLngs = validLocations.map(m => m.longitude!);
    
    if (myLocation) {
      allLats.push(myLocation.latitude);
      allLngs.push(myLocation.longitude);
    }

    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);

    mapRef.current?.fitToCoordinates(
      validLocations.map(m => ({ latitude: m.latitude!, longitude: m.longitude! })),
      {
        edgePadding: { top: 100, right: 50, bottom: 150, left: 50 },
        animated: true,
      }
    );
    setSelectedMember(null);
  };

  const getMarkerColor = (member: MemberLocation) => {
    if (member.is_live) return colors.accent;
    return colors.textMuted;
  };

  // Brisbane default coordinates
  const defaultRegion = {
    latitude: myLocation?.latitude || -27.4698,
    longitude: myLocation?.longitude || 153.0251,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading crew locations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={defaultRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        customMapStyle={darkMapStyle}
      >
        {/* Crew member markers */}
        {memberLocations.map((member) => {
          if (!member.latitude || !member.longitude) return null;
          return (
            <Marker
              key={member.user_id}
              coordinate={{
                latitude: member.latitude,
                longitude: member.longitude,
              }}
              onPress={() => setSelectedMember(member)}
            >
              <View style={[styles.marker, { borderColor: getMarkerColor(member) }]}>
                <Text style={styles.markerText}>{member.name?.charAt(0) || '?'}</Text>
                {member.is_live && <View style={styles.liveIndicator} />}
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Header */}
      <LinearGradient
        colors={['rgba(0,0,0,0.9)', 'transparent']}
        style={styles.header}
      >
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{crewName}</Text>
          <Text style={styles.headerSubtitle}>
            {memberLocations.filter(m => m.is_live).length} live • {memberLocations.length} total
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchCrewLocations}>
          <Ionicons name="refresh" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Member List */}
      <View style={styles.memberList}>
        <TouchableOpacity style={styles.allButton} onPress={centerOnAll}>
          <Ionicons name="people" size={18} color={colors.textPrimary} />
          <Text style={styles.allButtonText}>View All</Text>
        </TouchableOpacity>
        
        {memberLocations.map((member) => (
          <TouchableOpacity
            key={member.user_id}
            style={[
              styles.memberChip,
              selectedMember?.user_id === member.user_id && styles.memberChipSelected,
              member.no_location && styles.memberChipDisabled,
            ]}
            onPress={() => centerOnMember(member)}
            disabled={member.no_location}
          >
            <View style={[styles.memberDot, { backgroundColor: getMarkerColor(member) }]} />
            <Text style={[
              styles.memberName,
              member.no_location && styles.memberNameDisabled
            ]}>
              {member.name?.split(' ')[0] || 'Unknown'}
            </Text>
            {member.is_live && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Selected Member Info */}
      {selectedMember && (
        <View style={styles.selectedInfo}>
          <LinearGradient
            colors={['#1A1A1A', '#0A0A0A']}
            style={styles.selectedInfoGradient}
          >
            <View style={styles.selectedInfoHeader}>
              <View style={[styles.selectedMarker, { borderColor: getMarkerColor(selectedMember) }]}>
                <Text style={styles.selectedMarkerText}>{selectedMember.name?.charAt(0)}</Text>
              </View>
              <View style={styles.selectedInfoText}>
                <Text style={styles.selectedName}>{selectedMember.name}</Text>
                <Text style={styles.selectedStatus}>
                  {selectedMember.is_live ? '🟢 Location live' : '⚪ Last known location'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Location Sharing Status */}
      <View style={styles.sharingStatus}>
        <View style={[styles.sharingDot, { backgroundColor: isSharingLocation ? '#00FF00' : colors.textMuted }]} />
        <Text style={styles.sharingText}>
          {isSharingLocation ? 'Your location is being shared' : 'Location sharing disabled'}
        </Text>
      </View>
    </View>
  );
};

// Dark map style for nightclub app aesthetic
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
];

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
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
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
  memberList: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  allButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  allButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  memberChipSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(227, 24, 55, 0.2)',
  },
  memberChipDisabled: {
    opacity: 0.5,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  memberNameDisabled: {
    color: colors.textMuted,
  },
  liveBadge: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  liveBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#000',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  markerText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  liveIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00FF00',
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  selectedInfo: {
    position: 'absolute',
    bottom: 60,
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  selectedInfoGradient: {
    padding: spacing.md,
  },
  selectedInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  selectedMarkerText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  selectedInfoText: {
    marginLeft: spacing.md,
  },
  selectedName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  selectedStatus: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sharingStatus: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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

export default CrewMap;
