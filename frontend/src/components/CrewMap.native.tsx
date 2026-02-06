import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
import { api } from '../utils/api';
import { Ionicons } from '@expo/vector-icons';
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

// Native version with real map
export const CrewMap: React.FC<CrewMapProps> = ({ crewId, crewName, onClose }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [memberLocations, setMemberLocations] = useState<MemberLocation[]>([]);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberLocation | null>(null);

  // Brisbane default location
  const defaultRegion = {
    latitude: -27.4698,
    longitude: 153.0251,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

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
        Alert.alert('Permission Denied', 'Location permission is required to share your location with your crew.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setMyLocation(coords);

      // Update location to server
      await api.updateLocation(
        location.coords.latitude,
        location.coords.longitude,
        location.coords.accuracy || undefined,
        location.coords.heading || undefined,
        location.coords.speed || undefined
      );
      setIsSharingLocation(true);

      // Center map on user location
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 1000);
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

  const fitAllMarkers = () => {
    const validLocations = memberLocations.filter(
      m => m.latitude && m.longitude
    );
    
    if (validLocations.length === 0 && myLocation) {
      mapRef.current?.animateToRegion({
        ...myLocation,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 1000);
      return;
    }

    const coordinates = validLocations.map(m => ({
      latitude: m.latitude!,
      longitude: m.longitude!,
    }));

    if (myLocation) {
      coordinates.push(myLocation);
    }

    if (coordinates.length > 0) {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
        animated: true,
      });
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
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={myLocation ? { ...myLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 } : defaultRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        customMapStyle={darkMapStyle}
      >
        {/* Crew member markers */}
        {memberLocations.map((member) => {
          if (!member.latitude || !member.longitude) return null;
          return (
            <React.Fragment key={member.user_id}>
              <Marker
                coordinate={{
                  latitude: member.latitude,
                  longitude: member.longitude,
                }}
                onPress={() => setSelectedMember(member)}
              >
                <View style={[styles.markerContainer, { borderColor: getMarkerColor(member) }]}>
                  <Text style={styles.markerText}>{member.name?.charAt(0) || '?'}</Text>
                  {member.is_live && <View style={styles.liveDot} />}
                </View>
              </Marker>
              {member.is_live && (
                <Circle
                  center={{ latitude: member.latitude, longitude: member.longitude }}
                  radius={50}
                  fillColor={colors.accent + '20'}
                  strokeColor={colors.accent + '40'}
                  strokeWidth={1}
                />
              )}
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Header */}
      <View style={[styles.header, { top: insets.top + spacing.md }]}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{crewName}</Text>
          <Text style={styles.headerSubtitle}>
            {memberLocations.filter(m => m.is_live).length} live • {memberLocations.length} total
          </Text>
        </View>
        <TouchableOpacity style={styles.fitButton} onPress={fitAllMarkers}>
          <Ionicons name="contract" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Member Info Card */}
      {selectedMember && (
        <View style={[styles.memberCard, { bottom: insets.bottom + 100 }]}>
          <LinearGradient
            colors={[colors.backgroundCard, colors.background]}
            style={styles.memberCardGradient}
          >
            <View style={styles.memberCardHeader}>
              <View style={[styles.memberAvatar, { borderColor: getMarkerColor(selectedMember) }]}>
                <Text style={styles.memberAvatarText}>{selectedMember.name?.charAt(0) || '?'}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{selectedMember.name}</Text>
                <Text style={styles.memberStatus}>
                  {selectedMember.is_live ? '🟢 Location live' : '⚪ Last known location'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedMember(null)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.locationStatus}>
          <View style={[styles.statusDot, { backgroundColor: isSharingLocation ? '#00FF00' : colors.textMuted }]} />
          <Text style={styles.statusText}>
            {isSharingLocation ? 'Your location is being shared' : 'Location sharing disabled'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchCrewLocations}>
          <Ionicons name="refresh" size={20} color={colors.textPrimary} />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Dark map style for night mode
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
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
    flex: 1,
  },
  header: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: radius.lg,
    padding: spacing.md,
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
  fitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  liveDot: {
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
  memberCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  memberCardGradient: {
    padding: spacing.md,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  memberAvatarText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  memberStatus: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});

export default CrewMap;
