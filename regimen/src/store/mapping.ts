/* Maps the in-memory State to normalised Supabase rows and back.
   Each table lists its primary-key columns (besides user_id) so the sync layer can diff rows by key. */
import { FOODS } from '@/domain/data/foods';
import { newUserState } from '@/domain/seed';
import type { Checkin, DayType, Food, Plan, Recipe, State } from '@/domain/types';

export type Row = Record<string, unknown>;
export interface TableDef { table: string; key: string[]; rows: (s: State) => Row[] }

const n = (v: unknown) => (v == null || v === '' ? null : Number(v));

/** Parents come before children: upserts run in this order, deletes in reverse. */
export const TABLES: TableDef[] = [
  {
    table: 'profiles', key: [], rows: s => {
      const P = s.profile;
      return [{
        name: P.name, goal: P.goal, weight_kg: n(P.weightKg), goal_weight_kg: n(P.goalWeightKg), height_cm: n(P.heightCm), age: n(P.age), sex: P.sex,
        activity: P.activity, experience: P.experience, training_days: P.trainingDays, rest_days: P.restDays, duration_min: Number(P.duration) || 0,
        workout_time: P.workoutTime, location: P.location, equipment: P.equipment, priorities: P.priorities, kcal: Math.round(Number(P.kcal) || 0),
        protein_g: Math.round(Number(P.protein) || 0), carbs_g: Math.round(Number(P.carbs) || 0), fat_g: Math.round(Number(P.fat) || 0),
        rest_kcal: P.restTargets ? Math.round(Number(P.restTargets.kcal) || 0) : null, rest_protein_g: P.restTargets ? Math.round(Number(P.restTargets.protein) || 0) : null, rest_carbs_g: P.restTargets ? Math.round(Number(P.restTargets.carbs) || 0) : null, rest_fat_g: P.restTargets ? Math.round(Number(P.restTargets.fat) || 0) : null,
        meals_per_day: Math.min(6, Math.max(1, Number(P.mealsPerDay) || 4)), diet_prefs: P.dietPrefs, allergies: P.allergies, exclude: P.exclude,
        check_in_day: Number(P.checkInDay) || 0, check_in_freq: P.checkInFreq, units: P.units, water_enabled: P.water, water_ml: Number(P.waterMl) || 0,
        supplements: P.supplements, increments: P.increments, progression: P.progression, shift_later: P.shiftLater, calendar_sync: P.calendarSync,
        quiet_start: P.quietStart, quiet_end: P.quietEnd, quote_tone: P.quoteTone, onboarded: P.onboarded, start_date: P.startDate || null,
        active_plan_id: s.activePlanId, active_workout: s.active, is_sample: !!s.sample,
      }];
    },
  },
  { table: 'plans', key: ['id'], rows: s => s.plans.map((p, i) => ({ id: p.id, name: p.name, note: p.note, rotation: p.rotation, allow_consecutive: p.allowConsecutive, position: i })) },
  {
    table: 'plan_workouts', key: ['id'], rows: s => s.plans.flatMap(p => p.workouts.map((w, i) => ({
      id: `${p.id}:${w.id}`, plan_id: p.id, code: w.id, name: w.name, focus: w.focus, region: w.region, muscles: w.muscles, position: i,
    }))),
  },
  {
    table: 'plan_items', key: ['id'], rows: s => s.plans.flatMap(p => p.workouts.flatMap(w => w.items.map((it, i) => ({
      id: `${p.id}:${w.id}:${it.id}`, workout_id: `${p.id}:${w.id}`, item_key: it.id, exercise_id: it.exId, position: i, sets: Number(it.sets) || 0,
      rep_min: Number(it.repMin) || 0, rep_max: Number(it.repMax) || 0, rir: Number(it.rir) || 0, rest_s: Number(it.rest) || 0, tempo: it.tempo || '',
      warmups: Number(it.warmups) || 0, superset: it.superset || '', notes: it.notes || '', target_kg: n(it.targetKg), media_url: it.media || null, replaced: it.replaced || [],
    })))),
  },
  {
    table: 'schedule_entries', key: ['id'], rows: s => s.schedule.map(e => ({
      id: e.id, date: e.date, plan_id: e.planId, workout_code: e.workoutId, status: e.status, origin: e.origin,
      session_id: e.sessionId || null, rescheduled_to: e.rescheduledTo || null, from_entry: e.from || null,
    })),
  },
  { table: 'pauses', key: ['id'], rows: s => s.pauses.map(p => ({ id: p.id, from_date: p.from, to_date: p.to, reason: p.reason })) },
  {
    table: 'sessions', key: ['id'], rows: s => s.sessions.map(x => ({
      id: x.id, date: x.date, workout_code: x.workoutId, plan_id: x.planId, entry_id: x.entryId || null, duration_min: x.durationMin, notes: x.notes || '',
    })),
  },
  {
    table: 'session_sets', key: ['id'], rows: s => s.sessions.flatMap(x => x.sets.map((st, i) => ({
      id: `${x.id}:${i}`, session_id: x.id, position: i, exercise_id: st.exId, kg: Number(st.kg) || 0, reps: Math.round(Number(st.reps) || 0),
      rir: n(st.rir), warm: !!st.warm, note: st.note || '', feel: st.feel || '', substituted_for: st.sub || null,
    }))),
  },
  { table: 'weights', key: ['date'], rows: s => s.weights.map(w => ({ date: w.date, kg: w.kg })) },
  {
    table: 'checkins', key: ['id'], rows: s => s.checkins.map(c => ({
      id: c.id, date: c.date, kg: n(c.kg), waist: n(c.waist), hips: n(c.hips), chest: n(c.chest), thighs: n(c.thighs), arms: n(c.arms), custom: c.custom || [],
      energy: n(c.energy), sleep: n(c.sleep), hunger: n(c.hunger), stress: n(c.stress), recovery: n(c.recovery), cycle: c.cycle || '', strength: c.strength || '', notes: c.notes || '',
    })),
  },
  {
    table: 'photos', key: ['id'], rows: s => Object.entries(s.photos)
      .filter(([k]) => s.checkins.some(c => c.id === k.split(':')[0]))
      .map(([k, path]) => ({ id: k, checkin_id: k.split(':')[0], pose: k.split(':').slice(1).join(':'), storage_path: path })),
  },
  {
    table: 'nutrition_log', key: ['date'], rows: s => Object.entries(s.nutritionLog).map(([date, d]) => ({
      date, kcal: d.kcal, protein: d.p, carbs: d.c, fat: d.f, prepped: d.prepped, water_ml: Math.round(d.water || 0),
    })),
  },
  { table: 'day_plans', key: ['date'], rows: s => Object.entries(s.days).map(([date, d]) => ({ date, type: d.type, water_ml: Math.round(d.water || 0) })) },
  {
    table: 'day_meals', key: ['id'], rows: s => Object.entries(s.days).flatMap(([date, d]) => d.meals.map((m, i) => ({
      id: m.key, date, slot: i, logged: !!m.logged, prepped: !!m.prepped,
    }))),
  },
  {
    table: 'meal_items', key: ['id'], rows: s => Object.values(s.days).flatMap(d => d.meals.flatMap(m => m.items.map((it, i) => ({
      id: it.key || `${m.key}:${i}`, meal_id: m.key, position: i, food_id: it.foodId, grams: Number(it.g) || 0, locked: !!it.locked, estimate: it.estimate || null,
    })))),
  },
  {
    table: 'meal_slots', key: ['id'], rows: s => (['training', 'rest'] as DayType[]).flatMap(t => (s.mealSlots[t] || []).map((sl, i) => ({
      id: `${t}:${i}`, day_type: t, index: i, name: sl.name, label: sl.label, time: sl.time,
    }))),
  },
  {
    table: 'distribution', key: [], rows: s => [{
      mode: s.distribution.mode, custom: s.distribution.custom.map(Number), manual: s.distribution.manual, pre_idx: s.distribution.preIdx,
      post_idx: s.distribution.postIdx, protein_idx: s.distribution.proteinIdx,
    }],
  },
  {
    table: 'foods', key: ['id'], rows: s => Object.values(s.customFoods).map(f => {
      const { id, name, basis, kcal, p, c, f: fat, role, cat, tags, src, est, serving, rawId, cookedId, yld, buy, ...extra } = f;
      return { id, name, basis, kcal, protein: p, carbs: c, fat, role, category: cat, tags, source: src, estimated: !!est, serving: serving || null, raw_id: rawId || null, cooked_id: cookedId || null, yield: yld ?? null, buy: buy || null, extra };
    }),
  },
  {
    table: 'saved_meals', key: ['id'], rows: s => s.savedMeals.map((m, i) => ({
      id: m.id, name: m.name, items: m.items.map(({ foodId, g }) => ({ foodId, g })), estimate: m.estimate || null, fav: !!m.fav, uses: m.uses || 0, position: i,
    })),
  },
  {
    table: 'recipes', key: ['id'], rows: s => s.recipes.map((r, i) => ({
      id: r.id, name: r.name, cooked_weight: Number(r.cookedWeight) || 0, servings: Math.max(1, Math.round(Number(r.servings) || 1)), by_weight: !!r.byWeight, serving_g: n(r.servingG), fav: !!r.fav, position: i,
    })),
  },
  {
    table: 'recipe_ingredients', key: ['id'], rows: s => s.recipes.flatMap(r => r.ingredients.map((g, i) => ({
      id: `${r.id}:${i}`, recipe_id: r.id, position: i, food_id: g.foodId, grams: Number(g.g) || 0,
    }))),
  },
  {
    table: 'prep_plans', key: ['id'], rows: s => s.prep.map((p, i) => ({
      id: p.id, source_id: p.mealId, kind: p.kind, containers: Number(p.containers) || 1, people: Number(p.people) || 1, days: Number(p.days) || 1, version: p.version, actual: p.actual || {}, position: i,
    })),
  },
  { table: 'grocery_checks', key: ['id'], rows: s => Object.entries(s.grocery.checked).filter(([, v]) => v).map(([id]) => ({ id, checked: true })) },
  { table: 'grocery_manual', key: ['id'], rows: s => s.grocery.manual.map((m, i) => ({ id: m.id, name: m.name, qty: m.qty || '', category: m.cat || 'Other', position: i })) },
  {
    table: 'reminders', key: ['id'], rows: s => s.reminders.map((r, i) => ({
      id: r.id, type: r.type, time: r.time, freq: r.freq, channel: r.channel, snooze_min: Number(r.snooze) || 0, enabled: !!r.enabled, reschedule: !!r.reschedule, note: r.note || null, position: i,
    })),
  },
  {
    table: 'quotes_user', key: ['id'], rows: s => [
      ...Object.entries(s.quotes.fav).filter(([, v]) => v).map(([q]) => ({ id: `fav:${q}`, kind: 'fav', quote_id: q, text: null, tone: null, position: 0 })),
      ...Object.entries(s.quotes.hidden).filter(([, v]) => v).map(([q]) => ({ id: `hidden:${q}`, kind: 'hidden', quote_id: q, text: null, tone: null, position: 0 })),
      ...s.quotes.custom.map((c, i) => ({ id: `custom:${c.id}`, kind: 'custom', quote_id: c.id, text: c.text, tone: c.tone, position: i })),
    ],
  },
];

const byPos = (a: Row, b: Row) => Number(a.position ?? 0) - Number(b.position ?? 0);
const byDate = (a: { date: string }, b: { date: string }) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const group = (rows: Row[], k: string) => { const m: Record<string, Row[]> = {}; rows.forEach(r => (m[String(r[k])] ||= []).push(r)); Object.values(m).forEach(a => a.sort(byPos)); return m; };
const str = (v: unknown) => (v == null ? '' : String(v));

/** Rebuild State from table rows. Returns null when the user has no profile yet (new account). */
export function fromTables(t: Record<string, Row[]>, today: string): State | null {
  const pr = t.profiles?.[0]; if (!pr) return null;
  const s = newUserState(today);
  s.sample = !!pr.is_sample;
  s.profile = {
    ...s.profile,
    name: str(pr.name), goal: str(pr.goal), weightKg: pr.weight_kg as number | null, goalWeightKg: pr.goal_weight_kg as number | null, heightCm: pr.height_cm as number | null,
    age: pr.age as number | null, sex: str(pr.sex), activity: str(pr.activity), experience: str(pr.experience), trainingDays: (pr.training_days as number[]) || [],
    restDays: (pr.rest_days as number[]) || [], duration: Number(pr.duration_min), workoutTime: str(pr.workout_time), location: str(pr.location),
    equipment: (pr.equipment as string[]) || [], priorities: (pr.priorities as string[]) || [], kcal: Number(pr.kcal), protein: Number(pr.protein_g),
    carbs: Number(pr.carbs_g), fat: Number(pr.fat_g), restTargets: pr.rest_kcal != null ? { kcal: Number(pr.rest_kcal), protein: Number(pr.rest_protein_g), carbs: Number(pr.rest_carbs_g), fat: Number(pr.rest_fat_g) } : null,
    mealsPerDay: Number(pr.meals_per_day), dietPrefs: (pr.diet_prefs as string[]) || [],
    allergies: (pr.allergies as string[]) || [], exclude: (pr.exclude as string[]) || [], checkInDay: Number(pr.check_in_day), checkInFreq: str(pr.check_in_freq),
    units: pr.units === 'imperial' ? 'imperial' : 'metric', water: !!pr.water_enabled, waterMl: Number(pr.water_ml), supplements: !!pr.supplements,
    increments: (pr.increments as Record<string, number>) || s.profile.increments, progression: pr.progression === 'linear' ? 'linear' : 'double',
    shiftLater: !!pr.shift_later, calendarSync: !!pr.calendar_sync, quietStart: str(pr.quiet_start), quietEnd: str(pr.quiet_end), quoteTone: str(pr.quote_tone),
    onboarded: !!pr.onboarded, startDate: str(pr.start_date) || today,
  };
  s.active = (pr.active_workout as State['active']) || null;

  const workoutsByPlan = group(t.plan_workouts || [], 'plan_id');
  const itemsByWorkout = group(t.plan_items || [], 'workout_id');
  if (t.plans?.length) {
    s.plans = [...t.plans].sort(byPos).map((p): Plan => ({
      id: str(p.id), name: str(p.name), note: str(p.note), rotation: (p.rotation as string[]) || [], allowConsecutive: !!p.allow_consecutive,
      workouts: (workoutsByPlan[str(p.id)] || []).map(w => ({
        id: str(w.code), name: str(w.name), focus: str(w.focus), region: w.region as Plan['workouts'][number]['region'], muscles: (w.muscles as string[]) || [],
        items: (itemsByWorkout[str(w.id)] || []).map(it => ({
          id: str(it.item_key), exId: str(it.exercise_id), sets: Number(it.sets), repMin: Number(it.rep_min), repMax: Number(it.rep_max), rir: Number(it.rir),
          rest: Number(it.rest_s), tempo: str(it.tempo), warmups: Number(it.warmups), superset: str(it.superset), notes: str(it.notes),
          ...(it.target_kg != null ? { targetKg: Number(it.target_kg) } : {}), media: it.media_url ? str(it.media_url) : undefined, replaced: (it.replaced as Plan['workouts'][number]['items'][number]['replaced']) || [],
        })),
      })),
    }));
  }
  s.activePlanId = str(pr.active_plan_id) || s.plans[0]?.id;

  s.schedule = (t.schedule_entries || []).map(e => ({
    id: str(e.id), date: str(e.date), planId: str(e.plan_id), workoutId: str(e.workout_code), status: e.status as State['schedule'][number]['status'],
    origin: e.origin as State['schedule'][number]['origin'], ...(e.session_id ? { sessionId: str(e.session_id) } : {}),
    ...(e.rescheduled_to ? { rescheduledTo: str(e.rescheduled_to) } : {}), ...(e.from_entry ? { from: str(e.from_entry) } : {}),
  }));
  s.pauses = (t.pauses || []).map(p => ({ id: str(p.id), from: str(p.from_date), to: p.to_date ? str(p.to_date) : null, reason: str(p.reason) }));

  const setsBySession = group(t.session_sets || [], 'session_id');
  s.sessions = (t.sessions || []).map(x => ({
    id: str(x.id), date: str(x.date), workoutId: str(x.workout_code), planId: str(x.plan_id), entryId: str(x.entry_id), durationMin: Number(x.duration_min), notes: str(x.notes),
    sets: (setsBySession[str(x.id)] || []).map(st => ({
      exId: str(st.exercise_id), kg: Number(st.kg), reps: Number(st.reps), rir: st.rir == null ? null : Number(st.rir), warm: !!st.warm,
      note: str(st.note), feel: str(st.feel), ...(st.substituted_for ? { sub: str(st.substituted_for) } : {}),
    })),
  })).sort(byDate);

  s.weights = (t.weights || []).map(w => ({ date: str(w.date), kg: Number(w.kg) })).sort(byDate);
  s.checkins = (t.checkins || []).map((c): Checkin => ({
    id: str(c.id), date: str(c.date), kg: c.kg as number | null, waist: c.waist as number | null, hips: c.hips as number | null, chest: c.chest as number | null,
    thighs: c.thighs as number | null, arms: c.arms as number | null, custom: (c.custom as Checkin['custom']) || [], energy: Number(c.energy), sleep: Number(c.sleep),
    hunger: Number(c.hunger), stress: Number(c.stress), recovery: Number(c.recovery), cycle: str(c.cycle), strength: str(c.strength), notes: str(c.notes),
    photos: { front: null, side: null, back: null, custom: [] },
  })).sort(byDate);
  s.photos = Object.fromEntries((t.photos || []).map(p => [str(p.id), str(p.storage_path)]));

  s.nutritionLog = Object.fromEntries((t.nutrition_log || []).map(d => [str(d.date), {
    kcal: Number(d.kcal), p: Number(d.protein), c: Number(d.carbs), f: Number(d.fat), prepped: d.prepped == null ? null : !!d.prepped, water: Number(d.water_ml),
  }]));
  const mealsByDate = group((t.day_meals || []).map(m => ({ ...m, position: m.slot })), 'date');
  const itemsByMeal = group(t.meal_items || [], 'meal_id');
  s.days = Object.fromEntries((t.day_plans || []).map(d => [str(d.date), {
    type: d.type as DayType, water: Number(d.water_ml),
    meals: (mealsByDate[str(d.date)] || []).map(m => ({
      key: str(m.id), logged: !!m.logged, prepped: !!m.prepped,
      items: (itemsByMeal[str(m.id)] || []).map(it => ({ key: str(it.id), foodId: str(it.food_id), g: Number(it.grams), locked: !!it.locked, ...(it.estimate ? { estimate: it.estimate as never } : {}) })),
    })),
  }]));
  if (t.meal_slots?.length) {
    const slots = { training: [] as State['mealSlots']['training'], rest: [] as State['mealSlots']['rest'] };
    [...t.meal_slots].sort((a, b) => Number(a.index) - Number(b.index)).forEach(sl => slots[sl.day_type as DayType].push({ name: str(sl.name), label: str(sl.label), time: str(sl.time) }));
    s.mealSlots = slots;
  }
  const d = t.distribution?.[0];
  if (d) s.distribution = { mode: d.mode as State['distribution']['mode'], custom: ((d.custom as number[]) || []).map(Number), manual: (d.manual as State['distribution']['manual']) || null, preIdx: Number(d.pre_idx), postIdx: Number(d.post_idx), proteinIdx: (d.protein_idx as number[]) || [] };

  s.customFoods = Object.fromEntries((t.foods || []).filter(f => f.user_id && !FOODS[str(f.id)]).map(f => [str(f.id), {
    ...((f.extra as object) || {}), id: str(f.id), name: str(f.name), basis: f.basis as Food['basis'], kcal: Number(f.kcal), p: Number(f.protein), c: Number(f.carbs), f: Number(f.fat),
    role: f.role as Food['role'], cat: str(f.category), tags: (f.tags as string[]) || [], src: str(f.source), est: !!f.estimated,
    ...(f.serving ? { serving: f.serving as Food['serving'] } : {}), ...(f.buy ? { buy: f.buy as Food['buy'] } : {}),
    ...(f.raw_id ? { rawId: str(f.raw_id) } : {}), ...(f.cooked_id ? { cookedId: str(f.cooked_id) } : {}), ...(f.yield != null ? { yld: Number(f.yield) } : {}),
  } as Food]));
  s.savedMeals = [...(t.saved_meals || [])].sort(byPos).map(m => ({ id: str(m.id), name: str(m.name), items: (m.items as State['savedMeals'][number]['items']) || [], ...(m.estimate ? { estimate: m.estimate as never } : {}), fav: !!m.fav, uses: Number(m.uses) }));
  const ingByRecipe = group(t.recipe_ingredients || [], 'recipe_id');
  s.recipes = [...(t.recipes || [])].sort(byPos).map((r): Recipe => ({
    id: str(r.id), name: str(r.name), cookedWeight: Number(r.cooked_weight), servings: Number(r.servings), byWeight: !!r.by_weight, fav: !!r.fav,
    ...(r.serving_g != null ? { servingG: Number(r.serving_g) } : {}),
    ingredients: (ingByRecipe[str(r.id)] || []).map(g => ({ foodId: str(g.food_id), g: Number(g.grams) })),
  }));
  s.prep = [...(t.prep_plans || [])].sort(byPos).map(p => ({
    id: str(p.id), mealId: str(p.source_id), kind: p.kind === 'recipe' ? 'recipe' : 'meal', containers: Number(p.containers), people: Number(p.people), days: Number(p.days),
    version: p.version === 'rest' ? 'rest' : 'training', actual: (p.actual as Record<string, number>) || {},
  }));
  s.grocery = {
    checked: Object.fromEntries((t.grocery_checks || []).filter(g => g.checked).map(g => [str(g.id), true])),
    manual: [...(t.grocery_manual || [])].sort(byPos).map(m => ({ id: str(m.id), name: str(m.name), qty: str(m.qty), cat: str(m.category) })),
  };
  if (t.reminders?.length) s.reminders = [...t.reminders].sort(byPos).map(r => ({
    id: str(r.id), type: str(r.type), time: str(r.time), freq: str(r.freq), channel: str(r.channel), snooze: Number(r.snooze_min), enabled: !!r.enabled, reschedule: !!r.reschedule, ...(r.note ? { note: str(r.note) } : {}),
  }));
  const q = t.quotes_user || [];
  s.quotes = {
    fav: Object.fromEntries(q.filter(x => x.kind === 'fav').map(x => [str(x.quote_id), true])),
    hidden: Object.fromEntries(q.filter(x => x.kind === 'hidden').map(x => [str(x.quote_id), true])),
    custom: q.filter(x => x.kind === 'custom').sort(byPos).map(x => ({ id: str(x.quote_id), text: str(x.text), tone: str(x.tone) })),
  };
  return s;
}
