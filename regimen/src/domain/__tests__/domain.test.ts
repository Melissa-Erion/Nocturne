/* Domain tests. golden.json was produced by running the ORIGINAL prototype/store.js headlessly with today = 2026-09-29,
   so these tests prove the TypeScript port matches the prototype's behaviour. */
import * as R from '../index';
import type { Ctx, PlanItem, State } from '../types';
import golden from './golden.json';

const TODAY = '2026-09-29';
const make = (): Ctx => { const ctx = { s: R.sampleState(TODAY), today: TODAY }; R.ensureFuture(ctx); return ctx; };
const strip = <T,>(x: T): T => JSON.parse(JSON.stringify(x, (k, v) => (k === 'sessionId' || k === 'id' || k === 'key' ? undefined : v)));

describe('sample seed reproduces the prototype', () => {
  const ctx = make();
  it('weights, sessions and check-ins', () => {
    expect(ctx.s.weights.length).toBe(golden.nWeights);
    expect(ctx.s.weights.slice(0, 5).concat(ctx.s.weights.slice(-3))).toEqual(golden.weights);
    expect(ctx.s.sessions.length).toBe(golden.nSessions);
    expect(ctx.s.checkins.map(c => [c.date, c.kg, c.waist, c.energy, c.hunger])).toEqual(golden.checkins);
    expect(['2026-08-17', '2026-08-23', '2026-09-28'].map(d => ctx.s.nutritionLog[d])).toEqual(golden.nlog);
  });
  it('history, recommendations and PRs', () => {
    expect(strip(R.lastPerf(ctx, 'squat'))).toEqual(strip(golden.squatLast));
    for (const [ex, rec] of Object.entries(golden.recs)) expect(R.recommend(ctx, ex)).toEqual(rec);
    expect(R.prs(ctx, 'squat')).toEqual(golden.prsSquat);
  });
  it('schedule: future rotation, streak, week stats, next check-in', () => {
    const codes = ctx.s.schedule.filter(e => e.status === 'planned').sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 8).map(e => e.date + ':' + e.workoutId);
    expect(codes).toEqual(golden.futureCodes);
    expect(R.streak(ctx)).toBe(golden.streak);
    const { ents, ...ws } = R.weekStats(ctx, '2026-09-28');
    expect(ws).toEqual(golden.weekStats);
    expect(R.nextCheckIn(ctx)).toBe(golden.nextCheckIn);
  });
  it('nutrition: meal targets, generated day, alternatives', () => {
    expect(R.mealTargets(ctx, 'training')).toEqual(golden.targetsTraining);
    expect(R.mealTargets(ctx, 'rest')).toEqual(golden.targetsRest);
    expect(R.getDay(ctx, TODAY).meals.map(m => m.items.map(i => [i.foodId, i.g]))).toEqual(golden.todayDay);
    expect(R.alternatives(ctx.s, 'chicken_c', 145).slice(0, 5).map(a => [a.food.id, a.g, Math.round(a.score * 100) / 100])).toEqual(golden.alts);
  });
  it('meal prep and grocery list', () => {
    expect(R.prepCalc(ctx.s, ctx.s.prep[0])).toEqual(golden.prep1);
    expect(R.prepCalc(ctx.s, ctx.s.prep[1])).toEqual(golden.prep2);
    expect(R.groceryList(ctx.s).map(g => [g.id, Math.round(g.g), g.buy, g.est])).toEqual(golden.grocery);
  });
});

describe('scheduler rules', () => {
  const planned = (s: State) => s.schedule.filter(e => e.status === 'planned').sort((a, b) => a.date < b.date ? -1 : 1);

  it('never places same-region workouts back to back unless allowed', () => {
    const ctx = make();
    const ps = planned(ctx.s);
    for (let i = 1; i < ps.length; i++) {
      if (R.diff(ps[i - 1].date, ps[i].date) === 1) expect(R.workoutOf(ctx, ps[i - 1].workoutId)!.region).not.toBe(R.workoutOf(ctx, ps[i].workoutId)!.region);
    }
  });

  const at = (s: State, d: string) => s.schedule.filter(e => e.status === 'planned' && e.date === d).map(e => e.workoutId).sort();

  it('shift-later ON, free day: only the moved workout changes (nothing jumps to later weeks)', () => {
    const ctx = make();
    const before = planned(ctx.s).filter(e => e.date !== '2026-09-29').map(e => e.date + ':' + e.workoutId);
    const tue = planned(ctx.s)[0]; // Tue 29 Sep U1
    const r = R.moveEntry(ctx, tue.id, '2026-10-03', true); // Saturday (rest day, free)
    expect(r.error).toBeUndefined();
    expect(at(ctx.s, '2026-10-03')).toEqual(['U1']);
    expect(at(ctx.s, '2026-10-01')).toEqual(['L2']); // Thursday untouched
    expect(at(ctx.s, '2026-10-02')).toEqual(['U2']); // Friday untouched
    expect(planned(ctx.s).filter(e => e.id !== tue.id).map(e => e.date + ':' + e.workoutId)).toEqual(before);
  });

  it('shift-later ON, taken day: the workout in the way moves one training day, and so on only as needed', () => {
    const ctx = make();
    const tue = planned(ctx.s)[0];
    ctx.s.schedule = ctx.s.schedule.filter(e => !(e.status === 'planned' && e.date === '2026-10-05')); // free Mon 5 Oct
    R.moveEntry(ctx, tue.id, '2026-10-01', true); // onto Thu (L2)
    expect(at(ctx.s, '2026-10-01')).toEqual(['U1']);
    expect(at(ctx.s, '2026-10-02')).toEqual(['L2']); // Thu's L2 → Fri
    expect(at(ctx.s, '2026-10-05')).toEqual(['U2']); // Fri's U2 → next training day (Mon), which was free: chain stops
    expect(at(ctx.s, '2026-10-06')).toEqual(['U1']); // Tue 6 Oct untouched
  });

  it('shift-later OFF onto a taken day: both workouts stay on that day, nothing swaps', () => {
    const ctx = make();
    const [a, b] = planned(ctx.s);
    const [aDate, bDate] = [a.date, b.date];
    const r = R.moveEntry(ctx, a.id, bDate, false);
    expect(R.entry(ctx, a.id)!.date).toBe(bDate);
    expect(R.entry(ctx, b.id)!.date).toBe(bDate);
    expect(at(ctx.s, aDate)).toEqual([]);
    expect(r.note).toMatch(/2 workouts/);
  });

  it('reset schedule rebuilds upcoming workouts from the plan and keeps history', () => {
    const ctx = make();
    const done = ctx.s.schedule.filter(e => e.status === 'done').length;
    const original = planned(ctx.s).slice(0, 6).map(e => e.date + ':' + e.workoutId);
    R.moveEntry(ctx, planned(ctx.s)[0].id, '2026-10-03', true);
    R.skipEntry(ctx, planned(ctx.s)[1].id);
    R.resetSchedule(ctx);
    expect(ctx.s.schedule.filter(e => e.status === 'done').length).toBe(done);
    expect(planned(ctx.s).slice(0, 6).map(e => e.date + ':' + e.workoutId)).toEqual(original);
  });

  it('warns about back-to-back same-region moves', () => {
    const ctx = make();
    const u1 = planned(ctx.s)[0]; // U1 on Tue 29; U2 on Fri 2 Oct
    const r = R.moveEntry(ctx, u1.id, '2026-10-03', false);
    expect(r.warning).toMatch(/consecutive days/);
  });

  it('completed workouts cannot be moved and done is only set by finishing a session', () => {
    const ctx = make();
    const done = ctx.s.schedule.find(e => e.status === 'done')!;
    expect(R.moveEntry(ctx, done.id, '2026-10-20').error).toBeTruthy();
    const today = R.todayEntry(ctx)!;
    R.skipEntry(ctx, today.id); expect(today.status).toBe('skipped');
    R.restoreEntry(ctx, today.id); expect(today.status).toBe('planned');
    R.startWorkout(ctx, today.id);
    const a = ctx.s.active!;
    a.ex[0].sets.filter(st => !st.warm).forEach(st => { st.done = true; st.reps = 8; });
    R.finishWorkout(ctx);
    expect(today.status).toBe('done');
    expect(ctx.s.sessions[ctx.s.sessions.length - 1].sets.length).toBeGreaterThan(0);
  });

  it('pause removes planned entries and resume keeps the rotation', () => {
    const ctx = make();
    const nextCode = planned(ctx.s)[0].workoutId;
    R.pause(ctx, TODAY, null, 'Travel');
    expect(planned(ctx.s).length).toBe(0);
    expect(R.activePause(ctx)).toBeTruthy();
    ctx.today = '2026-10-06';
    R.resume(ctx);
    const ps = planned(ctx.s);
    expect(ps[0].date >= '2026-10-06').toBe(true);
    expect(ps[0].workoutId).toBe(nextCode);
  });

  it('missed → reschedule keeps the missed record and the streak survives', () => {
    const ctx = make();
    const s0 = R.streak(ctx);
    const today = R.todayEntry(ctx)!;
    R.missEntry(ctx, today.id);
    R.rescheduleMissed(ctx, today.id, '2026-09-30');
    expect(today.status).toBe('missed');
    expect(today.rescheduledTo).toBeTruthy();
    expect(R.streak(ctx)).toBe(s0);
  });
});

describe('workout pause', () => {
  it('paused time is excluded from the duration and the rest timer is pushed back', () => {
    const ctx = make();
    R.startWorkout(ctx, R.todayEntry(ctx)!.id);
    const a = ctx.s.active!; const t0 = a.startedAt;
    a.restEnd = t0 + 20 * 60000 + 90000;
    R.pauseWorkout(ctx, t0 + 20 * 60000);             // 20 min in
    expect(R.elapsedMs(a, t0 + 50 * 60000)).toBe(20 * 60000); // still 20 min while paused
    R.resumeWorkout(ctx, t0 + 50 * 60000);            // paused 30 min
    expect(a.restEnd).toBe(t0 + 50 * 60000 + 90000);  // 90 s of rest still left
    expect(R.elapsedMs(a, t0 + 60 * 60000)).toBe(30 * 60000);
    a.pausedMs = 30 * 60000; a.startedAt = Date.now() - 60 * 60000; // 60 min wall-clock, 30 paused
    a.ex[0].sets.filter(st => !st.warm).forEach(st => { st.done = true; st.reps = 8; });
    expect(R.finishWorkout(ctx)!.durationMin).toBe(30);
  });
});

describe('progressive overload rules', () => {
  const item = (o: Partial<PlanItem> = {}): PlanItem => ({ id: 'i', exId: 'squat', sets: 3, repMin: 6, repMax: 8, rir: 2, rest: 120, tempo: '', warmups: 0, superset: '', notes: '', replaced: [], ...o });
  const withSessions = (sets: [number, number, number][][]) => {
    const ctx = { s: R.newUserState(TODAY), today: TODAY };
    sets.forEach((ss, i) => ctx.s.sessions.push({ id: 's' + i, date: R.add('2026-09-01', i * 3), workoutId: 'L1', planId: 'ul4', entryId: 'e' + i, durationMin: 50, notes: '', sets: ss.map(([kg, reps, rir]) => ({ exId: 'squat', kg, reps, rir, warm: false })) }));
    return ctx;
  };
  it('baseline with no history', () => expect(R.recommend(withSessions([]), 'squat', item())!.type).toBe('baseline'));
  it('increase when all sets hit the top at target RIR', () => {
    const r = R.recommend(withSessions([[[60, 8, 2], [60, 8, 2], [60, 8, 1]]]), 'squat', item())!;
    expect(r).toMatchObject({ type: 'increase', kg: 62.5, reps: [6, 6, 6] });
  });
  it('hold at the top when harder than target RIR', () => {
    expect(R.recommend(withSessions([[[60, 8, 0], [60, 8, 0], [60, 8, 0]]]), 'squat', item())).toMatchObject({ type: 'hold', kg: 60, reps: [8, 8, 8] });
  });
  it('reduce ~5% after two sessions below rep_min at the same weight', () => {
    const r = R.recommend(withSessions([[[80, 5, 2], [80, 6, 2], [80, 6, 2]], [[80, 5, 2], [80, 5, 2], [80, 6, 2]]]), 'squat', item())!;
    expect(r.type).toBe('reduce'); expect(r.kg).toBe(75);
  });
  it('hold and aim for rep_min when a set falls short once', () => {
    expect(R.recommend(withSessions([[[80, 6, 2], [80, 5, 2], [80, 6, 2]]]), 'squat', item())).toMatchObject({ type: 'hold', reps: [6, 6, 6] });
  });
  it('otherwise hold and add a rep per set up to rep_max', () => {
    expect(R.recommend(withSessions([[[60, 6, 2], [60, 7, 2], [60, 8, 2]]]), 'squat', item())).toMatchObject({ type: 'hold', reps: [7, 8, 8] });
  });
  it('linear rule adds the increment when all sets reach rep_min', () => {
    const ctx = withSessions([[[60, 6, 2], [60, 6, 2], [60, 6, 2]]]); ctx.s.profile.progression = 'linear';
    expect(R.recommend(ctx, 'squat', item())).toMatchObject({ type: 'increase', kg: 62.5 });
  });
  it('e1RM uses Epley', () => expect(R.e1rm(100, 10)).toBeCloseTo(133.33, 1));
});

describe('nutrition maths', () => {
  it('reconcile sums exactly to the total', () => {
    for (const [t, w] of [[140, [1, 1, 1]], [55, [0.6, 0.9, 1.15, 1.15]], [190, [1.3, 1.25, 0.8, 0.8, 0.8]]] as [number, number[]][]) {
      const r = R.reconcile(t, w); expect(r.reduce((a, b) => a + b, 0)).toBe(t); r.forEach(x => expect(Number.isInteger(x)).toBe(true));
    }
  });
  it('per-meal grams sum to the daily grams in every mode; kcal = 4P+4C+9F', () => {
    const ctx = make();
    for (const mode of ['equal', 'prepost', 'protein', 'custom'] as const) {
      const t = R.mealTargets(ctx, 'training', mode);
      expect(t.reduce((a, m) => a + m.p, 0)).toBe(140); expect(t.reduce((a, m) => a + m.c, 0)).toBe(190); expect(t.reduce((a, m) => a + m.f, 0)).toBe(55);
      t.forEach(m => expect(m.kcal).toBe(m.p * 4 + m.c * 4 + m.f * 9));
    }
    const P = ctx.s.profile; expect(P.protein * 4 + P.carbs * 4 + P.fat * 9).toBe(1815); // the documented 1,815 vs 1,800
  });
  it('rest days use their own targets when set, otherwise the training-day targets', () => {
    const ctx = make();
    const sum = (t: R.MealTarget[]) => ['p', 'c', 'f'].map(k => t.reduce((a, m) => a + (m as unknown as Record<string, number>)[k], 0));
    expect(sum(R.mealTargets(ctx, 'rest'))).toEqual([140, 190, 55]);
    ctx.s.profile.restTargets = { kcal: 1600, protein: 140, carbs: 140, fat: 60 };
    expect(sum(R.mealTargets(ctx, 'rest'))).toEqual([140, 140, 60]);
    expect(sum(R.mealTargets(ctx, 'training'))).toEqual([140, 190, 55]);
    expect(R.dayTargets(ctx.s.profile, 'rest').kcal).toBe(1600);
  });
  it('solver respects locks, bounds and rounding, and gets close', () => {
    const s = R.newUserState(TODAY);
    const items = [{ foodId: 'chicken_c', g: 100 }, { foodId: 'rice_c', g: 100 }, { foodId: 'oil', g: 100 }, { foodId: 'broccoli_c', g: 100, locked: true }];
    const out = R.solve(s, items, { p: 40, c: 50, f: 12 });
    expect(out[3].g).toBe(100);
    out.forEach(i => { expect(i.g).toBeGreaterThanOrEqual(0); expect(i.g).toBeLessThanOrEqual(700); });
    expect(out[0].g % 5).toBe(0); expect(out[1].g % 5).toBe(0);
    const m = R.sumM(s, out);
    expect(Math.abs(m.p - 40)).toBeLessThan(4); expect(Math.abs(m.c - 50)).toBeLessThan(5); expect(Math.abs(m.f - 12)).toBeLessThan(2);
  });
  it('alternatives filter excluded foods and allergens and match the primary nutrient', () => {
    const s = R.newUserState(TODAY); s.profile.allergies = ['Tuna']; s.profile.exclude = ['Cod'];
    const alts = R.alternatives(s, 'chicken_c', 150);
    expect(alts.some(a => /Tuna|Cod/.test(a.food.name))).toBe(false);
    const turkey = alts.find(a => a.food.id === 'turkey')!;
    expect(turkey.g % 5).toBe(0);
    expect(Math.abs(turkey.m.p - R.macros(s, 'chicken_c', 150).p)).toBeLessThan(1.5);
    expect(R.alternatives(s, 'chicken_c', 150, { tag: 'Vegan' }).every(a => a.food.tags.includes('Vegan'))).toBe(true);
  });
  it('prepCalc: raw purchase = cooked ÷ yield, and actual batch weight overrides the estimate', () => {
    const ctx = make();
    const p = ctx.s.prep[0];
    const c = R.prepCalc(ctx.s, p)!;
    const chicken = c.lines.find(l => l.foodId === 'chicken_c')!;
    expect(chicken.buyG).toBeCloseTo(145 * 5 / 0.75, 5); expect(chicken.est).toBe(true); expect(chicken.rawId).toBe('chicken_r');
    p.actual.chicken_c = 800;
    const c2 = R.prepCalc(ctx.s, p)!;
    expect(c2.lines.find(l => l.foodId === 'chicken_c')!.perG).toBe(160);
    expect(c2.lines.find(l => l.foodId === 'chicken_c')!.est).toBe(false);
  });
});

describe('safety', () => {
  it('calorie floor is max(BMR, 1200 female / 1500 male)', () => {
    const s = R.newUserState(TODAY);
    Object.assign(s.profile, { weightKg: 78, heightCm: 170, age: 34, sex: 'Female', kcal: 1100 });
    expect(R.calorieFloor(s.profile)).toBe(Math.max(1200, R.bmr(s.profile)!));
    expect(R.lowCalorie(s.profile)).toBe(true);
    s.profile.sex = 'Male'; s.profile.kcal = 1600;
    expect(R.calorieFloor(s.profile)).toBe(Math.max(1500, R.bmr(s.profile)!));
  });
});
