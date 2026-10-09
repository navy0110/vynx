import { NextRequest, NextResponse } from 'next/server';
import { ALIAS_BLOCKCHAIN_ID, CLAIM_PRICE_SOL } from '@/lib/alias-network';
import { buildClaim } from '@/lib/alias-claim';
import { normalizeAlias } from '@/lib/alias';
import { ApiError } from '@/lib/wallet-session';

export const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'X-Action-Version': '2.1.3', 'X-Blockchain-Ids': ALIAS_BLOCKCHAIN_ID, 'Cache-Control': 'no-store' };
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
export async function GET(request: NextRequest) {
  try {
    const alias = normalizeAlias(request.nextUrl.searchParams.get('alias'));
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    return NextResponse.json({ title: `Claim @${alias} on VYNX`, icon: `${origin}/logo.png`, description: `Pay ${CLAIM_PRICE_SOL} devnet SOL to register your alias.`, label: `Claim @${alias}`, links: { actions: [{ label: `Claim for ${CLAIM_PRICE_SOL} SOL`, href: `/api/actions/claim-alias?alias=${alias}` }] } }, { headers: CORS });
  } catch (reason) { return NextResponse.json({ error: reason instanceof Error ? reason.message : 'Invalid alias.' }, { status: 400, headers: CORS }); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await buildClaim(request.nextUrl.searchParams.get('alias'), body.account);
    return NextResponse.json({ ...result, message: `Claim @${result.alias} for ${CLAIM_PRICE_SOL} devnet SOL`, links: { next: { type: 'post', href: `/api/actions/claim-alias/confirm?alias=${result.alias}` } } }, { headers: CORS });
  } catch (reason) { return NextResponse.json({ error: reason instanceof Error ? reason.message : 'Unable to prepare claim.', ...(reason instanceof ApiError && reason.code ? { code: reason.code } : {}) }, { status: reason instanceof ApiError ? reason.status : 400, headers: CORS }); }
}
