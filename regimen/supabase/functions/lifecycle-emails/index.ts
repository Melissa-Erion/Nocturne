// Lifecycle emails, sent once a day by pg_cron (see migrations/20261120030000_lifecycle_emails_cron.sql):
//  • trial_ending — 1–3 days before a free trial ends: what they did this week, the price that starts, how to cancel.
//    About their own subscription, so it's a transactional email (no marketing consent needed).
//  • come_back — about a week after access expired. This is marketing under Canada's anti-spam law (CASL), so it
//    is only sent when a mailing address is configured, includes an unsubscribe link, and skips unsubscribed users.
// Configuration (none of it is in the code):
//  • RESEND_API_KEY — Edge Function secret (Supabase dashboard → Edge Functions → Secrets). Without it nothing is sent.
//  • app_secrets 'email_from' (optional, default "Regimen <hello@regimenfit.ca>"; must be a verified Resend sender).
//  • app_secrets 'email_mailing_address' — business mailing address for the come-back email's footer (CASL).
// Auth: POST must carry the 'lifecycle_cron_auth' secret (app_secrets). GET ?unsub=<token> handles unsubscribe links.
// JWT checking is off because neither the scheduler nor an email link has a Supabase token.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const APP = "https://regimenfit.ca/app/";
const FN_URL = `${SB}/functions/v1/lifecycle-emails`;
const PRICE: Record<string, string> = { monthly: "CA$24.99 a month", yearly: "CA$179.99 a year" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path.split("?")[0]} ${r.status} ${await r.text()}`);
  const t = await r.text(); return (t ? JSON.parse(t) : null) as T;
}
async function secret(name: string) {
  const rows = await rest<{ value: string }[]>(`app_secrets?select=value&name=eq.${name}`);
  return rows[0]?.value || null;
}
function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
/** HTML line → plain text for the text/plain part. */
const plain = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const day = (d: Date) => d.toISOString().slice(0, 10);
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Toronto" });

async function emailOf(uid: string): Promise<string | null> {
  const r = await fetch(`${SB}/auth/v1/admin/users/${uid}`, { headers: H });
  if (!r.ok) return null;
  const u = await r.json() as { email?: string };
  return u.email || null;
}
async function alreadySent(uid: string, kind: string, ref: string) {
  const rows = await rest<unknown[]>(`email_log?select=kind&user_id=eq.${uid}&kind=eq.${kind}&ref=eq.${encodeURIComponent(ref)}`);
  return rows.length > 0;
}
async function markSent(uid: string, kind: string, ref: string) {
  await rest(`email_log?on_conflict=user_id,kind,ref`, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ user_id: uid, kind, ref }) });
}
async function prefs(uid: string): Promise<{ token: string; unsubscribed: boolean }> {
  const rows = await rest<{ token: string; unsubscribed: boolean }[]>(`email_prefs?select=token,unsubscribed&user_id=eq.${uid}`);
  if (rows[0]) return rows[0];
  const made = await rest<{ token: string; unsubscribed: boolean }[]>(`email_prefs?select=token,unsubscribed`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: uid }) });
  return made[0];
}

function layout(title: string, bodyHtml: string, footerHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3efe7;font-family:Helvetica,Arial,sans-serif;color:#0e0f16">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<div style="font-weight:800;font-size:18px;margin-bottom:24px"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#5b4fb3;margin-right:8px"></span>Regimen</div>
<h1 style="font-size:26px;line-height:1.2;margin:0 0 16px">${title}</h1>
${bodyHtml}
<p style="margin:28px 0"><a href="${APP}" style="background:#5b4fb3;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Open Regimen</a></p>
<p style="font-size:12px;color:#625f6e;line-height:1.5;margin-top:32px">${footerHtml}</p>
</div></body></html>`;
}

async function send(key: string, from: string, to: string, subject: string, html: string, text: string, extraHeaders: Record<string, string> = {}) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text, headers: extraHeaders }),
  });
  if (!r.ok) throw new Error(`resend ${r.status} ${await r.text()}`);
}

async function run() {
  const key = Deno.env.get("RESEND_API_KEY") || await secret("resend_api_key");
  if (!key) return { skipped: "RESEND_API_KEY is not set" };
  const from = (await secret("email_from")) || "Regimen <hello@regimenfit.ca>";
  const address = await secret("email_mailing_address");
  const now = Date.now();
  const out = { trial_ending: 0, come_back: 0, errors: 0 };

  // ── trial ending in 1–3 days ──
  const lo = new Date(now + 24 * 3600e3).toISOString(), hi = new Date(now + 72 * 3600e3).toISOString();
  const trials = await rest<{ user_id: string; plan: string | null; period_end: string }[]>(
    `subscriptions?select=user_id,plan,period_end&status=eq.trialing&period_end=gte.${lo}&period_end=lte.${hi}`);
  for (const t of trials) {
    try {
      const ref = t.period_end.slice(0, 10);
      if (await alreadySent(t.user_id, "trial_ending", ref)) continue;
      const to = await emailOf(t.user_id); if (!to) continue;
      const since = day(new Date(Date.parse(t.period_end) - 7 * 864e5));
      const [prof, sessions, meals, weights] = await Promise.all([
        rest<{ name: string | null }[]>(`profiles?select=name&user_id=eq.${t.user_id}`),
        rest<unknown[]>(`sessions?select=id&user_id=eq.${t.user_id}&date=gte.${since}`),
        rest<unknown[]>(`day_meals?select=id&user_id=eq.${t.user_id}&logged=eq.true&date=gte.${since}`),
        rest<unknown[]>(`weights?select=date&user_id=eq.${t.user_id}&date=gte.${since}`),
      ]);
      const name = esc((prof[0]?.name || "").trim());
      const ends = longDate(t.period_end); const price = t.plan ? PRICE[t.plan] : null;
      const did = [sessions.length && `${sessions.length} workout${sessions.length > 1 ? "s" : ""} logged`, meals.length && `${meals.length} meal${meals.length > 1 ? "s" : ""} eaten on plan`, weights.length && `${weights.length} weigh-in${weights.length > 1 ? "s" : ""}`].filter(Boolean) as string[];
      const subject = `Your Regimen free trial ends ${ends}`;
      const lines = [
        `${name ? `Hi ${name}, y` : "Y"}our free trial ends on <b>${esc(ends)}</b>.`,
        did.length ? `This week you've had ${did.map(esc).join(", ")}. Nice work.` : "There's still time to try a full workout and plan a day of meals before it ends.",
        price ? `After the trial, your plan (${esc(price)}, Canadian dollars plus any sales tax) starts automatically, so there's nothing you need to do to keep going.`
              : "After the trial, your subscription starts automatically, so there's nothing you need to do to keep going.",
        `Not for you? Cancel before ${esc(ends)} and you won't be charged: in Regimen, open <b>Me › Account › Manage or cancel subscription</b>. Your data is kept either way.`,
      ];
      const html = layout("Your free trial ends soon", lines.map(l => `<p style="font-size:16px;line-height:1.55;margin:0 0 14px">${l}</p>`).join(""),
        `You're receiving this because you started a Regimen free trial. Regimen · regimenfit.ca`);
      const text = lines.map(plain).join("\n\n") + `\n\nOpen Regimen: ${APP}`;
      await send(key, from, to, subject, html, text);
      await markSent(t.user_id, "trial_ending", ref); out.trial_ending++;
    } catch (e) { out.errors++; console.error("trial_ending", t.user_id, e); }
  }

  // ── come back: about a week after access expired (marketing: needs an address and an unsubscribe link) ──
  if (address) {
    const a = new Date(now - 8 * 864e5).toISOString(), b = new Date(now - 6 * 864e5).toISOString();
    const lapsed = await rest<{ user_id: string; period_end: string }[]>(`subscriptions?select=user_id,period_end&status=eq.expired&period_end=gte.${a}&period_end=lte.${b}`);
    for (const l of lapsed) {
      try {
        const ref = l.period_end.slice(0, 10);
        if (await alreadySent(l.user_id, "come_back", ref)) continue;
        const p = await prefs(l.user_id); if (p.unsubscribed) continue;
        const to = await emailOf(l.user_id); if (!to) continue;
        const prof = await rest<{ name: string | null }[]>(`profiles?select=name&user_id=eq.${l.user_id}`);
        const name = esc((prof[0]?.name || "").trim());
        const unsub = `${FN_URL}?unsub=${p.token}`;
        const lines = [
          `${name ? `Hi ${name}, y` : "Y"}our workouts, meals and progress are all still saved in Regimen, right where you left them.`,
          "If life got busy, that's normal. Pick up with today's workout and your meals portioned to the gram, and the schedule rebuilds itself around the days you can train.",
          "Today and today's meals are free to use any time. Start a new trial whenever you're ready for the rest.",
        ];
        const html = layout("Your plan is still here", lines.map(x => `<p style="font-size:16px;line-height:1.55;margin:0 0 14px">${x}</p>`).join(""),
          `You're receiving this because you had a Regimen subscription. Regimen · ${esc(address)} · <a href="${unsub}" style="color:#625f6e">Unsubscribe</a>`);
        const text = lines.map(plain).join("\n\n") + `\n\nOpen Regimen: ${APP}\n\nRegimen · ${address}\nUnsubscribe: ${unsub}`;
        await send(key, from, to, "Your Regimen plan is still here", html, text, { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
        await markSent(l.user_id, "come_back", ref); out.come_back++;
      } catch (e) { out.errors++; console.error("come_back", l.user_id, e); }
    }
  }
  return out;
}

async function unsubscribe(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return false;
  const rows = await rest<unknown[]>(`email_prefs?token=eq.${token}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ unsubscribed: true, updated_at: new Date().toISOString() }) });
  return rows.length > 0;
}
const page = (msg: string, extra = "") => new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Regimen</title>
<body style="font-family:Helvetica,Arial,sans-serif;background:#f3efe7;color:#0e0f16;padding:48px 24px;text-align:center"><h1 style="font-size:22px">${msg}</h1>${extra}
<p><a href="${APP}" style="color:#5b4fb3">Back to Regimen</a></p></body>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const unsub = url.searchParams.get("unsub");
  if (unsub) {
    // GET (the email link) only shows a confirm button: mail scanners open links automatically and must not unsubscribe
    // anyone. POST (that button, or a mail app's one-click unsubscribe, RFC 8058) does it.
    if (req.method === "GET") {
      return page("Unsubscribe from Regimen emails?", `<form method="post"><button style="background:#5b4fb3;color:#fff;border:0;padding:12px 20px;border-radius:10px;font-size:16px">Unsubscribe</button></form>`);
    }
    try { return (await unsubscribe(unsub)) ? page("You're unsubscribed. We won't send you these emails again.") : page("This unsubscribe link isn't valid."); }
    catch (e) { console.error("unsubscribe", e); return page("Something went wrong. Please try again later."); }
  }
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  const want = await secret("lifecycle_cron_auth");
  const got = req.headers.get("Authorization") || "";
  if (!want || !safeEqual(got, `Bearer ${want}`)) return json({ error: "Unauthorized" }, 401);
  try { return json(await run()); } catch (e) { console.error("lifecycle-emails failed", e); return json({ error: "failed" }, 500); }
});
