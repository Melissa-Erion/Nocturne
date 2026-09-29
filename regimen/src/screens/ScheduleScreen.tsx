/* 2. My Schedule — port of prototype/FitSchedule.dc.html */
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { requestCalendarPermission } from '@/lib/calendar';
import { saveTextFile } from '@/lib/files';
import { useRG } from '@/store/rg';
import type { EntryStatus, ScheduleEntry } from '@/domain/types';
import type { IconName } from '@/ui/icons';
import { Btn, Card, CardTitle, Check, Chip, Dialog, Field, Grid, H, Icon, Kicker, Muted, Row, Seg, T, Tag, Tap, useLayout } from '@/ui/kit';
import { alpha, C, R } from '@/ui/theme';
import { DateField } from './schedule/DateField';
import { Screen } from './Shell';

type View3 = 'day' | 'week' | 'month';
type Rect = { d: string; x: number; y: number; w: number; h: number };
interface Dnd { begin: (id: string, name: string, x: number, y: number) => void; move: (x: number, y: number) => void; end: (x: number, y: number, cancel?: boolean) => void }

const statusIcon = (s: EntryStatus): { name: IconName; fill?: boolean } =>
  s === 'done' ? { name: 'check-circle', fill: true } : s === 'missed' ? { name: 'x-circle' } : s === 'skipped' ? { name: 'skip-forward-circle' } : { name: 'circle-dashed' };

/** Drag source (PanResponder, web + native). `grab` = claim the touch immediately (grip handles, small pills);
    otherwise dragging starts after a few px of movement (desktop mouse). A release without movement is a tap. */
function Draggable({ id, name, enabled, grab, dnd, onTap, style, children }: { id: string; name: string; enabled: boolean; grab: boolean; dnd: Dnd; onTap?: () => void; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const live = useRef({ enabled, grab, dnd, onTap, id, name }); live.current = { enabled, grab, dnd, onTap, id, name };
  const started = useRef(false);
  const pr = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => live.current.grab && (live.current.enabled || !!live.current.onTap),
    onMoveShouldSetPanResponder: (_, g) => live.current.enabled && Math.abs(g.dx) + Math.abs(g.dy) > 6,
    onPanResponderTerminationRequest: () => !started.current,
    onPanResponderGrant: () => { started.current = false; },
    onPanResponderMove: (_, g) => {
      const L = live.current;
      if (!started.current && L.enabled && Math.abs(g.dx) + Math.abs(g.dy) > 6) { started.current = true; L.dnd.begin(L.id, L.name, g.moveX, g.moveY); }
      if (started.current) L.dnd.move(g.moveX, g.moveY);
    },
    onPanResponderRelease: (_, g) => { if (started.current) live.current.dnd.end(g.moveX, g.moveY); else live.current.onTap?.(); started.current = false; },
    onPanResponderTerminate: () => { if (started.current) live.current.dnd.end(0, 0, true); started.current = false; },
  }), []);
  return <View {...pr.panHandlers} style={[Platform.OS === 'web' && enabled && ({ cursor: 'grab', userSelect: 'none' } as unknown as ViewStyle), style]}>{children}</View>;
}

/** Faint diagonal stripes for paused days. */
const PauseStripes = ({ gap = 16 }: { gap?: number }) => (
  <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
    {Array.from({ length: 40 }, (_, i) => <Line key={i} x1={i * gap - 400} y1={0} x2={i * gap} y2={400} stroke={alpha(C.text, 0.03)} strokeWidth={gap / 2} />)}
  </Svg>
);

export default function ScheduleScreen() {
  const RG = useRG();
  const { wide } = useLayout();
  const [view, setView] = useState<View3>('week');
  const [anchorSt, setAnchor] = useState<string | null>(null);
  const [selId, setSel] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState('');
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [dlgPause, setDlgPause] = useState(false);
  const [reason, setReason] = useState('Travel');
  const [pFrom, setPFrom] = useState(''); const [pTo, setPTo] = useState('');

  /* drag and drop: day cells are measured in window coordinates when a drag begins */
  const [drag, setDrag] = useState<{ id: string; name: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const overRef = useRef<string | null>(null);
  const cellRefs = useRef(new Map<string, View>());
  const rects = useRef<Rect[]>([]);
  const rootRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const pos = useRef(new Animated.ValueXY()).current;
  const dragIdRef = useRef<string | null>(null);

  const S = RG.s, P = S.profile, T0 = RG.TODAY; const anchor = anchorSt || T0;
  const wname = (e: ScheduleEntry) => RG.workout(e.workoutId, e.planId)?.name || e.workoutId;
  const moveToast = (r: { error?: string; note?: string; warning?: string }, d: string) => RG.toast(r.error || [`Moved to ${RG.fmtD(d)}.`, r.note, r.warning].filter(Boolean).join(' '));

  const hit = (x: number, y: number) => rects.current.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)?.d ?? null;
  const dnd: Dnd = {
    begin(id, name, x, y) {
      rects.current = [];
      cellRefs.current.forEach((v, d) => v?.measureInWindow((cx, cy, w, h) => { rects.current.push({ d, x: cx, y: cy, w, h }); }));
      rootRef.current?.measureInWindow((ox, oy) => { origin.current = { x: ox, y: oy }; pos.setValue({ x: x - ox + 10, y: y - oy + 10 }); });
      pos.setValue({ x: x - origin.current.x + 10, y: y - origin.current.y + 10 });
      dragIdRef.current = id; setDrag({ id, name });
    },
    move(x, y) {
      pos.setValue({ x: x - origin.current.x + 10, y: y - origin.current.y + 10 });
      const d = hit(x, y); if (d !== overRef.current) { overRef.current = d; setOver(d); }
    },
    end(x, y, cancel) {
      const d = cancel ? null : hit(x, y); const src = dragIdRef.current;
      setDrag(null); setOver(null); overRef.current = null; dragIdRef.current = null;
      if (!d || !src) return;
      const e = RG.entry(src); if (e && e.date === d) return;
      moveToast(RG.moveEntry(src, d), d);
    },
  };

  const select = (en: ScheduleEntry) => () => {
    if (swapFrom) { if (en.status === 'planned' && en.id !== swapFrom) { RG.swapEntries(swapFrom, en.id); RG.toast('Workouts swapped.'); } setSwapFrom(null); return; }
    setSel(en.id); setMoveDate(en.date);
  };
  const openDay = (d: string) => () => { setView('day'); setAnchor(d); };

  const mkItem = (en: ScheduleEntry) => {
    const w = RG.workout(en.workoutId, en.planId); const st = en.status; const dragOk = st === 'planned';
    const sub = st === 'done' ? 'Logged' : st === 'missed' ? (en.rescheduledTo ? 'Missed · rescheduled' : 'Missed') : st === 'skipped' ? 'Skipped'
      : `${P.workoutTime} · ${w ? w.focus : ''}${en.origin === 'manual' ? ' · moved' : en.origin === 'rescheduled' ? ' · rescheduled' : ''}`;
    return { en, name: w ? w.name : en.workoutId, short: w ? w.id : '', icon: statusIcon(st), drag: dragOk, sub };
  };

  /* week */
  const mon = RG.monday(anchor); const nextCheck = RG.nextCheckIn();
  const weekDays = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const d = RG.add(mon, i); const items = RG.entriesOn(d).map(mkItem);
    return { d, i, dn: RG.DN[i], dm: RG.fmtShort(d), isT: d === T0, tag: d === T0 ? 'TODAY' : d === nextCheck ? 'CHECK-IN' : '', items, paused: RG.inPause(d),
      emptyLabel: RG.inPause(d) ? 'Paused' : P.trainingDays.includes(i) ? 'Open training day' : 'Rest' };
  });
  /* month */
  const m0 = anchor.slice(0, 8) + '01'; const gs = RG.monday(m0); const curM = anchor.slice(5, 7);
  const monthDays = Array.from({ length: 42 }, (_, i) => RG.add(gs, i)).filter((d, i) => i < 35 || d.slice(5, 7) === curM);
  const monthRows = Array.from({ length: Math.ceil(monthDays.length / 7) }, (_, r) => monthDays.slice(r * 7, r * 7 + 7));
  /* day */
  const dayItems = RG.entriesOn(anchor).map(en => {
    const w = RG.workout(en.workoutId, en.planId);
    return { en, name: w?.name || en.workoutId, icon: statusIcon(en.status), exercises: (w?.items || []).map(i => ({ key: i.id, name: RG.ex(i.exId)?.name || i.exId, scheme: `${i.sets} × ${i.repMin}–${i.repMax}` })) };
  });

  const plan = RG.plan(); const nx = RG.nextEntry(RG.add(T0, -1));
  const recent = S.schedule.filter(e => e.date >= RG.add(T0, -28) && e.date <= T0 && ((e.status === 'missed' && !e.rescheduledTo) || e.status === 'skipped'));
  const sel = selId ? RG.entry(selId) : undefined; const sw = sel && RG.workout(sel.workoutId, sel.planId);
  const pause = RG.activePause();
  const close = () => setSel(null);

  const shiftAnchor = (dir: number) => {
    if (view !== 'month') setAnchor(RG.add(anchor, (view === 'week' ? 7 : 1) * dir));
    else { const y = Number(anchor.slice(0, 4)), m = Number(anchor.slice(5, 7)) - 1 + dir; setAnchor(new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)); }
  };
  const rangeLabel = view === 'week' ? `${RG.fmtShort(mon)} – ${RG.fmtShort(RG.add(mon, 6))}` : view === 'month' ? `${RG.MFULL[Number(curM) - 1]} ${anchor.slice(0, 4)}` : RG.fmtD(anchor);

  const toggleSync = async () => {
    const on = !P.calendarSync;
    if (on && Platform.OS !== 'web') {
      const ok = await requestCalendarPermission();
      if (!ok) return RG.toast('Calendar access was not granted. Allow it in system settings to show workouts in your main calendar.');
    }
    RG.update(s => { s.profile.calendarSync = on; });
    RG.toast(on ? (Platform.OS === 'web' ? 'Workouts will show in your main calendar on your phone. On the web, use Export .ics.' : 'Workouts now show in your main calendar.') : 'Removed from the main calendar.');
  };
  const exportIcs = async () => {
    try { await saveTextFile('regimen-schedule.ics', RG.icsExport(), 'text/calendar'); RG.toast('Calendar file downloaded — import it into any calendar app.'); }
    catch { RG.toast('Could not export the calendar file.'); }
  };
  const doMove = () => { if (!sel || !moveDate) return; const r = RG.moveEntry(sel.id, moveDate); close(); moveToast(r, moveDate); };
  const doReschedule = () => { if (!sel || !moveDate) return; if (sel.status === 'skipped') RG.restoreEntry(sel.id); RG.rescheduleMissed(sel.id, moveDate); close(); RG.toast(`Rescheduled to ${RG.fmtD(moveDate)}.`); };
  const doPause = () => { if (!pFrom) return; RG.pause(pFrom, pTo || null, reason); setDlgPause(false); RG.toast(`Schedule paused (${reason}). Your rotation is saved.`); };
  const swapEntry = swapFrom ? RG.entry(swapFrom) : undefined;

  const legend: [IconName, string, boolean?, string?][] = [['check-circle', 'Logged', true, C.accent], ['circle-dashed', 'Planned'], ['x-circle', 'Missed'], ['skip-forward-circle', 'Skipped'], ['pause', 'Paused']];

  const itemBox = (it: ReturnType<typeof mkItem>): ViewStyle => {
    const st = it.en.status;
    return {
      gap: 2, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6,
      backgroundColor: st === 'done' ? C.a800 : st === 'planned' ? C.surface : 'transparent',
      boxShadow: swapFrom === it.en.id ? `0 0 0 2px ${C.accent}` : it.en.date === T0 && st === 'planned' ? `inset 0 0 0 1px ${C.accent}` : st === 'planned' ? `inset 0 0 0 1px ${C.n800}` : undefined,
      borderWidth: st === 'missed' || st === 'skipped' ? 1 : 0, borderStyle: 'dashed', borderColor: C.n700,
      opacity: drag?.id === it.en.id ? 0.4 : 1,
    };
  };
  const itemFg = (st: EntryStatus) => st === 'done' ? C.a100 : st === 'planned' ? C.text : C.n400;

  return (
    <View ref={rootRef} style={{ flex: 1 }}>
      <Screen>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ marginRight: 'auto' }}>
            <Muted>{plan.name}</Muted>
            <H size={28} style={{ marginTop: 2 }}>My Schedule</H>
          </View>
          <Seg value={view} onChange={setView} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} style={{ alignSelf: 'auto' }} />
          <Row gap={4}>
            <Btn iconOnly icon="caret-left" label="Previous" onPress={() => shiftAnchor(-1)} style={{ borderColor: C.divider }} />
            <Btn title="Today" onPress={() => setAnchor(T0)} />
            <Btn iconOnly icon="caret-right" label="Next" onPress={() => shiftAnchor(1)} style={{ borderColor: C.divider }} />
          </Row>
          {pause
            ? <Btn variant="primary" icon="play" title="Resume schedule" onPress={() => { RG.resume(); RG.toast('Schedule resumed. Rotation continues in order.'); }} />
            : <Btn icon="pause" title="Pause schedule" onPress={() => { setPFrom(T0); setPTo(''); setDlgPause(true); }} />}
          <Btn icon="calendar-plus" title="Export .ics" onPress={exportIcs} />
        </View>

        <Row gap={18} wrap>
          <T size={15}>{rangeLabel}</T>
          <Check checked={P.shiftLater} onChange={() => RG.update(s => { s.profile.shiftLater = !s.profile.shiftLater; })} label={<T size={13} color={C.n400}>Shift later workouts when one moves</T>} />
          <Check checked={P.calendarSync} onChange={toggleSync} label={<T size={13} color={C.n400}>Show in main calendar</T>} />
          <Row gap={12} wrap style={{ marginLeft: 'auto' }}>
            {legend.map(([ic, l, f, col]) => <Row key={l} gap={4}><Icon name={ic} fill={f} size={12} color={col || C.n400} /><T size={11} color={C.n400}>{l}</T></Row>)}
          </Row>
        </Row>

        {swapEntry && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: C.a900, boxShadow: `inset 0 0 0 1px ${C.a700}` }}>
            <Icon name="arrows-left-right" size={16} color={C.accent} />
            <T size={14} style={{ flex: 1 }}>{`Swapping ${wname(swapEntry)} — pick another planned workout to trade days with.`}</T>
            <Btn title="Cancel" onPress={() => setSwapFrom(null)} />
          </View>
        )}

        {view === 'week' && (
          <Grid min={128} gap={8}>
            {weekDays.map(d => {
              const ov = over === d.d;
              return (
                <View key={d.d} ref={r => { if (r) cellRefs.current.set(d.d, r); else cellRefs.current.delete(d.d); }}
                  style={{ minHeight: 150, padding: 10, borderRadius: R.md, gap: 8, overflow: 'hidden',
                    backgroundColor: ov ? alpha(C.accent, 0.12) : d.isT || d.paused ? 'transparent' : alpha(C.text, 0.03),
                    borderWidth: 1, borderStyle: 'dashed', borderColor: ov ? C.accent : 'transparent' }}>
                  {d.isT && !ov && <LinearGradient colors={[C.a900, 'transparent']} style={StyleSheet.absoluteFill} pointerEvents="none" />}
                  {d.paused && !d.isT && !ov && <PauseStripes />}
                  <Tap onPress={openDay(d.d)} label={`Open ${RG.fmtD(d.d)}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, minHeight: 22 }}>
                    <T size={13} w={500} color={d.isT ? C.a300 : C.text}>{d.dn}</T>
                    <T size={12} color={C.n500}>{d.dm}</T>
                    <T size={10} color={C.n600}>{d.tag}</T>
                  </Tap>
                  {d.items.map(it => {
                    const fg = itemFg(it.en.status);
                    const body = (
                      <Tap onPress={select(it.en)} label={`${it.name} · ${it.en.status}`} style={itemBox(it)}>
                        <Row gap={6}>
                          <Icon name={it.icon.name} fill={it.icon.fill} size={14} color={fg} />
                          <T size={13} w={500} color={fg} style={{ flex: 1 }} numberOfLines={2}>{it.name}</T>
                          {it.drag && (
                            <Draggable id={it.en.id} name={it.name} enabled grab dnd={dnd} onTap={select(it.en)} style={{ margin: -8, padding: 8 }}>
                              <Icon name="dots-six-vertical" size={14} color={fg} style={{ opacity: 0.6 }} />
                            </Draggable>
                          )}
                        </Row>
                        <T size={11} color={fg} style={{ opacity: 0.75 }}>{it.sub}</T>
                      </Tap>
                    );
                    return wide && it.drag
                      ? <Draggable key={it.en.id} id={it.en.id} name={it.name} enabled grab={false} dnd={dnd}>{body}</Draggable>
                      : <View key={it.en.id}>{body}</View>;
                  })}
                  {!d.items.length && <T size={12} color={C.n600} style={{ paddingVertical: 4, paddingHorizontal: 2 }}>{d.emptyLabel}</T>}
                </View>
              );
            })}
          </Grid>
        )}

        {view === 'month' && (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {RG.DN.map(h => <T key={h} size={10} color={C.n500} upper style={{ flex: 1, minWidth: 0, letterSpacing: 0.8, paddingHorizontal: 6, paddingBottom: 4 }} numberOfLines={1}>{h}</T>)}
            </View>
            {monthRows.map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', gap: 4 }}>
                {row.map(d => {
                  const inM = d.slice(5, 7) === curM; const isT = d === T0; const ov = over === d; const paused = RG.inPause(d);
                  return (
                    <View key={d} ref={r => { if (r) cellRefs.current.set(d, r); else cellRefs.current.delete(d); }} style={{ flex: 1, minWidth: 0 }}>
                      <Tap onPress={openDay(d)} label={`Open ${RG.fmtD(d)}`}
                        style={{ minHeight: 78, padding: wide ? 6 : 4, borderRadius: 6, gap: 3, overflow: 'hidden', flexGrow: 1,
                          backgroundColor: ov ? alpha(C.accent, 0.12) : isT ? C.a900 : paused ? 'transparent' : inM ? alpha(C.text, 0.03) : 'transparent',
                          boxShadow: isT ? `inset 0 0 0 1px ${C.a700}` : undefined, borderWidth: 1, borderStyle: 'dashed', borderColor: ov ? C.accent : 'transparent' }}>
                        {paused && !isT && !ov && <PauseStripes gap={12} />}
                        <T size={12} w={isT ? 600 : 400} color={isT ? C.a300 : inM ? C.n300 : C.n700}>{Number(d.slice(8))}</T>
                        {RG.entriesOn(d).map(mkItem).map(it => {
                          const st = it.en.status;
                          return (
                            <Draggable key={it.en.id} id={it.en.id} name={it.name} enabled={it.drag} grab={!wide} dnd={dnd} onTap={wide ? undefined : openDay(d)}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: wide ? 6 : 3, borderRadius: 4, minWidth: 0,
                                backgroundColor: st === 'done' ? C.a800 : st === 'planned' ? C.n800 : 'transparent', opacity: drag?.id === it.en.id ? 0.4 : 1 }}>
                              {wide && <Icon name={it.icon.name} fill={it.icon.fill} size={11} color={st === 'done' ? C.a100 : st === 'planned' ? C.text : C.n500} />}
                              <T size={11} lh={1.3} numberOfLines={1} color={st === 'done' ? C.a100 : st === 'planned' ? C.text : C.n500} style={{ flexShrink: 1 }}>{it.short}</T>
                            </Draggable>
                          );
                        })}
                      </Tap>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {view === 'day' && (
          <Card gap={12} pad={[18, 20]}>
            <Row gap={10} wrap style={{ alignItems: 'baseline' }}>
              <H size={24}>{RG.fmtD(anchor)}</H>
              <T size={13} color={C.n500}>{RG.dayType(anchor) === 'training' ? 'Training day' : 'Rest day'}</T>
            </Row>
            {dayItems.map(e => (
              <View key={e.en.id} style={{ gap: 10 }}>
                <Row gap={10} wrap>
                  <Icon name={e.icon.name} fill={e.icon.fill} size={20} color={C.accent} />
                  <T size={18} style={{ flex: 1 }}>{e.name}</T>
                  <Tag style={{ alignSelf: 'center' }}>{e.en.status}</Tag>
                  <Btn title="Actions" onPress={select(e.en)} />
                </Row>
                <Grid min={240} gap={6}>
                  {e.exercises.map(x => (
                    <View key={x.key} style={{ flexDirection: 'row', gap: 8, paddingVertical: 6 }}>
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: C.divider }} />
                      <T size={13} style={{ flex: 1 }}>{x.name}</T>
                      <T size={13} color={C.n500} tab>{x.scheme}</T>
                    </View>
                  ))}
                </Grid>
              </View>
            ))}
            {!dayItems.length && <T size={14} color={C.n400}>No workout scheduled. Rest and recovery count as training too.</T>}
          </Card>
        )}

        <Grid min={340}>
          <Card gap={10}>
            <CardTitle>Rotation</CardTitle>
            <Muted>Workouts always run in this order. Skipping, moving or pausing never loses your place.</Muted>
            <Row gap={6} wrap>
              {plan.rotation.map((id, i) => {
                const on = nx && nx.workoutId === id;
                return (
                  <Row key={id + i} gap={6}>
                    <View style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, backgroundColor: on ? C.a800 : C.n900, boxShadow: on ? `inset 0 0 0 1px ${C.accent}` : undefined }}>
                      <T size={12} color={on ? C.a100 : C.n300} lh={1.3}>{RG.workout(id)?.name || id}</T>
                    </View>
                    {i < plan.rotation.length - 1 && <Icon name="arrow-right" size={12} color={C.n600} />}
                  </Row>
                );
              })}
            </Row>
            <T size={13} color={C.n300}>{nx ? `Next up: ${wname(nx)} · ${RG.fmtD(nx.date)}` : 'Nothing scheduled'}</T>
            <Muted>{`Training days: ${P.trainingDays.map(i => RG.DN[i]).join(', ')} · Rest: ${P.restDays.map(i => RG.DN[i]).join(', ')} · Recovery rule: ${plan.allowConsecutive ? 'same muscles allowed back-to-back' : 'no same-region days back-to-back'}`}</Muted>
          </Card>
          <Card gap={8}>
            <CardTitle>Needs attention</CardTitle>
            {recent.map(e => (
              <Row key={e.id} gap={10} style={{ paddingVertical: 4 }}>
                <Icon name={e.status === 'missed' ? 'x-circle' : 'skip-forward-circle'} size={14} color={C.n400} />
                <T size={13} style={{ flex: 1 }}>{`${wname(e)} · ${RG.fmtD(e.date)} · ${e.status}`}</T>
                <Btn variant="ghost" size="sm" title={e.status === 'missed' ? 'Reschedule' : 'Restore'} onPress={() => { setSel(e.id); setMoveDate(RG.add(T0, 1)); }} />
              </Row>
            ))}
            {!recent.length && <T size={13} color={C.n500}>Nothing missed or skipped in the last four weeks.</T>}
            {S.pauses.map(p => (
              <Row key={p.id} gap={4}><Icon name="pause" size={12} color={C.n500} /><Muted>{`Paused ${RG.fmtShort(p.from)} – ${p.to ? RG.fmtShort(p.to) : 'open'} · ${p.reason}`}</Muted></Row>
            ))}
          </Card>
        </Grid>

        {/* entry actions */}
        <Dialog open={!!sel} onClose={close} width={480}>
          {sel && (
            <>
              <Row gap={10} align="flex-start">
                <View style={{ flex: 1 }}>
                  <Kicker>{`${RG.fmtD(sel.date)} · ${sel.status}`}</Kicker>
                  <T size={20} w={500} lh={1.2} style={{ marginTop: 4 }}>{sw?.name || sel.workoutId}</T>
                </View>
                <Btn variant="ghost" iconOnly icon="x" color={C.text} label="Close" onPress={close} />
              </Row>
              <T size={13} color={C.n400}>{sel.status === 'planned' ? 'Auto-scheduled workouts are only marked complete once you log them.' : sel.status === 'missed' ? 'Rescheduling adds a new session and keeps this one in your history as missed.' : sel.status === 'done' ? 'Logged sessions stay on the day they happened.' : 'Skipped — the rotation moved on to the next workout.'}</T>
              {sel.status === 'planned' && (
                <>
                  <Field label="Move to date">
                    <Row gap={6}><DateField value={moveDate} onChange={setMoveDate} label="Move to date" /><Btn variant="primary" title="Move" onPress={doMove} /></Row>
                  </Field>
                  <Grid min={150} gap={6}>
                    <Btn icon="play" title="Open workout" onPress={() => { const id = sel.id; close(); RG.startWorkout(id); }} />
                    <Btn icon="arrows-left-right" title="Swap with…" onPress={() => { setSwapFrom(sel.id); setSel(null); }} />
                    <Btn icon="skip-forward" title="Skip" onPress={() => { RG.skipEntry(sel.id); close(); RG.toast(`${sw?.name || 'Workout'} skipped.`); }} />
                    <Btn icon="x-circle" title="Mark missed" onPress={() => { RG.missEntry(sel.id); close(); }} />
                  </Grid>
                </>
              )}
              {(sel.status === 'missed' || sel.status === 'skipped') && (
                <>
                  <Field label="Reschedule to">
                    <Row gap={6}><DateField value={moveDate} onChange={setMoveDate} label="Reschedule to" /><Btn variant="primary" title="Reschedule" onPress={doReschedule} /></Row>
                  </Field>
                  <Btn title="Undo — set back to planned" onPress={() => { RG.restoreEntry(sel.id); close(); }} />
                </>
              )}
              {sel.status === 'done' && <Btn icon="clock-counter-clockwise" title="View logged session" onPress={() => { const sid = sel.sessionId; close(); RG.go('history', sid); }} />}
            </>
          )}
        </Dialog>

        {/* pause */}
        <Dialog open={dlgPause} onClose={() => setDlgPause(false)} title="Pause schedule"
          body="Planned workouts in the pause are taken off the calendar. When you resume, the rotation picks up with the next workout in order."
          actions={<><Btn title="Cancel" onPress={() => setDlgPause(false)} /><Btn variant="primary" title="Pause" disabled={!pFrom} onPress={doPause} /></>}>
          <Row gap={6} wrap>
            {['Illness', 'Travel', 'Injury', 'Recovery', 'Other'].map(l => <Chip key={l} label={l} on={reason === l} onPress={() => setReason(l)} style={{ borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 }} />)}
          </Row>
          <Grid min={150} gap={8}>
            <Field label="From"><DateField value={pFrom} onChange={setPFrom} label="From" /></Field>
            <Field label="Until (optional)"><DateField value={pTo} onChange={setPTo} label="Until" allowEmpty /></Field>
          </Grid>
        </Dialog>
      </Screen>

      {drag && (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, transform: pos.getTranslateTransform(), zIndex: 100,
          flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: C.surface, boxShadow: `0 0 0 1px ${C.accent}, 0 8px 22px rgba(0,0,0,0.5)` }}>
          <Icon name="circle-dashed" size={14} />
          <T size={13} w={500}>{drag.name}</T>
        </Animated.View>
      )}
    </View>
  );
}
