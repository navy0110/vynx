import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { aliasConnection, ALIAS_BLOCKCHAIN_ID, verifyAliasPayment } from "@/lib/alias-network";

const CORS = {
  "X-Action-Version": "2.1.3",
  "X-Blockchain-Ids": ALIAS_BLOCKCHAIN_ID,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Called by blink clients (and internally) after the tx is signed and confirmed
export async function POST(request: NextRequest) {
  const alias = request.nextUrl.searchParams.get("alias") ?? "";

  const body = await request.json().catch(() => ({}));
  const walletAddress: string = body.account ?? "";
  const txSignature: string = body.signature ?? "";

  if (!alias || !walletAddress || !txSignature) {
    return NextResponse.json(
      { error: "alias, account and signature are required" },
      { status: 400, headers: CORS }
    );
  }

  const treasury = process.env.NEXT_PUBLIC_TREASURY_WALLET;
  if (!treasury) return NextResponse.json({ error: "Treasury wallet not configured" }, { status: 503, headers: CORS });

  try {
    const connection = await aliasConnection();
    const tx = await connection.getParsedTransaction(txSignature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    verifyAliasPayment(tx, walletAddress, treasury);
  } catch {
    return NextResponse.json({ error: "A confirmed devnet alias payment is required. Check your network and retry." }, { status: 400, headers: CORS });
  }

  // Check alias is still available
  const { data: existing } = await supabaseAdmin
    .from("cards_users")
    .select("id")
    .eq("username", alias.toLowerCase())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Alias already taken" },
      { status: 409, headers: CORS }
    );
  }

  const { error } = await supabaseAdmin.from("cards_users").insert({
    wallet_address: walletAddress,
    username: alias.toLowerCase(),
    tx_signature: txSignature || null,
  });

  if (error) {
    console.error("[register]", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS }
    );
  }

  // Solana Actions nextAction response format
  return NextResponse.json(
    {
      type: "completed",
      title: `@${alias} is yours!`,
      icon: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/logo.png`,
      description: "Your creator card is live on VYNX.",
      label: "Done",
    },
    { headers: CORS }
  );
}
