/* Sample-data exit: a banner shown on every page while the account holds the sample data set,
   and the "Remove sample data & set up my own" action (confirm → wipe → guided setup). */
import { useState } from 'react';
import { View } from 'react-native';
import { useRG } from '@/store/rg';
import { Banner, Btn, Dialog, Icon, T } from '@/ui/kit';
import { C } from '@/ui/theme';

export function RemoveSampleButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const RG = useRG();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await RG.clearSample();
      setOpen(false);
      RG.go('onboarding');
      RG.toast('Sample data removed. Enter your details to build your own plan.');
    } catch (e) {
      RG.toast('Could not remove the sample data: ' + (e instanceof Error ? e.message : 'please try again.'));
    } finally { setBusy(false); }
  };
  return (
    <>
      <Btn variant="primary" size={size} icon="trash" title="Remove sample data & set up my own" onPress={() => setOpen(true)} />
      <Dialog open={open} onClose={() => !busy && setOpen(false)} title="Remove the sample data?"
        body="This deletes all of the demo data (weigh-ins, workouts, check-ins, meals, recipes and meal prep) and opens the guided setup so you can enter your own details. It can't be undone."
        actions={<>
          <Btn title="Cancel" disabled={busy} onPress={() => setOpen(false)} />
          <Btn variant="primary" icon="trash" title={busy ? 'Removing…' : 'Remove & set up my own'} disabled={busy} onPress={go} />
        </>} />
    </>
  );
}

/** Shown on every page (except guided setup) while sample data is loaded. */
export function SampleBanner() {
  const RG = useRG();
  const [hidden, setHidden] = useState(false);
  if (!RG.s.sample || hidden) return null;
  return (
    <Banner>
      <Icon name="info" size={18} color={C.accent} />
      <View style={{ flex: 1, minWidth: 220 }}>
        <T size={14} w={500}>You're exploring sample data</T>
        <T size={13} color={C.n300}>Everything here is a demo. When you're ready, remove it and set up your own plan.</T>
      </View>
      <RemoveSampleButton size="sm" />
      <Btn variant="ghost" iconOnly icon="x" color={C.n400} label="Hide for now" onPress={() => setHidden(true)} />
    </Banner>
  );
}
