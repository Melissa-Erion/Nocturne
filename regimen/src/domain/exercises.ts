/* Exercise lookup across the built-in library (EX) and the user's own exercises (State.customExercises). */
import { EX } from './data/exercises';
import type { Equipment, Exercise, Region, State } from './types';

/** An exercise by id: the user's own first, then the built-in library. */
export const exById = (s: Pick<State, 'customExercises'>, id: string): Exercise | undefined => s.customExercises?.[id] || EX[id];

/** Every exercise the user can pick, sorted by muscle then name. */
export const allExercises = (s: Pick<State, 'customExercises'>): Exercise[] =>
  [...Object.values(EX), ...Object.values(s.customExercises || {})]
    .sort((a, b) => a.muscle.localeCompare(b.muscle) || a.name.localeCompare(b.name));

/** Muscle groups offered when adding an exercise (the library's groups plus a few common extras), with their body region. */
export const MUSCLE_REGIONS: Record<string, Region> = (() => {
  const m: Record<string, Region> = {};
  for (const e of Object.values(EX)) m[e.muscle] = e.region;
  for (const [k, r] of [['Glutes', 'lower'], ['Quads', 'lower'], ['Hamstrings', 'lower'], ['Calves', 'lower'], ['Chest', 'upper'], ['Back', 'upper'],
    ['Shoulders', 'upper'], ['Biceps', 'upper'], ['Triceps', 'upper'], ['Core', 'core'], ['Full body', 'full'], ['Cardio', 'full'], ['Other', 'full']] as [string, Region][]) {
    if (!m[k]) m[k] = r;
  }
  return m;
})();
export const EQUIPMENT: Equipment[] = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'];

/** Build a new custom exercise. Names are trimmed and limited to 80 characters; instructions to 1,000. */
export function makeCustomExercise(id: string, name: string, muscle: string, equip: Equipment, instr = ''): Exercise {
  return { id, name: name.trim().slice(0, 80), muscle, region: MUSCLE_REGIONS[muscle] || 'full', equip, instr: instr.trim().slice(0, 1000), alts: [] };
}
