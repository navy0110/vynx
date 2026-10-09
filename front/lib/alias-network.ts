import { Connection, type ConnectionConfig, type ParsedTransactionWithMeta } from "@solana/web3.js";

export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const ALIAS_BLOCKCHAIN_ID = `solana:${DEVNET_GENESIS_HASH}`;
export const CLAIM_PRICE_SOL = 0.00001;
export const CLAIM_PRICE_LAMPORTS = 10_000;

export async function aliasConnection(options: ConnectionConfig = {}) {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || "https://api.devnet.solana.com";
  const connection = new Connection(rpc, { commitment: 'confirmed', ...options });
  if (await connection.getGenesisHash() !== DEVNET_GENESIS_HASH) {
    throw new Error("Alias claiming requires Solana devnet. Check the RPC configuration.");
  }
  return connection;
}

export function verifyAliasPayment(tx: ParsedTransactionWithMeta | null, wallet: string, treasury: string) {
  if (!tx || !tx.meta || tx.meta.err) throw new Error("Payment is not confirmed on Solana devnet. Wait and retry.");
  const signed = tx.transaction.message.accountKeys.some(key => key.signer && key.pubkey.toBase58() === wallet);
  const paid = tx.transaction.message.instructions.some(instruction => {
    if (!("parsed" in instruction) || instruction.program !== "system") return false;
    const { type, info } = instruction.parsed;
    return type === "transfer" && info.source === wallet && info.destination === treasury && info.lamports === CLAIM_PRICE_LAMPORTS;
  });
  if (!signed || !paid) throw new Error("A signed devnet alias payment to the configured treasury is required.");
}
