/* The order workouts run in: a numbered list. Drag a row by its handle, or use the Move up / Move down buttons on
   that row (each labelled with the workout's name, so it's clear which one moves). */
import { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { Btn, Icon, T } from '@/ui/kit';
import { alpha, C, R, SHADOW } from '@/ui/theme';

const ROW = 52; // row height + gap, used to turn a drag distance into a new position

export function RotationList({ items, onMove }: { items: { key: string; name: string }[]; onMove: (from: number, to: number) => void }) {
  const [drag, setDrag] = useState<{ i: number; dy: number } | null>(null);
  const n = items.length;
  const target = drag ? Math.max(0, Math.min(n - 1, drag.i + Math.round(drag.dy / ROW))) : -1;
  return (
    <View style={{ gap: 6 }}>
      {items.map((it, i) => {
        const moving = drag?.i === i;
        // rows between the dragged row and its target slide out of the way
        const shift = drag && !moving ? (drag.i < i && i <= target ? -ROW : target <= i && i < drag.i ? ROW : 0) : 0;
        return (
          <View key={it.key} style={{
            height: ROW - 6, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 6, borderRadius: R.md,
            backgroundColor: moving ? alpha(C.accent, 0.16) : C.n900, borderWidth: 1, borderColor: moving ? C.accent : 'transparent',
            transform: [{ translateY: moving ? drag!.dy : shift }], zIndex: moving ? 5 : 1, boxShadow: moving ? SHADOW.md : undefined,
          }}>
            <Handle label={`Drag ${it.name} to reorder`} onDrag={dy => setDrag({ i, dy })}
              onDrop={dy => { setDrag(null); const to = Math.max(0, Math.min(n - 1, i + Math.round(dy / ROW))); if (to !== i) onMove(i, to); }} />
            <T size={13} w={600} color={C.a300} style={{ width: 20 }}>{`${i + 1}.`}</T>
            <T size={14} style={{ flex: 1 }} numberOfLines={1}>{it.name}</T>
            <Btn variant="ghost" iconOnly icon="arrow-up" label={`Move ${it.name} up`} disabled={i === 0} style={{ width: 34, height: 34, minHeight: 34 }} onPress={() => onMove(i, i - 1)} />
            <Btn variant="ghost" iconOnly icon="arrow-down" label={`Move ${it.name} down`} disabled={i === n - 1} style={{ width: 34, height: 34, minHeight: 34 }} onPress={() => onMove(i, i + 1)} />
          </View>
        );
      })}
    </View>
  );
}

function Handle({ label, onDrag, onDrop }: { label: string; onDrag: (dy: number) => void; onDrop: (dy: number) => void }) {
  const cb = useRef({ onDrag, onDrop }); cb.current = { onDrag, onDrop };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => cb.current.onDrag(0),
    onPanResponderMove: (_, g) => cb.current.onDrag(g.dy),
    onPanResponderRelease: (_, g) => cb.current.onDrop(g.dy),
    onPanResponderTerminate: (_, g) => cb.current.onDrop(g.dy),
  })).current;
  return (
    <View {...pan.panHandlers} accessibilityLabel={label} accessibilityRole="adjustable"
      style={{ width: 34, height: 40, alignItems: 'center', justifyContent: 'center', cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object}>
      <Icon name="dots-six-vertical" size={18} color={C.n400} />
    </View>
  );
}
