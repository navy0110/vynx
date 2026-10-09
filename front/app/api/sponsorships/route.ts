import { authorize, checkout, issueChallenge, sponsorDb, verifyPayment } from '@/lib/sponsorship-server';
import { profileFields, requestFields, text, type SponsorAction, type SponsorPayload, type SponsorRequest } from '@/lib/sponsorship-domain';
import { publicationFields } from '@/lib/creator-draft';
import { requireWallet } from '@/lib/wallet-session';
import { validateClaimedAlias } from '@/lib/claimed-alias';

export const runtime = 'nodejs';
const ACTIONS: SponsorAction[] = ['save-profile', 'save-design', 'request', 'list', 'approve', 'reject', 'checkout', 'confirm'];
const headers = { 'Cache-Control': 'no-store' };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });

export async function GET(request: Request) {
  try {
    const alias = new URL(request.url).searchParams.get('alias');
    if (!alias || !/^[a-z0-9_]{3,30}$/.test(alias)) return reply({ error: 'Alias inválido.' }, 400);
    const db = sponsorDb();
    const { data: profile, error } = await db.from('sponsor_profiles').select('*').eq('alias', alias).maybeSingle();
    if (error) return reply({ error: 'No se pudo cargar el perfil. Revisa la configuración de patrocinios.' }, 503);
    if (!profile) return reply({ error: 'Este creador todavía no publicó su página.' }, 404);
    const { data: ad, error: adError } = await db.from('sponsor_requests')
      .select('id,brand_name,headline,description,destination_url,ends_at,payment_signature')
      .eq('creator_wallet', profile.wallet).eq('status', 'active').lte('starts_at', new Date().toISOString())
      .gt('ends_at', new Date().toISOString()).maybeSingle();
    if (adError) return reply({ error: 'No se pudo cargar el espacio patrocinado.' }, 503);
    return reply({ profile, ad });
  } catch { return reply({ error: 'Configura Supabase y aplica la migración de patrocinios.' }, 503); }
}

export async function POST(request: Request) {
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin;
    if (request.headers.get('origin') !== origin) return reply({ error: 'Origen no autorizado.' }, 403);
    const raw = await request.text();
    if (raw.length > 3000000) return reply({ error: 'Solicitud demasiado grande. Reduce el tamaño de las imágenes.' }, 413);
    const body = JSON.parse(raw);
    if (!body || !ACTIONS.includes(body.action) || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
      return reply({ error: 'Solicitud inválida.' }, 400);
    }
    const action: SponsorAction = body.action;
    if (action !== 'save-design' && raw.length > 16000) return reply({ error: 'Solicitud demasiado grande.' }, 413);
    const sessionWallet = await requireWallet(request);
    if (sessionWallet !== body.wallet) return reply({ error: 'La sesión pertenece a otra wallet.' }, 403);
    const payload: SponsorPayload = body.payload;
    // Validate before issuing or consuming a challenge.
    const design = action === 'save-design' ? publicationFields(payload) : null;
    if (body.phase === 'challenge') return reply(await issueChallenge(origin, body.wallet, action, payload));
    if (typeof body.signature !== 'string' || typeof body.challenge !== 'string') return reply({ error: 'Firma requerida.' }, 401);
    const db = await authorize(origin, body);
    const wallet: string = body.wallet;

    if (action === 'save-design' && design) {
      await validateClaimedAlias(db, wallet, design.alias);
      const { data: profile, error } = await db.from('sponsor_profiles').update({
        alias: design.alias, display_name: design.name, bio: design.bio, design,
      }).eq('wallet', wallet).select('*').maybeSingle();
      if (error) return reply({ error: error.code === '23505' ? 'Ese alias ya tiene dueño.' : 'No se pudo publicar. Aplica la migración 003_creator_design.sql y reintenta.' }, 409);
      if (!profile) return reply({ error: 'Primero publica tu oferta en Patrocinios. Luego podrás publicar el diseño.' }, 409);
      return reply({ ok: true, profile });
    }

    if (action === 'save-profile') {
      const fields = profileFields(payload);
      await validateClaimedAlias(db, wallet, fields.alias);
      const { data: profile, error } = await db.from('sponsor_profiles').upsert({ wallet, ...fields }, { onConflict: 'wallet' }).select('*').single();
      if (error) return reply({ error: error.code === '23505' ? 'Ese alias ya tiene dueño.' : 'No se pudo guardar la oferta.' }, 409);
      return reply({ ok: true, profile });
    }
    if (action === 'list') {
      const results = await Promise.all([
        db.from('sponsor_profiles').select('*').eq('wallet', wallet).maybeSingle(),
        db.from('sponsor_requests').select('*').or(`creator_wallet.eq.${wallet},brand_wallet.eq.${wallet}`).order('created_at', { ascending: false }).limit(100),
      ]);
      if (results.some(r => r.error)) return reply({ error: 'No se pudieron cargar tus campañas.' }, 503);
      return reply({ profile: results[0].data, campaigns: results[1].data });
    }
    if (action === 'request') {
      const alias = text(payload.alias, 30).toLowerCase();
      const { data: profile, error: lookupError } = await db.from('sponsor_profiles').select('*').eq('alias', alias).single();
      if (lookupError || !profile || !profile.accepting) return reply({ error: 'Este creador no está recibiendo solicitudes.' }, 409);
      if (profile.wallet === wallet) return reply({ error: 'Usa una wallet de marca distinta a la del creador.' }, 400);
      const { count, error: countError } = await db.from('sponsor_requests').select('id', { count: 'exact', head: true }).eq('brand_wallet', wallet).eq('status', 'pending');
      if (countError) return reply({ error: 'No se pudo verificar la solicitud.' }, 503);
      if ((count ?? 0) >= 10) return reply({ error: 'Ya tienes diez solicitudes pendientes.' }, 429);
      const fields = requestFields(payload);
      const { error } = await db.from('sponsor_requests').insert({ creator_wallet: profile.wallet, brand_wallet: wallet,
        price_cents: profile.price_cents, duration_days: profile.duration_days, ...fields });
      if (error) return reply({ error: 'No se pudo enviar la solicitud.' }, 409);
      return reply({ ok: true });
    }

    const id = text(payload.id, 36);
    if (!/^[a-f0-9-]{36}$/i.test(id)) return reply({ error: 'Campaña inválida.' }, 400);
    const { data: campaign, error } = await db.from('sponsor_requests').select('*').eq('id', id).single();
    if (error || !campaign || (campaign.creator_wallet !== wallet && campaign.brand_wallet !== wallet)) return reply({ error: 'Campaña no encontrada.' }, 404);
    if (action === 'approve' || action === 'reject') {
      if (campaign.creator_wallet !== wallet) return reply({ error: 'Solo el creador puede revisar el anuncio.' }, 403);
      const { error: reviewError } = await db.rpc('review_sponsorship', { request_id: id, reviewer: wallet, decision: action === 'approve' ? 'approved' : 'rejected' });
      if (reviewError) return reply({ error: 'La solicitud ya fue revisada o tu espacio ya está reservado.' }, 409);
      return reply({ ok: true });
    }
    if (campaign.brand_wallet !== wallet) return reply({ error: 'Solo la marca puede realizar este pago.' }, 403);
    if (action === 'confirm' && campaign.status === 'active' && campaign.payment_signature === payload.tx_signature) return reply({ ok: true });
    if (campaign.status !== 'approved') return reply({ error: 'El creador debe aprobar la campaña antes del pago.' }, 409);
    if (action === 'checkout') return reply(await checkout(campaign as SponsorRequest));
    const signature = text(payload.tx_signature, 88);
    await verifyPayment(campaign as SponsorRequest, signature);
    const { error: activationError } = await db.rpc('activate_sponsorship', { request_id: id, tx_signature: signature });
    if (activationError) return reply({ error: 'El pago no pudo activar la campaña. Conserva la firma y vuelve a verificarlo.' }, 409);
    return reply({ ok: true });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'No se pudo completar la operación.' }, 400);
  }
}
