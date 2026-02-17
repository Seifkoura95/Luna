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
        <Image 
          source={{ uri: LUNA_GROUP_LOGO }} 
          style={compactLogo ? styles.logoCompact : styles.logo}
          contentFit="contain"
        />
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
          <GoldStarIcon size={16} />
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
    paddingBottom: 20,
  },
  logo: {
    width: 240,
    height: 70,
    marginBottom: 12,
  },
  logoCompact: {
    width: 200,
    height: 55,
    marginBottom: 10,
  },
  pageTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  description: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 4,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  pointsText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default PageHeader;
