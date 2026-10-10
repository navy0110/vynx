import { aliasPda, REGISTRY_PROGRAM, registryEnabled } from './alias-registry';
import { registryConnection } from './alias-registration';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAlias } from './alias';

export function aliasAvailabilityClientHash(request: Request, secret: string, trustedVercel = process.env.VERCEL === '1') {
  // Vercel supplies this header. Direct/self-hosted requests share a bucket rather
  // than trusting arbitrary forwarding headers supplied by the caller.
  const supplied = trustedVercel ? request.headers.get('x-vercel-forwarded-for')?.trim() : '';
  const version = supplied ? isIP(supplied) : 0;
  const client = version === 6 ? new URL(`http://[${supplied}]`).hostname : version === 4 ? supplied : 'shared';
  return createHmac('sha256', secret).update(`alias-availability:${client}`).digest('hex');
}

export async function aliasAvailability(request: Request, db: SupabaseClient, secret: string, trustedVercel = process.env.VERCEL === '1') {
  const headers = { 'Cache-Control': 'no-store' };
  const unavailable = () => Response.json({ error: 'Alias availability is temporarily unavailable. Please try again.' }, { status: 503, headers });
  try {
    // Invalid aliases also consume quota; rate limiting happens before lookups.
    const { data: limit, error: limitError } = await db.rpc('consume_alias_availability_limit', {
      client_hash: aliasAvailabilityClientHash(request, secret, trustedVercel),
    });
    if (limitError || typeof limit?.allowed !== 'boolean' || !Number.isInteger(limit.retry_after) || limit.retry_after < 1) return unavailable();
    if (!limit.allowed) return Response.json({ error: 'Too many alias checks. Please try again shortly.' }, {
      status: 429, headers: { ...headers, 'Retry-After': String(limit.retry_after) },
    });
    let alias: string;
    try { alias = normalizeAlias(new URL(request.url).searchParams.get('alias')); }
    catch (reason) { return Response.json({ error: reason instanceof Error ? reason.message : 'Enter a valid alias.' }, { status: 400, headers }); }
    const { data, error } = await db.from('cards_users').select('username').eq('username', alias).maybeSingle();
    if (error) return unavailable();
    let available = data === null;
    if (available && registryEnabled()) {
      const connection = await registryConnection();
      const info = await connection.getAccountInfo(aliasPda(alias), 'confirmed');
      available = !info?.owner.equals(REGISTRY_PROGRAM);
    }
    return Response.json({ alias, available }, { headers });
  } catch { return unavailable(); }
}
