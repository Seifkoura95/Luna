import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius } from '../src/theme/colors';
import { AppBackground } from '../src/components/AppBackground';

interface PaymentMethod {
  id: string;
  type: 'card' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  expiry?: string;
  isDefault: boolean;
}

export default function PaymentMethodsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: '1', type: 'card', last4: '4242', brand: 'Visa', expiry: '12/27', isDefault: true },
    { id: '2', type: 'apple_pay', isDefault: false },
  ]);

  const getCardIcon = (brand?: string) => {
    switch (brand?.toLowerCase()) {
      case 'visa': return 'card';
      case 'mastercard': return 'card';
      case 'amex': return 'card';
      default: return 'card-outline';
    }
  };

  const setDefaultMethod = (id: string) => {
    setPaymentMethods(methods =>
      methods.map(m => ({ ...m, isDefault: m.id === id }))
    );
  };

  const removeMethod = (id: string) => {
    Alert.alert(
      'Remove Payment Method',
      'Are you sure you want to remove this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setPaymentMethods(methods => methods.filter(m => m.id !== id)),
        },
      ]
    );
  };

  const addPaymentMethod = () => {
    Alert.alert('Add Payment Method', 'Stripe payment integration coming soon!');
  };

  return (
    <View style={styles.container}>
      <AppBackground />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PAYMENT METHODS</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Payment Methods List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOUR CARDS</Text>
          
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={styles.paymentCard}
              onPress={() => setDefaultMethod(method.id)}
            >
              <View style={styles.paymentIcon}>
                {method.type === 'apple_pay' ? (
                  <Ionicons name="logo-apple" size={24} color="#fff" />
                ) : method.type === 'google_pay' ? (
                  <Ionicons name="logo-google" size={24} color="#fff" />
                ) : (
                  <Ionicons name={getCardIcon(method.brand) as any} size={24} color="#fff" />
                )}
              </View>
              
              <View style={styles.paymentInfo}>
                {method.type === 'card' ? (
                  <>
                    <Text style={styles.paymentTitle}>{method.brand} •••• {method.last4}</Text>
                    <Text style={styles.paymentDesc}>Expires {method.expiry}</Text>
                  </>
                ) : method.type === 'apple_pay' ? (
                  <Text style={styles.paymentTitle}>Apple Pay</Text>
                ) : (
                  <Text style={styles.paymentTitle}>Google Pay</Text>
                )}
              </View>

              <View style={styles.paymentActions}>
                {method.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>Default</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => removeMethod(method.id)}>
                  <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add Payment Method */}
        <TouchableOpacity style={styles.addButton} onPress={addPaymentMethod}>
          <Ionicons name="add-circle" size={24} color={colors.accent} />
          <Text style={styles.addButtonText}>Add Payment Method</Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={20} color={colors.gold} />
          <Text style={styles.infoText}>
            Your payment information is securely stored and encrypted. We use Stripe for all payment processing.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  paymentDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  paymentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  defaultBadge: {
    backgroundColor: colors.gold + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
    textTransform: 'uppercase',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227, 24, 55, 0.1)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.gold,
    lineHeight: 18,
  },
});
