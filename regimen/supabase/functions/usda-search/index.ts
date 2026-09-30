// USDA FoodData Central search proxy. The API key stays on the server as the USDA_API_KEY secret
// (Supabase dashboard → Edge Functions → Secrets) and is never sent to the app.
// Only signed-in users may call it (the platform verifies the JWT; we also require role = authenticated).
// Results are cached in public.food_search_cache for 30 days so repeat searches don't call USDA.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CACHE_DAYS = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function role(req: Request): string | null {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.role === "string" ? payload.role : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (role(req) !== "authenticated") return json({ error: "Sign in to search foods" }, 401);

  const key = Deno.env.get("USDA_API_KEY");
  if (!key) return json({ error: "Food search is not set up yet (USDA_API_KEY secret missing)." }, 503);

  let query = "", limit = 15;
  try { const b = await req.json(); query = String(b.query || "").trim().slice(0, 100); limit = Math.min(25, Math.max(1, Number(b.limit) || 15)); }
  catch { return json({ error: "Invalid request" }, 400); }
  if (!query) return json({ foods: [] });

  // Shared cache (service role only; the table has RLS with no policies, so app users can't touch it).
  const SB = Deno.env.get("SUPABASE_URL"), SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cacheKey = `${query.toLowerCase().replace(/\s+/g, " ")}|${limit}`;
  const sbHeaders = SR ? { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" } : null;
  if (SB && sbHeaders) {
    try {
      const since = new Date(Date.now() - CACHE_DAYS * 864e5).toISOString();
      const c = await fetch(`${SB}/rest/v1/food_search_cache?select=results&query_key=eq.${encodeURIComponent(cacheKey)}&created_at=gt.${encodeURIComponent(since)}`, { headers: sbHeaders });
      const rows = c.ok ? await c.json() as { results: unknown }[] : [];
      if (rows.length) return json({ foods: rows[0].results, cached: true });
    } catch { /* cache miss on error */ }
  }

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&pageSize=${limit}&dataType=Foundation,SR%20Legacy,Branded`;
  const r = await fetch(url);
  if (!r.ok) return json({ error: `USDA search failed (${r.status})` }, 502);
  const j = await r.json() as { foods?: Record<string, unknown>[] };
  // Return only what the app uses.
  const foods = (j.foods || []).map(f => ({
    fdcId: f.fdcId, description: f.description, brandName: f.brandName, servingSize: f.servingSize, servingSizeUnit: f.servingSizeUnit,
    foodNutrients: ((f.foodNutrients as Record<string, unknown>[]) || [])
      .filter(n => ["203", "204", "205", "208"].includes(String(n.nutrientNumber)))
      .map(n => ({ nutrientNumber: n.nutrientNumber, nutrientName: n.nutrientName, value: n.value, unitName: n.unitName })),
  }));
  if (SB && sbHeaders) {
    try {
      await fetch(`${SB}/rest/v1/food_search_cache?on_conflict=query_key`, {
        method: "POST", headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ query_key: cacheKey, results: foods, created_at: new Date().toISOString() }),
      });
    } catch { /* caching is best-effort */ }
  }
  return json({ foods, cached: false });
});
