import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/colors';
import { RotatingMoon } from './RotatingMoon';
import { FierySun } from './FierySun';
import { useAuthStore } from '../store/authStore';

interface PageHeaderProps {
  title: string;
  description?: string;
  showPoints?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  description,
  showPoints = false 
}) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <RotatingMoon size={80} rotationDuration={30000} />
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerUnderline} />
      {description && (
        <Text style={styles.headerDescription}>{description}</Text>
      )}
      
      {showPoints && (
        <View style={styles.pointsBadge}>
          <FierySun size={22} />
          <Text style={styles.pointsText}>{user?.points_balance?.toLocaleString() || 0} pts</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontFamily: Platform.select({
      ios: 'Avenir-Black',
      android: 'sans-serif-condensed',
      default: 'system-ui',
    }),
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 8,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  headerUnderline: {
    width: 50,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
  },
  headerDescription: {
    fontFamily: Platform.select({
      ios: 'Avenir',
      android: 'sans-serif',
      default: 'system-ui',
    }),
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldGlow,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    gap: 6,
    marginTop: spacing.md,
  },
  pointsText: {
    fontFamily: Platform.select({
      ios: 'Avenir-Heavy',
      android: 'sans-serif-condensed',
      default: 'system-ui',
    }),
    color: colors.gold,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default PageHeader;
