// RevenueCat webhook → public.subscriptions. RevenueCat calls this on every purchase, renewal, cancellation and expiry.
// The app user id is the Supabase user id (the web app configures RevenueCat with it).
// Security: RevenueCat sends the Authorization value set in its webhook settings; it must match the
// 'revenuecat_webhook_auth' row in public.app_secrets (readable only by the service role). JWT checking is off
// because RevenueCat doesn't have a Supabase token.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let authCache: { value: string; at: number } | null = null;
async function expectedAuth(): Promise<string | null> {
  if (authCache && Date.now() - authCache.at < 5 * 60e3) return authCache.value;
  const r = await fetch(`${SB}/rest/v1/app_secrets?select=value&name=eq.revenuecat_webhook_auth`, { headers: H });
  const rows = r.ok ? await r.json() as { value: string }[] : [];
  if (!rows.length) return null;
  authCache = { value: rows[0].value, at: Date.now() };
  return rows[0].value;
}

function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

type Ev = {
  type: string; app_user_id?: string; original_app_user_id?: string; aliases?: string[];
  transferred_to?: string[]; transferred_from?: string[];
  product_id?: string; new_product_id?: string; period_type?: string; expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null; store?: string; environment?: string;
};

const userIds = (e: Ev) => [...new Set([e.app_user_id, e.original_app_user_id, ...(e.aliases || [])].filter((x): x is string => !!x && UUID.test(x)))];

async function current(uid: string) {
  const r = await fetch(`${SB}/rest/v1/subscriptions?select=status&user_id=eq.${uid}`, { headers: H });
  const rows = r.ok ? await r.json() as { status: string }[] : [];
  return rows[0]?.status ?? null;
}

async function write(uid: string, row: Record<string, unknown>) {
  if (await current(uid) === "comp") return; // complimentary access is never overwritten
  // Only real users: the foreign key rejects unknown ids.
  const r = await fetch(`${SB}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: uid, ...row, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) console.error("subscriptions upsert failed", uid, r.status, await r.text());
}

const planOf = (p?: string) => (!p ? null : /year|annual/i.test(p) ? "yearly" : "monthly");
const iso = (ms?: number | null) => (ms ? new Date(ms).toISOString() : null);
const source = (e: Ev) => {
  const s = (e.store || "").toUpperCase();
  const base = s === "APP_STORE" || s === "MAC_APP_STORE" ? "app_store" : s === "PLAY_STORE" ? "play_store" : "stripe";
  return e.environment === "SANDBOX" ? `${base}_sandbox` : base;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  const want = await expectedAuth();
  const got = req.headers.get("Authorization") || "";
  if (!want || !(safeEqual(got, want) || safeEqual(got, `Bearer ${want}`))) return json({ error: "Unauthorized" }, 401);

  let e: Ev;
  try { e = (await req.json()).event; if (!e?.type) throw 0; } catch { return json({ error: "Invalid body" }, 400); }

  const end = iso(e.expiration_at_ms);
  const plan = planOf(e.new_product_id || e.product_id);
  switch (e.type) {
    case "TEST":
      return json({ ok: true, test: true });
    case "INITIAL_PURCHASE": case "RENEWAL": case "UNCANCELLATION": case "PRODUCT_CHANGE":
    case "SUBSCRIPTION_EXTENDED": case "TEMPORARY_ENTITLEMENT_GRANT": case "REFUND_REVERSED":
      for (const uid of userIds(e)) await write(uid, { status: e.period_type === "TRIAL" ? "trialing" : "active", plan, period_end: end, source: source(e) });
      break;
    case "CANCELLATION":
      // Auto-renew turned off (or refunded): access continues until period_end, then EXPIRATION arrives.
      for (const uid of userIds(e)) await write(uid, { status: "canceled", plan, period_end: end, source: source(e) });
      break;
    case "BILLING_ISSUE":
      // Keep access through the grace period while the card is retried.
      if (e.grace_period_expiration_at_ms) for (const uid of userIds(e)) await write(uid, { period_end: iso(e.grace_period_expiration_at_ms) });
      break;
    case "EXPIRATION":
      for (const uid of userIds(e)) await write(uid, { status: "expired", period_end: end, source: source(e) });
      break;
    case "TRANSFER":
      for (const uid of (e.transferred_from || []).filter(x => UUID.test(x))) await write(uid, { status: "expired", period_end: new Date().toISOString() });
      // The receiving user gets their state from the next event / the app's own RevenueCat check.
      break;
    default:
      break; // other events (e.g. NON_RENEWING_PURCHASE, SUBSCRIPTION_PAUSED) don't change access here
  }
  return json({ ok: true });
});
