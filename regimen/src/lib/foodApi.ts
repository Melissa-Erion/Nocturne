/* Live nutrition data: USDA FoodData Central search (free key: EXPO_PUBLIC_USDA_API_KEY) and Open Food Facts barcode lookup.
   Results are returned as Food objects (per 100 g) the caller can save into customFoods. Values from labels are flagged as estimated
   when a field is missing. */
import type { Food, FoodRole } from '@/domain/types';

const USDA = 'https://api.nal.usda.gov/fdc/v1';
export const usdaEnabled = () => !!process.env.EXPO_PUBLIC_USDA_API_KEY;

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

/** Search USDA FoodData Central. Returns [] if no API key is configured. */
export async function searchUsda(query: string, limit = 15): Promise<Food[]> {
  const key = process.env.EXPO_PUBLIC_USDA_API_KEY; if (!key || !query.trim()) return [];
  const r = await fetch(`${USDA}/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&pageSize=${limit}&dataType=Foundation,SR%20Legacy,Branded`);
  if (!r.ok) throw new Error(`USDA search failed (${r.status})`);
  const j = await r.json() as { foods?: UsdaFood[] };
  return (j.foods || []).map(f => {
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
