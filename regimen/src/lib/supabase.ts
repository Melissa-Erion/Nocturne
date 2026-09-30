import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** null when the app is built without Supabase config — it then runs in on-device mode. */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        // PKCE: needed for Google sign-in on phones (code exchanged in the app); also works for web and email links.
        flowType: 'pkce',
      },
    })
  : null;

export const PHOTO_BUCKET = 'progress-photos';
