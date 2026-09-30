/* "Sync to my calendar": a private link that Google Calendar, Outlook or Apple Calendar subscribes to, so workouts
   (and moves, skips and new weeks) show up there automatically. */
import { useEffect, useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import { getFeed, stopFeed, type FeedLinks } from '@/lib/calendarFeed';
import { useRG } from '@/store/rg';
import { useUI } from '@/store/store';
import { Btn, Dialog, Icon, Muted, Row, T } from '@/ui/kit';
import { C, R } from '@/ui/theme';

export function CalendarSyncDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const RG = useRG();
  const userId = useUI(u => u.userId);
  const [feed, setFeed] = useState<FeedLinks | null>(null);
  const [err, setErr] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !userId || feed) return;
    let on = true; setErr('');
    getFeed(userId).then(f => { if (on) setFeed(f); }).catch(() => { if (on) setErr('Couldn’t create your calendar link. Check your connection and try again.'); });
    return () => { on = false; };
  }, [open, userId, feed]);

  const openUrl = (u: string) => { if (Platform.OS === 'web') window.open(u, '_blank', 'noopener'); else Linking.openURL(u); };
  const copy = async () => {
    if (!feed) return;
    try {
      if (Platform.OS === 'web') { await navigator.clipboard.writeText(feed.https); RG.toast('Calendar link copied.', false); }
      else await Share.share({ message: feed.https });
    } catch { RG.toast('Couldn’t copy. Select the link and copy it instead.', false); }
  };
  const stop = async () => {
    if (!userId) return;
    setBusy(true);
    try { await stopFeed(userId); setFeed(null); setConfirmStop(false); onClose(); RG.toast('Calendar sync stopped. Remove the “Regimen workouts” calendar from your calendar app to clear it.', false); }
    catch { RG.toast('Couldn’t stop syncing. Try again.', false); }
    setBusy(false);
  };

  if (!userId) return (
    <Dialog open={open} onClose={onClose} title="Sync to your calendar"
      body="Sign in to your Regimen account to sync your workouts to Google Calendar, Outlook or Apple Calendar."
      actions={<Btn title="Close" onPress={onClose} />} />
  );

  return (
    <>
      <Dialog open={open && !confirmStop} onClose={onClose} width={500} title="Sync to your calendar"
        body="Add your workouts to Google Calendar, Outlook or Apple Calendar. They stay in sync: when you move, skip or add a workout here, your calendar updates too."
        actions={<>
          {feed && <Btn variant="ghost" title="Stop syncing" onPress={() => setConfirmStop(true)} color={C.n400} />}
          <Btn title="Done" onPress={onClose} />
        </>}>
        {err ? <Row gap={8}><Icon name="warning" size={16} color={C.n300} /><T size={13} color={C.n300} style={{ flex: 1 }}>{err}</T></Row>
          : !feed ? <Muted size={13}>Creating your private calendar link…</Muted>
          : (
            <View style={{ gap: 10 }}>
              <T size={13} w={500}>Choose your calendar</T>
              <Btn variant="primary" icon="calendar-check" title="Add to Google Calendar" onPress={() => openUrl(feed.google)} block />
              <Btn icon="calendar-check" title="Add to Outlook" onPress={() => openUrl(feed.outlook)} block />
              <Btn icon="calendar-check" title="Add to Apple Calendar" onPress={() => openUrl(feed.webcal)} block />
              <View style={{ gap: 6, padding: 12, borderRadius: R.md, boxShadow: `inset 0 0 0 1px ${C.n800}` }}>
                <T size={13}>Other calendar apps: copy this link and choose “Subscribe” or “Add calendar from URL”.</T>
                <Row gap={8}>
                  <T size={11} color={C.n400} numberOfLines={1} style={{ flex: 1 }} selectable>{feed.https}</T>
                  <Btn size="sm" icon="copy" title={Platform.OS === 'web' ? 'Copy link' : 'Share link'} onPress={copy} />
                </Row>
              </View>
              <Muted size={12}>Google Calendar checks for changes every few hours, so updates can take a while to show there. Keep this link private: anyone with it can see your workout schedule.</Muted>
            </View>
          )}
      </Dialog>
      <Dialog open={open && confirmStop} onClose={() => setConfirmStop(false)} title="Stop syncing?"
        body="Your calendar will stop receiving workouts from Regimen. If you sync again later, you'll get a new link to add."
        actions={<><Btn title="Cancel" onPress={() => setConfirmStop(false)} /><Btn variant="primary" title={busy ? 'Stopping…' : 'Stop syncing'} disabled={busy} onPress={stop} /></>} />
    </>
  );
}
