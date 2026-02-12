import React from 'react';
import { View, Text, StyleSheet, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/colors';
import { GoldStarIcon } from './GoldStarIcon';
import { useAuthStore } from '../store/authStore';
import { useFonts, fonts } from '../hooks/useFonts';

// Luna Group Logo URL
const LUNA_GROUP_LOGO = 'https://customer-assets.emergentagent.com/job_c826baa4-6640-40ce-9e0d-38132d9944fc/artifacts/2k76js5m_luna-group-logo-2.webp';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  showPoints?: boolean;
  showLogo?: boolean;
  compactLogo?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle,
  description,
  showPoints = false,
  showLogo = true,
  compactLogo = false
}) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const fontsLoaded = useFonts();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      {/* Prominent Luna Group Logo */}
      <Image 
        source={{ uri: LUNA_GROUP_LOGO }} 
        style={compactLogo ? styles.logoCompact : styles.logo}
        resizeMode="contain"
      />
      
      {/* Page Title - shown below logo */}
      {title && !showLogo && (
        <Text style={[styles.headerTitle, fontsLoaded && { fontFamily: fonts.milker }]}>{title}</Text>
      )}
      
      {title && showLogo && (
        <Text style={[styles.pageTitle, fontsLoaded && { fontFamily: fonts.bold }]}>{title}</Text>
      )}
      
      {subtitle && (
        <Text style={[styles.headerSubtitle, fontsLoaded && { fontFamily: fonts.milker }]}>{subtitle}</Text>
      )}
      
      <View style={styles.headerUnderline} />
      
      {description && (
        <Text style={[styles.headerDescription, fontsLoaded && { fontFamily: fonts.regular }]}>{description}</Text>
      )}
      
      {showPoints && (
        <View style={styles.pointsBadge}>
          <GoldStarIcon size={18} />
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
  logo: {
    width: 240,
    height: 70,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  logoCompact: {
    width: 180,
    height: 50,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 3,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    textAlign: 'center',
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
