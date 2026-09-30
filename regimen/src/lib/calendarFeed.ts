/* Live calendar subscription (Google Calendar, Outlook, Apple Calendar). The user's private link is served by the
   calendar-feed Edge Function; the secret token lives in public.calendar_feeds (readable only by that user). */
import { supabase } from './supabase';

const FN = `${(process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1/calendar-feed`;
const localTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

export interface FeedLinks { https: string; webcal: string; google: string; outlook: string }

function links(token: string): FeedLinks {
  const https = `${FN}?t=${token}`;
  const webcal = https.replace(/^https:/, 'webcal:');
  return {
    https, webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent('Regimen workouts')}`,
  };
}

/** The user's calendar link, created on first use. Keeps the stored time zone current. */
export async function getFeed(userId: string): Promise<FeedLinks> {
  if (!supabase) throw new Error('Sign in to sync your calendar.');
  const tz = localTz();
  const { data, error } = await supabase.from('calendar_feeds').select('token, tz').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data) {
    if (data.tz !== tz) await supabase.from('calendar_feeds').update({ tz }).eq('user_id', userId);
    return links(data.token);
  }
  const ins = await supabase.from('calendar_feeds').insert({ user_id: userId, tz }).select('token').single();
  if (ins.error) throw ins.error;
  return links(ins.data.token);
}

/** Turn the link off: calendars already subscribed stop receiving workouts. */
export async function stopFeed(userId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('calendar_feeds').delete().eq('user_id', userId);
  if (error) throw error;
}
