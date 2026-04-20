import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../theme/colors';

interface SectionTitleProps {
  title: string;
  onSeeAll?: () => void;
  seeAllText?: string;
  icon?: string;
  iconColor?: string;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  onSeeAll,
  seeAllText = 'See All',
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn}>
          <Text style={styles.seeAllText}>{seeAllText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: '#D4AF5A',
  },
  seeAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  seeAllText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(240, 240, 248, 0.45)',
    textTransform: 'uppercase',
  },
});

export default SectionTitle;
