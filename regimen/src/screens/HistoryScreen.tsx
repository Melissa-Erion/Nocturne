/* 5. Exercise History — port of prototype/FitHistory.dc.html */
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRG } from '@/store/rg';
import { Btn, Card, ConfirmDelete, Empty, H, Input, Kicker, LineChart, Muted, NotMedical, PageHeader, Row, Spacer, T, Tap } from '@/ui/kit';
import { alpha, C } from '@/ui/theme';
import { FillGrid, Table } from './history/Table';
import { Screen } from './Shell';

export default function HistoryScreen() {
  const RG = useRG();
  const rp = RG.routeParam;
  // the picked exercise belongs to the route param it was picked under, so a new param (from Records, or a finished workout) wins
  const [pick, setPick] = useState<{ rp: unknown; ex: string } | null>(null);
  const exSel = pick && pick.rp === rp ? pick.ex : null;
  const setEx = (ex: string) => setPick({ rp, ex });
  const [q, setQ] = useState('');
  const [dlg, setDlg] = useState(false);
  const [w, setW] = useState(0);

  const S = RG.s, wu = RG.wu(), volK = RG.imp() ? 2.20462 : 1;
  const counts: Record<string, number> = {};
  S.sessions.forEach(s => new Set(s.sets.filter(x => !x.warm).map(x => x.exId)).forEach(id => { counts[id] = (counts[id] || 0) + 1; }));
  const exParam = typeof rp === 'string' && rp.startsWith('ex:') ? rp.slice(3) : null;
  const ses = typeof rp === 'string' && !exParam ? S.sessions.find(s => s.id === rp) : undefined;
  const exId: string | undefined = exSel || exParam || (ses && ses.sets[0]?.exId) || Object.keys(counts)[0];
  const ql = q.toLowerCase();
  const exList = Object.values(RG.EX).filter(e => counts[e.id] || e.id === exId).filter(e => !ql || e.name.toLowerCase().includes(ql))
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || (a.name < b.name ? -1 : 1));

  const h = exId ? RG.history(exId) : []; const ex = exId ? RG.ex(exId) : undefined;
  const e1 = h.map(s => Math.max(...s.sets.map(x => RG.e1rm(x.kg, x.reps)))); const wk = h.map(s => s.sets[0].kg);
  const lo = h.length ? Math.min(...wk, ...e1) * 0.95 : 0, hi = h.length ? Math.max(...wk, ...e1) * 1.03 : 1;
  const rec = exId ? RG.recommend(exId) : null;
  const byWorkout = (id: string) => { const ww = RG.workout(id); return ww ? ww.name : id; };
  const recText = rec ? (rec.kg != null ? `${RG.w(rec.kg)} ${wu} × ${rec.reps.join(', ')} — ${rec.reason}` : rec.reason) : 'Not in the active plan — no target set.';

  const sName = ses ? byWorkout(ses.workoutId) : '', sDate = ses ? RG.fmtD(ses.date) : '';
  const sWork = ses ? ses.sets.filter(x => !x.warm) : [];
  const sMeta = ses ? `${ses.durationMin} min · ${sWork.length} working sets · volume ${RG.num(volK * RG.sum(sWork.map(x => x.kg * x.reps)))} ${wu}${ses.notes ? ' · ' + ses.notes : ''}` : '';
  const sExercises = ses ? [...new Set(ses.sets.map(x => x.exId))].map(id => ({
    id, name: (RG.ex(id)?.name || id) + (ses.sets.find(x => x.exId === id && x.sub) ? ' (substitute)' : ''),
    sets: ses.sets.filter(x => x.exId === id).map(x => `${x.warm ? 'W ' : ''}${RG.w(x.kg)}×${x.reps}`).join(' · '),
  })) : [];

  const doDelete = () => {
    if (!ses) return;
    RG.update(s => {
      s.sessions = s.sessions.filter(x => x.id !== ses.id);
      const en = s.schedule.find(e => e.sessionId === ses.id);
      if (en) { en.status = en.date < RG.TODAY ? 'missed' : 'planned'; en.sessionId = null; }
    });
    RG.go('history'); RG.toast('Session deleted.');
  };

  const side = w >= 260 * 3 + 16 * 2; // grid auto-fit minmax(260px) with the chart column spanning 2 tracks

  const list = (
    <Card gap={6} pad={[12, 12]} style={[{ maxHeight: side ? 640 : 380 }, side && { flex: 1 }]}>
      <Input value={q} onChange={setQ} placeholder="Search exercises" height={38} />
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 6 }} nestedScrollEnabled>
        {exList.map(e => {
          const on = e.id === exId;
          return (
            <Tap key={e.id} onPress={() => setEx(e.id)} label={e.name}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, minHeight: 36, borderRadius: 6, backgroundColor: on ? alpha(C.accent, 0.12) : 'transparent' }}>
              <T size={13} color={on ? C.text : C.n400} style={{ flex: 1 }}>{e.name}</T>
              <T size={11} color={C.n500}>{counts[e.id] ? counts[e.id] + '×' : ''}</T>
            </Tap>
          );
        })}
        {!exList.length && <Muted size={13} style={{ padding: 8 }}>{q ? 'No exercises match.' : 'Log a workout to build your history.'}</Muted>}
      </ScrollView>
    </Card>
  );

  const detail = (
    <View style={[{ gap: 16, minWidth: 0 }, side && { flex: 2 }]}>
      <Card gap={10}>
        {ex ? (
          <>
            <Row gap={10} wrap style={{ alignItems: 'baseline' }}>
              <H size={22}>{ex.name}</H>
              <T size={13} color={C.n500}>{`${ex.muscle} · ${ex.equip} · ${h.length} sessions`}</T>
            </Row>
            <Row gap={18} wrap>
              <Row gap={6}><View style={{ width: 12, height: 2, backgroundColor: C.accent }} /><T size={12} color={C.n400}>Estimated 1RM</T></Row>
              <Row gap={6}><View style={{ width: 12, height: 2, backgroundColor: C.n500 }} /><T size={12} color={C.n400}>Working weight</T></Row>
            </Row>
            {h.length > 1 ? (
              <LineChart w={600} h={140} height={160} series={[
                { points: RG.pts(wk, 600, 140, lo, hi), color: C.n500, width: 1.5 },
                { points: RG.pts(e1, 600, 140, lo, hi), color: C.accent, width: 2.2 },
              ]} />
            ) : (
              <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
                <Muted size={13}>{h.length ? 'One session so far — the trend appears after the next one.' : 'No sessions logged for this exercise yet.'}</Muted>
              </View>
            )}
            <Row><T size={11} color={C.n600}>{h[0] ? RG.fmtShort(h[0].date) : ''}</T><Spacer /><T size={11} color={C.n600}>{h.length ? RG.fmtShort(h[h.length - 1].date) : ''}</T></Row>
            <View style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: C.a900 }}>
              <T size={13} color={C.n300}><T size={13} color={C.a300}>Next session · </T>{recText}</T>
            </View>
            <NotMedical text="Estimates only (e1RM uses the Epley formula) — not medical advice." />
          </>
        ) : (
          <Empty icon="clock-counter-clockwise" title="No exercise history yet" body="Finish a workout and every logged set appears here with its trend and next-session target."
            action={<Btn variant="primary" icon="barbell" title="Go to Active Workout" onPress={() => RG.go('workout')} />} />
        )}
      </Card>
      {ex && (
        <Card gap={6} pad={[12, 18]}>
          <Table minWidth={520} cols={[{ label: 'Date', width: 110 }, { label: 'Workout', flex: 1.1 }, { label: `Sets (${wu} × reps @ RIR)`, flex: 2.2 }, { label: 'Volume', width: 84 }, { label: 'e1RM', width: 64 }]}
            rows={h.slice().reverse().map(s => ({
              key: s.sessionId,
              label: RG.fmtD(s.date),
              onPress: () => { RG.go('history', s.sessionId); if (exId) setPick({ rp: s.sessionId, ex: exId }); },
              cells: [
                <T key="d" size={14} numberOfLines={1}>{RG.fmtD(s.date)}</T>,
                <T key="w" size={14} color={C.n400}>{byWorkout(s.workoutId)}</T>,
                <T key="s" size={14} tab>{s.sets.map(x => `${RG.w(x.kg)}×${x.reps}${x.rir != null ? '@' + x.rir : ''}`).join('  ')}</T>,
                <T key="v" size={14} tab>{RG.num(volK * RG.sum(s.sets.map(x => x.kg * x.reps)))}</T>,
                <T key="e" size={14} tab>{RG.w(Math.max(...s.sets.map(x => RG.e1rm(x.kg, x.reps))))}</T>,
              ],
            }))} />
          {!h.length && <Muted size={13} style={{ paddingVertical: 8 }}>No sessions logged for this exercise yet.</Muted>}
        </Card>
      )}
    </View>
  );

  return (
    <Screen>
      <PageHeader kicker={`${S.sessions.length} logged sessions`} title="Exercise History" />

      {ses && (
        <Card gap={10} style={{ boxShadow: `inset 0 0 0 1px ${C.a700}` }}>
          <Row gap={10} wrap>
            <Kicker>{`Logged session · ${sDate}`}</Kicker>
            <Spacer />
            <Btn variant="ghost" size="sm" icon="trash" title="Delete session" color={C.n400} onPress={() => setDlg(true)} />
            <Btn variant="ghost" iconOnly icon="x" color={C.text} label="Close session" onPress={() => RG.go('history')} />
          </Row>
          <T size={22} lh={1.25}>{sName}</T>
          <T size={13} color={C.n400}>{sMeta}</T>
          <FillGrid min={250} gap={8}>
            {sExercises.map(x => (
              <Tap key={x.id} onPress={() => setEx(x.id)} label={x.name} style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: C.n900, flexGrow: 1 }}>
                <T size={13}>{x.name}</T>
                <T size={12} color={C.n400} tab>{x.sets}</T>
              </Tap>
            ))}
          </FillGrid>
        </Card>
      )}

      <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ flexDirection: side ? 'row' : 'column', gap: 16, alignItems: side ? 'flex-start' : 'stretch' }}>
        {list}
        {detail}
      </View>

      <ConfirmDelete open={dlg} onClose={() => setDlg(false)} onConfirm={doDelete}
        title="Permanently delete this session?"
        body={`All sets from ${sName} on ${sDate} will be removed from history, records and progression targets. This cannot be undone.`} />
    </Screen>
  );
}
