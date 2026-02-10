import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { colors, spacing, radius } from '../theme/colors';
import { api } from '../utils/api';
import { useFonts, fonts } from '../hooks/useFonts';
import * as Haptics from 'expo-haptics';

interface MembershipCardProps {
  compact?: boolean;
  onRegisterComplete?: () => void;
}

export const MembershipCard: React.FC<MembershipCardProps> = ({
  compact = false,
  onRegisterComplete,
}) => {
  const [status, setStatus] = useState<{
    registered: boolean;
    member_key: string | null;
    loading: boolean;
    error: string | null;
  }>({
    registered: false,
    member_key: null,
    loading: true,
    error: null,
  });
  const [walletLoading, setWalletLoading] = useState(false);
  const fontsLoaded = useFonts();

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }));
      const result = await api.cherryHubStatus();
      setStatus({
        registered: result.registered,
        member_key: result.member_key,
        loading: false,
        error: null,
      });
    } catch (e: any) {
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: e.message || 'Failed to check membership status',
      }));
    }
  };

  const handleRegister = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }));
      const result = await api.cherryHubRegister(false);
      
      if (result.status === 'success' || result.status === 'already_registered') {
        setStatus({
          registered: true,
          member_key: result.member_key,
          loading: false,
          error: null,
        });
        onRegisterComplete?.();
        Alert.alert(
          '🎉 Membership Activated!',
          'Your Luna Group membership is now active. You can add your card to Apple Wallet or Google Wallet.',
          [{ text: 'Got it!' }]
        );
      }
    } catch (e: any) {
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: e.message || 'Registration failed',
      }));
      Alert.alert('Registration Failed', e.message || 'Please try again later');
    }
  };

  const handleAddToWallet = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    
    try {
      setWalletLoading(true);
      const result = await api.cherryHubGetWalletPass(platform);
      
      if (platform === 'ios' && result.pass_content_base64) {
        // For iOS, we need to save the .pkpass file and open it
        const fileUri = FileSystem.documentDirectory + 'luna_membership.pkpass';
        await FileSystem.writeAsStringAsync(fileUri, result.pass_content_base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Open the file to trigger Apple Wallet
        const canOpen = await Linking.canOpenURL(fileUri);
        if (canOpen) {
          await Linking.openURL(fileUri);
        } else {
          Alert.alert(
            'Apple Wallet',
            'The membership card has been downloaded. Please open your Files app to add it to Apple Wallet.',
            [{ text: 'OK' }]
          );
        }
      } else if (platform === 'android' && result.google_wallet_url) {
        // For Android, open the Google Wallet URL
        const canOpen = await Linking.canOpenURL(result.google_wallet_url);
        if (canOpen) {
          await Linking.openURL(result.google_wallet_url);
        } else {
          Alert.alert(
            'Google Wallet',
            'Please install Google Wallet to add your membership card.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'Wallet Pass',
          'Your membership card is ready! Use your device\'s native wallet app to add it.',
          [{ text: 'OK' }]
        );
      }
    } catch (e: any) {
      Alert.alert(
        'Error',
        e.message || 'Failed to get wallet pass. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setWalletLoading(false);
    }
  };

  if (status.loading) {
    return (
      <View style={[styles.card, compact && styles.cardCompact]}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.loadingText}>Checking membership...</Text>
      </View>
    );
  }

  if (!status.registered) {
    return (
      <TouchableOpacity
        style={[styles.card, compact && styles.cardCompact]}
        onPress={handleRegister}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['rgba(227, 24, 55, 0.15)', 'rgba(227, 24, 55, 0.05)']}
          style={styles.cardGradient}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="card-outline" size={32} color={colors.accent} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, fontsLoaded && { fontFamily: fonts.bold }]}>
              Activate Membership
            </Text>
            <Text style={[styles.cardSubtitle, fontsLoaded && { fontFamily: fonts.regular }]}>
              Get your digital membership card
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.05)']}
        style={styles.cardGradient}
      >
        {/* Membership Card Info */}
        <View style={styles.membershipInfo}>
          <View style={styles.memberBadge}>
            <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
            <Text style={[styles.memberStatus, fontsLoaded && { fontFamily: fonts.semiBold }]}>
              MEMBER
            </Text>
          </View>
          <Text style={[styles.memberKey, fontsLoaded && { fontFamily: fonts.regular }]}>
            #{status.member_key || 'LUNA-XXXX'}
          </Text>
        </View>

        {/* Add to Wallet Button */}
        <TouchableOpacity
          style={styles.walletButton}
          onPress={handleAddToWallet}
          disabled={walletLoading}
          activeOpacity={0.85}
        >
          {walletLoading ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <>
              <Ionicons
                name={Platform.OS === 'ios' ? 'wallet-outline' : 'wallet'}
                size={20}
                color={colors.textPrimary}
              />
              <Text style={[styles.walletButtonText, fontsLoaded && { fontFamily: fonts.semiBold }]}>
                {Platform.OS === 'ios' ? 'Add to Apple Wallet' : 'Add to Google Wallet'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.sm,
  },
  cardCompact: {
    marginVertical: spacing.xs,
  },
  cardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(227, 24, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  loadingText: {
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    fontSize: 14,
  },
  membershipInfo: {
    flex: 1,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  memberStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 2,
    marginLeft: spacing.xs,
  },
  memberKey: {
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  walletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  walletButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default MembershipCard;
