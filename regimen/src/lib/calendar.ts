/* "Show in main calendar": mirror planned workouts into a dedicated "Regimen" device calendar (iOS/Android).
   On web, use the .ics export instead. */
import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';
import { workoutOf } from '@/domain/schedule';
import type { State } from '@/domain/types';

const TITLE = 'Regimen';
let lastSig = '';

async function regimenCalendarId(): Promise<string | null> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const own = cals.find(c => c.title === TITLE);
  if (own) return own.id;
  if (Platform.OS === 'ios') {
    const def = await Calendar.getDefaultCalendarAsync();
    return Calendar.createCalendarAsync({ title: TITLE, color: '#9184d9', entityType: Calendar.EntityTypes.EVENT, sourceId: def.source.id, source: def.source, name: TITLE, ownerAccount: 'personal', accessLevel: Calendar.CalendarAccessLevel.OWNER });
  }
  return Calendar.createCalendarAsync({ title: TITLE, color: '#9184d9', entityType: Calendar.EntityTypes.EVENT, source: { isLocalAccount: true, name: TITLE, type: 'LOCAL' }, name: TITLE, ownerAccount: 'personal', accessLevel: Calendar.CalendarAccessLevel.OWNER });
}

export async function requestCalendarPermission() {
  if (Platform.OS === 'web') return false;
  const r = await Calendar.requestCalendarPermissionsAsync();
  lastSig = '';
  return r.granted;
}

export async function syncCalendar(s: State, today: string) {
  if (Platform.OS === 'web' || !s.profile.calendarSync) return;
  const planned = s.schedule.filter(e => e.status === 'planned' && e.date >= today).sort((a, b) => a.date < b.date ? -1 : 1);
  const sig = JSON.stringify([planned.map(e => [e.date, e.workoutId]), s.profile.workoutTime, s.profile.duration]);
  if (sig === lastSig) return;
  const perm = await Calendar.getCalendarPermissionsAsync();
  if (!perm.granted) return;
  lastSig = sig;
  const id = await regimenCalendarId(); if (!id) return;
  const from = new Date(today + 'T00:00:00'); const to = new Date(from.getTime() + 90 * 864e5);
  for (const ev of await Calendar.getEventsAsync([id], from, to)) await Calendar.deleteEventAsync(ev.id);
  const ctx = { s, today };
  const [h, m] = s.profile.workoutTime.split(':').map(Number);
  for (const e of planned) {
    const w = workoutOf(ctx, e.workoutId, e.planId); if (!w) continue;
    const start = new Date(e.date + 'T00:00:00'); start.setHours(h || 0, m || 0, 0, 0);
    await Calendar.createEventAsync(id, { title: w.name, notes: w.focus, startDate: start, endDate: new Date(start.getTime() + s.profile.duration * 60000) });
  }
}
