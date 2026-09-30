/* Permanently delete the signed-in account (server: supabase/functions/delete-account). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const DELETED_KEY = 'regimen.accountDeleted';

/** True once, right after an account was deleted (for a message on the sign-in screen). */
export async function takeDeletedNotice(): Promise<boolean> {
  try { const v = await AsyncStorage.getItem(DELETED_KEY); if (v) await AsyncStorage.removeItem(DELETED_KEY); return !!v; } catch { return false; }
}

export type DeleteResult = { ok: true } | { ok: false; cancelFirst?: boolean; message: string };

export async function deleteAccount(userId: string): Promise<DeleteResult> {
  if (!supabase) return { ok: false, message: 'Account deletion needs your Regimen account connection.' };
  const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
  if (error) {
    let body: { error?: string } = {};
    try { body = await (error as { context?: Response }).context?.json(); } catch { /* not JSON */ }
    if (body.error === 'cancel_first') return { ok: false, cancelFirst: true, message: 'Cancel your subscription first, so you are not charged again. Then delete your account.' };
    return { ok: false, message: body.error || "Couldn't reach the server. Check your connection and try again." };
  }
  // The account is gone: clear this device's copy and the session.
  try { await AsyncStorage.multiRemove([`regimen.state.${userId}`]); await AsyncStorage.setItem(DELETED_KEY, '1'); } catch { /* ignore */ }
  try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* session already invalid */ }
  return { ok: true };
}
