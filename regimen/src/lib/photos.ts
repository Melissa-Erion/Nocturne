/* Progress photos live in a PRIVATE Supabase Storage bucket and are only ever shown through short-lived signed URLs. */
import { PHOTO_BUCKET, supabase } from './supabase';

const SIGNED_TTL_S = 60 * 30; // 30 minutes
const cache = new Map<string, { url: string; exp: number }>();
const pending = new Map<string, Promise<string | null>>();

export function cachedSignedUrl(path: string): string | null {
  const c = cache.get(path);
  return c && c.exp > Date.now() + 60_000 ? c.url : null;
}

export function signedUrl(path: string): Promise<string | null> {
  const hit = cachedSignedUrl(path); if (hit) return Promise.resolve(hit);
  if (!supabase) return Promise.resolve(null);
  if (!pending.has(path)) {
    pending.set(path, supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_TTL_S).then(({ data, error }) => {
      pending.delete(path);
      if (error || !data) return null;
      cache.set(path, { url: data.signedUrl, exp: Date.now() + SIGNED_TTL_S * 1000 });
      return data.signedUrl;
    }));
  }
  return pending.get(path)!;
}

/** Upload a picked image (file:, blob: or data: URI) to `<userId>/<checkinId>/<pose>-<ts>.jpg`. Returns the storage path. */
export async function uploadPhoto(userId: string, key: string, uri: string): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const [checkinId, ...pose] = key.split(':');
  const path = `${userId}/${checkinId}/${pose.join('-').replace(/[^a-z0-9-]/gi, '_')}-${Date.now()}.jpg`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function removePhoto(path: string) {
  cache.delete(path);
  if (supabase) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}
