// Emails the owner when someone creates a Regimen account.
// Called by the auth.users insert trigger (migrations/20261121000000_signup_alert.sql) through pg_net.
// Configuration (none of it is in the code):
//  • RESEND_API_KEY — Edge Function secret. Without it nothing is sent.
//  • app_secrets 'signup_alert_to' — where alerts go. 'email_from' (optional) — verified Resend sender.
// Auth: POST must carry the 'lifecycle_cron_auth' secret (app_secrets). Body {"test": true} sends a test alert.
// Body {"grant": {"email": "…", "name": "…"}} emails that person that they've been given free lifetime access
// (sent after their subscriptions row is set to 'comp').
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}` };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function secret(name: string) {
  const r = await fetch(`${SB}/rest/v1/app_secrets?select=value&name=eq.${name}`, { headers: H });
  if (!r.ok) return null;
  const rows = await r.json() as { value: string }[];
  return rows[0]?.value || null;
}

Deno.serve(async req => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = await secret("lifecycle_cron_auth");
  if (!auth || req.headers.get("Authorization") !== `Bearer ${auth}`) return json({ error: "unauthorized" }, 401);
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ skipped: "RESEND_API_KEY is not set" });
  const from = (await secret("email_from")) || "Regimen <hello@regimenfit.ca>";
  const b = await req.json().catch(() => ({})) as { test?: boolean; email?: string; name?: string; provider?: string; created_at?: string; grant?: { email?: string; name?: string } };
  const send = async (to: string, subject: string, html: string, text: string) => {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    const out = await r.text();
    return json({ sent: r.ok, status: r.status, resend: out.slice(0, 300) }, r.ok ? 200 : 502);
  };

  if (b.grant) {
    const to = String(b.grant.email || "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "grant.email is required" }, 400);
    const first = String(b.grant.name || "").trim().split(/\s+/)[0];
    const hi = first ? `Hi ${first},` : "Hi,";
    const body = [
      "Good news: you've been given free lifetime access to Regimen Pro.",
      "Everything is unlocked: workout plans and scheduling, guided workouts, the full meal planner, meal prep, grocery lists and progress tracking. No trial, no card, and it never expires.",
      "Just sign in with this email address. If the app is already open, refresh the page.",
    ];
    const app = "https://regimenfit.ca/app/";
    const text = `${hi}\n\n${body.join("\n\n")}\n\nOpen Regimen: ${app}\n\nEnjoy,\nRegimen`;
    const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.55;color:#15161d;max-width:520px">` +
      `<p>${esc(hi)}</p>${body.map(x => `<p>${esc(x)}</p>`).join("")}` +
      `<p><a href="${app}" style="display:inline-block;background:#5b4fb3;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Open Regimen</a></p>` +
      `<p>Enjoy,<br>Regimen</p></div>`;
    return await send(to, "You've got free lifetime access to Regimen Pro", html, text);
  }

  const to = await secret("signup_alert_to");
  if (!to) return json({ skipped: "signup_alert_to is not set" });
  const email = b.test ? "test@example.com" : String(b.email || "unknown");
  const name = b.test ? "Test sign-up" : String(b.name || "");
  const provider = b.test ? "test" : String(b.provider || "email");
  const when = new Date(b.created_at || Date.now()).toLocaleString("en-CA", { timeZone: "America/Edmonton", dateStyle: "medium", timeStyle: "short" });
  const subject = b.test ? "Regimen sign-up alerts are working" : `New Regimen sign-up: ${name || email}`;
  const lines = [`Name: ${name || "—"}`, `Email: ${email}`, `Signed up with: ${provider}`, `When: ${when} (Edmonton)`];
  const text = (b.test ? "This is a test. You'll get an email like this each time someone creates a Regimen account.\n\n" : "") + lines.join("\n") +
    "\n\nSee all accounts: Supabase → Authentication → Users";
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#15161d">` +
    (b.test ? `<p>This is a test. You'll get an email like this each time someone creates a Regimen account.</p>` : "") +
    `<p>${lines.map(esc).join("<br>")}</p><p style="color:#75727f">See all accounts: Supabase → Authentication → Users</p></div>`;

  return await send(to, subject, html, text);
});
