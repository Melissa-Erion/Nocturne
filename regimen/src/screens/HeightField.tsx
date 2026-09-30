/* Height input: centimetres in metric, feet + inches in imperial. The value is in display units (cm or total inches). */
import { View } from 'react-native';
import { Field, Muted, NumInput, Row } from '@/ui/kit';

export function HeightField({ value, onValue, imperial, height, size }: { value: number | null; onValue: (v: number | null) => void; imperial: boolean; height?: number; size?: number }) {
  if (!imperial) return <Field label="Height (cm)"><NumInput value={value} onValue={v => onValue(v == null ? null : Math.round(v))} height={height} size={size} /></Field>;
  const ft = value == null ? null : Math.floor(Math.round(value) / 12);
  const inch = value == null ? null : Math.round(value) % 12;
  const set = (f: number | null, i: number | null) => onValue(f == null && i == null ? null : (f || 0) * 12 + (i || 0));
  return (
    <Field label="Height (ft / in)">
      <Row gap={8}>
        <View style={{ flex: 1 }}><NumInput value={ft} onValue={f => set(f == null ? null : Math.max(0, Math.round(f)), inch)} height={height} size={size} placeholder="ft" /></View>
        <Muted>ft</Muted>
        <View style={{ flex: 1 }}><NumInput value={inch} onValue={i => set(ft, i == null ? null : Math.min(11, Math.max(0, Math.round(i))))} height={height} size={size} placeholder="in" /></View>
        <Muted>in</Muted>
      </Row>
    </Field>
  );
}
