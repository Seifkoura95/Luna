import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../src/components/Icon';
import { api } from '../src/utils/api';
import { colors, radius } from '../src/theme/colors';

interface MenuItem {
  name: string;
  desc?: string;
  price: number;
  unit?: string;
}

interface VenueMenu {
  venue_id: string;
  venue_name: string;
  description: string;
  food: Record<string, MenuItem[]>;
  drinks: Record<string, MenuItem[]>;
}

type Tab = 'food' | 'drinks';

export default function VenueMenuScreen() {
  const { venue_id } = useLocalSearchParams<{ venue_id: string }>();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState<VenueMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('food');

  useEffect(() => {
    if (!venue_id) return;
    (async () => {
      try {
        const data = await api.getVenueMenu(venue_id);
        setMenu(data);
      } catch (e) {
        console.error('Failed to load menu', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [venue_id]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!menu) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.errorText}>Menu not available.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sections = Object.entries(activeTab === 'food' ? menu.food : menu.drinks);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0B0D14', '#050709', colors.background]}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          data-testid="venue-menu-back-btn"
        >
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.venueName}>{menu.venue_name}</Text>
          <Text style={styles.venueDesc} numberOfLines={2}>
            {menu.description}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['food', 'drinks'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setActiveTab(t)}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            data-testid={`venue-menu-tab-${t}`}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t.toUpperCase()}
            </Text>
            {activeTab === t && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {sections.map(([category, items]) => (
          <View key={category} style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionTitle}>{category.toUpperCase()}</Text>
              <View style={styles.sectionLine} />
            </View>
            {items.map((item, idx) => (
              <View key={`${category}-${idx}`} style={styles.itemRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {!!item.desc && <Text style={styles.itemDesc}>{item.desc}</Text>}
                </View>
                <Text style={styles.itemPrice}>
                  {item.price > 0 ? (
                    <>
                      ${item.price.toFixed(item.price % 1 === 0 ? 0 : 2)}
                      {item.unit ? (
                        <Text style={styles.itemUnit}>  /{item.unit}</Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.itemUnit}>{item.unit || 'MP'}</Text>
                  )}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Menu for reference. Orders taken at the venue.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: { color: colors.textMuted, fontSize: 14, marginBottom: 16 },
  backBtn: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  backBtnText: { color: colors.gold, fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueName: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  venueDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, letterSpacing: 0.2 },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 22,
    marginTop: 8,
    marginBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tab: { paddingVertical: 14, alignItems: 'flex-start' },
  tabActive: {},
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.textMuted,
  },
  tabTextActive: { color: colors.gold },
  tabUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -0.5,
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 1,
  },

  section: { marginTop: 24, marginBottom: 4 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  sectionLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(212,168,50,0.3)',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    color: colors.gold,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  itemDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: colors.gold, letterSpacing: 0.3 },
  itemUnit: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },

  footer: {
    marginTop: 40,
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: { fontSize: 11, color: colors.textMuted, letterSpacing: 0.5 },
});
