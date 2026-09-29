/** @jest-environment node */
/* Live integration test against the real Supabase project (schema + RLS + mapping + diff sync).
   Skipped unless SUPABASE_IT_EMAIL / SUPABASE_IT_PASSWORD are set to a confirmed test user. */
import { createClient } from '@supabase/supabase-js';

const email = process.env.SUPABASE_IT_EMAIL, password = process.env.SUPABASE_IT_PASSWORD;
const mockClient = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://x', process.env.EXPO_PUBLIC_SUPABASE_KEY || 'x', { auth: { persistSession: false } });
jest.mock('@/lib/supabase', () => ({ supabase: mockClient, PHOTO_BUCKET: 'progress-photos' }));

import * as R from '@/domain';
import { CloudSync } from '../sync';

const TODAY = '2026-09-29';
const run = email && password ? describe : describe.skip;

run('cloud sync (live)', () => {
  jest.setTimeout(120000);
  let uid = '';
  beforeAll(async () => {
    const { data, error } = await mockClient.auth.signInWithPassword({ email: email!, password: password! });
    if (error) throw error; uid = data.user!.id;
  });

  it('pushes the full sample state and loads it back identically, then syncs a diff', async () => {
    const statuses: string[] = [];
    const sync = new CloudSync(uid, st => statuses.push(st));
    await sync.wipe();
    expect(await sync.load(TODAY)).toBeNull(); // new account

    const ctx = { s: R.sampleState(TODAY), today: TODAY };
    R.ensureFuture(ctx); R.getDay(ctx, TODAY);
    ctx.s.photos[`${ctx.s.checkins[0].id}:front`] = `${uid}/x/front.jpg`;
    await sync.push(ctx.s);
    expect(statuses).toContain('saved');

    const back = await new CloudSync(uid, () => {}).load(TODAY);
    const norm = (x: R.State) => {
      const c = JSON.parse(JSON.stringify(x));
      c.schedule.forEach((e: R.ScheduleEntry) => { if (!e.sessionId) delete e.sessionId; });
      c.schedule.sort((a: R.ScheduleEntry, b: R.ScheduleEntry) => a.id < b.id ? -1 : 1);
      c.sessions.sort((a: R.Session, b: R.Session) => a.id < b.id ? -1 : 1);
      c.sessions.forEach((z: R.Session) => z.sets.forEach(st => { st.note ||= ''; st.feel ||= ''; }));
      return c;
    };
    expect(norm(back!)).toEqual(norm(ctx.s));

    // a diff: move a workout, log weight, delete a check-in (cascades its photo row)
    const planned = ctx.s.schedule.find(e => e.status === 'planned')!;
    R.moveEntry(ctx, planned.id, R.add(planned.date, 2), true);
    R.logWeight(ctx, 70.1, TODAY);
    ctx.s.checkins.shift(); delete ctx.s.photos[Object.keys(ctx.s.photos)[0]];
    await sync.push(ctx.s);
    const back2 = await new CloudSync(uid, () => {}).load(TODAY);
    expect(norm(back2!)).toEqual(norm(ctx.s));

    await sync.wipe();
  });

  it('row-level security hides other users’ rows', async () => {
    const { data } = await mockClient.from('profiles').select('user_id');
    expect((data || []).every(r => r.user_id === uid)).toBe(true);
    const { error } = await mockClient.from('weights').insert({ user_id: '00000000-0000-0000-0000-000000000001', date: TODAY, kg: 1 });
    expect(error).toBeTruthy();
  });
});
