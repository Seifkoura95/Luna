import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme/colors';
import { LunaIcon } from './LunaIcons';
import { useAuthStore } from '../store/authStore';

const LUNA_GROUP_LOGO = 'https://customer-assets.emergentagent.com/job_c826baa4-6640-40ce-9e0d-38132d9944fc/artifacts/2k76js5m_luna-group-logo-2.webp';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  showPoints?: boolean;
  showLogo?: boolean;
  compactLogo?: boolean;
  showAccent?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle,
  description,
  showPoints = false,
  showLogo = true,
  compactLogo = false,
  showAccent = true,
}) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  return (
    <View style={[styles.header, { paddingTop: insets.top + 48 }]}>
      {showLogo && (
        <View style={styles.logoContainer}>
          <Image 
            source={{ uri: LUNA_GROUP_LOGO }} 
            style={compactLogo ? styles.logoCompact : styles.logo}
            contentFit="contain"
          />
          {/* Blue accent divider under logo */}
          {showAccent && (
            <View style={styles.accentContainer}>
              <LinearGradient
                colors={['transparent', colors.accent, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.accentLine}
              />
            </View>
          )}
        </View>
      )}
      
      {title && (
        <Text style={styles.pageTitle}>{title}</Text>
      )}
      
      {subtitle && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}
      
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
      
      {showPoints && (
        <View style={styles.pointsBadge}>
          <LunaIcon name="star" size={14} color={colors.gold} filled />
          <Text style={styles.pointsText}>
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
    paddingHorizontal: spacing.lg,
    marginBottom: 20,
  },
  logoContainer: {
    marginBottom: 10,
    alignItems: 'center',
  },
  logo: {
    width: 260,
    height: 75,
  },
  logoCompact: {
    width: 180,
    height: 52,
  },
  accentContainer: {
    marginTop: spacing.sm,
    width: 100,
    alignItems: 'center',
  },
  accentLine: {
    width: '100%',
    height: 2,
    borderRadius: 1,
  },
  pageTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  description: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
    lineHeight: 18,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldDim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    gap: spacing.xs,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  pointsText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
});

export default PageHeader;
