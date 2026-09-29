/* 15. Analytics — port of prototype/FitAnalytics.dc.html */
import { useState, type ReactNode } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { usePhoto, useRG } from '@/store/rg';
import { Btn, Card, CardTitle, Grid, H, Icon, LineChart, Muted, NotMedical, Row, Select, Seg, Stripes, T } from '@/ui/kit';
import { C } from '@/ui/theme';
import { Screen } from './Shell';

const MEAS = [['waist', 'Waist'], ['hips', 'Hips'], ['chest', 'Chest'], ['thighs', 'Thighs'], ['arms', 'Arms']] as const;
type MeasKey = typeof MEAS[number][0];

const Big = ({ children, unit, extra }: { children: ReactNode; unit?: string; extra?: string }) => (
  <T size={26} tab lh={1.2}>{children}{unit ? <T size={13} color={C.n500}> {unit}</T> : null}{extra ? <T size={13} color={C.a300}> {extra}</T> : null}</T>
);
const Hint = ({ children }: { children: ReactNode }) => <T size={13} color={C.n400} style={{ paddingVertical: 18 }}>{children}</T>;

export default function AnalyticsScreen() {
  const RG = useRG();
  const [roll, setRoll] = useState(7);
  const [meas, setMeas] = useState<MeasKey>('waist');
  const [exSel, setEx] = useState('squat');

  const S = RG.s, P = S.profile, T0 = RG.TODAY, wu = RG.wu(), lu = RG.lu(), K = RG.imp() ? 2.20462 : 1;
  const sgn = (v: number) => (v < 0 ? '−' : '+') + Math.abs(v * K).toFixed(1);
  const lastOf = <X,>(a: X[]) => a[a.length - 1];

  // body weight
  const ws = S.weights.map(w => w.kg); const hasW = ws.length >= 2;
  const av = RG.rolling(ws, roll).map(v => v ?? 0);
  const lo = Math.min(...ws) - 0.3, hi = Math.max(...ws) + 0.3;
  const days = hasW ? Math.max(7, RG.diff(S.weights[0].date, T0)) : 7;
  const tot = hasW ? lastOf(av) - av[Math.min(av.length - 1, roll - 1)] : 0;
  const rate = tot / (Math.max(1, days - roll + 1) / 7);
  const weeklyPct = hasW && lastOf(av) ? Math.abs(rate) / lastOf(av) * 100 : 0;

  // measurements
  const cis = S.checkins.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const mcis = cis.filter(c => c[meas] != null); const mv = mcis.map(c => c[meas] as number);

  // weekly completion & volume
  const mons: string[] = []; for (let i = 6; i >= 0; i--) mons.push(RG.monday(RG.add(T0, -7 * i)));
  const thisMon = RG.monday(T0);
  const weeks = mons.map(m => { const st = RG.weekStats(m); return { m, wk: RG.fmtShort(m), label: `${st.done}/${st.total}`, h: st.total ? st.done / Math.max(st.total, 4) * 100 : 0, done: st.done, total: st.total }; });
  const vols = mons.map(m => RG.sum(S.sessions.filter(s => s.date >= m && s.date <= RG.add(m, 6)).flatMap(s => s.sets.filter(x => !x.warm)).map(x => x.kg * x.reps)) * K);
  const vmax = Math.max(...vols, 1);

  // strength
  const ids = [...new Set(S.sessions.flatMap(s => s.sets.map(x => x.exId)))].filter(id => RG.history(id).length > 0);
  const exId = ids.includes(exSel) ? exSel : ids[0];
  const best = (sets: { kg: number; reps: number }[]) => Math.max(0, ...sets.map(x => RG.e1rm(x.kg, x.reps)));
  const h = exId ? RG.history(exId) : []; const e1 = h.map(s => best(s.sets));
  let prs = 0;
  ids.forEach(id => { let b = 0; RG.history(id).forEach((s, i) => { const v = best(s.sets); if (i > 0 && v > b + 0.01) prs++; b = Math.max(b, v); }); });

  // nutrition adherence (last 28 days)
  const log: { d: string; kcal: number; p: number; f: number }[] = [];
  for (let i = 28; i >= 1; i--) { const d = RG.add(T0, -i); const l = S.nutritionLog[d]; if (l) log.push({ d, kcal: l.kcal, p: l.p, f: l.f }); }
  const inK = log.filter(l => Math.abs(l.kcal - P.kcal) <= P.kcal * 0.1).length, inP = log.filter(l => l.p >= P.protein * 0.9).length, inF = log.filter(l => Math.abs(l.f - P.fat) <= P.fat * 0.15).length;
  const pct = (n: number) => log.length ? Math.round(n / log.length * 100) + '%' : '—';

  // meal prep
  const prepW = mons.slice(0, 6).map(m => { const sun = RG.add(m, -1); const l = S.nutritionLog[sun]; return { label: RG.fmtShort(sun), ok: !!(l && l.prepped) }; });
  const cnt = prepW.filter(p => p.ok).length;

  const WeekLabels = ({ items }: { items: string[] }) => (
    <View style={{ flexDirection: 'row', gap: 8 }}>{items.map((l, i) => <T key={i} size={10} color={C.n600} center numberOfLines={1} style={{ flex: 1 }}>{l}</T>)}</View>
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ marginRight: 'auto' }}>
          <Muted>Trends over the last 6 weeks · single days are noise</Muted>
          <H size={28} style={{ marginTop: 2 }}>Analytics</H>
        </View>
        <Seg value={roll} onChange={setRoll} options={[3, 7, 14].map(n => ({ value: n, label: n + '-day avg' }))} />
      </View>

      <Grid min={440} gap={16}>
        {/* body weight */}
        <Card gap={8}>
          <Row gap={8} wrap style={{ alignItems: 'baseline' }}><CardTitle style={{ flexGrow: 1 }}>Body-weight trend</CardTitle><Muted>{roll}-day rolling average</Muted></Row>
          {hasW ? (
            <>
              <Row gap={18} wrap align="flex-start">
                <View><Big unit={wu}>{RG.bw(lastOf(av))}</Big><Muted size={11}>Trend now</Muted></View>
                <View><Big>{sgn(rate)}</Big><Muted size={11}>{wu} per week, avg</Muted></View>
                <View><Big>{sgn(tot) + ' ' + wu}</Big><Muted size={11}>since start</Muted></View>
              </Row>
              <LineChart w={600} h={160} height={170} series={[{ points: RG.pts(ws, 600, 160, lo, hi), color: C.n700, width: 1 }, { points: RG.pts(av, 600, 160, lo, hi), color: C.accent, width: 2.4 }]} />
              <Muted>{`Trend is changing about ${weeklyPct.toFixed(2)}% of body weight per week. ${weeklyPct > 1 ? 'Faster than 1% a week is aggressive; consider raising calories slightly. This is not medical advice.' : 'That is a sustainable pace for most people.'} Daily readings (grey) include water and food; judge progress by the line.`}</Muted>
              {weeklyPct > 1 && <Row gap={6}><Icon name="warning" size={14} color={C.a300} /><T size={12} color={C.a300}>More than 1% of body weight per week</T></Row>}
              <NotMedical text={RG.NOT_MEDICAL} />
            </>
          ) : <Hint>Log at least two weigh-ins to see your rolling average and weekly rate. Use “Log weight” on the dashboard.</Hint>}
        </Card>

        {/* measurements */}
        <Card gap={8}>
          <Row gap={8} wrap style={{ alignItems: 'baseline' }}>
            <CardTitle style={{ flexGrow: 1 }}>Body measurements</CardTitle>
            <Seg value={meas} onChange={setMeas} options={MEAS.map(([k, l]) => ({ value: k, label: l }))} style={{ flexShrink: 1 }} />
          </Row>
          {mv.length ? (
            <>
              <Big unit={lu} extra={mv.length > 1 ? `${lastOf(mv) - mv[0] < 0 ? '−' : '+'}${RG.len(Math.abs(lastOf(mv) - mv[0]))} ${lu} since ${RG.fmtShort(mcis[0].date)}` : ''}>{RG.len(lastOf(mv))}</Big>
              {mv.length > 1
                ? <LineChart w={600} h={140} height={150} series={[{ points: RG.pts(mv, 600, 140, Math.min(...mv) - 0.5, Math.max(...mv) + 0.5), color: C.accent, width: 2.2 }]} />
                : <Hint>One more check-in with this measurement draws the trend line.</Hint>}
              <Row style={{ justifyContent: 'space-between' }}>{mcis.map(c => <T key={c.id} size={11} color={C.n600} numberOfLines={1}>{RG.fmtShort(c.date)}</T>)}</Row>
            </>
          ) : <Hint>No {MEAS.find(m => m[0] === meas)?.[1].toLowerCase()} measurements yet. Add them in a progress check-in.</Hint>}
          {!cis.length && <Row><Btn variant="ghost" size="sm" title="Open check-ins" onPress={() => RG.go('checkins')} /></Row>}
        </Card>

        {/* completion */}
        <Card gap={10}>
          <Row gap={8} wrap style={{ alignItems: 'baseline' }}>
            <CardTitle style={{ flexGrow: 1 }}>Workout completion &amp; frequency</CardTitle>
            <Muted>{`${RG.sum(weeks.map(w => w.done))} of ${RG.sum(weeks.map(w => w.total))} sessions · avg ${(RG.sum(weeks.slice(0, 6).map(w => w.done)) / 6).toFixed(1)}/week`}</Muted>
          </Row>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 140 }}>
            {weeks.map(w => (
              <View key={w.m} accessibilityLabel={`Week of ${w.wk}: ${w.done} of ${w.total} sessions`} style={{ flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end', height: '100%' }}>
                <T size={11} color={C.n400} tab>{w.label}</T>
                <View style={{ width: '100%', maxWidth: 44, height: 100, borderRadius: 5, backgroundColor: C.n900, overflow: 'hidden', justifyContent: 'flex-end' }}>
                  <View style={{ width: '100%', height: `${w.h}%`, borderRadius: 5, backgroundColor: w.m === thisMon ? C.a700 : C.accent }} />
                </View>
              </View>
            ))}
          </View>
          <WeekLabels items={weeks.map(w => w.wk)} />
        </Card>

        {/* volume */}
        <Card gap={10}>
          <Row gap={8} wrap style={{ alignItems: 'baseline' }}><CardTitle style={{ flexGrow: 1 }}>Training volume</CardTitle><Muted>working sets × reps × load, {wu}</Muted></Row>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 140 }}>
            {mons.map((m, i) => (
              <View key={m} accessibilityLabel={`Week of ${RG.fmtShort(m)}: ${RG.num(Math.round(vols[i]))} ${wu}`} style={{ flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end', height: '100%' }}>
                <T size={10} color={C.n400} tab>{vols[i] ? (vols[i] / 1000).toFixed(1) + 'k' : '—'}</T>
                <View style={{ width: '100%', maxWidth: 44, height: Math.max(2, vols[i] / vmax * 100), borderRadius: 5, backgroundColor: m === thisMon ? C.a700 : C.n500 }} />
              </View>
            ))}
          </View>
          <WeekLabels items={mons.map(m => RG.fmtShort(m))} />
          {!S.sessions.length && <Muted>No workouts logged yet — volume appears after your first session.</Muted>}
        </Card>

        {/* strength */}
        <Card gap={8}>
          <Row gap={8} wrap>
            <CardTitle style={{ flexGrow: 1 }}>Exercise strength</CardTitle>
            {ids.length > 0 && <Select title="Exercise" value={exId} onChange={setEx} style={{ width: 'auto', minWidth: 180 }}
              options={ids.map(id => ({ value: id, label: RG.ex(id)?.name || id })).sort((a, b) => a.label < b.label ? -1 : 1)} />}
          </Row>
          {e1.length ? (
            <>
              <Big unit={`${wu} est. 1RM`} extra={e1.length > 1 ? `${sgn(lastOf(e1) - e1[0])} since ${RG.fmtShort(h[0].date)}` : ''}>{RG.w(lastOf(e1))}</Big>
              {e1.length > 1
                ? <LineChart w={600} h={140} height={150} series={[{ points: RG.pts(e1, 600, 140, Math.min(...e1) * 0.97, Math.max(...e1) * 1.02), color: C.accent, width: 2.2 }]} />
                : <Hint>Log this exercise again to see its trend.</Hint>}
              <Muted>{prs} personal records across all exercises in this period.</Muted>
              <NotMedical text="Estimated 1RM uses the Epley formula from your logged sets — an estimate, not a tested max. Not medical advice." />
            </>
          ) : <Hint>No working sets logged yet. Estimated one-rep maxes appear here after your first workout.</Hint>}
        </Card>

        {/* adherence */}
        <Card gap={10}>
          <Row gap={8} wrap style={{ alignItems: 'baseline' }}><CardTitle style={{ flexGrow: 1 }}>Calorie &amp; macro adherence</CardTitle><Muted>logged vs target, last 28 days</Muted></Row>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[[pct(inK), 'Days within ±10% kcal'], [pct(inP), 'Days ≥90% protein'], [pct(inF), 'Days within ±15% fat']].map(([v, l]) => (
              <View key={l} style={{ flex: 1, minWidth: 0 }}><Big>{v}</Big><Muted size={11}>{l}</Muted></View>
            ))}
          </View>
          {log.length ? (
            <>
              <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', height: 90 }}>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 45, height: 1, backgroundColor: C.n700 }} />
                {Array.from({ length: 28 }, (_, i) => {
                  const l = log[i]; if (!l) return <View key={i} style={{ flex: 1 }} />;
                  const d = P.kcal ? (l.kcal - P.kcal) / P.kcal : 0; const ok = Math.abs(d) <= 0.1; const hgt = Math.min(45, Math.abs(d) * 150);
                  return <View key={i} accessibilityLabel={`${RG.fmtD(l.d)} · ${RG.num(l.kcal)} kcal`}
                    style={{ flex: 1, height: Math.max(2, hgt), transform: [{ translateY: d > 0 ? -hgt / 2 : hgt / 2 }], borderRadius: 2, backgroundColor: ok ? C.accent : 'transparent', boxShadow: ok ? undefined : `inset 0 0 0 1px ${C.n500}` }} />;
                })}
              </View>
              <Muted>Line = daily target. Filled bars are within ±10% of target.</Muted>
            </>
          ) : <Hint>No logged days in the last 28 days. Log meals on the Nutrition Dashboard to track adherence.</Hint>}
        </Card>

        {/* meal prep */}
        <Card gap={10}>
          <CardTitle>Meal-prep consistency</CardTitle>
          <Row gap={8} wrap>
            {prepW.map(p => (
              <View key={p.label} style={{ alignItems: 'center', gap: 4 }} accessibilityLabel={`${p.label}: ${p.ok ? 'prepped' : 'not prepped'}`}>
                <Icon name={p.ok ? 'check-circle' : 'circle-dashed'} fill={p.ok} size={22} color={p.ok ? C.accent : C.n600} />
                <Muted size={11}>{p.label}</Muted>
              </View>
            ))}
          </Row>
          <T size={13} color={C.n300}>{`Prepped ${cnt} of the last ${prepW.length} Sundays.`}</T>
        </Card>

        {/* photo timeline */}
        <Card gap={10}>
          <Row style={{ alignItems: 'baseline' }}><CardTitle style={{ flex: 1 }}>Progress-photo timeline</CardTitle><Btn variant="ghost" size="sm" title="Open photos" onPress={() => RG.go('photos')} /></Row>
          {cis.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {cis.map(c => <PhotoThumb key={c.id} k={c.id + ':front'} date={RG.fmtShort(c.date)} />)}
            </ScrollView>
          ) : <Hint>No check-ins yet. Front photos from each check-in line up here.</Hint>}
        </Card>
      </Grid>
    </Screen>
  );
}

function PhotoThumb({ k, date }: { k: string; date: string }) {
  const src = usePhoto(k);
  return (
    <View style={{ width: 70, gap: 4 }}>
      <Stripes style={{ aspectRatio: 3 / 4, borderRadius: 6 }}>
        {src && <Image source={{ uri: src }} accessibilityLabel={date} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />}
      </Stripes>
      <Muted size={11}>{date}</Muted>
    </View>
  );
}
