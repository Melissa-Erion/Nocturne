/* Exercise picker for the workout builder: search the library (name, muscle or equipment), pick one, or add your own
   exercise when it isn't listed. Your own exercises are marked "Yours" and work everywhere built-in ones do. */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { EQUIPMENT, MUSCLE_REGIONS } from '@/domain/exercises';
import type { Equipment } from '@/domain/types';
import { useRG } from '@/store/rg';
import { Btn, Dialog, Field, Icon, Input, Muted, Row, Select, T, Tag, Tap } from '@/ui/kit';
import { alpha, C, R } from '@/ui/theme';

/** Equipment guessed from the name ("cable kickback" → Cable); null when the name doesn't say. */
const guessEquip = (n: string): Equipment | null => {
  const t = n.toLowerCase();
  if (/cable|pulldown|pushdown/.test(t)) return 'Cable';
  if (/dumbbell|\bdb\b/.test(t)) return 'Dumbbell';
  if (/barbell|\bbb\b|smith/.test(t)) return t.includes('smith') ? 'Machine' : 'Barbell';
  if (/machine|press machine|leg press|hack/.test(t)) return 'Machine';
  if (/band|bodyweight|push-?up|pull-?up|chin-?up|plank|dip\b|lunge walk/.test(t)) return 'Bodyweight';
  return null;
};

const MUSCLES = Object.keys(MUSCLE_REGIONS).sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));

export function ExercisePicker({ open, onClose, onPick, currentId, title = 'Choose an exercise' }: {
  open: boolean; onClose: () => void; onPick: (id: string) => void; currentId?: string; title?: string;
}) {
  const RG = useRG();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('Glutes');
  const [equip, setEquip] = useState<Equipment>('Dumbbell');
  const [instr, setInstr] = useState('');
  const [equipSet, setEquipSet] = useState(false); // the user picked equipment themselves
  const onName = (v: string) => { setName(v); if (!equipSet) { const g = guessEquip(v); if (g) setEquip(g); } };
  useEffect(() => { if (open) { setQ(''); setAdding(false); } }, [open]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = RG.allExercises().filter(e => words.every(w => `${e.name} ${e.muscle} ${e.equip}`.toLowerCase().includes(w)));
  const pick = (id: string) => { onPick(id); onClose(); };
  const startAdd = () => { setEquipSet(false); onName(q.trim()); setInstr(''); setAdding(true); };
  const clash = RG.allExercises().find(e => e.name.trim().toLowerCase() === name.trim().toLowerCase());
  const save = () => {
    if (!name.trim()) return;
    const n = name.trim(); const e = RG.addCustomExercise(n.charAt(0).toUpperCase() + n.slice(1), muscle, equip, instr);
    RG.toast(`${e.name} added to your exercises.`);
    pick(e.id);
  };

  if (adding) return (
    <Dialog open={open} onClose={onClose} title="Add your own exercise" width={520}
      body="It's saved to your account and works like any other exercise: logging, history, records and next-session targets."
      actions={<>
        <Btn title="Back to the list" onPress={() => setAdding(false)} />
        <Btn variant="primary" title="Save and use" disabled={!name.trim() || !!clash} onPress={save} />
      </>}>
      <Field label="Exercise name"><Input value={name} onChange={onName} placeholder="e.g. Cable kickback" maxLength={80} autoFocus /></Field>
      {!!clash && (
        <Row gap={8} wrap>
          <Muted size={12} color={C.a300}>{`"${clash.name}" is already in the list.`}</Muted>
          <Tap onPress={() => pick(clash.id)} label={`Use ${clash.name}`}><T size={12} color={C.accent}>Use it</T></Tap>
        </Row>
      )}
      <Row gap={10} wrap align="flex-start">
        <Field label="Main muscle" style={{ flexGrow: 1, flexBasis: 180 }}><Select value={muscle} options={MUSCLES} onChange={setMuscle} title="Main muscle" /></Field>
        <Field label="Equipment" style={{ flexGrow: 1, flexBasis: 180 }}><Select value={equip} options={EQUIPMENT} onChange={v => { setEquip(v); setEquipSet(true); }} title="Equipment" /></Field>
      </Row>
      <Field label="How to do it (optional)"><Input value={instr} onChange={setInstr} multiline height={80} maxLength={1000} placeholder="Setup and cues you want to remember" /></Field>
      <Muted size={12}>Equipment sets the weight jumps used for next-session targets (Settings › Training).</Muted>
    </Dialog>
  );

  return (
    <Dialog open={open} onClose={onClose} title={title} width={560} actions={<Btn title="Close" onPress={onClose} />}>
      <Input value={q} onChange={setQ} placeholder="Search by name, muscle or equipment" autoFocus height={42} />
      <View style={{ gap: 2 }}>
        {list.map((e, i) => {
          const on = e.id === currentId; const yours = !!RG.s.customExercises?.[e.id];
          const header = i === 0 || list[i - 1].muscle !== e.muscle;
          return (
            <View key={e.id}>
              {header && <T size={11} color={C.n500} upper style={{ letterSpacing: 0.8, marginTop: i ? 10 : 2, marginBottom: 4 }}>{e.muscle}</T>}
              <Tap onPress={() => pick(e.id)} label={`${e.name}, ${e.muscle}, ${e.equip}`}
                style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: R.md,
                  backgroundColor: on ? alpha(C.accent, 0.16) : hovered ? alpha(C.text, 0.06) : 'transparent' })}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={14} numberOfLines={1}>{e.name}</T>
                  <Muted size={12}>{e.equip}</Muted>
                </View>
                {yours && <Tag variant="outline">Yours</Tag>}
                {on && <Icon name="check" size={16} color={C.accent} />}
              </Tap>
            </View>
          );
        })}
        {!list.length && <Muted style={{ paddingVertical: 8 }}>{`No exercise matches "${q}".`}</Muted>}
      </View>
      <Tap onPress={startAdd} label="Add your own exercise"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: R.md, borderWidth: 1, borderStyle: 'dashed', borderColor: C.n700 }}>
        <Icon name="plus" size={16} color={C.accent} />
        <T size={14} color={C.accent}>{q.trim() ? `Add "${q.trim()}" as your own exercise` : "Can't find it? Add your own exercise"}</T>
      </Tap>
    </Dialog>
  );
}
