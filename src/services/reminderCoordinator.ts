import { getLastFeed } from '../db/feedRepo';
import { ReminderSettings } from '../types/models';
import { cancelReminder, requestNotificationPermission, scheduleNextFeedReminder } from './notifications';

export const recalculateReminder = async (babyId: string, settings: ReminderSettings) => {
  if (!settings.enabled) {
    await cancelReminder();
    return null;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    await cancelReminder();
    throw new Error('Notifications permission not granted.');
  }

  const lastFeed = await getLastFeed(babyId);
  if (!lastFeed) {
    await cancelReminder();
    return null;
  }

  return scheduleNextFeedReminder(lastFeed.timestamp, settings.intervalHours, {
    start: settings.quietHoursStart,
    end: settings.quietHoursEnd,
    allowDuringQuietHours: settings.allowDuringQuietHours,
  });
};
