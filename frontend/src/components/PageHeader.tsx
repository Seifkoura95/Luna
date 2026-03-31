import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/colors';
import { GoldStarIcon } from './GoldStarIcon';
import { useAuthStore } from '../store/authStore';

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

  return (
    <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
      {showLogo && (
        <View style={styles.logoContainer}>
          <Image 
            source={{ uri: LUNA_GROUP_LOGO }} 
            style={compactLogo ? styles.logoCompact : styles.logo}
            contentFit="contain"
          />
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
          <GoldStarIcon size={14} />
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
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  logoContainer: {
    marginBottom: 6,
  },
  logo: {
    width: 160,
    height: 48,
  },
  logoCompact: {
    width: 120,
    height: 36,
  },
  pageTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  description: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 2,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  pointsText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 13,
  },
});

export default PageHeader;
