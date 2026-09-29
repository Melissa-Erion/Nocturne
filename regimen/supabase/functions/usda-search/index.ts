// USDA FoodData Central search proxy. The API key stays on the server as the USDA_API_KEY secret
// (Supabase dashboard → Edge Functions → Secrets) and is never sent to the app.
// Only signed-in users may call it (the platform verifies the JWT; we also require role = authenticated).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
  return json({ foods });
});
