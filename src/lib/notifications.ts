import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import type { NotificationResponse } from 'expo-notifications';
import { formatReminder } from './format';

export const REMINDER_CHANNEL = 'idea-reminders';

// expo-notifications eagerly loads the native `ExpoTopicSubscriptionModule` on
// Android at import time. Expo Go does not register that native module, so any
// import of the package crashes the whole app there.
// See https://github.com/expo/expo/issues/52175.
// Workaround: only require the package in runtimes that actually provide it.
const inExpoGoOnAndroid =
  Platform.OS === 'android' &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import('expo-notifications');

let Notifications: NotificationsModule | null = null;

if (!inExpoGoOnAndroid) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications') as NotificationsModule;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    Notifications = null;
  }
}

export const notificationsSupported = Notifications !== null;

export function notificationsUnsupportedReason(): string {
  if (inExpoGoOnAndroid) {
    return 'Expo Go on Android cannot schedule notifications (missing native module). Run a development build (npx expo run:android) to enable reminders.';
  }
  return 'Notifications are not available on this device.';
}

export async function ensureNotificationSetup(): Promise<boolean> {
  if (!Notifications) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Idea reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C5CFF',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function scheduleIdeaReminder(
  ideaId: string,
  title: string,
  when: Date,
): Promise<string> {
  if (!Notifications) throw new Error('Notifications unavailable in this runtime');
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Idea reminder',
      body: title,
      data: { url: `/idea/${ideaId}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      ...(Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL } : {}),
    },
  });
}

export async function cancelReminder(notificationId: string | null): Promise<void> {
  if (!Notifications || !notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // already fired or canceled
  }
}

export function describeReminder(when: Date): string {
  return formatReminder(when);
}

export function useNotificationResponse(): NotificationResponse | null | undefined {
  const [response, setResponse] = useState<NotificationResponse | null | undefined>(undefined);

  useEffect(() => {
    if (!Notifications) return undefined;
    const subscription = Notifications.addNotificationResponseReceivedListener((r) =>
      setResponse(r),
    );
    // Cold-start taps are not emitted as events; fetch the stored response async.
    Notifications.getLastNotificationResponseAsync()
      .then((initial) => {
        if (initial) setResponse(initial);
      })
      .catch(() => {});
    return () => subscription.remove();
  }, []);

  return response;
}
