import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const router = useRouter();

  // ── Re-run whenever the user changes (login/logout/restored). This is the
  // critical fix: cold-boot of the app fires this hook BEFORE the auth store
  // has loaded the JWT from AsyncStorage, so previously the registration POST
  // went out unauthenticated and 401'd silently — leaving every user without
  // a push_token in the DB. By keying on `userId` we register exactly once
  // per logged-in session, after auth is ready.
  const userId = useAuthStore((s) => s.user?.user_id ?? null);
  const authToken = useAuthStore((s) => s.token);

  // Listen for incoming notifications + handle taps. This effect runs once and
  // is independent of auth state.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (n) => {
        setNotification(n);
        console.log('📱 Notification received:', n.request.content.title);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('📱 Notification tapped:', data);
        handleNotificationNavigation(data, router);
      }
    );

    return () => {
      try {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      } catch {
        // ignore web cleanup errors
      }
    };
  }, [router]);

  // Permission + token retrieval + backend registration. Gated on a logged-in
  // user. Re-runs if the user logs in/out so the token is always linked to
  // the correct account.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!userId || !authToken) {
      // No user yet — don't try to register. The hook will re-run when auth
      // resolves.
      return;
    }

    let cancelled = false;

    (async () => {
      const { token, status } = await registerForPushNotificationsAsync();
      if (cancelled) return;
      setPermissionStatus(status);
      if (!token) {
        console.log(`📱 No push token returned (status=${status})`);
        return;
      }
      setExpoPushToken(token);
      console.log('📱 Push token obtained:', token.substring(0, 30) + '…');
      try {
        await api.registerPushToken(token, Platform.OS);
        console.log(`📱 Push token registered with backend for user ${userId.substring(0, 8)}…`);
      } catch (err) {
        console.error('📱 Failed to register push token with backend:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, authToken]);

  return {
    expoPushToken,
    notification,
    permissionStatus,
  };
}

interface RegistrationResult {
  token: string | null;
  status: string;
}

async function registerForPushNotificationsAsync(): Promise<RegistrationResult> {
  let token: string | null = null;
  let status = 'undetermined';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Luna VIP Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('auctions', {
      name: 'Auction Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 100, 100],
      lightColor: '#D4AF37',
    });
    await Notifications.setNotificationChannelAsync('events', {
      name: 'Event Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#2563EB',
    });
  }

  if (!Device.isDevice) {
    console.log('📱 Push notifications require a physical device');
    return { token: null, status: 'simulator' };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  status = existingStatus;
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    finalStatus = requested;
    status = requested;
  }

  if (finalStatus !== 'granted') {
    console.log('📱 Push notification permission not granted');
    return { token: null, status };
  }

  try {
    const projectId =
      process.env.EXPO_PUBLIC_PROJECT_ID ||
      (Constants?.expoConfig?.extra as any)?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        '📱 No EAS projectId found — push token will be sandbox only (Expo Go). ' +
          'Set extra.eas.projectId in app.json for real push in production builds.',
      );
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenData.data;
    console.log('📱 Got Expo push token');
  } catch (error) {
    console.error('📱 Error getting push token:', error);
  }

  return { token, status };
}

function handleNotificationNavigation(data: any, router: any) {
  try {
    if (data?.type === 'event' || data?.action === 'view_event') {
      if (data.event_id) router.push(`/event/${data.event_id}`);
    } else if (data?.type === 'auction' || data?.action === 'view_auction') {
      router.push(data.auction_id ? `/auctions` : '/(tabs)/auctions');
    } else if (data?.type === 'booking' || data?.action === 'view_booking') {
      router.push('/(tabs)/profile');
    } else if (data?.type === 'crew' || data?.action === 'view_crew') {
      if (data.crew_id) router.push(`/crew/${data.crew_id}`);
    } else if (data?.type === 'wallet' || data?.action === 'view_wallet') {
      router.push('/(tabs)/wallet');
    } else if (data?.type === 'rewards' || data?.action === 'view_rewards') {
      router.push('/(tabs)/wallet');
    } else if (data?.type === 'geofence' || data?.action === 'nearby_venue') {
      if (data.venue_id) router.push(`/venue/${data.venue_id}`);
    } else if (data?.type === 'chat' || data?.action === 'view_chat') {
      router.push('/(tabs)/luna-ai');
    }
  } catch (error) {
    console.error('📱 Navigation error:', error);
  }
}

export default usePushNotifications;
