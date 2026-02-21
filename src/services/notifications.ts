import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getReminderNotificationId, setReminderNotificationId } from '../db/settingsRepo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type QuietHours = {
  start?: string | null;
  end?: string | null;
  allowDuringQuietHours: boolean;
};

export type BabyNotificationIdentity = {
  name?: string | null;
  photoUri?: string | null;
};

const inQuietHours = (date: Date, quietHours: QuietHours) => {
  if (quietHours.allowDuringQuietHours) return false;
  if (!quietHours.start || !quietHours.end) return false;

  const [sh, sm] = quietHours.start.split(':').map(Number);
  const [eh, em] = quietHours.end.split(':').map(Number);
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
};

const moveOutOfQuietHours = (date: Date, quietHours: QuietHours) => {
  if (!inQuietHours(date, quietHours)) return date;
  if (!quietHours.start || !quietHours.end) return date;

  const [eh, em] = quietHours.end.split(':').map(Number);
  const moved = new Date(date);
  moved.setHours(eh, em, 0, 0);

  if (moved <= date) {
    moved.setDate(moved.getDate() + 1);
  }

  return moved;
};

export const requestNotificationPermission = async () => {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;

  const next = await Notifications.requestPermissionsAsync();
  return next.status === 'granted';
};

export const cancelReminder = async () => {
  const existing = await getReminderNotificationId();
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing);
    await setReminderNotificationId(null);
  }
};

export const scheduleNextFeedReminder = async (
  lastFeedTime: string,
  intervalHours: number,
  quietHours: QuietHours,
  identity?: BabyNotificationIdentity,
) => {
  await cancelReminder();

  let triggerDate = new Date(lastFeedTime);
  triggerDate.setHours(triggerDate.getHours() + intervalHours);
  triggerDate = moveOutOfQuietHours(triggerDate, quietHours);

  if (triggerDate <= new Date()) {
    triggerDate = new Date(Date.now() + 60 * 1000);
  }

  if (Platform.OS === 'ios') {
    await Notifications.setNotificationCategoryAsync('feed-reminder', []);
  }

  const normalizedName = identity?.name?.trim() || 'Baby';
  const avatar = normalizedName.charAt(0).toUpperCase();
  const content: Notifications.NotificationContentInput = {
    title: `${avatar} ${normalizedName}`,
    subtitle: 'Feeding reminder',
    body: `Time to log ${normalizedName}'s next feed.`,
    sound: true,
  };

  if (identity?.photoUri && Platform.OS === 'ios') {
    (content as any).attachments = [{ identifier: 'baby-photo', url: identity.photoUri }];
  }

  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  await setReminderNotificationId(id);
  return triggerDate.toISOString();
};
