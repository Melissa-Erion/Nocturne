// Live calendar feed: GET /functions/v1/calendar-feed?t=<token> returns the user's workouts as an iCalendar (.ics)
// subscription, so Google Calendar / Outlook / Apple Calendar stay in sync with the schedule.
// The token (public.calendar_feeds) is the only credential, so JWT checking is off. Calendar apps re-fetch on their own
// schedule (Google: every few hours). Without Regimen Pro access the feed is empty.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}` };
const APP_URL = "https://melissa-erion.github.io/Nocturne/";

async function q<T>(path: string): Promise<T[]> {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path.split("?")[0]} ${r.status}`);
  return await r.json() as T[];
}

// RFC 5545 text escaping and 75-octet line folding.
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string) {
  const out: string[] = []; let cur = ""; let bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > 74) { out.push(cur); cur = " "; bytes = 1; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n");
}
const ymd = (d: string) => d.replace(/-/g, "");
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const validTz = (tz: string) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } };

function ics(events: string[][], tz: string | null) {
  const head = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Regimen//Workouts//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Regimen workouts", "X-WR-CALDESC:Your Regimen training schedule",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
    ...(tz ? [`X-WR-TIMEZONE:${tz}`] : []),
  ];
  return [...head, ...events.flat(), "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}

const reply = (body: string, status = 200) => new Response(body, {
  status, headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store", "Content-Disposition": 'inline; filename="regimen.ics"' },
});

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Use GET", { status: 405 });
  const token = new URL(req.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response("Not found", { status: 404 });

  try {
    const feeds = await q<{ user_id: string; tz: string }>(`calendar_feeds?select=user_id,tz&token=eq.${token}`);
    if (!feeds.length) return new Response("Not found", { status: 404 });
    const { user_id: uid } = feeds[0];
    const tz = validTz(feeds[0].tz) ? feeds[0].tz : null;

    const subs = await q<{ status: string; period_end: string | null }>(`subscriptions?select=status,period_end&user_id=eq.${uid}`);
    const s = subs[0];
    const hasAccess = !!s && (s.status === "comp" || (s.status !== "expired" && !!s.period_end && Date.parse(s.period_end) > Date.now()));
    if (!hasAccess) return reply(ics([], tz));

    const today = new Date().toISOString().slice(0, 10);
    const from = addDays(today, -60);
    const [profiles, entries, workouts, items] = await Promise.all([
      q<{ workout_time: string | null; duration_min: number | null }>(`profiles?select=workout_time,duration_min&user_id=eq.${uid}`),
      q<{ id: string; date: string; plan_id: string; workout_code: string; status: string }>(
        `schedule_entries?select=id,date,plan_id,workout_code,status&user_id=eq.${uid}&date=gte.${from}&status=in.(planned,done)&order=date`),
      q<{ id: string; name: string; focus: string }>(`plan_workouts?select=id,name,focus&user_id=eq.${uid}`),
      q<{ workout_id: string; exercise_id: string; position: number; sets: number; rep_min: number; rep_max: number }>(
        `plan_items?select=workout_id,exercise_id,position,sets,rep_min,rep_max&user_id=eq.${uid}&order=position`),
    ]);
    const exIds = [...new Set(items.map(i => i.exercise_id))];
    const exercises = exIds.length ? await q<{ id: string; name: string }>(`exercises?select=id,name&id=in.(${exIds.map(encodeURIComponent).join(",")})`) : [];
    const exName = new Map(exercises.map(e => [e.id, e.name]));
    const wById = new Map(workouts.map(w => [w.id, w]));
    const itemsBy = new Map<string, typeof items>();
    for (const it of items) { const a = itemsBy.get(it.workout_id) || []; a.push(it); itemsBy.set(it.workout_id, a); }

    const P = profiles[0] || { workout_time: null, duration_min: null };
    const time = /^\d{1,2}:\d{2}$/.test(P.workout_time || "") ? P.workout_time!.padStart(5, "0").replace(":", "") + "00" : null;
    const mins = Math.max(15, Math.min(240, Number(P.duration_min) || 60));
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

    const events = entries.map(e => {
      const wid = `${e.plan_id}:${e.workout_code}`;
      const w = wById.get(wid);
      const name = w?.name || "Workout";
      const list = (itemsBy.get(wid) || []).map(i => `• ${exName.get(i.exercise_id) || i.exercise_id} — ${i.sets} × ${i.rep_min === i.rep_max ? i.rep_min : `${i.rep_min}–${i.rep_max}`}`);
      const desc = [...(w?.focus ? [w.focus] : []), ...list, "", `Open Regimen: ${APP_URL}`].join("\n");
      const when = time
        ? [tz ? `DTSTART;TZID=${tz}:${ymd(e.date)}T${time}` : `DTSTART:${ymd(e.date)}T${time}`, `DURATION:PT${mins}M`]
        : [`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(addDays(e.date, 1))}`];
      return [
        "BEGIN:VEVENT", `UID:${e.id}.${uid}@regimen`, `DTSTAMP:${stamp}`, ...when,
        `SUMMARY:${esc((e.status === "done" ? "✓ " : "") + name)}`, `DESCRIPTION:${esc(desc)}`, `URL:${APP_URL}`,
        "TRANSP:OPAQUE", "END:VEVENT",
      ];
    });
    return reply(ics(events, tz));
  } catch (err) {
    console.error("calendar-feed failed", err);
    return new Response("Calendar temporarily unavailable", { status: 503 });
  }
});
