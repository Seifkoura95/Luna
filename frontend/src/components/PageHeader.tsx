import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/colors';
import { LunaMoonIcon } from './LunaMoonIcon';
import { useAuthStore } from '../store/authStore';
import { useFonts, fonts } from '../hooks/useFonts';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  showPoints?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle,
  description,
  showPoints = false 
}) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const fontsLoaded = useFonts();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: fonts.striker }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.headerSubtitle, fontsLoaded && { fontFamily: fonts.striker }]}>{subtitle}</Text>
      )}
      <View style={styles.headerUnderline} />
      {description && (
        <Text style={[styles.headerDescription, fontsLoaded && { fontFamily: fonts.regular }]}>{description}</Text>
      )}
      
      {showPoints && (
        <View style={styles.pointsBadge}>
          <LunaMoonIcon size={18} />
          <Text style={[styles.pointsText, fontsLoaded && { fontFamily: fonts.bold }]}>
            {user?.points_balance?.toLocaleString() || 0} pts
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 3,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginTop: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  headerUnderline: {
    width: 40,
    height: 2,
    backgroundColor: colors.accent,
    marginTop: spacing.xs,
  },
  headerDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    letterSpacing: 0.3,
    paddingHorizontal: spacing.md,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldGlow,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    gap: 4,
    marginTop: spacing.sm,
  },
  pointsText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 12,
  },
});

export default PageHeader;
