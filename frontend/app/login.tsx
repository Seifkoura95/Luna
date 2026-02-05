import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { colors } from '../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/utils/api';
import { useAuthStore } from '../src/store/authStore';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function LoginScreen() {
  const router = useRouter();
  const { login, setLoading } = useAuthStore();

  const handleGoogleLogin = async () => {
    try {
      // Platform-specific redirect URL
      const redirectUrl = Platform.OS === 'web'
        ? `${API_URL}/`
        : Linking.createURL('/');

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web') {
        // Web: Direct navigation
        window.location.href = authUrl;
      } else {
        // Mobile: Use WebBrowser
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          // Parse session_id from result URL
          const url = new URL(result.url);
          let sessionId = url.searchParams.get('session_id');
          if (!sessionId && url.hash) {
            sessionId = url.hash.split('session_id=')[1]?.split('&')[0];
          }

          if (sessionId) {
            setLoading(true);
            const data = await api.exchangeSession(sessionId);
            await login(
              {
                user_id: data.user_id,
                email: data.email,
                name: data.name,
                picture: data.picture,
                tier: 'bronze',
                points_balance: 0,
              },
              data.session_token
            );
            
            // Fetch fresh user data
            const user = await api.getMe();
            useAuthStore.getState().setUser(user);
            
            router.replace('/(tabs)');
          }
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logo}>ECLIPSE</Text>
          <Text style={styles.location}>BRISBANE</Text>
          <View style={styles.divider} />
          <Text style={styles.tagline}>Premium VIP Experience</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="qr-code" size={24} color={colors.accent} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Tonight Pass</Text>
              <Text style={styles.featureDesc}>Skip the queue with your digital pass</Text>
            </View>
          </View>
          
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="star" size={24} color={colors.premiumGold} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Earn Rewards</Text>
              <Text style={styles.featureDesc}>Get points for every visit</Text>
            </View>
          </View>
          
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="diamond" size={24} color={colors.platinum} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>VIP Benefits</Text>
              <Text style={styles.featureDesc}>Exclusive perks and experiences</Text>
            </View>
          </View>
        </View>

        {/* Login Button */}
        <View style={styles.buttonSection}>
          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
            <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
          
          <Text style={styles.termsText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 8,
  },
  location: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 6,
    marginTop: 4,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: colors.accent,
    marginVertical: 20,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  featuresSection: {
    paddingVertical: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  buttonSection: {
    alignItems: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  googleButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  termsText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
