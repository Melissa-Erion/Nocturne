/* Local primitives shared by the History and Records ports: the prototype's `.table` (fading row rules,
   uppercase header, horizontal scroll below its min-width) and an auto-fill grid. */
import { Children, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import { Rule, T } from '@/ui/kit';
import { alpha, C } from '@/ui/theme';

type PState = PressableStateCallbackType & { hovered?: boolean };
export interface TCol { label: ReactNode; flex?: number; width?: number }
export interface TRow { key: string; cells: ReactNode[]; onPress?: () => void; label?: string }

const cellStyle = (c: TCol): ViewStyle => ({ padding: 5.6, minWidth: 0, justifyContent: 'center', ...(c.width ? { width: c.width } : { flex: c.flex ?? 1 }) });

/** `.table`: header rule in divider colour, body rules at 8 % text; scrolls sideways when narrower than minWidth. */
export function Table({ cols, rows, minWidth = 520 }: { cols: TCol[]; rows: TRow[]; minWidth?: number }) {
  const [w, setW] = useState(0);
  const inner = (
    <View style={{ width: w ? Math.max(w, minWidth) : '100%' }}>
      <View style={{ flexDirection: 'row' }}>
        {cols.map((c, i) => (
          <View key={i} style={cellStyle(c)}>
            <T size={11} color={alpha(C.text, 0.6)} upper lh={1.3} style={{ letterSpacing: 0.88 }}>{c.label}</T>
          </View>
        ))}
        <Rule style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} />
      </View>
      {rows.map(r => {
        const body = (st?: PState) => (
          <View style={[{ flexDirection: 'row', alignItems: 'center' }, st?.hovered && { backgroundColor: alpha(C.text, 0.04) }]}>
            {r.cells.map((cell, i) => <View key={i} style={cellStyle(cols[i])}>{typeof cell === 'string' || typeof cell === 'number' ? <T size={14}>{cell}</T> : cell}</View>)}
            <Rule color={alpha(C.text, 0.08)} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} />
          </View>
        );
        return r.onPress
          ? <Pressable key={r.key} onPress={r.onPress} accessibilityRole="button" accessibilityLabel={r.label}>{(st: PState) => body(st)}</Pressable>
          : <View key={r.key}>{body()}</View>;
      })}
    </View>
  );
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
      {w && w < minWidth ? <ScrollView horizontal showsHorizontalScrollIndicator>{inner}</ScrollView> : inner}
    </View>
  );
}

/** repeat(auto-fill, minmax(N px, 1fr)): like Grid but keeps empty tracks, so a few items don't stretch full width. */
export function FillGrid({ min, gap = 10, children, style }: { min: number; gap?: number; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [w, setW] = useState(0);
  const kids = Children.toArray(children).filter(Boolean);
  const cols = w ? Math.max(1, Math.floor((w + gap) / (Math.min(min, w) + gap))) : 1;
  const cw = w ? (w - gap * (cols - 1)) / cols : undefined;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {kids.map((k, i) => <View key={i} style={{ width: cw ?? '100%', minWidth: 0 }}>{k}</View>)}
    </View>
  );
}
