import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { StarfieldBackground } from '../../src/components/StarfieldBackground';

const TabBarIcon = ({ name, color, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; focused: boolean }) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
    {focused && <View style={styles.iconGlow} />}
    <Ionicons name={name} size={24} color={color} />
  </View>
);

const HeaderTitle = ({ title }: { title: string }) => (
  <View style={styles.headerTitleContainer}>
    <Text style={styles.headerTitleText}>{title}</Text>
    <View style={styles.headerTitleUnderline} />
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
          <Ionicons name="star" size={16} color={colors.gold} />
          <Text style={styles.pointsText}>{user.points_balance.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
};

export default function TabLayout() {
  return (
    <View style={styles.rootContainer}>
      {/* Global Starfield Background */}
      <StarfieldBackground starCount={60} shootingStarCount={2} />
      
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: colors.textPrimary,
          headerRight: () => <HeaderRight />,
          headerShadowVisible: false,
          headerBackground: () => (
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
          ),
          sceneContainerStyle: { backgroundColor: 'transparent' },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tonight',
          headerTitle: () => <HeaderTitle title="TONIGHT" />,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="radio-button-on" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="compass" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          headerTitle: () => <HeaderTitle title="REWARDS" />,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="gift" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="auctions"
        options={{
          title: 'Auctions',
          headerTitle: () => <HeaderTitle title="LIVE AUCTIONS" />,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="flash" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: () => <HeaderTitle title="PROFILE" />,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="events" options={{ href: null }} />
      <Tabs.Screen name="photos" options={{ href: null }} />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    backgroundColor: colors.backgroundCard,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.sm + 2,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    height: Platform.OS === 'ios' ? 95 : 75,
    elevation: 0,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
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
    backgroundColor: colors.accentGlow,
  },
  iconGlow: {
    position: 'absolute',
    width: 44,
    height: 36,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    opacity: 0.2,
  },
  header: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    elevation: 0,
    height: 100,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 6,
  },
  headerTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 6,
    marginBottom: 6,
  },
  headerTitleUnderline: {
    width: 40,
    height: 2,
    backgroundColor: colors.accent,
  },
  headerRight: {
    marginRight: spacing.md,
  },
  pointsContainer: {
    position: 'relative',
  },
  pointsGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: radius.full,
    backgroundColor: colors.goldGlow,
    opacity: 0.4,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.gold + '40',
    gap: spacing.xs,
  },
  pointsText: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});