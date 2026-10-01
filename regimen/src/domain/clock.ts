/* Times of day are stored as 24-hour "HH:MM" strings; these helpers show them in the user's clock format
   and pick the workout time for a given weekday (each training day can have its own time). */
import type { Profile } from './types';

export type Clock = '12h' | '24h';

/** "17:30" → "5:30 PM" (12-hour, the default) or "17:30" (24-hour). Invalid input is returned unchanged. */
export function fmtTime(hhmm: string | null | undefined, clock: Clock = '12h'): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!m) return hhmm || '';
  const h = Number(m[1]) % 24;
  if (clock === '24h') return `${String(h).padStart(2, '0')}:${m[2]}`;
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Workout time on a weekday (0 = Monday): that day's own time if set, else the default workout time. */
export const workoutTimeOn = (p: Pick<Profile, 'workoutTime' | 'dayTimes'>, weekday: number): string =>
  p.dayTimes?.[String(weekday)] || p.workoutTime;

/** A starting point for rest-day targets: same protein and fat, about 10% fewer calories taken from carbs
    (rest days burn less), never below the calorie floor or 50 g carbs. */
export function suggestRestTargets(t: { kcal: number; protein: number; carbs: number; fat: number }, floor: number) {
  const kcal = Math.max(Math.ceil(floor / 10) * 10, Math.round((t.kcal * 0.9) / 10) * 10);
  if (kcal >= t.kcal) return { ...t };
  const carbs = Math.max(50, Math.round(t.carbs - (t.kcal - kcal) / 4));
  const macroKcal = t.protein * 4 + carbs * 4 + t.fat * 9;
  return { kcal: carbs === 50 ? Math.max(kcal, Math.round(macroKcal / 10) * 10) : kcal, protein: t.protein, carbs, fat: t.fat };
}

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const hm = (t: number) => { const x = ((t % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

/** A reminder's time on a weekday. Workout reminders ("Start workout", "Upcoming workout") move with that day's
    workout time, keeping the same gap they have from the default workout time; other reminders keep their time. */
export function reminderTimeOn(p: Pick<Profile, 'workoutTime' | 'dayTimes'>, r: { type: string; time: string }, weekday: number): string {
  if (r.type !== 'Start workout' && r.type !== 'Upcoming workout') return r.time;
  const day = workoutTimeOn(p, weekday);
  if (day === p.workoutTime || !/^\d{1,2}:\d{2}$/.test(day) || !/^\d{1,2}:\d{2}$/.test(p.workoutTime)) return r.time;
  return hm(toMin(r.time) + toMin(day) - toMin(p.workoutTime));
}
