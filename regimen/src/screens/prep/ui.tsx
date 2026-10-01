/* Local layout helpers shared by the Prep, Recipes, Settings and Onboarding ports.
   Grid: same as kit Grid, but column widths are floored — the kit's onLayout width is rounded, so three
   fractional columns can overflow by a fraction of a pixel and wrap early. */
import { Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import { Input, Rule, T, type InputProps } from '@/ui/kit';
import { alpha, C } from '@/ui/theme';
import { useRG } from '@/store/rg';

/** `top`: like CSS `align-items: start` — items keep their own height. */
export function Grid({ min, gap = 16, children, style, top }: { min: number; gap?: number; children?: ReactNode; style?: StyleProp<ViewStyle>; top?: boolean }) {
  const [w, setW] = useState(0);
  const kids = Children.toArray(children).filter(Boolean);
  const cols = w ? Math.max(1, Math.min(kids.length || 1, Math.floor((w + gap) / (Math.min(min, w) + gap)))) : 1;
  const cw = w ? Math.floor((w - 1 - gap * (cols - 1)) / cols) : undefined;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, top && { alignItems: 'flex-start' }, style]} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {kids.map((k, i) => (
        <View key={i} style={{ width: cw ?? '100%', minWidth: 0 }}>
          {!top && isValidElement(k) ? cloneElement(k as ReactElement<{ style?: StyleProp<ViewStyle> }>, { style: [{ flexGrow: 1 }, (k as ReactElement<{ style?: StyleProp<ViewStyle> }>).props.style] }) : k}
        </View>
      ))}
    </View>
  );
}

/** Local table (.table): uppercase header, fading row rules, horizontal scroll below a minimum width. */
export function Table({ cols, rows, minWidth = 720 }: { cols: { label: string; flex: number }[]; rows: { key: string; cells: ReactNode[] }[]; minWidth?: number }) {
  const [w, setW] = useState(0);
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={w < minWidth}>
        <View style={{ width: Math.max(w, minWidth) }}>
          <View style={{ flexDirection: 'row' }}>
            {cols.map(c => <T key={c.label} size={11} w={600} upper color={alpha(C.text, 0.6)} style={{ flex: c.flex, padding: 5.6, letterSpacing: 0.9 }}>{c.label}</T>)}
          </View>
          <Rule />
          {rows.map(r => (
            <View key={r.key}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {r.cells.map((cell, i) => <View key={i} style={{ flex: cols[i].flex, padding: 5.6, minWidth: 0 }}>{cell}</View>)}
              </View>
              <Rule color={alpha(C.text, 0.08)} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}


type PState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };
/** Toggle button used for day / equipment / diet pickers (the prototype's `chip` style: 8 px radius, 13 px). */
export function Pick({ label, on, onPress, style, sub }: { label: string; on: boolean; onPress: () => void; style?: StyleProp<ViewStyle>; sub?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} hitSlop={{ top: 6, bottom: 6 }}
      style={(st: PState) => [{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: on ? C.accent : C.n800, minHeight: 36, justifyContent: 'center' },
        on ? { backgroundColor: alpha(C.accent, st.hovered ? 0.2 : 0.14) } : st.hovered && { backgroundColor: alpha(C.text, 0.06) },
        st.focused && { outlineColor: C.accent, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle, style]}>
      <T size={13} color={on ? C.accent : C.n300} lh={1.3}>{label}</T>
      {sub != null && <T size={11} color={on ? C.a300 : C.n500} lh={1.3}>{sub}</T>}
    </Pressable>
  );
}

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;
/** HH:MM time field (stands in for <input type=time>). Keeps its own text while typing; commits valid times. */
export function TimeInput({ value, onChange, style, ...rest }: Omit<InputProps, 'value' | 'onChange'> & { value: string; onChange: (v: string) => void }) {
  const clock = useRG().s.profile.clock;
  const [txt, setTxt] = useState<string | null>(null);
  if (clock === '24h') {
    const commit = (v: string) => { const m = v.trim().match(TIME); if (m) onChange(`${m[1].padStart(2, '0')}:${m[2]}`); };
    return <Input {...rest} style={style} value={txt ?? value} placeholder={rest.placeholder ?? 'HH:MM'} maxLength={5} inputMode="numeric"
      onChange={v => { setTxt(v); commit(v); }} onBlur={e => { setTxt(null); rest.onBlur?.(e); }} />;
  }
  // 12-hour: "h:mm" plus an AM/PM switch. Typing a 24-hour time (e.g. 17:30) also works.
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || '');
  const h24 = m ? Number(m[1]) % 24 : null; const pm = h24 != null && h24 >= 12;
  const shown = m ? `${(h24! % 12) || 12}:${m[2]}` : '';
  const to24 = (h: number, min: string, isPm: boolean) => `${String((h % 12) + (isPm ? 12 : 0)).padStart(2, '0')}:${min}`;
  const commit = (v: string) => {
    const x = /^(\d{1,2}):?([0-5]\d)$/.exec(v.trim()); if (!x) return;
    const h = Number(x[1]); if (h > 23) return;
    onChange(h === 0 || h > 12 ? `${String(h).padStart(2, '0')}:${x[2]}` : to24(h, x[2], pm));
  };
  const flip = () => { if (m) onChange(to24(h24! % 12, m[2], !pm)); };
  return (
    <View style={[{ flexDirection: 'row', gap: 6, alignItems: 'center' }, style as StyleProp<ViewStyle>]}>
      <Input {...rest} style={{ flex: 1, minWidth: 64 }} value={txt ?? shown} placeholder={rest.placeholder ?? 'h:mm'} maxLength={5} inputMode="numeric"
        onChange={v => { setTxt(v); commit(v); }} onBlur={e => { setTxt(null); rest.onBlur?.(e); }} />
      <Pressable onPress={flip} accessibilityRole="button" accessibilityLabel={`${pm ? 'PM' : 'AM'}, switch to ${pm ? 'AM' : 'PM'}`}
        style={({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => ({ height: rest.height ?? 36, minWidth: 48, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.divider, backgroundColor: hovered ? alpha(C.accent, 0.12) : C.surface })}>
        <T size={13} w={600} color={C.a200}>{pm ? 'PM' : 'AM'}</T>
      </Pressable>
    </View>
  );
}
