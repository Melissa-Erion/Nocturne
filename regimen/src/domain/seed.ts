/* Initial state: a clean new-user state, and the sample-data seed from prototype/store.js.
   The sample seed is generated relative to `today`; with today = 2026-09-29 it reproduces the prototype exactly. */
import { add, diff, dow, monday } from './dates';
import { EX } from './data/exercises';
import { PLAN_UL4, PLAN_UL5, START_KG } from './data/plans';
import { avgWeight } from './misc';
import type { ISODate, Plan, Reminder, ScheduleEntry, SetLog, State } from './types';
import { INCREMENTS_METRIC } from './units';
import { mulberry, r1, uid } from './util';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export const defaultReminders = (): Reminder[] => [
  { id: 'r1', type: 'Upcoming workout', time: '15:30', freq: 'Training days', channel: 'Push', snooze: 15, enabled: true, reschedule: true, note: '2 h before session' },
  { id: 'r2', type: 'Start workout', time: '17:30', freq: 'Training days', channel: 'Push', snooze: 10, enabled: true, reschedule: false },
  { id: 'r3', type: 'Missed workout', time: '20:30', freq: 'When missed', channel: 'Push', snooze: 0, enabled: true, reschedule: true },
  { id: 'r4', type: 'Progress check-in', time: '08:00', freq: 'Weekly · Sun', channel: 'Push + email', snooze: 60, enabled: true, reschedule: true },
  { id: 'r5', type: 'Progress photos', time: '08:05', freq: 'Every 2 weeks · Sun', channel: 'Push', snooze: 60, enabled: true, reschedule: true },
  { id: 'r6', type: 'Weight log', time: '07:15', freq: 'Daily', channel: 'Push', snooze: 30, enabled: true, reschedule: false },
  { id: 'r7', type: 'Meal prep', time: '14:00', freq: 'Weekly · Sun', channel: 'Push', snooze: 60, enabled: true, reschedule: true },
  { id: 'r8', type: 'Grocery shopping', time: '10:00', freq: 'Weekly · Sat', channel: 'Push', snooze: 60, enabled: true, reschedule: true },
  { id: 'r9', type: 'Drink water', time: '10:00', freq: 'Every 2 h, 10:00–18:00', channel: 'Push', snooze: 30, enabled: true, reschedule: false },
  { id: 'r10', type: "Prepare tomorrow's meals", time: '21:00', freq: 'Daily', channel: 'Push', snooze: 30, enabled: true, reschedule: false },
  { id: 'r11', type: 'Supplements', time: '08:00', freq: 'Daily', channel: 'Push', snooze: 15, enabled: false, reschedule: false },
  { id: 'r12', type: 'Wind-down routine', time: '22:15', freq: 'Daily', channel: 'Push', snooze: 15, enabled: true, reschedule: false },
];

/** State for a brand-new account: default plans and settings, no history, onboarding not done. */
export function newUserState(today: ISODate): State {
  return {
    v: 1, sample: false,
    profile: {
      name: '', goal: 'Fat loss', weightKg: null, goalWeightKg: null, heightCm: null, age: null, sex: 'Female', activity: 'Moderately active', experience: 'Intermediate',
      trainingDays: [0, 1, 3, 4], restDays: [2, 5, 6], duration: 60, location: 'Gym', equipment: ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'], priorities: [],
      kcal: 1800, protein: 140, carbs: 190, fat: 55, restTargets: null, mealsPerDay: 4, dietPrefs: [], allergies: [], exclude: [],
      checkInDay: 6, checkInFreq: 'Weekly', units: 'metric', water: true, waterMl: 2500, supplements: false,
      increments: { ...INCREMENTS_METRIC },
      progression: 'double', quietStart: '22:00', quietEnd: '07:00', calendarSync: false, shiftLater: true, workoutTime: '17:30',
      quoteTone: 'Disciplined', onboarded: false, startDate: today,
    },
    plans: [clone(PLAN_UL4), clone(PLAN_UL5)], activePlanId: 'ul4', sessions: [], schedule: [], pauses: [],
    weights: [], checkins: [], nutritionLog: {}, days: {},
    distribution: { mode: 'prepost', custom: [25, 25, 25, 25], manual: null, preIdx: 2, postIdx: 3, proteinIdx: [1, 3] },
    mealSlots: {
      training: [{ name: 'Meal 1', label: 'Breakfast', time: '07:30' }, { name: 'Meal 2', label: 'Lunch', time: '12:30' }, { name: 'Meal 3', label: 'Pre-workout', time: '16:00' }, { name: 'Meal 4', label: 'Post-workout dinner', time: '19:30' }],
      rest: [{ name: 'Meal 1', label: 'Breakfast', time: '08:30' }, { name: 'Meal 2', label: 'Lunch', time: '12:30' }, { name: 'Meal 3', label: 'Snack', time: '15:30' }, { name: 'Meal 4', label: 'Dinner', time: '19:00' }],
    },
    savedMeals: [], recipes: [], customFoods: {}, prep: [], grocery: { checked: {}, manual: [] },
    reminders: defaultReminders(), quotes: { fav: {}, hidden: {}, custom: [] }, active: null, photos: {},
  };
}

/** Sample data: ~6 weeks of training, weights, check-ins and nutrition history for "Alex". */
export function sampleState(today: ISODate): State {
  const rnd = mulberry(20260929);
  const start = add(monday(today), -42);
  const s = newUserState(today);
  s.sample = true;
  Object.assign(s.profile, {
    name: 'Alex', weightKg: 78.6, goalWeightKg: 72, heightCm: 170, age: 34, priorities: ['Glutes', 'Upper back'], exclude: ['Pork'],
    calendarSync: true, onboarded: true, startDate: start,
  });
  // weights
  const n0 = diff(start, today);
  const noise = () => (rnd() - 0.5) * 0.9;
  for (let i = 0; i <= n0; i++) s.weights.push({ date: add(start, i), kg: r1(81.6 - 0.068 * i + noise() + (dow(add(start, i)) === 0 ? 0.25 : 0)) });
  // training history
  const plan: Plan = s.plans[0];
  const wmap: Record<string, Plan['workouts'][number]> = {}; plan.workouts.forEach(w => wmap[w.id] = w);
  const prog: Record<string, { kg: number; reps: number[] }> = {};
  const slots: { date: ISODate; wid: string }[] = [];
  const week: [string, number][] = [['L1', 0], ['U1', 1], ['L2', 3], ['U2', 4]];
  for (let w = 0; w < 6; w++) { const mon = add(start, w * 7); week.forEach(([wid, o]) => slots.push({ date: add(mon, o), wid })); }
  week.forEach(([wid, o]) => { const d = add(monday(today), o); if (d < today) slots.push({ date: d, wid }); });
  const missDate = add(start, 25);
  slots.forEach(sl => {
    const miss = sl.date === missDate;
    const entry: ScheduleEntry = { id: uid(), date: sl.date, workoutId: sl.wid, planId: 'ul4', status: miss ? 'missed' : 'done', origin: 'auto', sessionId: null };
    s.schedule.push(entry);
    const doDate = miss ? add(sl.date, 1) : sl.date;
    const toSession = (en: ScheduleEntry) => {
      const w = wmap[sl.wid]; const sets: SetLog[] = [];
      w.items.forEach(item => {
        const p = prog[item.exId] || (prog[item.exId] = { kg: START_KG[item.exId], reps: Array.from({ length: item.sets }, (_, j) => item.repMin - (j === item.sets - 1 ? 1 : 0)) });
        for (let j = 0; j < item.warmups; j++) sets.push({ exId: item.exId, kg: r1(p.kg * (j === 0 ? 0.5 : 0.7)), reps: j === 0 ? 8 : 5, rir: 5, warm: true });
        p.reps.forEach((rp, j) => sets.push({ exId: item.exId, kg: p.kg, reps: Math.max(1, rp), rir: j === item.sets - 1 ? Math.max(0, item.rir - 1) : item.rir, warm: false }));
        if (p.reps.every(r => r >= item.repMax)) { p.kg = r1(p.kg + (s.profile.increments[EX[item.exId].equip] || 2.5)); p.reps = p.reps.map((_, j) => item.repMin - (j > 0 && rnd() < 0.5 ? 1 : 0)); }
        else p.reps = p.reps.map(r => Math.min(item.repMax, r + (rnd() < 0.62 ? 1 : 0)));
      });
      const ses = { id: uid(), date: doDate, workoutId: sl.wid, planId: 'ul4', entryId: en.id, sets, durationMin: 52 + Math.round(rnd() * 14), notes: '' };
      s.sessions.push(ses); en.sessionId = ses.id;
    };
    if (miss) {
      const re: ScheduleEntry = { id: uid(), date: doDate, workoutId: sl.wid, planId: 'ul4', status: 'done', origin: 'rescheduled', from: entry.id };
      entry.rescheduledTo = re.id; s.schedule.push(re); toSession(re);
    } else toSession(entry);
  });
  // weekly check-ins on Sundays
  const ciDates: ISODate[] = []; for (let d = add(start, -1); d <= add(monday(today), -1); d = add(d, 7)) ciDates.push(d);
  ciDates.forEach((d, i) => s.checkins.push({
    id: uid(), date: d, kg: avgWeight(s.weights, d), waist: r1(84.5 - i * 0.45 + (rnd() - 0.5) * 0.3), hips: r1(103 - i * 0.3), chest: r1(96 - i * 0.2), thighs: r1(60 - i * 0.2), arms: r1(30.5 - i * 0.05), custom: [],
    energy: 3 + Math.round(rnd()), sleep: 3 + Math.round(rnd()), hunger: 2 + Math.round(rnd() * 2), stress: 2 + Math.round(rnd()), recovery: 3 + Math.round(rnd()),
    cycle: i === 3 ? 'Luteal phase, some water retention' : '', strength: i > 3 ? 'Squat moved up; incline press stalled one week' : 'Steady', notes: i === 0 ? 'Baseline check-in.' : '',
    photos: { front: null, side: null, back: null, custom: [] },
  }));
  // nutrition log history
  for (let d = start; d < today; d = add(d, 1)) {
    const k = 1800 + Math.round((rnd() - 0.45) * 260); const p = 140 + Math.round((rnd() - 0.55) * 28);
    const c = Math.round((k - p * 4 - 55 * 9) / 4 + (rnd() - 0.5) * 10); const f = 55 + Math.round((rnd() - 0.5) * 12);
    const prepped = dow(d) === 6 ? rnd() > 0.15 : null; const water = 2000 + Math.round(rnd() * 800);
    s.nutritionLog[d] = { kcal: k, p, c, f, prepped, water };
  }
  s.savedMeals = [
    { id: 'sm1', name: 'Chicken, rice & broccoli', items: [{ foodId: 'chicken_c', g: 145 }, { foodId: 'rice_c', g: 180 }, { foodId: 'broccoli_c', g: 100 }], fav: true, uses: 18 },
    { id: 'sm2', name: 'Yogurt, oats & berries', items: [{ foodId: 'yog', g: 250 }, { foodId: 'oats', g: 45 }, { foodId: 'blueb', g: 80 }], fav: true, uses: 31 },
    { id: 'sm3', name: 'Turkey wrap & banana', items: [{ foodId: 'turkey', g: 110 }, { foodId: 'tortilla', g: 62 }, { foodId: 'banana', g: 118 }], fav: false, uses: 9 },
    { id: 'sm4', name: 'Salmon, potatoes & greens', items: [{ foodId: 'salmon_r', g: 130 }, { foodId: 'potato_r', g: 250 }, { foodId: 'greens', g: 60 }], fav: false, uses: 6 },
    { id: 'sm5', name: 'Restaurant: poke bowl (estimate)', items: [], estimate: { kcal: 640, p: 38, c: 78, f: 18 }, fav: false, uses: 2 },
  ];
  s.recipes = [
    { id: 'rc1', name: 'Beef & lentil chili', ingredients: [{ foodId: 'beef_r', g: 900 }, { foodId: 'lentil_r', g: 250 }, { foodId: 'peppers', g: 300 }, { foodId: 'oil', g: 15 }], cookedWeight: 2650, servings: 6, byWeight: false, fav: true },
    { id: 'rc2', name: 'Overnight protein oats', ingredients: [{ foodId: 'oats', g: 200 }, { foodId: 'whey', g: 60 }, { foodId: 'yog', g: 400 }, { foodId: 'blueb', g: 200 }], cookedWeight: 1150, servings: 4, byWeight: false, fav: false },
  ];
  s.prep = [
    { id: 'pp1', mealId: 'sm1', kind: 'meal', containers: 5, people: 1, days: 5, version: 'training', actual: {} },
    { id: 'pp2', mealId: 'rc1', kind: 'recipe', containers: 6, people: 1, days: 6, version: 'rest', actual: {} },
  ];
  return s;
}
