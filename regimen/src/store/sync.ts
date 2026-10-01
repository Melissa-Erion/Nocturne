/* Cloud sync. On sign-in, every table is read and folded into State (mapping.fromTables).
   After each change, State is re-flattened into rows and diffed against the last synced snapshot:
   only changed rows are upserted and only removed rows deleted. Pushes are serialised and retried. */
import { supabase } from '@/lib/supabase';
import type { State } from '@/domain/types';
import { TABLES, fromTables, type Row } from './mapping';

type Snapshot = Map<string, Map<string, string>>;
const PAGE = 1000;

const keyOf = (key: string[], r: Row) => key.map(k => String(r[k])).join('|');

// Tables added after launch: if one isn't in the database yet, load it as empty instead of failing sign-in.
const OPTIONAL = new Set(['custom_exercises']);

async function readAll(table: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!.from(table).select('*').range(from, from + PAGE - 1);
    if (error && OPTIONAL.has(table) && (error.code === 'PGRST205' || error.code === '42P01')) return [];
    if (error) throw error;
    out.push(...(data as Row[]));
    if (!data || data.length < PAGE) return out;
  }
}

function flatten(s: State): Map<string, Map<string, Row>> {
  const m = new Map<string, Map<string, Row>>();
  for (const t of TABLES) {
    const rows = new Map<string, Row>();
    for (const r of t.rows(s)) rows.set(keyOf(t.key, r), r);
    m.set(t.table, rows);
  }
  return m;
}

export class CloudSync {
  private snap: Snapshot = new Map();
  private running = false;
  private again = false;
  constructor(private userId: string, private onStatus: (st: 'saving' | 'saved' | 'error', msg?: string) => void) {}

  /** Load the user's data. Returns null for a brand-new account. */
  async load(today: string): Promise<State | null> {
    const t: Record<string, Row[]> = {};
    await Promise.all(TABLES.map(async d => { t[d.table] = await readAll(d.table); }));
    t.foods = t.foods.filter(f => f.user_id === this.userId);
    const s = fromTables(t, today);
    if (s) this.snap = new Map([...flatten(s)].map(([tb, rows]) => [tb, new Map([...rows].map(([k, r]) => [k, JSON.stringify(r)]))]));
    return s;
  }

  /** Forget the snapshot so the next push rewrites everything. */
  reset() { this.snap = new Map(); }

  /** Delete every row this user owns (children first), e.g. before restoring sample data. */
  async wipe() {
    for (const t of [...TABLES].reverse()) {
      const { error } = await supabase!.from(t.table).delete().eq('user_id', this.userId);
      if (error && OPTIONAL.has(t.table) && (error.code === 'PGRST205' || error.code === '42P01')) continue;
      if (error) throw new Error(`${t.table}: ${error.message}`);
    }
    this.snap = new Map();
  }

  async push(s: State) {
    if (this.running) { this.again = true; return; }
    this.running = true;
    try {
      do {
        this.again = false;
        await this.pushOnce(s);
      } while (this.again);
      this.onStatus('saved');
    } catch (e) {
      this.onStatus('error', e instanceof Error ? e.message : String((e as { message?: string })?.message || e));
    } finally { this.running = false; }
  }

  private async pushOnce(s: State) {
    const cur = flatten(s);
    const work: { table: string; up: Row[]; del: Row[]; key: string[]; next: Map<string, string> }[] = [];
    for (const t of TABLES) {
      const prev = this.snap.get(t.table) || new Map<string, string>();
      const rows = cur.get(t.table)!; const next = new Map<string, string>();
      const up: Row[] = []; const del: Row[] = [];
      rows.forEach((r, k) => { const j = JSON.stringify(r); next.set(k, j); if (prev.get(k) !== j) up.push(r); });
      prev.forEach((j, k) => { if (!rows.has(k)) del.push(JSON.parse(j)); });
      if (up.length || del.length) work.push({ table: t.table, up, del, key: t.key, next });
    }
    if (!work.length) return;
    this.onStatus('saving');
    const uid = this.userId;
    // upserts parents → children
    for (const w of work) {
      for (let i = 0; i < w.up.length; i += 500) {
        const chunk = w.up.slice(i, i + 500).map(r => ({ ...r, user_id: uid }));
        const onConflict = w.table === 'foods' ? 'id' : ['user_id', ...w.key].join(',');
        const { error } = await supabase!.from(w.table).upsert(chunk, { onConflict });
        if (error) throw new Error(`${w.table}: ${error.message}`);
      }
    }
    // deletes children → parents
    for (const w of [...work].reverse()) {
      if (!w.del.length || !w.key.length) continue;
      const col = w.key[0];
      const vals = w.del.map(r => r[col]);
      for (let i = 0; i < vals.length; i += 200) {
        const { error } = await supabase!.from(w.table).delete().eq('user_id', uid).in(col, vals.slice(i, i + 200) as string[]);
        if (error) throw new Error(`${w.table}: ${error.message}`);
      }
    }
    for (const w of work) this.snap.set(w.table, w.next);
  }
}
