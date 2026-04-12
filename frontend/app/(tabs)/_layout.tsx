import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { AppBackground } from '../../src/components/AppBackground';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';

// Tab bar icons using Ionicons (reliable on web + native)
const HomeIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => <Ionicons name="home" size={size} color={color} />;
const LocationIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => <Ionicons name="compass" size={size} color={color} />;
const CardIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => <Ionicons name="wallet" size={size} color={color} />;
const StarIcon = ({ size = 14, color = '#fff' }: { size?: number; color?: string }) => <Ionicons name="star" size={size} color={color} />;
const GuestIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => <Ionicons name="person" size={size} color={color} />;
const LunaAIIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => <Ionicons name="sparkles" size={size} color={color} />;

// Custom tab bar icon using Luna Icons with optional badge
const TabBarIcon = ({ 
  IconComponent, 
  color, 
  focused,
  badge,
}: { 
  IconComponent: React.FC<{ size?: number; color?: string }>; 
  color: string; 
  focused: boolean;
  badge?: boolean;
}) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
    {focused && <View style={styles.iconGlow} />}
    <IconComponent size={22} color={color} />
    {badge && (
      <View style={styles.badgeDot} />
    )}
  </View>
);

const HeaderRight = () => {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;

  return (
    <View style={styles.headerRight}>
      <View style={styles.pointsContainer}>
        <View style={styles.pointsGlow} />
        <View style={styles.pointsBadge}>
          <StarIcon size={14} color={colors.gold} />
          <Text style={styles.pointsText}>{user.points_balance?.toLocaleString() || 0}</Text>
        </View>
      </View>
    </View>
  );
};

export default function TabLayout() {
  const [hasBirthdayReward, setHasBirthdayReward] = useState(false);
  const user = useAuthStore((state) => state.user);

  // Check for unclaimed birthday rewards
  useEffect(() => {
    const checkBirthdayRewards = async () => {
      if (!user) return;
      try {
        const status = await api.getBirthdayStatus();
        // Check if there are unclaimed rewards
        const hasUnclaimed = status?.available_rewards?.length > 0 || 
                            (status?.is_birthday_period && status?.rewards_claimed < status?.total_rewards);
        setHasBirthdayReward(hasUnclaimed);
      } catch (e) {
        // Silent fail - badge just won't show
      }
    };
    checkBirthdayRewards();
  }, [user]);
  return (
    <View style={styles.rootContainer}>
      {/* Simple black background with Luna glow */}
      <AppBackground />
      
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: colors.text,
          headerRight: () => <HeaderRight />,
          headerShadowVisible: false,
          headerBackground: () => (
            <View style={{ flex: 1, backgroundColor: colors.bg }} />
          ),
          sceneContainerStyle: { backgroundColor: colors.bg },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tonight',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={HomeIcon} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Venues',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={LocationIcon} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={CardIcon} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="luna-ai"
        options={{
          title: 'Luna AI',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={LunaAIIcon} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={GuestIcon} color={color} focused={focused} badge={hasBirthdayReward} />
          ),
        }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="photos" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="leaderboard" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="auctions" options={{ href: null, headerShown: false }} />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabBar: {
    backgroundColor: 'rgba(6, 6, 10, 0.92)',
    borderTopColor: colors.glassBorder,
    borderTopWidth: 1,
    paddingTop: spacing.sm + 2,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    height: Platform.OS === 'ios' ? 95 : 75,
    elevation: 0,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  tabBarItem: {
    paddingTop: 6,
  },
  iconContainer: {
    width: 44,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    position: 'relative',
  },
  iconContainerActive: {
    backgroundColor: colors.accentDim,
  },
  iconGlow: {
    position: 'absolute',
    width: 44,
    height: 36,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    opacity: 0.15,
  },
  header: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    elevation: 0,
    height: 100,
  },
  headerTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  headerRight: {
    marginRight: spacing.md,
  },
  pointsContainer: {
    position: 'relative',
  },
  pointsGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: radius.pill,
    backgroundColor: colors.goldDim,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: colors.gold + '30',
    gap: spacing.xs,
  },
  pointsText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B9D',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
