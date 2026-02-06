import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  type: 'outbid' | 'auction_won' | 'event_reminder' | 'crew_invite' | 'general';
  title: string;
  body: string;
  data?: Record<string, any>;
}

class NotificationService {
  private expoPushToken: string | null = null;

  async registerForPushNotifications(): Promise<string | null> {
    // Check if physical device (required for push)
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return null;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-project-id', // Replace with actual project ID
      });
      this.expoPushToken = tokenData.data;

      // Register token with backend
      await this.registerTokenWithBackend(this.expoPushToken);

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Luna Group',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E31837',
        });
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      return null;
    }
  }

  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      await api.registerPushToken(token, Platform.OS);
      console.log('Push token registered with backend');
    } catch (error) {
      console.error('Failed to register token with backend:', error);
    }
  }

  async unregisterPushToken(): Promise<void> {
    try {
      await api.removePushToken();
      this.expoPushToken = null;
      console.log('Push token unregistered');
    } catch (error) {
      console.error('Failed to unregister push token:', error);
    }
  }

  // Add notification listeners
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  // Schedule a local notification
  async scheduleLocalNotification(
    notification: NotificationData,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        data: { ...notification.data, type: notification.type },
        sound: 'default',
      },
      trigger: trigger || null, // null = immediate
    });
  }

  // Get pending notifications from server
  async getPendingNotifications(): Promise<any[]> {
    try {
      const response = await api.getPendingNotifications();
      return response.notifications || [];
    } catch (error) {
      console.error('Failed to get pending notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await api.markNotificationRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  // Get badge count
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  // Set badge count
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

export const notificationService = new NotificationService();
export default notificationService;
