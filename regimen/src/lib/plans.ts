/* Plans, trial and access rules. These prices are shown until RevenueCat's own prices load (those are the real ones
   and can change in RevenueCat without an app update). All prices are in Canadian dollars. */

export const TRIAL_DAYS = 7;

export const PLANS = [
  { id: 'yearly', name: 'Yearly', price: 'CA$179.99', per: 'year', note: 'Save 40% · CA$15/month billed yearly', recommended: true },
  { id: 'monthly', name: 'Monthly', price: 'CA$24.99', per: 'month', note: 'Flexible · cancel anytime', recommended: false },
] as const;

/** EXPO_PUBLIC_BILLING: 'live' = real payments; 'sandbox' = Stripe test mode (paywall on, test cards, no real charges);
    anything else = payments off and nobody is locked out. */
export const billingMode = (): 'live' | 'sandbox' | 'off' => {
  const m = process.env.EXPO_PUBLIC_BILLING;
  return m === 'live' || m === 'sandbox' ? m : 'off';
};
/** Payments are switched on (real or test mode): the paywall is in force. */
export const billingLive = () => billingMode() !== 'off';
/** EXPO_PUBLIC_PAYWALL_PREVIEW=1 shows the locked experience without billing (for testing and demos). */
export const paywallPreview = () => process.env.EXPO_PUBLIC_PAYWALL_PREVIEW === '1';

export type SubStatus = 'trialing' | 'active' | 'canceled' | 'expired' | 'comp';
export interface Subscription { status: SubStatus; plan: 'monthly' | 'yearly' | null; periodEnd: string | null }

/** Full access? Comp is permanent; trialing/active/canceled keep access until the paid period ends; expired is locked.
    When billing isn't live (and not previewing), everyone has full access. */
export function hasFullAccess(sub: Subscription | null, now = Date.now(), enforced = billingLive() || paywallPreview()): boolean {
  if (!enforced) return true;
  if (!sub) return false;
  if (sub.status === 'comp') return true;
  if (sub.status === 'expired') return false;
  return !!sub.periodEnd && Date.parse(sub.periodEnd) > now;
}

/** What free users can open. Everything else shows the upgrade screen. */
export const FREE_ROUTES = new Set(['dashboard', 'settings', 'account', 'onboarding', 'upgrade']);

/** Plain descriptions of what each locked screen unlocks. */
export const FEATURE: Record<string, { title: string; body: string }> = {
  schedule: { title: 'Workout scheduling', body: 'Your schedule builds itself from your plan. Move, skip, pause and reschedule workouts while your rotation stays on track.' },
  plans: { title: 'Workout plans', body: 'Build and edit your own plans, rotations and exercises.' },
  workout: { title: 'Guided workouts', body: 'Log every set, with rest timers and exact next-session targets.' },
  history: { title: 'Exercise history', body: 'Every set you’ve logged, with strength charts and your next recommendation.' },
  records: { title: 'Personal records', body: 'Heaviest lifts, best reps and estimated maxes for every exercise.' },
  checkins: { title: 'Progress check-ins', body: 'Weekly measurements and ratings, with changes since you started.' },
  photos: { title: 'Progress photos', body: 'Private side-by-side comparisons of your progress.' },
  analytics: { title: 'Analytics', body: 'Weight trends, training volume, strength and nutrition adherence.' },
  nutrition: { title: 'Nutrition dashboard', body: 'Your day’s meals, macros remaining and water, planned vs logged.' },
  meals: { title: 'Meal builder', body: 'Meals with exact portions solved to hit your macros, for training and rest days.' },
  prep: { title: 'Meal prep', body: 'Batch-cook amounts, cooked yields and portions per container.' },
  recipes: { title: 'Recipes & saved meals', body: 'Your recipes and favourite meals with full nutrition.' },
  alternatives: { title: 'Food substitutions', body: 'Swap any food for one that matches its macros, with the exact amount.' },
  grocery: { title: 'Grocery list', body: 'A shopping list built from your meal prep, grouped by aisle.' },
};
