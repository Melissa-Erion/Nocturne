// Answers from the calculator on the landing page (regimenfit.ca), carried into guided setup so people don't
// type their details twice. Read once, then removed. Web only; ignored if older than 7 days or malformed.
import { Platform } from 'react-native';

export type Prefill = { units: 'metric' | 'imperial'; weight: number; heightCm: number; age: number; sex: string; goal: string; activity: string };

const KEY = 'regimen.prefill';
const SEXES = ['Female', 'Male'];
const GOALS = ['Fat loss', 'Muscle gain', 'Recomposition', 'Strength', 'Maintenance'];
const ACTS = ['Sedentary', 'Lightly active', 'Moderately active', 'Very active'];

export function takePrefill(): Prefill | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); window.localStorage.removeItem(KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object' || Date.now() - Number(p.at) > 7 * 864e5) return null;
    const units = p.units === 'metric' ? 'metric' : 'imperial';
    const weight = Number(p.weight), heightCm = Number(p.heightCm), age = Math.round(Number(p.age));
    const kg = units === 'imperial' ? weight / 2.20462 : weight;
    if (!(kg >= 30 && kg <= 300) || !(heightCm >= 120 && heightCm <= 230) || !(age >= 16 && age <= 100)) return null;
    return {
      units, weight, heightCm, age,
      sex: SEXES.includes(p.sex) ? p.sex : 'Female',
      goal: GOALS.includes(p.goal) ? p.goal : 'Fat loss',
      activity: ACTS.includes(p.activity) ? p.activity : 'Moderately active',
    };
  } catch { return null; }
}
