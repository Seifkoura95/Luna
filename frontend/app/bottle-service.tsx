import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { Icon } from '../src/components/Icon';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../src/components/AppBackground';
import * as Haptics from 'expo-haptics';

const BOTTLE_VENUES = [
  { id: 'eclipse', name: 'Eclipse', color: '#E31837' },
];

type CartItem = { package_id: string; name: string; price: number; quantity: number };

export default function BottleServiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ venue_id?: string }>();

  const initialVenue = BOTTLE_VENUES.find(v => v.id === params.venue_id) || BOTTLE_VENUES[0];
  const [selectedVenue, setSelectedVenue] = useState(initialVenue);
  const [menu, setMenu] = useState<any[]>([]);
  const [categories, setCategories] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [specialRequests, setSpecialRequests] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const getNext7Dates = () => {
    const dates = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push({
        value: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' }),
        short: d.toLocaleDateString('en-AU', { weekday: 'short' }),
      });
    }
    return dates;
  };
  const dates = getNext7Dates();

  useEffect(() => {
    fetchMenu();
    setCart([]);
  }, [selectedVenue]);

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const res = await api.getBottleMenu(selectedVenue.id);
      setMenu(res.menu || []);
      setCategories(res.categories || {});
    } catch (e) {
      console.error('Failed to load bottle menu:', e);
      setMenu([]);
      setCategories({});
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: any) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart(prev => {
      const existing = prev.find(c => c.package_id === item.id);
      if (existing) {
        return prev.map(c => c.package_id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { package_id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const removeFromCart = (packageId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.package_id === packageId);
      if (existing && existing.quantity > 1) {
        return prev.map(c => c.package_id === packageId ? { ...c, quantity: c.quantity - 1 } : c);
      }
      return prev.filter(c => c.package_id !== packageId);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!selectedDate) {
      Alert.alert('Select Date', 'Please select a date for your pre-order');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Add some items to your pre-order');
      return;
    }

    setOrdering(true);
    try {
      const res = await api.createBottlePreorder({
        venue_id: selectedVenue.id,
        date: selectedDate,
        items: cart.map(c => ({ package_id: c.package_id, quantity: c.quantity })),
        special_requests: specialRequests || undefined,
      });

      // Stripe flow — open checkout, webhook confirms & awards points
      if (res.checkout_url) {
        if (Platform.OS === 'web') {
          window.location.href = res.checkout_url;
        } else {
          const Linking = require('expo-linking');
          await Linking.openURL(res.checkout_url);
        }
        return;
      }

      // DEV_MODE / free path
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Pre-Order Confirmed!',
        `${res.message}\n\nYou earned ${res.points_earned} Luna Points!`,
        [{ text: 'Done', onPress: () => { setShowCart(false); setCart([]); router.back(); } }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  };

  const getCartQuantity = (itemId: string) => {
    const c = cart.find(x => x.package_id === itemId);
    return c ? c.quantity : 0;
  };

  const filteredMenu = activeCategory === 'All' ? menu : menu.filter(m => m.category === activeCategory);
  const categoryNames = ['All', ...Object.keys(categories)];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} data-testid="bottle-service-screen">
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} data-testid="bottle-back-btn">
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Bottle Service</Text>
          <Text style={styles.headerSub}>Pre-Order & Skip the Wait</Text>
        </View>
        <TouchableOpacity
          style={styles.cartBtn}
          onPress={() => setShowCart(true)}
          data-testid="bottle-cart-btn"
        >
          <Icon name="cart" size={24} color={colors.textPrimary} />
          {cartCount > 0 && (
            <View style={[styles.cartBadge, { backgroundColor: selectedVenue.color }]}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Venue Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.venueScroll} contentContainerStyle={styles.venueScrollContent}>
          {BOTTLE_VENUES.map(venue => {
            const isActive = selectedVenue.id === venue.id;
            return (
              <TouchableOpacity
                key={venue.id}
                style={[styles.venueChip, isActive && { backgroundColor: venue.color, borderColor: venue.color }]}
                onPress={() => setSelectedVenue(venue)}
                data-testid={`venue-chip-${venue.id}`}
              >
                <Text style={[styles.venueChipText, isActive && { color: '#FFF' }]}>{venue.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SELECT DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {dates.map(d => (
              <TouchableOpacity
                key={d.value}
                style={[styles.dateChip, selectedDate === d.value && { borderColor: selectedVenue.color, backgroundColor: `${selectedVenue.color}22` }]}
                onPress={() => setSelectedDate(d.value)}
                data-testid={`date-${d.value}`}
              >
                <Text style={[styles.dateDay, selectedDate === d.value && { color: selectedVenue.color }]}>{d.short}</Text>
                <Text style={[styles.dateNum, selectedDate === d.value && { color: colors.textPrimary }]}>{d.label.split(' ').slice(1).join(' ')}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Category Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
          {categoryNames.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catTab, activeCategory === cat && styles.catTabActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.catTabText, activeCategory === cat && styles.catTabTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Menu Items */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={selectedVenue.color} />
          </View>
        ) : filteredMenu.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Icon name="wine" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No bottles available</Text>
          </View>
        ) : (
          filteredMenu.map(item => {
            const qty = getCartQuantity(item.id);
            return (
              <View key={item.id} style={styles.menuCard} data-testid={`menu-item-${item.id}`}>
                <Image source={{ uri: item.image_url }} style={styles.menuImage} />
                <View style={styles.menuInfo}>
                  <View style={styles.menuTop}>
                    <Text style={styles.menuName}>{item.name}</Text>
                    <View style={[styles.catBadge, { backgroundColor: `${selectedVenue.color}22` }]}>
                      <Text style={[styles.catBadgeText, { color: selectedVenue.color }]}>{item.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.menuDesc} numberOfLines={2}>{item.description}</Text>
                  <View style={styles.menuBottom}>
                    <Text style={[styles.menuPrice, { color: selectedVenue.color }]}>${item.price}</Text>
                    {qty === 0 ? (
                      <TouchableOpacity
                        style={[styles.addBtn, { backgroundColor: selectedVenue.color }]}
                        onPress={() => addToCart(item)}
                        data-testid={`add-${item.id}`}
                      >
                        <Icon name="add" size={20} color="#FFF" />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.qtyRow}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item.id)}>
                          <Icon name="remove" size={18} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{qty}</Text>
                        <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: selectedVenue.color }]} onPress={() => addToCart(item)}>
                          <Icon name="add" size={18} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating Cart Bar */}
      {cartCount > 0 && !showCart && (
        <TouchableOpacity
          style={[styles.floatingCart, { borderColor: selectedVenue.color }]}
          onPress={() => setShowCart(true)}
          data-testid="floating-cart-bar"
        >
          <LinearGradient colors={[selectedVenue.color, `${selectedVenue.color}CC`]} style={styles.floatingCartGrad}>
            <View style={styles.floatingCartLeft}>
              <Text style={styles.floatingCartCount}>{cartCount} item{cartCount > 1 ? 's' : ''}</Text>
            </View>
            <Text style={styles.floatingCartTotal}>${cartTotal}</Text>
            <Text style={styles.floatingCartAction}>View Cart</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Cart Modal */}
      <Modal visible={showCart} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { backgroundColor: selectedVenue.color }]}>
              <Text style={styles.modalTitle}>Your Pre-Order</Text>
              <TouchableOpacity onPress={() => setShowCart(false)} data-testid="close-cart-modal">
                <Icon name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalVenue}>{selectedVenue.name}</Text>
              {selectedDate ? (
                <Text style={styles.modalDate}>{dates.find(d => d.value === selectedDate)?.label}</Text>
              ) : (
                <Text style={[styles.modalDate, { color: colors.error }]}>No date selected</Text>
              )}

              <View style={styles.modalDivider} />

              {cart.map(item => (
                <View key={item.package_id} style={styles.cartRow}>
                  <View style={styles.cartRowInfo}>
                    <Text style={styles.cartItemName}>{item.name}</Text>
                    <Text style={styles.cartItemPrice}>${item.price} x {item.quantity}</Text>
                  </View>
                  <Text style={styles.cartLineTotal}>${item.price * item.quantity}</Text>
                  <View style={styles.cartQtyControls}>
                    <TouchableOpacity style={styles.cartQtyBtn} onPress={() => removeFromCart(item.package_id)}>
                      <Icon name="remove" size={16} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cartQtyBtn} onPress={() => addToCart({ id: item.package_id, name: item.name, price: item.price })}>
                      <Icon name="add" size={16} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={styles.modalDivider} />

              <TextInput
                style={styles.notesInput}
                placeholder="Special requests (e.g., ice bucket, sparklers)..."
                placeholderTextColor={colors.textMuted}
                value={specialRequests}
                onChangeText={setSpecialRequests}
                multiline
              />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={[styles.totalAmount, { color: selectedVenue.color }]}>${cartTotal}</Text>
              </View>

              <View style={styles.pointsRow}>
                <Icon name="star" size={16} color={colors.gold} />
                <Text style={styles.pointsText}>Earn {Math.round(cartTotal * 0.1)} Luna Points</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.orderBtn, { backgroundColor: selectedVenue.color }]}
                onPress={handlePlaceOrder}
                disabled={ordering}
                data-testid="place-order-btn"
              >
                {ordering ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.orderBtnText}>Confirm Pre-Order - ${cartTotal}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1 },
  headerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cartBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  cartBadge: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  content: { flex: 1 },

  // Venue chips
  venueScroll: { marginBottom: spacing.md },
  venueScrollContent: { paddingHorizontal: spacing.md, gap: spacing.xs },
  venueChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass },
  venueChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  // Dates
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.sm },
  dateChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm, alignItems: 'center', backgroundColor: colors.glass },
  dateDay: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  dateNum: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Category tabs
  catScroll: { marginBottom: spacing.md },
  catContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  catTab: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderLight },
  catTabActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  catTabText: { fontSize: 13, color: colors.textMuted },
  catTabTextActive: { color: colors.accentBright, fontWeight: '600' },

  // Menu items
  loadingWrap: { height: 200, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { height: 200, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  emptyText: { fontSize: 16, color: colors.textMuted },
  menuCard: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.glass, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorderSubtle, overflow: 'hidden' },
  menuImage: { width: 100, height: 120 },
  menuInfo: { flex: 1, padding: spacing.sm },
  menuTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  menuName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  catBadgeText: { fontSize: 10, fontWeight: '600' },
  menuDesc: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 16 },
  menuBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuPrice: { fontSize: 18, fontWeight: '700' },
  addBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border },
  qtyText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, minWidth: 20, textAlign: 'center' },

  // Floating cart
  floatingCart: { position: 'absolute', bottom: 24, left: spacing.md, right: spacing.md, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1 },
  floatingCartGrad: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  floatingCartLeft: { flex: 1 },
  floatingCartCount: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  floatingCartTotal: { fontSize: 18, fontWeight: '800', color: '#FFF', marginRight: spacing.md },
  floatingCartAction: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.backgroundCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  modalBody: { padding: spacing.lg },
  modalVenue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  modalDate: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  modalDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  cartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  cartRowInfo: { flex: 1 },
  cartItemName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  cartItemPrice: { fontSize: 12, color: colors.textMuted },
  cartLineTotal: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginRight: spacing.sm, minWidth: 60, textAlign: 'right' },
  cartQtyControls: { flexDirection: 'row', gap: 4 },
  cartQtyBtn: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundElevated, borderWidth: 1, borderColor: colors.border },
  notesInput: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, fontSize: 13, minHeight: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  totalLabel: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  totalAmount: { fontSize: 24, fontWeight: '800' },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pointsText: { fontSize: 13, color: colors.gold },
  modalFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  orderBtn: { paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center' },
  orderBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
