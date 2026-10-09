import type { SupabaseClient } from '@supabase/supabase-js';

export async function validateClaimedAlias(db: SupabaseClient, wallet: string, alias: string) {
  const results = await Promise.all([
    db.from('cards_users').select('username').eq('wallet_address', wallet).maybeSingle(),
    db.from('cards_users').select('wallet_address').eq('username', alias).maybeSingle(),
  ]);
  if (results.some(result => result.error)) throw new Error('No se pudo verificar el alias comprado. Vuelve a intentarlo.');
  const owned = results[0].data;
  const claimed = results[1].data;
  if (owned && owned.username !== alias) throw new Error(`Usa el alias comprado por tu wallet: @${owned.username}.`);
  if (claimed && claimed.wallet_address !== wallet) throw new Error('Ese alias pertenece a otra wallet.');
}
