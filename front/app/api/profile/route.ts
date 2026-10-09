import { createClient } from '@supabase/supabase-js';
import { PublicKey } from '@solana/web3.js';
import { publicationFields } from '@/lib/creator-draft';
import { apiFailure, ApiError, assertOrigin, requireWallet } from '@/lib/wallet-session';
import { appDb } from '@/lib/app-db';

const reply = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store' },
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const wallet = params.get('wallet') ?? '';
  const alias = params.get('alias')?.toLowerCase();
  if (!wallet) {
    try {
      const owner = await requireWallet(request);
      const { data: profile, error } = await appDb().from('cards_users').select('*').eq('wallet_address', owner).maybeSingle();
      if (error) throw new ApiError('Unable to load your creator profile.', 503);
      return reply({ profile });
    } catch (reason) { return apiFailure(reason); }
  }
  try { new PublicKey(wallet); }
  catch { return reply({ error: 'A valid Solana address is required.' }, 400); }
  if (alias && !/^[a-z0-9_]{3,30}$/.test(alias)) return reply({ error: 'Invalid alias.' }, 400);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return reply({ error: 'Profile storage is unavailable.' }, 503);
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    let query = db.from('cards_users')
      .select('username,wallet_address')
      .eq('wallet_address', wallet);
    if (alias) query = query.eq('username', alias);
    const { data: profile, error } = await query.maybeSingle();
    if (error) return reply({ error: 'Your profile could not be loaded. Please retry.' }, 503);
    return reply({ profile });
  } catch { return reply({ error: 'Your profile could not be loaded. Please retry.' }, 503); }
}

export async function PATCH(request: Request) {
  try {
    assertOrigin(request);
    const wallet = await requireWallet(request);
    const raw = await request.text();
    if (raw.length > 3000000) throw new ApiError('Reduce the image sizes before saving.', 413);
    const body = JSON.parse(raw);
    const design = publicationFields(body.design);
    if (typeof body.published !== 'boolean' || typeof body.tips_enabled !== 'boolean') throw new ApiError('Invalid profile settings.');
    const db = appDb();
    const { data: owner, error: ownerError } = await db.from('cards_users').select('id,username').eq('wallet_address', wallet).maybeSingle();
    if (ownerError) throw new ApiError('Profile storage is unavailable.', 503);
    if (!owner) throw new ApiError('Claim an alias before saving your creator card.', 409);
    if (owner.username !== design.alias) throw new ApiError('Use the alias purchased by your signed-in wallet.', 403);
    const { data: profile, error } = await db.from('cards_users').update({
      display_name: design.name, bio: design.bio, avatar_url: design.avatar, banner_url: design.cover,
      design, published: body.published, tips_enabled: body.tips_enabled,
    }).eq('id', owner.id).eq('wallet_address', wallet).select('*').single();
    if (error) throw new ApiError('Unable to save your profile right now. Please retry.', 503);
    return reply({ profile });
  } catch (reason) { return apiFailure(reason); }
}
