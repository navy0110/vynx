import { NextRequest, NextResponse } from 'next/server';
import { confirmClaim } from '@/lib/alias-claim';
import { ALIAS_BLOCKCHAIN_ID } from '@/lib/alias-network';
import { ApiError } from '@/lib/wallet-session';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'X-Action-Version': '2.1.3', 'X-Blockchain-Ids': ALIAS_BLOCKCHAIN_ID, 'Cache-Control': 'no-store' };
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await confirmClaim(request.nextUrl.searchParams.get('alias'), body.account, body.signature);
    return NextResponse.json({ ...result, type: 'completed', title: `@${result.alias} is yours!`, icon: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`, description: 'Your alias is registered. Customize and publish your creator card.', label: 'Done' }, { headers: CORS });
  } catch (reason) { return NextResponse.json({ error: reason instanceof Error ? reason.message : 'Unable to verify claim.', ...(reason instanceof ApiError && reason.code ? { code: reason.code } : {}) }, { status: reason instanceof ApiError ? reason.status : 400, headers: CORS }); }
}
