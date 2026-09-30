/* Live nutrition data: USDA FoodData Central search and Open Food Facts barcode lookup.
   USDA searches go through the `usda-search` Supabase Edge Function, which holds the API key as a server secret —
   the key is never in the app's code (USDA deactivates keys found in public code).
   Results are returned as Food objects (per 100 g) the caller can save into customFoods. Values from labels are flagged as estimated
   when a field is missing. */
import type { Food, FoodRole } from '@/domain/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/** Live USDA search needs a signed-in cloud account (the proxy function only serves signed-in users). */
export const usdaEnabled = () => !!supabase;

const roleOf = (p: number, c: number, f: number): FoodRole => {
  const kp = p * 4, kc = c * 4, kf = f * 9, t = kp + kc + kf || 1;
  if (t < 60 && kc / t < 0.8) return 'veg';
  if (kp / t >= 0.4) return 'protein';
  if (kf / t >= 0.5) return 'fat';
  return 'carb';
};

const newId = (prefix: string) => prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface UsdaNutrient { nutrientNumber?: string; nutrientName?: string; value?: number; unitName?: string }
interface UsdaFood { fdcId: number; description: string; brandName?: string; foodNutrients?: UsdaNutrient[]; servingSize?: number; servingSizeUnit?: string }

/** Search USDA FoodData Central via the server-side proxy. */
export async function searchUsda(query: string, limit = 15): Promise<Food[]> {
  if (!supabase || !query.trim()) return [];
  // Device cache (memory + storage, 7 days) in front of the server's shared 30-day cache, so repeat searches make no request.
  const key = `usda:${query.trim().toLowerCase().replace(/\s+/g, ' ')}|${limit}`;
  let raw: UsdaFood[] | null = memo.get(key) || null;
  if (!raw) {
    try { const c = JSON.parse((await AsyncStorage.getItem(key)) || 'null'); if (c && Date.now() - c.t < DEVICE_TTL) raw = c.foods; } catch { /* no cache */ }
  }
  if (!raw) raw = await fetchUsda(query, limit);
  if (!memo.has(key)) { memo.set(key, raw); AsyncStorage.setItem(key, JSON.stringify({ t: Date.now(), foods: raw })).catch(() => {}); }
  return toFoods(raw);
}

const memo = new Map<string, UsdaFood[]>();
const DEVICE_TTL = 7 * 864e5;

async function fetchUsda(query: string, limit: number): Promise<UsdaFood[]> {
  const { data, error } = await supabase!.functions.invoke('usda-search', { body: { query, limit } });
  if (error) {
    let msg = error.message;
    try { const b = await (error as { context?: Response }).context?.json(); if (b?.error) msg = b.error; } catch { /* keep generic message */ }
    throw new Error(msg);
  }
  return ((data as { foods?: UsdaFood[] }).foods) || [];
}

function toFoods(list: UsdaFood[]): Food[] {
  return list.map(f => {
    const n = (num: string, name: RegExp) => f.foodNutrients?.find(x => x.nutrientNumber === num || (x.nutrientName && name.test(x.nutrientName)))?.value;
    const p = n('203', /^Protein/) ?? 0, c = n('205', /^Carbohydrate/) ?? 0, fat = n('204', /^Total lipid/) ?? 0;
    const kcal = n('208', /^Energy/) ?? Math.round(p * 4 + c * 4 + fat * 9);
    const name = (f.brandName ? f.brandName + ' — ' : '') + f.description.charAt(0) + f.description.slice(1).toLowerCase();
    const serving = f.servingSize && f.servingSizeUnit?.toLowerCase() === 'g' ? { label: 'serving', g: f.servingSize } : undefined;
    return {
      id: newId('usda_'), name, basis: /cooked|boiled|baked|roasted|grilled/i.test(f.description) ? 'cooked' : 'raw', kcal, p, c, f: fat,
      role: roleOf(p, c, fat), cat: 'Other', tags: [], src: `USDA FoodData Central #${f.fdcId}`, est: false, custom: true, ...(serving ? { serving } : {}),
    } as Food;
  });
}

/** Look up a barcode on Open Food Facts. Returns null if not found. */
export async function lookupBarcode(code: string): Promise<Food | null> {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments,serving_quantity,serving_size`);
  if (!r.ok) return null;
  const j = await r.json() as { status?: number; product?: { product_name?: string; brands?: string; serving_quantity?: number; serving_size?: string; nutriments?: Record<string, number> } };
  if (j.status !== 1 || !j.product) return null;
  const nu = j.product.nutriments || {};
  const p = nu.proteins_100g, c = nu.carbohydrates_100g, f = nu.fat_100g; const kcal = nu['energy-kcal_100g'];
  const est = [p, c, f, kcal].some(v => v == null);
  const P = p ?? 0, Cc = c ?? 0, F = f ?? 0;
  const name = [j.product.brands?.split(',')[0], j.product.product_name].filter(Boolean).join(' — ') || `Barcode ${code}`;
  return {
    id: newId('off_'), name, basis: 'prepared', kcal: kcal ?? Math.round(P * 4 + Cc * 4 + F * 9), p: P, c: Cc, f: F, role: roleOf(P, Cc, F), cat: 'Pantry', tags: [],
    src: `Open Food Facts · ${code}`, est, custom: true, barcode: code,
    ...(j.product.serving_quantity ? { serving: { label: j.product.serving_size || 'serving', g: Number(j.product.serving_quantity) } } : {}),
  } as Food;
}
