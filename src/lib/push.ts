import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiRequest } from './api';

/**
 * Registers this device for Expo push. Silently no-ops in simulators, without
 * notification permission, or before an EAS projectId exists — order updates
 * still arrive by email and in-app.
 */
export async function registerForPush(): Promise<void> {
  if (!Device.isDevice) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const granted =
    existing.granted ||
    (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  if (!projectId) return;

  const token = (
    await Notifications.getExpoPushTokenAsync({ projectId })
  ).data;

  await apiRequest('/push-token', {
    method: 'POST',
    body: {
      token,
      platform: Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB',
    },
  });
}
