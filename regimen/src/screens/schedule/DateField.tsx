/* Date picker for the schedule dialogs. Web: the browser's native <input type="date">. Native: ISO text field with ±1 day steppers. */
import { createElement, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRG } from '@/store/rg';
import { Btn, Input } from '@/ui/kit';
import { C, FONT, R } from '@/ui/theme';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function DateField({ value, onChange, label, allowEmpty }: { value: string; onChange: (v: string) => void; label?: string; allowEmpty?: boolean }) {
  const RG = useRG();
  const [txt, setTxt] = useState<string | null>(null);
  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'date', value, 'aria-label': label,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      style: {
        flex: 1, minWidth: 0, height: 36, boxSizing: 'border-box', padding: '6px 10px', fontFamily: FONT.regular, fontSize: 14, color: C.text,
        background: C.surface, border: `1px solid ${C.divider}`, borderRadius: R.md, colorScheme: 'dark', outline: 'none',
      },
    });
  }
  const step = (n: number) => { const base = ISO.test(value) ? value : RG.TODAY; setTxt(null); onChange(RG.add(base, n)); };
  return (
    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Btn iconOnly variant="ghost" icon="caret-left" label="Previous day" onPress={() => step(-1)} />
      <Input value={txt ?? value} placeholder={allowEmpty ? 'Open-ended' : 'YYYY-MM-DD'} accessibilityLabel={label} autoCapitalize="none" height={44} style={{ flex: 1 }}
        onChange={v => { setTxt(v); if (ISO.test(v) || (allowEmpty && v.trim() === '')) onChange(v.trim()); }} onBlur={() => setTxt(null)} />
      <Btn iconOnly variant="ghost" icon="caret-right" label="Next day" onPress={() => step(1)} />
    </View>
  );
}
