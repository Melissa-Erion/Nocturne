// Deletes the signed-in user's account: progress photos in storage, then the auth user, which cascades to every
// table (all user data references auth.users on delete cascade). A running paid subscription must be cancelled
// first, so nobody keeps being billed for an account that no longer exists.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  // Who is asking? Ask Auth with the caller's own token (never trust an id from the body).
  const auth = req.headers.get("Authorization") || "";
  const me = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: SR, Authorization: auth } });
  if (!me.ok) return json({ error: "Please sign in again, then try deleting your account." }, 401);
  const uid = (await me.json() as { id?: string }).id;
  if (!uid) return json({ error: "Please sign in again, then try deleting your account." }, 401);

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  if (body.confirm !== "DELETE") return json({ error: "Type DELETE to confirm." }, 400);

  // Block while a paid subscription would keep renewing.
  const subR = await fetch(`${SB}/rest/v1/subscriptions?select=status,period_end,source&user_id=eq.${uid}`, { headers: admin });
  const sub = subR.ok ? (await subR.json() as { status: string; period_end: string | null; source: string | null }[])[0] : undefined;
  if (sub && (sub.status === "active" || sub.status === "trialing") && !/sandbox/.test(sub.source || "")) {
    return json({ error: "cancel_first" }, 409);
  }

  // Progress photos (private bucket, <uid>/...).
  const pr = await fetch(`${SB}/rest/v1/rpc/photo_paths_for_user`, { method: "POST", headers: admin, body: JSON.stringify({ uid }) });
  if (!pr.ok) { console.error("photo list failed", pr.status, await pr.text()); return json({ error: "Couldn't prepare the deletion, so nothing was removed. Please try again." }, 500); }
  const paths = (await pr.json() as { name: string }[]).map(r => r.name);
  for (let i = 0; i < paths.length; i += 500) {
    const d = await fetch(`${SB}/storage/v1/object/progress-photos`, { method: "DELETE", headers: admin, body: JSON.stringify({ prefixes: paths.slice(i, i + 500) }) });
    if (!d.ok) { console.error("photo delete failed", d.status, await d.text()); return json({ error: "Couldn't delete your photos, so your account was not deleted. Please try again." }, 500); }
  }

  // The account itself; every table cascades.
  const del = await fetch(`${SB}/auth/v1/admin/users/${uid}`, { method: "DELETE", headers: admin });
  if (!del.ok) { console.error("user delete failed", del.status, await del.text()); return json({ error: "Couldn't delete your account. Please try again or email support@regimenfit.ca." }, 500); }
  console.log("account deleted", uid, "photos", paths.length);
  return json({ ok: true, photos: paths.length });
});
