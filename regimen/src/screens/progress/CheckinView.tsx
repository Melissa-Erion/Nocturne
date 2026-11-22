/* One check-in, laid out to read: weight and measurements with the change from the previous check-in, its photos,
   how the week felt (as bars), and notes. Step to the previous/next check-in, or Edit / Delete. */
import { Image, View } from 'react-native';
import type { Checkin } from '@/domain/types';
import { usePhoto, useRG } from '@/store/rg';
import { Btn, Card, Grid, H, Muted, Row, Section, T, Tap } from '@/ui/kit';
import { C, R } from '@/ui/theme';

export const MEAS: ['waist' | 'hips' | 'chest' | 'thighs' | 'arms', string][] = [['waist', 'Waist'], ['hips', 'Hips'], ['chest', 'Chest'], ['thighs', 'Thighs'], ['arms', 'Arms']];
export const RAT: ['energy' | 'sleep' | 'hunger' | 'stress' | 'recovery', string, string[]][] = [
  ['energy', 'Energy', ['Very low', 'Low', 'OK', 'Good', 'High']], ['sleep', 'Sleep quality', ['Poor', 'Fair', 'OK', 'Good', 'Great']],
  ['hunger', 'Hunger', ['None', 'Low', 'Moderate', 'High', 'Very high']], ['stress', 'Stress', ['None', 'Low', 'Moderate', 'High', 'Very high']],
  ['recovery', 'Recovery', ['Poor', 'Fair', 'OK', 'Good', 'Great']],
];
const POSES = ['front', 'side', 'back'] as const;

/** "−1.2 kg" style change between two values, or '' when either is missing. */
export function useDelta() {
  const RG = useRG();
  return (a: number | null | undefined, b: number | null | undefined, fmt: (v: number) => string, unit: string) => {
    if (a == null || b == null) return '';
    const x = b - a; if (Math.abs(x) < 0.05) return 'no change';
    return `${x < 0 ? '−' : '+'}${fmt(Math.abs(x))} ${unit}`;
  };
}

export function PhotoThumb({ id, pose, date, onPress }: { id: string; pose: string; date: string; onPress?: () => void }) {
  const src = usePhoto(`${id}:${pose}`);
  return (
    <Tap onPress={onPress} label={`${pose} photo ${date}`} style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <View style={{ aspectRatio: 3 / 4, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.n900, alignItems: 'center', justifyContent: 'center' }}>
        {src ? <Image source={{ uri: src }} accessibilityLabel={`${pose} progress photo ${date}`} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          : <T size={11} color={C.n500} center>{'No photo'}</T>}
      </View>
      <T size={11} color={C.n400} center>{pose[0].toUpperCase() + pose.slice(1)}</T>
    </Tap>
  );
}

export function CheckinView({ c, prev, first, index, total, onBack, onEdit, onDelete, onStep }: {
  c: Checkin; prev?: Checkin; first?: Checkin; index: number; total: number;
  onBack: () => void; onEdit: () => void; onDelete: () => void; onStep: (dir: -1 | 1) => void;
}) {
  const RG = useRG(); const wu = RG.wu(), lu = RG.lu(); const delta = useDelta();
  const bw = (v: number) => RG.bw(v), len = (v: number) => RG.len(v);
  const stats = [{ label: 'Weight', now: c.kg, unit: wu, fmt: bw, prev: prev?.kg, first: first?.kg }]
    .concat(MEAS.map(([k, l]) => ({ label: l, now: c[k], unit: lu, fmt: len, prev: prev?.[k], first: first?.[k] })))
    .concat((c.custom || []).map(x => ({ label: x.name, now: x.value, unit: lu, fmt: len, prev: prev?.custom?.find(y => y.name === x.name)?.value, first: first?.custom?.find(y => y.name === x.name)?.value })))
    .filter(s => s.now != null);
  const hasPhotos = POSES.some(p => RG.hasPhoto(`${c.id}:${p}`));
  const notes: [string, string][] = ([['Strength progress', c.strength], ['Cycle notes', c.cycle], ['Notes', c.notes]] as [string, string][]).filter(([, v]) => !!v);
  return (
    <View style={{ gap: 14 }}>
      <Row gap={8} wrap>
        <Btn variant="ghost" icon="arrow-left" title="All check-ins" onPress={onBack} />
        <View style={{ flex: 1 }} />
        <Btn iconOnly icon="caret-left" label="Older check-in" disabled={index === 0} onPress={() => onStep(-1)} />
        <T size={13} color={C.n400}>{`${index + 1} of ${total}`}</T>
        <Btn iconOnly icon="caret-right" label="Newer check-in" disabled={index === total - 1} onPress={() => onStep(1)} />
      </Row>
      <View style={{ gap: 2 }}>
        <H size={28}>{RG.fmtD(c.date)}</H>
        <Muted size={13}>{prev ? `Compared with your previous check-in on ${RG.fmtD(prev.date)}.` : 'Your first check-in: the baseline everything is compared with.'}</Muted>
      </View>

      <Card gap={10}>
        <Grid min={140} gap={12}>
          {stats.map(s => (
            <View key={s.label} style={{ gap: 1 }}>
              <Muted size={12}>{s.label}</Muted>
              <T size={22} tab lh={1.25}>{s.fmt(s.now as number)} <T size={12} color={C.n500}>{s.unit}</T></T>
              {!!prev && <T size={12} tab color={C.a300}>{delta(s.prev, s.now, s.fmt, s.unit) || '—'}{' since last'}</T>}
              {!!first && first.id !== c.id && first.id !== prev?.id && !!delta(s.first, s.now, s.fmt, s.unit) && <T size={11} tab color={C.n400}>{delta(s.first, s.now, s.fmt, s.unit) + ' since start'}</T>}
            </View>
          ))}
        </Grid>
        {!stats.length && <Muted size={13}>No weight or measurements in this check-in.</Muted>}
      </Card>

      <Section title="Photos" right={<Btn variant="ghost" icon="camera" title={hasPhotos ? 'Compare photos' : 'Add photos'} onPress={() => RG.go('photos')} />}>
        <Row gap={10} align="flex-start">
          {POSES.map(p => <PhotoThumb key={p} id={c.id} pose={p} date={c.date} onPress={() => RG.go('photos')} />)}
        </Row>
      </Section>

      <Section title="How the week felt">
        <Card gap={10}>
          {RAT.map(([k, l, words]) => {
            const v = c[k] || 3;
            return (
              <View key={k} style={{ gap: 4 }}>
                <Row><T size={13} style={{ flex: 1 }}>{l}</T><T size={13} color={C.n300}>{words[v - 1]}</T></Row>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {[1, 2, 3, 4, 5].map(n => <View key={n} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: n <= v ? C.a400 : C.n800 }} />)}
                </View>
              </View>
            );
          })}
        </Card>
      </Section>

      {!!notes.length && (
        <Section title="Notes">
          <Card gap={10}>
            {notes.map(([l, v]) => <View key={l} style={{ gap: 2 }}><T size={12} w={600} color={C.n400}>{l}</T><T size={14}>{v}</T></View>)}
          </Card>
        </Section>
      )}

      <Row gap={8} wrap style={{ marginTop: 4 }}>
        <Btn variant="primary" title="Edit check-in" onPress={onEdit} />
        <Btn variant="ghost" icon="trash" title="Delete" color={C.n400} onPress={onDelete} />
      </Row>
    </View>
  );
}
