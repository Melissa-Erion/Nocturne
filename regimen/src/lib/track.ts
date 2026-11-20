/* Usage events for the sign-up → paying funnel (public.events, see migrations/20261120040000_usage_events.sql).
   Only for signed-in accounts (cloud mode); on-device mode and tests send nothing. Fire-and-forget: a failed insert
   is ignored and never affects the app. No food, weight or health details are sent, only which step happened. */
import { supabase } from './supabase';
import { useUI } from '@/store/store';

export type EventName =
  | 'app_open' | 'setup_done' | 'food_added' | 'meal_eaten' | 'extra_logged' | 'workout_started' | 'workout_finished'
  | 'paywall_prompt' | 'upgrade_viewed' | 'checkout_started' | 'checkout_done' | 'calorie_check_applied';

const last: Partial<Record<EventName, number>> = {};
/** Record that something happened. Repeats of the same event within 5 seconds are dropped. */
export function track(name: EventName, props: Record<string, string | number | boolean> = {}) {
  if (!supabase || !useUI.getState().userId) return;
  const now = Date.now(); if ((last[name] || 0) > now - 5000) return; last[name] = now;
  supabase.from('events').insert({ name, props }).then(() => {}, () => {});
}

// Every "Included with Regimen Pro" prompt, wherever it comes from, with the feature that triggered it.
useUI.subscribe((s, prev) => { if (s.lockPrompt && s.lockPrompt !== prev.lockPrompt) track('paywall_prompt', { feature: s.lockPrompt }); });
