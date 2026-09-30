/* RG — the same API surface the prototype pages used (window.RG), backed by the typed domain layer.
   Screens call `const RG = useRG()`; it re-renders whenever state changes.
   Read-only helpers compute from current state; mutating helpers commit (re-render + save + sync). */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import * as D from '@/domain';
import type { ISODate, MealItem, PlanItem, State } from '@/domain/types';
import { deleteLocalImage, persistLocalImage } from '@/lib/files';
import { cachedSignedUrl, removePhoto, signedUrl, uploadPhoto } from '@/lib/photos';
import { clearSampleData, commit, ctx, dropUndo, getState, pushUndo, resetToSample, toast, undo, update, useUI } from './store';

export type Route =
  | 'dashboard' | 'schedule' | 'plans' | 'workout' | 'history' | 'records' | 'checkins' | 'photos' | 'analytics'
  | 'nutrition' | 'meals' | 'prep' | 'recipes' | 'alternatives' | 'grocery' | 'settings' | 'account' | 'onboarding';

const U = () => D.makeUnits(getState());

export const RG = {
  /* constants & date helpers */
  get TODAY(): ISODate { return D.localToday(); },
  EX: D.EX, FOODS: D.FOODS, QUOTES: D.QUOTES, DN: D.DN, DFULL: D.DFULL, MN: D.MN, MFULL: D.MFULL, tagMap: D.tagMap,
  add: D.add, dow: D.dow, diff: D.diff, fmtD: D.fmtD, fmtShort: D.fmtShort, uid: D.uid, r1: D.r1, sum: D.sum, num: D.num,
  /** Long id for rows that must be globally unique (custom foods). */
  lid: (prefix = '') => prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),

  /* state */
  get s(): State { return getState(); },
  update, commit, toast,
  go(route: Route, param?: unknown) { useUI.setState({ routeParam: param == null ? null : param }); router.navigate(('/' + route) as never); },
  get routeParam(): unknown { return useUI.getState().routeParam; },
  reset: resetToSample,
  clearSample: clearSampleData,

  /* units */
  imp: () => U().imp(), wu: () => U().wu(), lu: () => U().lu(),
  w: (kg: number | null | undefined, dp?: number) => U().w(kg, dp), bw: (kg: number | null | undefined) => U().bw(kg), len: (cm: number | null | undefined) => U().len(cm),
  toKg: (v: number) => U().toKg(v), toCm: (v: number) => U().toCm(v), g: (g: number) => U().g(g),

  /* plans */
  plan: () => D.activePlan(ctx()),
  workout: (wid: string, planId?: string) => D.workoutOf(ctx(), wid, planId),
  ex: (id: string) => D.EX[id],

  /* schedule */
  inPause: (d: ISODate) => D.inPause(ctx(), d),
  activePause: () => D.activePause(ctx()),
  recoveryClash: (date: ISODate, wid: string, ignoreId?: string) => D.recoveryClash(ctx(), date, wid, ignoreId),
  regenerate(from?: ISODate) { pushUndo('rebuild schedule'); D.regenerate(ctx(), from); commit(); },
  /** Rebuild upcoming workouts from the plan (history kept). */
  resetSchedule() { pushUndo('reset schedule'); D.resetSchedule(ctx()); commit(); },
  /** Reverse the last schedule change. */
  undo,
  entriesOn: (d: ISODate) => D.entriesOn(ctx(), d),
  entry: (id: string) => D.entry(ctx(), id),
  todayEntry: () => D.todayEntry(ctx()),
  nextEntry: (after?: ISODate) => D.nextEntry(ctx(), after),
  moveEntry(id: string, date: ISODate, shift?: boolean | null) { pushUndo('move workout'); const r = D.moveEntry(ctx(), id, date, shift); if (r.error) dropUndo(); else commit(); return r; },
  swapEntries(a: string, b: string) { pushUndo('swap workouts'); D.swapEntries(ctx(), a, b); commit(); },
  skipEntry(id: string) { pushUndo('skip workout'); D.skipEntry(ctx(), id); commit(); },
  missEntry(id: string) { pushUndo('mark missed'); D.missEntry(ctx(), id); commit(); },
  restoreEntry(id: string) { pushUndo('restore workout'); D.restoreEntry(ctx(), id); commit(); },
  rescheduleMissed(id: string, date: ISODate) { pushUndo('reschedule workout'); D.rescheduleMissed(ctx(), id, date); commit(); },
  pause(from: ISODate, to: ISODate | null, reason: string) { pushUndo('pause schedule'); D.pause(ctx(), from, to, reason); commit(); },
  resume() { pushUndo('resume schedule'); D.resume(ctx()); commit(); },
  weekStats: (mon: ISODate) => D.weekStats(ctx(), mon),
  monday: (d?: ISODate) => D.monday(d || D.localToday()),
  streak: () => D.streak(ctx()),
  icsExport: () => D.icsExport(ctx()),

  /* history & progression */
  history: (exId: string) => D.history(ctx(), exId),
  lastPerf: (exId: string) => D.lastPerf(ctx(), exId),
  e1rm: D.e1rm,
  prs: (exId: string) => D.prs(ctx(), exId),
  planItemFor: (exId: string) => D.planItemFor(ctx(), exId),
  recommend: (exId: string, item?: PlanItem | null) => D.recommend(ctx(), exId, item),

  /* active workout */
  startWorkout(entryId?: string) { const c = ctx(); D.startWorkout(c, entryId); commit(); RG.go('workout'); },
  finishWorkout() { const r = D.finishWorkout(ctx()); commit(); return r; },
  discardWorkout() { D.discardWorkout(ctx()); commit(); },
  pauseWorkout() { D.pauseWorkout(ctx()); commit(); },
  resumeWorkout() { D.resumeWorkout(ctx()); commit(); },
  /** Active (unpaused) time of the running workout in ms. */
  workoutElapsed: () => { const a = getState().active; return a ? D.elapsedMs(a) : 0; },
  replaceExercise(planId: string, workoutId: string, itemId: string, newExId: string) { D.replaceExercise(ctx(), planId, workoutId, itemId, newExId); commit(); },

  /* nutrition */
  food: (id: string) => D.food(getState(), id),
  allFoods: () => D.allFoods(getState()),
  macros: (foodId: string, g: number) => D.macros(getState(), foodId, g),
  sumM: (items: MealItem[]) => D.sumM(getState(), items),
  reconcile: D.reconcile,
  dayType: (d: ISODate) => D.dayType(ctx(), d),
  /** Daily targets for a date ('training'/'rest' decided from the schedule) or an explicit day type. */
  dayTargets: (dateOrType: ISODate | D.DayType) => D.dayTargets(getState().profile, dateOrType === 'training' || dateOrType === 'rest' ? dateOrType : D.dayType(ctx(), dateOrType)),
    mealTargets: (type: D.DayType, mode?: D.DistributionMode) => D.mealTargets(ctx(), type, mode),
  solve: (items: MealItem[], target: { p: number; c: number; f: number }) => D.solve(getState(), items, target),
  getDay: (d: ISODate) => D.getDay(ctx(), d),
  dayTotals: (d: ISODate) => D.dayTotals(ctx(), d),
  alternatives: (foodId: string, g: number, opts?: { tag?: string; lower?: boolean; higher?: boolean }) => D.alternatives(getState(), foodId, g, opts),

  /* prep & grocery */
  prepSource: (p: D.PrepPlan) => D.prepSource(getState(), p),
  recipeNutrition: (r: D.Recipe) => D.recipeNutrition(getState(), r),
  prepCalc: (p: D.PrepPlan) => D.prepCalc(getState(), p),
  groceryList: () => D.groceryList(getState()),

  /* quotes, weights, charts, check-ins */
  quoteList: () => D.quoteList(getState()),
  todayQuote: (offset = 0) => D.todayQuote(getState(), D.localToday(), offset),
  pts: D.pts, rolling: D.rolling,
  avgWeight: (d?: ISODate, n?: number) => D.avgWeight(getState().weights, d || D.localToday(), n),
  logWeight(kg: number, date?: ISODate) { D.logWeight(ctx(), kg, date); commit(); },
  nextCheckIn: () => D.nextCheckIn(ctx()),

  /* safety */
  bmr: D.bmr, tdee: D.tdee, calorieFloor: D.calorieFloor, lowCalorie: D.lowCalorie, NOT_MEDICAL: D.NOT_MEDICAL,

  /* private photos — key is `${checkinId}:${pose}` */
  hasPhoto: (key: string) => !!getState().photos[key],
  /** Displayable URL, or null while a signed URL is being fetched (the screen re-renders when it arrives). */
  photo(key: string): string | null {
    const ref = getState().photos[key]; if (!ref) return null;
    if (useUI.getState().mode === 'device' || /^(file|data|blob|https?):/.test(ref)) return ref;
    const hit = cachedSignedUrl(ref); if (hit) return hit;
    signedUrl(ref).then(u => { if (u) commitView(); });
    return null;
  },
  /** Save (uri) or delete (null) a photo. */
  async setPhoto(key: string, uri: string | null) {
    const s = getState(); const old = s.photos[key]; const { mode, userId } = useUI.getState();
    try {
      if (uri) {
        const ref = mode === 'cloud' && userId ? await uploadPhoto(userId, key, uri) : await persistLocalImage(uri, key);
        s.photos[key] = ref;
      } else delete s.photos[key];
      commit();
      if (old && old !== s.photos[key]) { if (mode === 'cloud') removePhoto(old).catch(() => {}); else deleteLocalImage(old); }
    } catch (e) {
      toast('Photo could not be saved: ' + (e instanceof Error ? e.message : 'unknown error'));
    }
  },
};
export type RGType = typeof RG;

/** Re-render without saving (e.g. a signed URL arrived). */
function commitView() { useUI.setState(u => ({ version: u.version + 1 })); }

/** Subscribe a screen to state changes. */
export function useRG(): RGType {
  useUI(u => u.version);
  return RG;
}

/** Resolve a photo URL for display (handles async signed URLs). */
export function usePhoto(key: string | null): string | null {
  useUI(u => u.version);
  const [, force] = useState(0);
  const url = key ? RG.photo(key) : null;
  useEffect(() => { if (key && !url && getState().photos[key]) { const ref = getState().photos[key]; signedUrl(ref).then(() => force(x => x + 1)); } }, [key, url]);
  return url;
}
