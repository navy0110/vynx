import { NextRequest, NextResponse } from "next/server";
import {
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import { aliasConnection, ALIAS_BLOCKCHAIN_ID, CLAIM_PRICE_SOL, CLAIM_PRICE_LAMPORTS } from "@/lib/alias-network";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept-Encoding",
  "X-Action-Version": "2.1.3",
  "X-Blockchain-Ids": ALIAS_BLOCKCHAIN_ID,
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// GET — Blink metadata
export async function GET(request: NextRequest) {
  const alias = request.nextUrl.searchParams.get("alias") ?? "alias";
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  return NextResponse.json(
    {
      title: `Claim @${alias} on VYNX`,
      icon: `${origin}/logo.png`,
      description: `Pay ${CLAIM_PRICE_SOL} SOL to register @${alias} as your creator card alias on VYNX.`,
      label: `Claim @${alias} — ${CLAIM_PRICE_SOL} SOL`,
      links: {
        actions: [
          {
            label: `Claim for ${CLAIM_PRICE_SOL} SOL`,
            href: `/api/actions/claim-alias?alias=${encodeURIComponent(alias)}`,
          },
        ],
      },
    },
    { headers: CORS }
  );
}

// POST — Build & return the unsigned transaction (Solana Actions spec)
export async function POST(request: NextRequest) {
  const alias = request.nextUrl.searchParams.get("alias") ?? "";

  if (!alias) {
    return NextResponse.json(
      { error: "alias query param is required" },
      { status: 400, headers: CORS }
    );
  }

  const body = await request.json().catch(() => ({}));
  const account: string = body.account ?? "";

  if (!account) {
    return NextResponse.json(
      { error: "account is required in request body" },
      { status: 400, headers: CORS }
    );
  }

  const treasury = process.env.NEXT_PUBLIC_TREASURY_WALLET;
  if (!treasury || treasury.startsWith("REPLACE_")) {
    return NextResponse.json(
      { error: "Treasury wallet not configured" },
      { status: 503, headers: CORS }
    );
  }

  let connection;
  try {
    connection = await aliasConnection();
  } catch {
    return NextResponse.json({ error: "Alias claiming requires an available Solana devnet RPC." }, { status: 503, headers: CORS });
  }

  const senderPubkey = new PublicKey(account);
  const treasuryPubkey = new PublicKey(treasury);

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = senderPubkey;

  tx.add(
    SystemProgram.transfer({
      fromPubkey: senderPubkey,
      toPubkey: treasuryPubkey,
      lamports: CLAIM_PRICE_LAMPORTS,
    })
  );

  const serialized = tx.serialize({ requireAllSignatures: false });

  return NextResponse.json(
    {
      transaction: Buffer.from(serialized).toString("base64"),
      message: `Claiming @${alias} for ${CLAIM_PRICE_SOL} SOL`,
      links: {
        next: {
          type: "post",
          href: `/api/actions/claim-alias/confirm?alias=${encodeURIComponent(alias)}`,
        },
      },
    },
    { headers: CORS }
  );
}
