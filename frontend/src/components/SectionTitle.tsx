import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { spacing } from '../theme/colors';

interface SectionTitleProps {
  title: string;
  onSeeAll?: () => void;
  seeAllText?: string;
  icon?: string;
  iconColor?: string;
  liveDot?: boolean; // Pulsing red dot AFTER the title (auction-style)
}

const LivePulseDot: React.FC = () => {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.25, duration: 600, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.75, duration: 600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return (
    <Animated.View
      style={[styles.liveDot, { opacity, transform: [{ scale }] }]}
    />
  );
};

export const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  onSeeAll,
  seeAllText = 'See All',
  liveDot = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        {liveDot && <LivePulseDot />}
      </View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: '#D4AF5A',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E31837',
    shadowColor: '#E31837',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
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
