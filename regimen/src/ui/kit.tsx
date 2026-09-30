/* Nocturne component kit for React Native (+ web). Mirrors the prototype's CSS classes:
   .btn(-primary/-secondary/-ghost/-icon) · .card · .card-kicker · .card-title · .tag · .hr (fading rule) · .input · .seg · .dialog.
   Buttons are outlined, never filled. Touch targets reach ≥ 44 px via hitSlop. */
import { LinearGradient } from 'expo-linear-gradient';
import React, { Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from 'react';
import {
  Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
  type PressableStateCallbackType, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';
import { ICONS, type IconName } from './icons';
import { alpha, C, FONT, R, SHADOW, WIDE } from './theme';

type PState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };
const focusRing = (st: PState): ViewStyle => (st.focused && Platform.OS === 'web' ? { outlineColor: C.accent, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle : {});

/* ── Layout ── */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  return { width, height, wide: width >= WIDE };
}

/* ── Text ── */
export interface TProps { size?: number; w?: 400 | 500 | 600; color?: string; tab?: boolean; center?: boolean; upper?: boolean; lh?: number; style?: StyleProp<TextStyle>; children?: ReactNode; numberOfLines?: number; selectable?: boolean; onPress?: () => void }
export function T({ size = 15, w = 400, color = C.text, tab, center, upper, lh, style, children, numberOfLines, selectable, onPress }: TProps) {
  return (
    <Text
      numberOfLines={numberOfLines} selectable={selectable} onPress={onPress}
      style={[{ fontFamily: w === 600 ? FONT.semibold : w === 500 ? FONT.medium : FONT.regular, fontSize: size, color, lineHeight: Math.round(size * (lh ?? 1.5)) },
        tab && { fontVariant: ['tabular-nums'] }, center && { textAlign: 'center' }, upper && { textTransform: 'uppercase' }, style]}
    >{children}</Text>
  );
}
/** Heading: weight 500, letter-spacing −0.015em, line-height 1.12. */
export function H({ size = 28, style, children, color }: { size?: number; style?: StyleProp<TextStyle>; children?: ReactNode; color?: string }) {
  return <T size={size} w={500} color={color} lh={1.12} style={[{ letterSpacing: -0.015 * size }, style]}>{children}</T>;
}
export const Kicker = ({ children, color = C.accent, style }: { children?: ReactNode; color?: string; style?: StyleProp<TextStyle> }) =>
  <T size={10} color={color} upper style={[{ letterSpacing: 1 }, style]}>{children}</T>;
export const CardTitle = ({ children, size = 17, style }: { children?: ReactNode; size?: number; style?: StyleProp<TextStyle> }) =>
  <T size={size} w={500} lh={1.2} style={style}>{children}</T>;
export const Muted = ({ children, size = 12, color = C.n500, style, tab, numberOfLines }: { children?: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle>; tab?: boolean; numberOfLines?: number }) =>
  <T size={size} color={color} style={style} tab={tab} numberOfLines={numberOfLines}>{children}</T>;
/** Small uppercase column label (tables, list headers). */
export const ColLabel = ({ children, style }: { children?: ReactNode; style?: StyleProp<TextStyle> }) =>
  <T size={10} color={C.n500} upper style={[{ letterSpacing: 0.8 }, style]}>{children}</T>;

/* ── Icon ── */
export function Icon({ name, size = 16, color = C.text, fill, style }: { name: IconName; size?: number; color?: string; fill?: boolean; style?: StyleProp<ViewStyle> }) {
  const I = ICONS[name];
  return <View style={style} pointerEvents="none"><I size={size} color={color} weight={fill ? 'fill' : 'regular'} /></View>;
}

/* ── Buttons ── */
export type BtnVariant = 'primary' | 'secondary' | 'ghost';
export interface BtnProps {
  title?: ReactNode; icon?: IconName; iconFill?: boolean; iconRight?: IconName; onPress?: () => void; variant?: BtnVariant; disabled?: boolean;
  size?: 'sm' | 'md' | 'lg'; iconOnly?: boolean; style?: StyleProp<ViewStyle>; color?: string; label?: string; iconSize?: number; block?: boolean;
}
export function Btn({ title, icon, iconFill, iconRight, onPress, variant = 'secondary', disabled, size = 'md', iconOnly, style, color, label, iconSize, block }: BtnProps) {
  // Primary buttons are filled so the main action on each screen is easy to spot.
  const fg = color || (variant === 'secondary' ? C.text : variant === 'primary' ? C.bg : C.accent);
  const fs = size === 'lg' ? 15 : size === 'sm' ? 12 : 14;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label || (typeof title === 'string' ? title : undefined)} disabled={disabled} onPress={onPress}
      hitSlop={iconOnly ? 4 : { top: 7, bottom: 7, left: 2, right: 2 }}
      style={(st: PState) => [
        s.btn,
        variant === 'primary' && { borderColor: C.accent, backgroundColor: C.accent },
        variant === 'secondary' && { borderColor: C.divider },
        variant === 'ghost' && { paddingHorizontal: 2.8 + (title ? 3 : 0) },
        size === 'lg' && { paddingVertical: 10, paddingHorizontal: 18 },
        size === 'sm' && { paddingVertical: 4, paddingHorizontal: 8 },
        iconOnly && { width: 36, height: 36, paddingHorizontal: 0, paddingVertical: 0 },
        block && { alignSelf: 'stretch' },
        (st.hovered || st.pressed) && {
          backgroundColor: variant === 'primary' ? (st.pressed ? C.a600 : C.a400) : variant === 'secondary' ? alpha(C.text, st.pressed ? 0.14 : 0.07) : alpha(C.accent, st.pressed ? 0.18 : 0.1),
        },
        disabled && { opacity: 0.45 },
        focusRing(st), style,
      ]}
    >
      {icon && <Icon name={icon} fill={iconFill} size={iconSize || (iconOnly ? 18 : fs + 2)} color={fg} />}
      {title != null && title !== '' && (typeof title === 'string' || typeof title === 'number' ? <T size={fs} w={500} color={fg} lh={1.2}>{title}</T> : title)}
      {iconRight && <Icon name={iconRight} size={fs + 1} color={fg} />}
    </Pressable>
  );
}

/** Pill toggle used for filter chips, reason chips, feel chips. */
export function Chip({ label, on, onPress, icon, style }: { label: string; on?: boolean; onPress?: () => void; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress} hitSlop={6}
      style={(st: PState) => [s.chip, on ? { borderColor: C.accent, backgroundColor: alpha(C.accent, st.hovered ? 0.2 : 0.14) } : st.hovered && { backgroundColor: alpha(C.text, 0.06) }, focusRing(st), style]}>
      {icon && <Icon name={icon} size={13} color={on ? C.accent : C.n400} />}
      <T size={12} color={on ? C.accent : C.n300}>{label}</T>
    </Pressable>
  );
}

/** Generic pressable surface (rows, cells, tiles). */
export function Tap({ onPress, style, children, label, disabled, onLongPress }: { onPress?: () => void; style?: StyleProp<ViewStyle> | ((st: PState) => StyleProp<ViewStyle>); children?: ReactNode; label?: string; disabled?: boolean; onLongPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onLongPress={onLongPress} disabled={disabled}
      style={(st: PState) => [typeof style === 'function' ? style(st) : style, st.hovered && !disabled && { opacity: 0.92 }, focusRing(st)]}>
      {children}
    </Pressable>
  );
}

/* ── Surfaces ── */
export function Card({ children, style, gap = 12, pad = [16, 18] }: { children?: ReactNode; style?: StyleProp<ViewStyle>; gap?: number; pad?: [number, number] }) {
  return <View style={[s.card, { gap, paddingVertical: pad[0], paddingHorizontal: pad[1] }, style]}>{children}</View>;
}
/** Card with the hero gradient (160deg, #272a3b → surface at 60%). */
export function HeroCard({ children, style, gap = 12 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return (
    <View style={[s.card, { padding: 0, overflow: 'hidden' }, style]}>
      <LinearGradient colors={[C.heroTop, C.surface]} locations={[0, 0.6]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ paddingVertical: 18, paddingHorizontal: 20, gap, flexGrow: 1 }}>
        {children}
      </LinearGradient>
    </View>
  );
}
/** Accent-tinted banner (paused schedule, active workout, quotes). */
export function Banner({ children, style, gradient }: { children?: ReactNode; style?: StyleProp<ViewStyle>; gradient?: boolean }) {
  if (gradient) return (
    <View style={[{ borderRadius: R.md, overflow: 'hidden', boxShadow: `inset 0 0 0 1px ${C.a800}` }, style]}>
      <LinearGradient colors={[C.a900, 'transparent']} locations={[0, 0.7]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20, flexGrow: 1 }}>
        {children}
      </LinearGradient>
    </View>
  );
  return <View style={[s.banner, style]}>{children}</View>;
}

export function Tag({ children, variant = 'neutral', icon, style }: { children?: ReactNode; variant?: 'accent' | 'neutral' | 'outline'; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const fg = variant === 'accent' ? C.a100 : variant === 'outline' ? C.accent : C.n100;
  return (
    <View style={[s.tag, variant === 'accent' && { backgroundColor: C.a800 }, variant === 'neutral' && { backgroundColor: C.n800 }, variant === 'outline' && { borderWidth: 1, borderColor: C.accent }, style]}>
      {icon && <Icon name={icon} size={12} fill color={fg} />}
      <T size={11} color={fg} lh={1.3} style={{ letterSpacing: 0.2 }}>{children}</T>
    </View>
  );
}

/** Freestanding rule that fades over 48 px at each end (a Nocturne signature). */
export function Rule({ style, color = C.divider }: { style?: StyleProp<ViewStyle>; color?: string }) {
  return (
    <View style={[{ height: 1, flexDirection: 'row' }, style]} pointerEvents="none">
      <LinearGradient colors={['transparent', color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 48, height: 1 }} />
      <View style={{ flex: 1, height: 1, backgroundColor: color }} />
      <LinearGradient colors={[color, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 48, height: 1 }} />
    </View>
  );
}
/** A list row with the fading rule along its top edge. */
export function RuledRow({ children, style, faint }: { children?: ReactNode; style?: StyleProp<ViewStyle>; faint?: boolean }) {
  return (
    <View style={[{ paddingVertical: 8 }, style]}>
      <Rule color={faint ? alpha(C.text, 0.08) : C.divider} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      {children}
    </View>
  );
}

/** Auto-fit grid: repeat(auto-fit, minmax(min(100%, N px), 1fr)). */
export function Grid({ min, gap = 16, children, style }: { min: number; gap?: number; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [w, setW] = useState(0);
  const kids = Children.toArray(children).filter(Boolean);
  const cols = w ? Math.max(1, Math.min(kids.length || 1, Math.floor((w + gap) / (Math.min(min, w) + gap)))) : 1;
  const cw = w ? Math.floor((w - 1 - gap * (cols - 1)) / cols) : undefined; // floor: onLayout widths are rounded
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {kids.map((k, i) => (
        <View key={i} style={{ width: cw ?? '100%', minWidth: 0 }}>
          {/* like CSS grid: items in a row stretch to equal height */}
          {isValidElement(k) && typeof (k as ReactElement<{ style?: unknown }>).props.style !== 'function' ? cloneElement(k as ReactElement<{ style?: StyleProp<ViewStyle> }>, { style: [{ flexGrow: 1 }, (k as ReactElement<{ style?: StyleProp<ViewStyle> }>).props.style] }) : k}
        </View>
      ))}
    </View>
  );
}
export const Row = ({ children, gap = 8, style, wrap, align = 'center' }: { children?: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean; align?: ViewStyle['alignItems'] }) =>
  <View style={[{ flexDirection: 'row', alignItems: align, gap }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
export const Col = ({ children, gap = 8, style }: { children?: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) =>
  <View style={[{ gap }, style]}>{children}</View>;
export const Spacer = () => <View style={{ flex: 1 }} />;

/* ── Forms ── */
export function Field({ label, children, style, hint }: { label?: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle>; hint?: ReactNode }) {
  return (
    <View style={[{ gap: 5, minWidth: 0 }, style]}>
      {label != null && <T size={12} color={alpha(C.text, 0.7)}>{label}</T>}
      {children}
      {hint != null && <Muted size={11}>{hint}</Muted>}
    </View>
  );
}

export interface InputProps extends Omit<TextInputProps, 'value' | 'onChange' | 'style'> {
  value: string | number | null | undefined; onChange?: (v: string) => void; numeric?: boolean; style?: StyleProp<TextStyle>; size?: number; height?: number; center?: boolean;
}
export function Input({ value, onChange, numeric, style, size = 14, height = 36, center, multiline, ...rest }: InputProps) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      {...rest}
      multiline={multiline}
      value={value == null ? '' : String(value)}
      onChangeText={onChange}
      keyboardType={numeric ? 'decimal-pad' : rest.keyboardType}
      inputMode={numeric ? 'decimal' : rest.inputMode}
      placeholderTextColor={C.n600}
      selectionColor={C.accent}
      onFocus={e => { setFocus(true); rest.onFocus?.(e); }}
      onBlur={e => { setFocus(false); rest.onBlur?.(e); }}
      style={[s.input, { fontSize: size, minHeight: multiline ? 90 : height }, center && { textAlign: 'center' }, multiline && { textAlignVertical: 'top', paddingTop: 8 },
        focus && { borderColor: C.accent }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as unknown as TextStyle), style]}
    />
  );
}
/** Numeric input that keeps its own text while typing and reports numbers (or null when empty). */
export function NumInput({ value, onValue, ...rest }: Omit<InputProps, 'value' | 'onChange'> & { value: number | null | undefined | string; onValue: (n: number | null) => void }) {
  const [txt, setTxt] = useState<string | null>(null);
  return <Input {...rest} numeric value={txt ?? (value == null || value === '' ? '' : String(value))}
    onChange={v => { setTxt(v); const n = parseFloat(v.replace(',', '.')); onValue(v.trim() === '' ? null : Number.isFinite(n) ? n : null); }}
    onBlur={e => { setTxt(null); rest.onBlur?.(e); }} />;
}

export type Opt<V extends string | number = string> = V | { value: V; label: string };
const optV = <V extends string | number>(o: Opt<V>): V => (typeof o === 'object' ? o.value : o);
const optL = <V extends string | number>(o: Opt<V>) => (typeof o === 'object' ? o.label : String(o));

/** Dropdown select (opens a list in a modal). */
export function Select<V extends string | number>({ value, options, onChange, style, placeholder, title, height = 36 }: { value: V | null | undefined; options: Opt<V>[]; onChange: (v: V) => void; style?: StyleProp<ViewStyle>; placeholder?: string; title?: string; height?: number }) {
  const [open, setOpen] = useState(false);
  const cur = options.find(o => optV(o) === value);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => setOpen(true)}
        style={(st: PState) => [s.input, { minHeight: height, flexDirection: 'row', alignItems: 'center', gap: 6 }, st.hovered && { borderColor: alpha(C.text, 0.45) }, focusRing(st), style]}>
        <T size={14} numberOfLines={1} color={cur ? C.text : C.n600} style={{ flex: 1 }}>{cur ? optL(cur) : placeholder || 'Choose…'}</T>
        <Icon name="caret-down" size={12} color={C.n400} />
      </Pressable>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} width={380}>
        <ScrollView style={{ maxHeight: 420 }}>
          {options.map(o => {
            const on = optV(o) === value;
            return (
              <Pressable key={String(optV(o))} onPress={() => { onChange(optV(o)); setOpen(false); }}
                style={(st: PState) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 6 },
                  on && { backgroundColor: alpha(C.accent, 0.14) }, st.hovered && !on && { backgroundColor: alpha(C.text, 0.06) }]}>
                <T size={14} color={on ? C.accent : C.text} style={{ flex: 1 }}>{optL(o)}</T>
                {on && <Icon name="check" size={14} color={C.accent} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Dialog>
    </>
  );
}

/** Segmented control (.seg). */
export function Seg<V extends string | number>({ value, options, onChange, style, size = 12 }: { value: V; options: Opt<V>[]; onChange: (v: V) => void; style?: StyleProp<ViewStyle>; size?: number }) {
  return (
    <View style={[s.seg, style]}>
      {options.map((o, i) => {
        const on = optV(o) === value;
        return (
          <Pressable key={String(optV(o))} onPress={() => onChange(optV(o))} accessibilityRole="button" accessibilityState={{ selected: on }} hitSlop={{ top: 6, bottom: 6 }}
            style={(st: PState) => [{ paddingVertical: 6, paddingHorizontal: 12, justifyContent: 'center' }, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.divider },
              on ? { backgroundColor: alpha(C.accent, 0.14) } : st.hovered && { backgroundColor: alpha(C.text, 0.07) }, focusRing(st)]}>
            <T size={size} color={on ? C.accent : C.n400}>{optL(o)}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tab strip (underlined). */
export function Tabs<V extends string | number>({ value, options, onChange, style }: { value: V; options: Opt<V>[]; onChange: (v: V) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ gap: 4 }}>
      {options.map(o => {
        const on = optV(o) === value;
        return (
          <Pressable key={String(optV(o))} onPress={() => onChange(optV(o))} hitSlop={{ top: 6, bottom: 6 }}
            style={(st: PState) => [{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 }, on ? { boxShadow: `inset 0 -2px 0 ${C.accent}` } : st.hovered && { backgroundColor: alpha(C.text, 0.06) }, focusRing(st)]}>
            <T size={13} color={on ? C.text : C.n400} w={on ? 500 : 400}>{optL(o)}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Check({ checked, onChange, label, style, size = 13 }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; style?: StyleProp<ViewStyle>; size?: number }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} hitSlop={8}
      style={(st: PState) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }, focusRing(st), style]}>
      <View style={[s.box, checked && { backgroundColor: C.accent, borderColor: C.accent }]}>{checked && <Icon name="check" size={11} color={C.bg} />}</View>
      {label != null && (typeof label === 'string' ? <T size={size} style={{ flexShrink: 1 }}>{label}</T> : label)}
    </Pressable>
  );
}

/* ── Dialog ── */
export function Dialog({ open, onClose, title, body, children, actions, width = 440 }: { open: boolean; onClose: () => void; title?: ReactNode; body?: ReactNode; children?: ReactNode; actions?: ReactNode; width?: number }) {
  const { height } = useWindowDimensions();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close dialog">
        <Pressable onPress={e => e.stopPropagation()} style={[s.dialog, { width: '100%', maxWidth: width, maxHeight: height * 0.9 }]}>
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            {title != null && <T size={20} w={500} lh={1.2}>{title}</T>}
            {body != null && (typeof body === 'string' ? <T size={14} color={alpha(C.text, 0.85)}>{body}</T> : body)}
            {children}
            {actions != null && <View style={{ flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>{actions}</View>}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Permanent-delete confirmation: a checkbox, or typing DELETE for bulk deletes. */
export function ConfirmDelete({ open, onClose, onConfirm, title, body, typed, confirmLabel = 'Delete permanently' }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; typed?: boolean; confirmLabel?: string }) {
  const [ok, setOk] = useState(false); const [txt, setTxt] = useState('');
  const ready = typed ? txt.trim() === 'DELETE' : ok;
  const close = () => { setOk(false); setTxt(''); onClose(); };
  return (
    <Dialog open={open} onClose={close} title={title} body={body}
      actions={<><Btn title="Cancel" onPress={close} /><Btn variant="primary" title={confirmLabel} icon="trash" disabled={!ready} onPress={() => { onConfirm(); close(); }} /></>}>
      {typed
        ? <Field label="Type DELETE to confirm"><Input value={txt} onChange={setTxt} autoCapitalize="characters" placeholder="DELETE" /></Field>
        : <Check checked={ok} onChange={setOk} label="I understand this can't be undone." />}
    </Dialog>
  );
}

/* ── Data display ── */
/** Layered horizontal bars on a track: later fills paint over earlier ones. */
export function Bar({ fills, height = 6, track = C.n900, style }: { fills: { pct: number; color: string }[]; height?: number; track?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }, style]}>
      {fills.map((f, i) => <View key={i} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, Math.max(0, f.pct))}%`, borderRadius: height / 2, backgroundColor: f.color }} />)}
    </View>
  );
}

export interface Series { points: string; color: string; width?: number; dash?: string }
/** Polyline chart in a w×h viewBox stretched to the container (preserveAspectRatio none), as in the prototype. */
export function LineChart({ series, w = 280, h = 80, height = 80, grid, bars }: { series: Series[]; w?: number; h?: number; height?: number; grid?: number[]; bars?: { x: number; y: number; width: number; height: number; color: string }[] }) {
  return (
    <Svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      {grid?.map((y, i) => <Line key={'g' + i} x1={0} x2={w} y1={y} y2={y} stroke={C.n800} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
      {bars?.map((b, i) => <Rect key={'b' + i} x={b.x} y={b.y} width={b.width} height={b.height} fill={b.color} />)}
      {series.filter(x => x.points).map((x, i) => <Polyline key={i} points={x.points} fill="none" stroke={x.color} strokeWidth={x.width ?? 1.5} strokeDasharray={x.dash} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />)}
    </Svg>
  );
}

export function Stat({ value, label, sub, size = 22 }: { value: ReactNode; label: ReactNode; sub?: ReactNode; size?: number }) {
  return (
    <View style={{ minWidth: 0 }}>
      <T size={size} tab lh={1.2}>{value}{sub != null && <T size={size} color={C.n500} tab>{sub}</T>}</T>
      <Muted size={11}>{label}</Muted>
    </View>
  );
}

/** "Not medical advice" — shown wherever calculations are presented. */
export function NotMedical({ text, style }: { text?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Row gap={6} align="flex-start" style={style}>
      <Icon name="info" size={13} color={C.n500} style={{ marginTop: 2 }} />
      <Muted size={11} style={{ flex: 1 }}>{text || 'Not medical advice. These are estimates to help you plan — adjust with a qualified professional if you have a medical condition.'}</Muted>
    </Row>
  );
}

export function PageHeader({ kicker, title, sub, right }: { kicker?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
      <View style={{ marginRight: 'auto', flexShrink: 1, minWidth: 200 }}>
        {kicker != null && (typeof kicker === 'string' ? <Muted>{kicker}</Muted> : kicker)}
        <H size={28} style={{ marginTop: 2 }}>{title}</H>
        {sub != null && (typeof sub === 'string' ? <T size={13} color={C.n400} style={{ marginTop: 4 }}>{sub}</T> : sub)}
      </View>
      {right != null && <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>{right}</View>}
    </View>
  );
}

export const Page = ({ children, gap = 16 }: { children?: ReactNode; gap?: number }) => <View style={{ gap }}>{children}</View>;

export function Empty({ icon = 'info', title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 16 }}>
      <Icon name={icon} size={26} color={C.n600} />
      <T size={15} w={500} center>{title}</T>
      {body && <Muted size={13} style={{ textAlign: 'center', maxWidth: 420 }}>{body}</Muted>}
      {action}
    </View>
  );
}

/** Striped placeholder used for empty photo slots. */
export function Stripes({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: C.n900, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        {Array.from({ length: 220 }, (_, i) => <Line key={i} x1={i * 14 - 1500} y1={0} x2={i * 14} y2={1500} stroke={C.n800} strokeWidth={5} />)}
      </Svg>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: 'transparent', borderRadius: R.md, paddingVertical: 5.6, paddingHorizontal: 10.08, minHeight: 32, backgroundColor: 'transparent' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: C.n800 },
  card: { backgroundColor: C.surface, borderRadius: R.md, boxShadow: SHADOW.sm, minWidth: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingVertical: 12, paddingHorizontal: 16, borderRadius: R.md, boxShadow: `inset 0 0 0 1px ${C.a700}`, backgroundColor: C.a900 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start' },
  input: { width: '100%', paddingVertical: 6, paddingHorizontal: 10, fontFamily: FONT.regular, color: C.text, backgroundColor: C.surface, borderWidth: 1, borderColor: C.divider, borderRadius: R.md },
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: C.divider, borderRadius: R.md, overflow: 'hidden', alignSelf: 'flex-start' },
  box: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: C.n600, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 11.2, backgroundColor: alpha(C.n900, 0.6) },
  dialog: { padding: 16, borderRadius: R.lg, backgroundColor: C.surface, boxShadow: SHADOW.lg },
});
