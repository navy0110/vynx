import { createClient } from '@supabase/supabase-js';
import { PublicKey } from '@solana/web3.js';

const reply = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store' },
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const wallet = params.get('wallet') ?? '';
  const alias = params.get('alias')?.toLowerCase();
  try { new PublicKey(wallet); }
  catch { return reply({ error: 'A valid Solana address is required.' }, 400); }
  if (alias && !/^[a-z0-9_]{3,30}$/.test(alias)) return reply({ error: 'Invalid alias.' }, 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return reply({ error: 'Profile storage is unavailable.' }, 503);
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    let query = db.from('cards_users')
      .select('username,wallet_address,display_name,bio,avatar_url,banner_url,created_at,tx_signature')
      .eq('wallet_address', wallet);
    if (alias) query = query.eq('username', alias);
    const { data: profile, error } = await query.maybeSingle();
    if (error) return reply({ error: 'Your profile could not be loaded. Please retry.' }, 503);
    return reply({ profile });
  } catch { return reply({ error: 'Your profile could not be loaded. Please retry.' }, 503); }
}
