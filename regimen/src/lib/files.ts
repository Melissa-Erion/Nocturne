/* Saving files the user asked for (.ics schedule, JSON export, photo download). Web downloads; native shares. */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export async function saveTextFile(name: string, content: string, mime: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return;
  }
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create(); f.write(content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name });
}

/** Download/share an image from a URL (signed URL, file URI or data URL). */
export async function saveImage(url: string, name: string) {
  if (Platform.OS === 'web') {
    const a = document.createElement('a'); a.href = url; a.download = name; a.target = '_blank'; a.rel = 'noopener'; a.click();
    return;
  }
  let uri = url;
  if (/^https?:/.test(url)) { const f = new File(Paths.cache, name); if (f.exists) f.delete(); const out = await File.downloadFileAsync(url, f); uri = out.uri; }
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/jpeg' });
}

/** On-device mode (no Supabase): keep a durable private copy of a picked photo inside the app's documents folder. */
export async function persistLocalImage(uri: string, key: string): Promise<string> {
  if (Platform.OS === 'web') return uri; // already a data: URL from the picker (base64)
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${key.replace(/[^a-z0-9-]/gi, '_')}-${Date.now()}.jpg`);
  await new File(uri).copy(dest);
  return dest.uri;
}

export function deleteLocalImage(uri: string) {
  if (Platform.OS === 'web' || !uri.startsWith('file:')) return;
  try { const f = new File(uri); if (f.exists) f.delete(); } catch { /* already gone */ }
}
