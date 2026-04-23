import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';

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

  useEffect(() => {
    // Skip on web
    if (Platform.OS === 'web') {
      console.log('📱 Push notifications not supported on web');
      return;
    }

    // Register for push notifications
    registerForPushNotificationsAsync().then(({ token, status }) => {
      setPermissionStatus(status);
      if (token) {
        setExpoPushToken(token);
        console.log('📱 Push token obtained:', token.substring(0, 30) + '...');
        // Register token with backend
        api.registerPushToken(token, Platform.OS).then(() => {
          console.log('📱 Push token registered with backend');
        }).catch((err) => {
          console.error('📱 Failed to register push token with backend:', err);
        });
      }
    });

    // Listen for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
        console.log('📱 Notification received:', notification.request.content.title);
      }
    );

    // Listen for notification interactions (taps)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('📱 Notification tapped:', data);
        
        // Handle navigation based on notification type
        handleNotificationNavigation(data, router);
      }
    );

    return () => {
      if (notificationListener.current && Notifications.removeNotificationSubscription) {
        try {
          Notifications.removeNotificationSubscription(notificationListener.current);
        } catch (e) {
          // Ignore cleanup errors on web
        }
      }
      if (responseListener.current && Notifications.removeNotificationSubscription) {
        try {
          Notifications.removeNotificationSubscription(responseListener.current);
        } catch (e) {
          // Ignore cleanup errors on web
        }
      }
    };
  }, [router]);

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
  let token = null;
  let status = 'undetermined';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Luna VIP Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB', // Luna accent color
      sound: 'default',
    });
    
    // Also create special channels for different notification types
    await Notifications.setNotificationChannelAsync('auctions', {
      name: 'Auction Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 100, 100],
      lightColor: '#D4AF37', // Gold
    });
    
    await Notifications.setNotificationChannelAsync('events', {
      name: 'Event Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#2563EB',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    status = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status: requestedStatus } = await Notifications.requestPermissionsAsync();
      finalStatus = requestedStatus;
      status = requestedStatus;
    }
    
    if (finalStatus !== 'granted') {
      console.log('📱 Push notification permission not granted');
      return { token: null, status };
    }
    
    try {
      // Resolve the EAS project ID with a safe fallback chain:
      //   1. EXPO_PUBLIC_PROJECT_ID (if set in .env)
      //   2. Constants.expoConfig.extra.eas.projectId (from app.json — set to "70fc7d51-...")
      //   3. Constants.easConfig.projectId (EAS runtime config in standalone builds)
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

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      token = tokenData.data;
      console.log('📱 Got Expo push token');
    } catch (error) {
      console.error('📱 Error getting push token:', error);
    }
  } else {
    console.log('📱 Push notifications require a physical device');
    status = 'simulator';
  }

  return { token, status };
}

function handleNotificationNavigation(data: any, router: any) {
  // Navigate based on notification type/action
  try {
    if (data.type === 'event' || data.action === 'view_event') {
      if (data.event_id) {
        router.push(`/event/${data.event_id}`);
      }
    } else if (data.type === 'auction' || data.action === 'view_auction') {
      if (data.auction_id) {
        router.push(`/auctions`);
      } else {
        router.push('/(tabs)/auctions');
      }
    } else if (data.type === 'booking' || data.action === 'view_booking') {
      router.push('/(tabs)/profile');
    } else if (data.type === 'crew' || data.action === 'view_crew') {
      if (data.crew_id) {
        router.push(`/crew/${data.crew_id}`);
      }
    } else if (data.type === 'wallet' || data.action === 'view_wallet') {
      router.push('/(tabs)/wallet');
    } else if (data.type === 'rewards' || data.action === 'view_rewards') {
      router.push('/(tabs)/wallet');
    } else if (data.type === 'geofence' || data.action === 'nearby_venue') {
      if (data.venue_id) {
        router.push(`/venue/${data.venue_id}`);
      }
    } else if (data.type === 'chat' || data.action === 'view_chat') {
      router.push('/(tabs)/luna-ai');
    }
  } catch (error) {
    console.error('📱 Navigation error:', error);
  }
}

export default usePushNotifications;
