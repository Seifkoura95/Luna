import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../theme/colors';
import { Icon } from './Icon';

interface FeaturedContentProps {
  type: 'artist' | 'promo' | 'event' | 'perk';
  title: string;
  subtitle?: string;
  description: string;
  image: string;
  cta?: string;
  onPress?: () => void;
}

export const FeaturedContent: React.FC<FeaturedContentProps> = ({
  type,
  title,
  subtitle,
  description,
  image,
  cta,
  onPress,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'artist':
        return 'mic';
      case 'promo':
        return 'pricetag';
      case 'event':
        return 'calendar';
      case 'perk':
        return 'star';
      default:
        return 'information-circle';
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
      disabled={!onPress}
    >
      <Image source={{ uri: image }} style={styles.backgroundImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
        style={styles.overlay}
      >
        <View style={styles.iconContainer}>
          <Icon name={getIcon()} size={20} color={colors.accent} />
        </View>
        
        <View style={styles.content}>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
          
          {cta && (
            <View style={styles.ctaContainer}>
              <Text style={styles.ctaText}>{cta}</Text>
              <Icon name="arrow-forward" size={16} color={colors.accent} />
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  overlay: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  ctaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    marginRight: spacing.xs,
  },
});