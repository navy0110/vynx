import { createClient } from '@supabase/supabase-js';

export function appDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Profile storage is unavailable.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
