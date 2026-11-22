/* Progress › Overview: the first thing in the Progress tab. Weight trend, changes since you started, your latest
   check-in (tap to open it), a before/after photo pair and your newest records, each linking to its full section. */
import { View } from 'react-native';
import { useRG } from '@/store/rg';
import { Btn, Card, Grid, H, LineChart, Muted, NotMedical, Row, Section, T, Tap } from '@/ui/kit';
import { C } from '@/ui/theme';
import { MEAS, PhotoThumb, useDelta } from './progress/CheckinView';
import { Screen } from './Shell';

export default function ProgressScreen() {
  const RG = useRG(); const delta = useDelta();
  const S = RG.s, wu = RG.wu(), lu = RG.lu(), T0 = RG.TODAY;
  const bw = (v: number) => RG.bw(v), len = (v: number) => RG.len(v);
  const cis = S.checkins.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const first = cis[0], last = cis[cis.length - 1], prev = cis[cis.length - 2];

  // weight: last 8 weeks, 7-day rolling average
  const since = RG.add(T0, -56);
  const wl = S.weights.filter(w => w.date >= since); const ws = wl.map(w => w.kg);
  const av = RG.rolling(ws, 7).map(v => v ?? 0);
  const lo = Math.min(...ws) - 0.3, hi = Math.max(...ws) + 0.3;
  const trendNow = av[av.length - 1], trendThen = av[Math.min(6, av.length - 1)];

  const changes = first && last && first !== last
    ? [{ label: 'Weight', a: first.kg, b: last.kg, unit: wu, fmt: bw }].concat(MEAS.map(([k, l]) => ({ label: l, a: first[k], b: last[k], unit: lu, fmt: len })))
      .filter(x => x.a != null && x.b != null)
    : [];

  // newest records (heaviest sets) from the last 30 days
  const exIds = [...new Set(S.sessions.flatMap(s => s.sets.filter(x => !x.warm).map(x => x.exId)))];
  const recent = exIds.map(id => ({ e: RG.ex(id), p: RG.prs(id) }))
    .filter((x): x is { e: NonNullable<typeof x.e>; p: NonNullable<typeof x.p> } => !!x.e && !!x.p && x.p.heavy.date >= RG.add(T0, -30))
    .sort((a, b) => a.p.heavy.date < b.p.heavy.date ? 1 : -1).slice(0, 3);

  const photoPair = first && last && first !== last;

  return (
    <Screen>
      <Row gap={12} wrap align="flex-end">
        <View style={{ marginRight: 'auto', gap: 2 }}>
          <H size={28}>Progress</H>
          <Muted size={13}>{cis.length ? `${cis.length} check-in${cis.length > 1 ? 's' : ''} · next check-in ${RG.fmtD(RG.nextCheckIn())}` : 'Check in every week or two to see how things are changing.'}</Muted>
        </View>
        <Btn variant="primary" icon="plus" title="New check-in" onPress={() => RG.go('checkins', { new: true })} />
      </Row>

      <Section title="Weight trend" sub="7-day average over the last 8 weeks. Single days are just water and food." right={<Btn variant="ghost" title="Analytics" iconRight="caret-right" onPress={() => RG.go('analytics')} />}>
        <Card gap={8}>
          {ws.length >= 2 ? <>
            <Row gap={20} wrap>
              <View><T size={26} tab>{bw(trendNow)} <T size={13} color={C.n500}>{wu}</T></T><Muted size={11}>Trend now</Muted></View>
              <View><T size={26} tab>{delta(trendThen, trendNow, bw, wu) || '—'}</T><Muted size={11}>{`Since ${RG.fmtShort(wl[0].date)}`}</Muted></View>
            </Row>
            <LineChart w={600} h={140} height={150} series={[{ points: RG.pts(ws, 600, 140, lo, hi), color: C.n700, width: 1 }, { points: RG.pts(av, 600, 140, lo, hi), color: C.accent, width: 2.4 }]} />
          </> : <Muted size={13}>Log your weight on a couple of days (Today › Weight) to see your trend here.</Muted>}
        </Card>
      </Section>

      {!!changes.length && (
        <Section title="Since you started" sub={`${RG.fmtD(first.date)} → ${RG.fmtD(last.date)}`}>
          <Card>
            <Grid min={130} gap={12}>
              {changes.map(x => (
                <View key={x.label}>
                  <Muted size={12}>{x.label}</Muted>
                  <T size={20} tab lh={1.3}>{x.fmt(x.b as number)} <T size={12} color={C.n500}>{x.unit}</T></T>
                  <T size={12} tab color={C.a300}>{delta(x.a, x.b, x.fmt, x.unit)}</T>
                </View>
              ))}
            </Grid>
          </Card>
        </Section>
      )}

      <Section title="Latest check-in" right={cis.length ? <Btn variant="ghost" title="All check-ins" iconRight="caret-right" onPress={() => RG.go('checkins')} /> : undefined}>
        {last ? (
          <Tap onPress={() => RG.go('checkins', { open: last.id })} label={`Open check-in ${RG.fmtD(last.date)}`}>
            <Card gap={6} style={{ borderColor: C.a700 }}>
              <Row gap={10}>
                <T size={17} w={600} style={{ flex: 1 }}>{RG.fmtD(last.date)}</T>
                <T size={13} color={C.accent}>Open ›</T>
              </Row>
              <T size={14} tab>{`${bw(last.kg as number)} ${wu}`}{prev ? <T size={13} color={C.a300}>{'  ' + (delta(prev.kg, last.kg, bw, wu) || '')}</T> : null}</T>
              <Muted size={12}>{MEAS.filter(([k]) => last[k] != null).map(([k, l]) => `${l} ${len(last[k] as number)}`).join(' · ') + (MEAS.some(([k]) => last[k] != null) ? ` ${lu}` : '')}</Muted>
            </Card>
          </Tap>
        ) : (
          <Card gap={8}>
            <T size={14}>No check-ins yet.</T>
            <Muted size={13}>Your first check-in (weight, measurements and how the week felt) becomes the baseline everything is compared with.</Muted>
            <Row><Btn variant="primary" icon="plus" title="Do my first check-in" onPress={() => RG.go('checkins', { new: true })} /></Row>
          </Card>
        )}
      </Section>

      {photoPair && (
        <Section title="Before & after" sub={`Front photos from ${RG.fmtD(first.date)} and ${RG.fmtD(last.date)}.`} right={<Btn variant="ghost" title="Compare photos" iconRight="caret-right" onPress={() => RG.go('photos')} />}>
          <Row gap={10} align="flex-start" style={{ maxWidth: 420 }}>
            <PhotoThumb id={first.id} pose="front" date={first.date} onPress={() => RG.go('photos')} />
            <PhotoThumb id={last.id} pose="front" date={last.date} onPress={() => RG.go('photos')} />
          </Row>
        </Section>
      )}

      <Section title="New records" sub="Your heaviest sets from the last 30 days." right={<Btn variant="ghost" title="All records" iconRight="caret-right" onPress={() => RG.go('records')} />}>
        <Card gap={6}>
          {recent.length ? recent.map(x => (
            <Row key={x.e.id} gap={10} style={{ paddingVertical: 4 }}>
              <T size={14} style={{ flex: 1 }}>{x.e.name}</T>
              <T size={14} tab w={600}>{`${RG.w(x.p.heavy.kg)} ${wu} × ${x.p.heavy.reps}`}</T>
              <Muted size={12}>{RG.fmtShort(x.p.heavy.date)}</Muted>
            </Row>
          )) : <Muted size={13}>No new records in the last 30 days yet. Keep logging your workouts.</Muted>}
        </Card>
      </Section>
      <NotMedical text={RG.NOT_MEDICAL} />
    </Screen>
  );
}
