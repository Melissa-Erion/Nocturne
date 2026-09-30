/* Regimen domain types. Metric is the internal standard everywhere (kg, cm, g, ml);
   unit conversion happens only at display and input (see units.ts). */

export type ISODate = string; // 'YYYY-MM-DD'
export type Region = 'upper' | 'lower' | 'core' | 'full';
export type Equipment = 'Barbell' | 'Dumbbell' | 'Cable' | 'Machine' | 'Bodyweight';

export interface Exercise {
  id: string;
  name: string;
  muscle: string;
  region: Region;
  equip: Equipment;
  instr: string;
  alts: string[];
}

export type Basis = 'raw' | 'cooked' | 'drained' | 'prepared' | 'edible';
export type FoodRole = 'protein' | 'carb' | 'fat' | 'veg';

export interface Food {
  id: string;
  name: string;
  basis: Basis;
  kcal: number; // per 100 g
  p: number;
  c: number;
  f: number;
  role: FoodRole;
  cat: string;
  tags: string[];
  src: string;
  est: boolean;
  serving?: { label: string; g: number };
  buy?: { unit: string; g: number };
  rawId?: string;
  cookedId?: string;
  yld?: number;
  custom?: boolean;
  [extra: string]: unknown;
}

export interface Replacement { exId: string; date: ISODate }

export interface PlanItem {
  id: string;
  exId: string;
  sets: number;
  repMin: number;
  repMax: number;
  rir: number;
  rest: number; // seconds
  tempo: string;
  warmups: number;
  superset: string;
  notes: string;
  replaced: Replacement[];
  targetKg?: number | null;
  media?: string;
}

export interface Workout {
  id: string; // rotation code, e.g. L1
  name: string;
  focus: string;
  muscles: string[];
  region: Region;
  items: PlanItem[];
}

export interface Plan {
  id: string;
  name: string;
  note: string;
  workouts: Workout[];
  rotation: string[];
  allowConsecutive: boolean;
}

export type EntryStatus = 'planned' | 'done' | 'missed' | 'skipped';
export type EntryOrigin = 'auto' | 'manual' | 'rescheduled';

export interface ScheduleEntry {
  id: string;
  date: ISODate;
  workoutId: string;
  planId: string;
  status: EntryStatus;
  origin: EntryOrigin;
  sessionId?: string | null;
  rescheduledTo?: string;
  from?: string;
}

export interface Pause { id: string; from: ISODate; to: ISODate | null; reason: string }

export interface SetLog {
  exId: string;
  kg: number;
  reps: number;
  rir: number | null;
  warm: boolean;
  note?: string;
  feel?: string;
  sub?: string; // original exercise this set substituted for
}

export interface Session {
  id: string;
  date: ISODate;
  workoutId: string;
  planId: string;
  entryId: string;
  sets: SetLog[];
  durationMin: number;
  notes: string;
}

export interface WeightEntry { date: ISODate; kg: number }

export interface CheckinPhotos { front: string | null; side: string | null; back: string | null; custom: string[] }

export interface Checkin {
  id: string;
  date: ISODate;
  kg: number | null;
  waist: number | null;
  hips: number | null;
  chest: number | null;
  thighs: number | null;
  arms: number | null;
  custom: { name: string; value: number | null }[];
  energy: number;
  sleep: number;
  hunger: number;
  stress: number;
  recovery: number;
  cycle: string;
  strength: string;
  notes: string;
  photos: CheckinPhotos;
}

export interface NutritionLogDay { kcal: number; p: number; c: number; f: number; prepped: boolean | null; water: number }

export interface MealItem { key?: string; foodId: string; g: number; locked?: boolean; estimate?: Macros }
export interface Meal { key: string; items: MealItem[]; logged: boolean; prepped: boolean }
export type DayType = 'training' | 'rest';
export interface DayPlan { type: DayType; meals: Meal[]; water: number }

export interface MealSlot { name: string; label: string; time: string }

export type DistributionMode = 'equal' | 'custom' | 'prepost' | 'protein' | 'manual';
export interface Distribution {
  mode: DistributionMode;
  custom: number[];
  manual: { p: number; c: number; f: number }[] | null;
  preIdx: number;
  postIdx: number;
  proteinIdx: number[];
}

export interface Macros { kcal: number; p: number; c: number; f: number }

export interface SavedMeal {
  id: string;
  name: string;
  items: MealItem[];
  estimate?: Macros;
  fav: boolean;
  uses: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: { foodId: string; g: number }[];
  cookedWeight: number;
  servings: number;
  byWeight: boolean;
  servingG?: number;
  fav: boolean;
}

export interface PrepPlan {
  id: string;
  mealId: string;
  kind: 'meal' | 'recipe';
  containers: number;
  people: number;
  days: number;
  version: DayType;
  actual: Record<string, number>; // foodId → actual cooked grams; 'total' for recipes
}

export interface GroceryManual { id: string; name: string; qty: string; cat: string }
export interface Grocery { checked: Record<string, boolean>; manual: GroceryManual[] }

export interface Reminder {
  id: string;
  type: string;
  time: string;
  freq: string;
  channel: string;
  snooze: number;
  enabled: boolean;
  reschedule: boolean;
  note?: string;
}

export interface CustomQuote { id: string; text: string; tone: string }
export interface Quotes { fav: Record<string, boolean>; hidden: Record<string, boolean>; custom: CustomQuote[] }

export interface MacroTargets { kcal: number; protein: number; carbs: number; fat: number }

export interface Profile {
  name: string;
  goal: string;
  weightKg: number | null;
  goalWeightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: 'Female' | 'Male' | string;
  activity: string;
  experience: string;
  trainingDays: number[]; // Mon = 0
  restDays: number[];
  duration: number;
  location: string;
  equipment: string[];
  priorities: string[];
  /** Training-day targets (also used on rest days unless restTargets is set). */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional separate rest-day targets; null = same as training days. */
  restTargets?: MacroTargets | null;
  mealsPerDay: number;
  dietPrefs: string[];
  allergies: string[];
  exclude: string[];
  checkInDay: number;
  checkInFreq: 'Weekly' | 'Biweekly' | 'Monthly' | string;
  units: 'metric' | 'imperial';
  water: boolean;
  waterMl: number;
  supplements: boolean;
  increments: Record<string, number>;
  progression: 'double' | 'linear';
  quietStart: string;
  quietEnd: string;
  calendarSync: boolean;
  shiftLater: boolean;
  workoutTime: string;
  quoteTone: string;
  onboarded: boolean;
  /** The guided app tour was finished or skipped. */
  tourDone?: boolean;
  startDate: ISODate;
}

export interface ActiveSet {
  id: string;
  kg: number | string | null;
  reps: number | string | null;
  target?: number;
  rir: number | string | null;
  warm: boolean;
  done: boolean;
  note: string;
  feel: string;
}

export interface Recommendation {
  type: 'baseline' | 'increase' | 'hold' | 'reduce';
  kg: number | null;
  reps: number[];
  reason: string;
}

export interface ActiveExercise {
  key: string;
  itemId: string;
  exId: string;
  originalExId: string;
  rec: Partial<Recommendation>;
  recState: 'pending' | 'accepted' | 'edited' | 'ignored' | string;
  sets: ActiveSet[];
  note: string;
  feel: string;
  [extra: string]: unknown;
}

export interface ActiveWorkout {
  entryId: string;
  workoutId: string;
  planId: string;
  date: ISODate;
  startedAt: number;
  restEnd: number | null;
  restFor: string | null;
  /** When the workout was paused (ms since epoch), or null while running. */
  pausedAt?: number | null;
  /** Total paused time so far (ms); excluded from the workout's duration. */
  pausedMs?: number;
  ex: ActiveExercise[];
  [extra: string]: unknown;
}

export interface State {
  v: 1;
  /** true when the state was created from the sample-data seed */
  sample?: boolean;
  profile: Profile;
  plans: Plan[];
  activePlanId: string;
  sessions: Session[];
  schedule: ScheduleEntry[];
  pauses: Pause[];
  weights: WeightEntry[];
  checkins: Checkin[];
  nutritionLog: Record<ISODate, NutritionLogDay>;
  days: Record<ISODate, DayPlan>;
  distribution: Distribution;
  mealSlots: Record<DayType, MealSlot[]>;
  savedMeals: SavedMeal[];
  recipes: Recipe[];
  customFoods: Record<string, Food>;
  prep: PrepPlan[];
  grocery: Grocery;
  reminders: Reminder[];
  quotes: Quotes;
  active: ActiveWorkout | null;
  /** photo key (`${checkinId}:${pose}`) → storage path (cloud) or local URI/data URL (device mode) */
  photos: Record<string, string>;
}

/** Everything the domain functions need: the mutable state and "today". */
export interface Ctx { s: State; today: ISODate }
