/* 8. Progress Photos — port of prototype/FitPhotos.dc.html */
import * as ImagePicker from 'expo-image-picker';
import { Children, useRef, useState, type ReactNode } from 'react';
import Svg, { Line } from 'react-native-svg';
import { Image, PanResponder, Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import type { Checkin } from '@/domain/types';
import { saveImage } from '@/lib/files';
import { usePhoto, useRG } from '@/store/rg';
import { useUI } from '@/store/store';
import { Btn, Card, CardTitle, Check, Dialog, Empty, Grid, H, Icon, Muted, Row, Select, Seg, Stripes, T, Tap } from '@/ui/kit';
import { alpha, C, R } from '@/ui/theme';
import { Screen } from './Shell';

type Pose = 'front' | 'side' | 'back';
const cap = (p: string) => p[0].toUpperCase() + p.slice(1);
const key = (c: Checkin, p: Pose) => c.id + ':' + p;
const chip = { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, backgroundColor: alpha(C.bg, 0.8) } as const;

/** Pick an image from the library. On web, downscale to ≤1000 px and return a JPEG data URL (as the prototype did). */
async function pickImage(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: Platform.OS === 'web' });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  if (Platform.OS !== 'web') return a.uri;
  const src = a.base64 ? `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` : a.uri;
  return new Promise(res => {
    const img = new window.Image();
    img.onload = () => {
      const s = Math.min(1, 1000 / Math.max(img.width, img.height)); const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      const g = cv.getContext('2d'); if (!g) return res(src);
      g.drawImage(img, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => res(src);
    img.src = src;
  });
}

/** Horizontal drag → 0..100, via PanResponder (mouse on web, touch on native). */
function useDrag(onPct: (v: number) => void) {
  const box = useRef({ x: 0, w: 1 }); const ref = useRef<View>(null);
  const cb = useRef(onPct); cb.current = onPct;
  const set = (pageX: number) => cb.current(Math.max(0, Math.min(100, (pageX - box.current.x) / box.current.w * 100)));
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > Math.abs(g.dy), onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => { const px = e.nativeEvent.pageX; ref.current?.measureInWindow((x, _y, w) => { box.current = { x, w: w || 1 }; set(px); }); },
    onPanResponderMove: (_, g) => set(g.moveX),
  })).current;
  return { ref, pan: pan.panHandlers };
}

/** Grid overlay: horizontal fifths, plus vertical thirds and a centre line when `full`. */
function AlignGrid({ full }: { full?: boolean }) {
  const ln = alpha(C.accent, 0.35);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {[0, 20, 40, 60, 80].map(y => <View key={'h' + y} style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`, height: 1, backgroundColor: ln }} />)}
      {full && [0, 33.33, 66.66].map(x => <View key={'v' + x} style={{ position: 'absolute', top: 0, bottom: 0, left: `${x}%`, width: 1, backgroundColor: ln }} />)}
      {full && <View style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: C.accent, opacity: 0.7 }} />}
    </View>
  );
}

/** Like CSS repeat(auto-fill, minmax(N px, 1fr)): columns don't stretch to fill when there are few items. */
function FillGrid({ min, gap, children }: { min: number; gap: number; children?: ReactNode }) {
  const [w, setW] = useState(0);
  const cols = w ? Math.max(1, Math.floor((w + gap) / (min + gap))) : 1; const cw = w ? (w - gap * (cols - 1)) / cols : undefined;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {Children.toArray(children).map((k, i) => <View key={i} style={{ width: cw ?? '100%' }}>{k}</View>)}
    </View>
  );
}

/** Kit <Stripes> look, but the hatching scales to any frame size (the kit's covers ~300 px). */
function Hatch({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const [sz, setSz] = useState({ w: 300, h: 400 });
  const n = Math.ceil((sz.w + sz.h) / 14) + 2;
  return (
    <View onLayout={e => setSz({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[{ overflow: 'hidden', backgroundColor: C.n900, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        {Array.from({ length: n }, (_, i) => <Line key={i} x1={i * 14 - sz.h} y1={0} x2={i * 14} y2={sz.h} stroke={C.n800} strokeWidth={5} />)}
      </Svg>
      {children}
    </View>
  );
}

const frame: StyleProp<ViewStyle> = { position: 'relative', aspectRatio: 3 / 4, borderRadius: R.md, overflow: 'hidden', boxShadow: `inset 0 0 0 1px ${C.n800}` };

export default function PhotosScreen() {
  const RG = useRG();
  const mode = useUI(u => u.mode);
  const [pose, setPose] = useState<Pose>('front');
  const [aId, setA] = useState<string | null>(null);
  const [bId, setB] = useState<string | null>(null);
  const [cmp, setCmp] = useState<'side' | 'slide'>('side');
  const [showW, setShowW] = useState(true);
  const [showM, setShowM] = useState(false);
  const [grid, setGrid] = useState(false);
  const [slide, setSlide] = useState(50);
  const [del, setDel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const S = RG.s, wu = RG.wu(), lu = RG.lu();
  const cis = S.checkins.slice().sort((x, y) => x.date < y.date ? -1 : 1);
  const a = cis.find(c => c.id === aId) || cis[0], b = cis.find(c => c.id === bId) || cis[cis.length - 1];
  const device = mode === 'device';

  const upload = async (c: Checkin) => {
    const k = key(c, pose);
    try {
      const uri = await pickImage(); if (!uri) return;
      setBusy(k); const before = RG.s.photos[k];
      await RG.setPhoto(k, uri);
      if (RG.s.photos[k] && RG.s.photos[k] !== before) RG.toast(device ? 'Photo saved privately to this device.' : 'Photo saved privately to your account.');
    } catch (e) {
      RG.toast('Could not open photos: ' + (e instanceof Error ? e.message : 'unknown error'));
    } finally { setBusy(null); }
  };
  const ciOpts = cis.map(c => ({ value: c.id, label: RG.fmtD(c.date) }));

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ marginRight: 'auto' }}>
          <Muted>Private by default</Muted>
          <H size={28} style={{ marginTop: 2 }}>Progress Photos</H>
        </View>
        <Seg value={pose} onChange={setPose} options={(['front', 'side', 'back'] as Pose[]).map(p => ({ value: p, label: cap(p) }))} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 16, borderRadius: R.md, boxShadow: `inset 0 0 0 1px ${C.n800}` }}>
        <Icon name="shield-check" size={20} color={C.accent} />
        <T size={13} color={C.n300} style={{ flex: 1 }}>
          <T size={13} w={500}>{device ? 'Your photos stay on this device.' : 'Your photos are private to your account.'}</T>
          {device
            ? ' They are never shared, posted or used for anything except your own comparisons. They leave the app only when you choose Download. Weight and measurement labels can be hidden from any comparison.'
            : ' They are kept in private storage that only you can open, shown through short-lived links, and never shared, posted or used for anything except your own comparisons. They leave the app only when you choose Download. Weight and measurement labels can be hidden from any comparison.'}
        </T>
      </View>

      {!cis.length ? (
        <Card>
          <Empty icon="camera" title="No check-ins yet" body="Photos are attached to check-ins so each one sits next to that day's weight and measurements. Add your first check-in, then come back to upload front, side and back photos."
            action={<Btn variant="primary" icon="plus" title="New check-in" onPress={() => RG.go('checkins')} />} />
        </Card>
      ) : (
        <>
          <Card gap={12}>
            <Row gap={10} wrap>
              <CardTitle style={{ marginRight: 'auto' }}>Compare</CardTitle>
              <Select title="Before" value={a?.id} options={ciOpts} onChange={setA} style={{ width: 'auto', minWidth: 132 }} />
              <Icon name="arrow-right" size={16} color={C.n500} />
              <Select title="After" value={b?.id} options={ciOpts} onChange={setB} style={{ width: 'auto', minWidth: 132 }} />
              <Seg value={cmp} onChange={setCmp} options={[{ value: 'side', label: 'Side by side' }, { value: 'slide', label: 'Slider' }]} />
            </Row>
            <Row gap={16} wrap>
              <Check checked={showW} onChange={setShowW} label={<T size={13} color={C.n300}>Show weight</T>} />
              <Check checked={showM} onChange={setShowM} label={<T size={13} color={C.n300}>Show measurements</T>} />
              <Check checked={grid} onChange={setGrid} label={<T size={13} color={C.n300}>Alignment overlay</T>} />
            </Row>
            {cmp === 'side' && a && b && (
              <View style={{ flexDirection: 'row', gap: 10, maxWidth: 760 }}>
                {[a, b].map((c, i) => (
                  <PhotoFigure key={i} c={c} pose={pose} grid={grid} showW={showW} showM={showM} busy={busy === key(c, pose)}
                    kg={`${RG.bw(c.kg)} ${wu}`} meas={`Waist ${RG.len(c.waist)} · Hips ${RG.len(c.hips)} ${lu}`} date={RG.fmtD(c.date)}
                    onUpload={() => upload(c)} onDelete={() => setDel(key(c, pose))} />
                ))}
              </View>
            )}
            {cmp === 'slide' && a && b && (
              <SliderCompare aKey={key(a, pose)} bKey={key(b, pose)} slide={slide} setSlide={setSlide} grid={grid}
                aLabel={RG.fmtShort(a.date) + (showW ? ` · ${RG.bw(a.kg)} ${wu}` : '')} bLabel={RG.fmtShort(b.date) + (showW ? ` · ${RG.bw(b.kg)} ${wu}` : '')} />
            )}
          </Card>
        </>
      )}

      <Card gap={10}>
        <CardTitle>Same-pose guidance</CardTitle>
        <Grid min={200} gap={8}>
          {([['sun', 'Same spot, same light, morning, before eating.'], ['ruler', 'Camera at chest height, about 2 m away, not tilted.'],
            ['person', 'Relaxed stance, arms slightly out, feet hip-width.'], ['t-shirt', 'Same clothing each time so changes are comparable.']] as const).map(([ic, tx]) => (
            <Row key={ic} gap={6} align="flex-start"><Icon name={ic} size={14} color={C.accent} style={{ marginTop: 3 }} /><T size={13} color={C.n300} style={{ flex: 1 }}>{tx}</T></Row>
          ))}
        </Grid>
      </Card>

      {cis.length > 0 && (
        <View style={{ gap: 10 }}>
          <T size={11} color={C.n500} upper style={{ letterSpacing: 0.9 }}>{`Timeline · ${pose}`}</T>
          <FillGrid min={120} gap={10}>
            {cis.slice().reverse().map(c => (
              <TimelineTile key={c.id} k={key(c, pose)} on={!!b && c.id === b.id} date={RG.fmtShort(c.date)} kg={showW ? `${RG.bw(c.kg)} ${wu}` : ''} onPress={() => setB(c.id)} />
            ))}
          </FillGrid>
        </View>
      )}

      <Dialog open={!!del} onClose={() => setDel(null)} title="Delete this photo?"
        body={device ? 'The photo is removed from this device permanently.' : 'The photo is removed from your private storage permanently.'}
        actions={<><Btn title="Cancel" onPress={() => setDel(null)} /><Btn variant="primary" icon="trash" title="Delete photo" onPress={async () => { const k = del; setDel(null); if (k) { await RG.setPhoto(k, null); RG.toast('Photo deleted.'); } }} /></>} />
    </Screen>
  );
}

function PhotoFigure({ c, pose, grid, showW, showM, kg, meas, date, busy, onUpload, onDelete }: {
  c: Checkin; pose: Pose; grid: boolean; showW: boolean; showM: boolean; kg: string; meas: string; date: string; busy: boolean; onUpload: () => void; onDelete: () => void;
}) {
  const k = key(c, pose); const src = usePhoto(k); const has = !!useRG().s.photos[k];
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <Hatch style={frame}>
        {src ? <Image source={{ uri: src }} accessibilityLabel={`${pose} progress photo ${c.date}`} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          : <T size={11} color={C.n500} center style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }), padding: 10 }}>
            {has || busy ? 'loading…' : `${cap(pose)} photo · ${date}\nnot added`}
          </T>}
        {grid && <AlignGrid full />}
        <View style={[chip, { position: 'absolute', left: 8, bottom: 8, gap: 2 }]}>
          <T size={11} w={500} lh={1.3}>{date}</T>
          {showW && <T size={11} lh={1.3} tab>{kg}</T>}
          {showM && <T size={11} lh={1.3} tab>{meas}</T>}
        </View>
      </Hatch>
      <Row gap={4} wrap>
        <Btn size="sm" icon="upload-simple" title={busy ? 'Saving…' : has ? 'Replace' : 'Upload'} disabled={busy} onPress={onUpload} />
        {has && <>
          <Btn variant="ghost" size="sm" icon="download-simple" title="Download" disabled={!src} onPress={() => { if (src) void saveImage(src, `progress-${pose}-${c.date}.jpg`); }} />
          <Btn variant="ghost" size="sm" icon="trash" title="Delete" color={C.n500} onPress={onDelete} />
        </>}
      </Row>
    </View>
  );
}

function SliderCompare({ aKey, bKey, slide, setSlide, grid, aLabel, bLabel }: { aKey: string; bKey: string; slide: number; setSlide: (v: number) => void; grid: boolean; aLabel: string; bLabel: string }) {
  const aSrc = usePhoto(aKey), bSrc = usePhoto(bKey);
  const [w, setW] = useState(0);
  const img = useDrag(setSlide), track = useDrag(setSlide);
  const step = (d: number) => setSlide(Math.max(0, Math.min(100, slide + d)));
  const a11y = { accessibilityRole: 'adjustable' as const, accessibilityLabel: 'Before / after slider', accessibilityValue: { min: 0, max: 100, now: Math.round(slide) },
    onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => step(e.nativeEvent.actionName === 'increment' ? 5 : -5), accessibilityActions: [{ name: 'increment' as const }, { name: 'decrement' as const }] };
  return (
    <View style={{ gap: 8, maxWidth: 420, width: '100%' }}>
      <View ref={img.ref} {...img.pan} {...a11y} onLayout={e => setW(e.nativeEvent.layout.width)} style={[frame, { cursor: 'ew-resize' } as unknown as ViewStyle]}>
        <Hatch style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 }} />
        {bSrc && <Image source={{ uri: bSrc }} accessibilityLabel="Current" resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />}
        {aSrc && w > 0 && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${slide}%`, overflow: 'hidden' }}>
            <Image source={{ uri: aSrc }} accessibilityLabel="Before" resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: w, height: '100%' }} />
          </View>
        )}
        {(!aSrc || !bSrc) && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <T size={11} color={C.n500} center style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }) }}>add both photos to use the slider</T>
          </View>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: `${slide}%`, width: 2, marginLeft: -1, backgroundColor: C.accent, boxShadow: `0 0 10px ${C.accent}` }} />
        {grid && <AlignGrid />}
        <View pointerEvents="none" style={[chip, { position: 'absolute', left: 8, top: 8, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 5 }]}><T size={11} lh={1.3}>{aLabel}</T></View>
        <View pointerEvents="none" style={[chip, { position: 'absolute', right: 8, top: 8, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 5 }]}><T size={11} lh={1.3}>{bLabel}</T></View>
      </View>
      {/* range input: a track with a draggable thumb */}
      <View ref={track.ref} {...track.pan} {...a11y} hitSlop={{ top: 12, bottom: 12 }} style={{ height: 24, justifyContent: 'center', cursor: 'pointer' } as ViewStyle}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: C.n800 }}>
          <View style={{ width: `${slide}%`, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: `${slide}%`, marginLeft: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: C.accent, boxShadow: `0 0 0 3px ${alpha(C.accent, 0.25)}` }} />
      </View>
    </View>
  );
}

function TimelineTile({ k, on, date, kg, onPress }: { k: string; on: boolean; date: string; kg: string; onPress: () => void }) {
  const src = usePhoto(k);
  return (
    <Tap onPress={onPress} label={`Compare ${date}`} style={{ gap: 4, padding: 6, borderRadius: R.md, borderWidth: 1, borderColor: on ? C.accent : C.n800 }}>
      <Stripes style={{ aspectRatio: 3 / 4, borderRadius: 6 }}>
        {src ? <Image source={{ uri: src }} accessibilityLabel={date} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          : <Icon name="image" size={22} color={C.n700} />}
      </Stripes>
      <T size={12}>{date}</T>
      {!!kg && <Muted size={11}>{kg}</Muted>}
    </Tap>
  );
}
