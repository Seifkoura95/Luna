import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/colors';
import { RotatingMoon } from './RotatingMoon';
import { FierySun } from './FierySun';
import { useAuthStore } from '../store/authStore';

interface PageHeaderProps {
  title: string;
  showPoints?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  showPoints = false 
}) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <RotatingMoon size={80} rotationDuration={30000} />
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerUnderline} />
      
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
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 6,
    marginTop: spacing.sm,
  },
  headerUnderline: {
    width: 50,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
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
    color: colors.gold,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default PageHeader;
