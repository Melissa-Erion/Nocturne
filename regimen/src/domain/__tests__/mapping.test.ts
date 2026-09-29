/* State → Supabase rows → State must be lossless, or data would silently change after a reload. */
jest.mock('@/lib/supabase', () => ({ supabase: null, PHOTO_BUCKET: 'progress-photos' }));
import * as R from '../index';
import { TABLES, fromTables, type Row } from '@/store/mapping';

const TODAY = '2026-09-29';

it('round-trips the full sample state through the table mapping', () => {
  const ctx = { s: R.sampleState(TODAY), today: TODAY };
  R.ensureFuture(ctx);
  R.getDay(ctx, TODAY); R.getDay(ctx, '2026-09-30');
  const s = ctx.s;
  // exercise every table
  s.checkins[0].custom = [{ name: 'Calf', value: 37 }];
  s.photos[`${s.checkins[0].id}:front`] = 'uid/c/front-1.jpg';
  s.customFoods.cf1 = { id: 'cf1', name: 'Protein bar', basis: 'prepared', kcal: 380, p: 30, c: 40, f: 12, role: 'protein', cat: 'Pantry', tags: [], src: 'Custom · product label', est: false, serving: { label: 'bar', g: 60 }, custom: true };
  s.grocery = { checked: { chicken_r: true }, manual: [{ id: 'm1', name: 'Coffee', qty: '1 bag', cat: 'Pantry' }] };
  s.quotes = { fav: { q1: true }, hidden: { q3: true }, custom: [{ id: 'c1', text: 'Mine', tone: 'Your own' }] };
  s.pauses.push({ id: 'p1', from: '2026-11-01', to: null, reason: 'Travel' });
  s.plans[0].workouts[0].items[0].targetKg = 60;

  const t: Record<string, Row[]> = {};
  for (const d of TABLES) t[d.table] = d.rows(s).map(r => ({ ...r, user_id: 'u' }));
  const back = fromTables(JSON.parse(JSON.stringify(t)), TODAY)!;

  const norm = (x: R.State) => {
    const c = JSON.parse(JSON.stringify(x));
    c.schedule.forEach((e: R.ScheduleEntry) => { if (!e.sessionId) delete e.sessionId; });
    c.schedule.sort((a: R.ScheduleEntry, b: R.ScheduleEntry) => a.id < b.id ? -1 : 1);
    c.sessions.sort((a: R.Session, b: R.Session) => a.id < b.id ? -1 : 1);
    c.checkins.forEach((k: R.Checkin) => { k.photos = { front: null, side: null, back: null, custom: [] }; });
    c.sessions.forEach((x2: R.Session) => x2.sets.forEach(st => { st.note ||= ''; st.feel ||= ''; }));
    Object.values(c.days as Record<string, R.DayPlan>).forEach(d => d.meals.forEach(m => m.items.forEach(i => { i.locked = !!i.locked; })));
    return c;
  };
  expect(norm(back)).toEqual(norm(s));
});
