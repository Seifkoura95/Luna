import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { AppBackground } from '../../src/components/AppBackground';
import {
  HomeIcon,
  LocationIcon,
  CardIcon,
  BoltIcon,
  GuestIcon,
  StarIcon,
} from '../../src/components/LunaIcons';

// Custom tab bar icon using Luna Icons
const TabBarIcon = ({ 
  IconComponent, 
  color, 
  focused 
}: { 
  IconComponent: React.FC<{ size?: number; color?: string }>; 
  color: string; 
  focused: boolean;
}) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
    {focused && <View style={styles.iconGlow} />}
    <IconComponent size={22} color={color} />
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
        name="auctions"
        options={{
          title: 'Auctions',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={BoltIcon} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={GuestIcon} color={color} focused={focused} />
          ),
        }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="photos" options={{ href: null }} />
      <Tabs.Screen name="leaderboard" options={{ href: null }} />
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
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 0.5,
    paddingTop: spacing.sm + 2,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    height: Platform.OS === 'ios' ? 95 : 75,
    elevation: 0,
  },
  tabBarLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
});
