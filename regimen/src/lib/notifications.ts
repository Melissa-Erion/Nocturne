/* Reminders → local notifications (iOS/Android). Web has no background scheduling, so this is a no-op there.
   Quiet hours are respected: a reminder whose time falls inside them is not scheduled. */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Reminder, State } from '@/domain/types';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

const toMin = (t: string) => { const [h, m] = (t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export function inQuietHours(time: string, start: string, end: string) {
  const t = toMin(time), a = toMin(start), b = toMin(end);
  return a <= b ? t >= a && t < b : t >= a || t < b;
}

const BODY: Record<string, string> = {
  'Upcoming workout': 'Your workout is coming up. Check today’s targets.',
  'Start workout': 'Time to train. Open Regimen to start logging.',
  'Missed workout': 'Missed today’s session? Reschedule it — the rotation keeps its order.',
  'Progress check-in': 'Check-in day: weight, measurements and a few ratings.',
  'Progress photos': 'Photo day. Same pose, same light, same time.',
  'Weight log': 'Log this morning’s weight.',
  'Meal prep': 'Meal-prep session today.',
  'Grocery shopping': 'Your grocery list is ready.',
  'Drink water': 'Water check.',
  "Prepare tomorrow's meals": 'Prepare tomorrow’s meals.',
  Supplements: 'Supplements.',
  'Wind-down routine': 'Start winding down.',
};

const DAYS: Record<string, number> = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 }; // expo weekday: 1 = Sunday

function triggersFor(r: Reminder, s: State): Notifications.NotificationTriggerInput[] {
  const [hour, minute] = r.time.split(':').map(Number);
  const T = Notifications.SchedulableTriggerInputTypes;
  if (/^Daily/.test(r.freq)) return [{ type: T.DAILY, hour, minute }];
  if (/Training days/.test(r.freq)) return s.profile.trainingDays.map(d => ({ type: T.WEEKLY, weekday: ((d + 1) % 7) + 1, hour, minute }));
  const wk = r.freq.match(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/);
  if (wk) return [{ type: T.WEEKLY, weekday: DAYS[wk[1]], hour, minute }];
  if (/Every 2 h/.test(r.freq)) return [10, 12, 14, 16, 18].map(h => ({ type: T.DAILY, hour: h, minute: 0 }));
  return []; // 'When missed' is event-driven, not scheduled
}

let lastSig = '';
export async function syncNotifications(s: State) {
  if (Platform.OS === 'web') return;
  const sig = JSON.stringify([s.reminders, s.profile.trainingDays, s.profile.quietStart, s.profile.quietEnd]);
  if (sig === lastSig) return; lastSig = sig;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of s.reminders.filter(x => x.enabled && x.channel.includes('Push'))) {
    if (inQuietHours(r.time, s.profile.quietStart, s.profile.quietEnd)) continue;
    for (const trigger of triggersFor(r, s)) {
      await Notifications.scheduleNotificationAsync({ content: { title: r.type, body: BODY[r.type] || r.type }, trigger });
    }
  }
}

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;
  const r = await Notifications.requestPermissionsAsync();
  lastSig = '';
  return r.granted;
}
