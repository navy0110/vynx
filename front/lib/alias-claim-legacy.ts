import { Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { appDb } from '@/lib/app-db';
import { normalizeAlias } from '@/lib/alias';
import { aliasConnection, CLAIM_PRICE_LAMPORTS } from '@/lib/alias-network';
import { MEMO_PROGRAM, validPaymentSignature, verifySolPayment } from '@/lib/sol-payment';
import { walletKey } from '@/lib/sponsorship-server';
import { ApiError } from '@/lib/wallet-session';
import { claimRpc, claimRpcFetch } from '@/lib/claim-rpc';

function claimConflict(rows: Awaited<ReturnType<typeof checkClaim>>, alias: string, account: string) {
  if (rows.some(row => row.wallet_address === account)) throw new ApiError('Your wallet already owns an alias. Open your creator card from the dashboard.', 409, 'WALLET_HAS_ALIAS');
  if (rows.some(row => row.username === alias)) throw new ApiError('This alias is already taken. Choose another alias.', 409, 'ALIAS_TAKEN');
}

export function verifyClaimPayment(tx: Parameters<typeof verifySolPayment>[0], account: string, treasury: string, alias: string) {
  const transfers = tx?.transaction.message.instructions.filter(instruction => 'parsed' in instruction && instruction.program === 'system'
    && instruction.parsed?.type === 'transfer' && instruction.parsed.info.source === account && instruction.parsed.info.destination === treasury) ?? [];
  if (transfers.length === 1 && 'parsed' in transfers[0] && transfers[0].parsed.info.lamports < CLAIM_PRICE_LAMPORTS) {
    throw new ApiError('Payment is below the required alias price. Keep the signature and contact support before paying again.', 400, 'INSUFFICIENT_PAYMENT');
  }
  try { verifySolPayment(tx, account, treasury, CLAIM_PRICE_LAMPORTS, `vynx:claim:${alias}`); }
  catch { throw new ApiError('Payment does not match this wallet, alias and required amount. Keep the signature and contact support.', 400, 'PAYMENT_MISMATCH'); }
}

export async function checkClaim(alias: string, wallet?: string) {
  const db = appDb();
  const { data, error } = await db.from('cards_users').select('username,wallet_address,tx_signature')
    .or(wallet ? `username.eq.${alias},wallet_address.eq.${wallet}` : `username.eq.${alias}`);
  if (error) throw new ApiError('Alias storage is unavailable.', 503);
  return data ?? [];
}
export async function buildClaim(value: unknown, account: string) {
  const alias = normalizeAlias(value);
  const payer = walletKey(account);
  const treasury = walletKey(process.env.NEXT_PUBLIC_TREASURY_WALLET);
  if (payer.equals(treasury)) throw new ApiError('Use a wallet different from the treasury.');
  claimConflict(await checkClaim(alias, account), alias, account);
  const connection = await claimRpc(() => aliasConnection({ fetch: claimRpcFetch, disableRetryOnRateLimit: true }));
  const { blockhash, lastValidBlockHeight } = await claimRpc(() => connection.getLatestBlockhash('confirmed'));
  const transaction = new Transaction({ feePayer: payer, blockhash, lastValidBlockHeight });
  transaction.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: treasury, lamports: CLAIM_PRICE_LAMPORTS }));
  transaction.add(new TransactionInstruction({ programId: MEMO_PROGRAM, data: Buffer.from(`vynx:claim:${alias}`), keys: [] }));
  return { alias, transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'), blockhash, lastValidBlockHeight };
}
export async function confirmClaim(value: unknown, account: string, signature: string) {
  const alias = normalizeAlias(value);
  walletKey(account);
  if (!validPaymentSignature(signature)) throw new ApiError('Invalid transaction signature. Reconnect the correct wallet and retry.', 400, 'INVALID_SIGNATURE');
  const rows = await checkClaim(alias, account);
  if (rows.some(row => row.username === alias && row.wallet_address === account && row.tx_signature === signature)) return { alias, ok: true };
  claimConflict(rows, alias, account);
  const treasury = walletKey(process.env.NEXT_PUBLIC_TREASURY_WALLET).toBase58();
  const connection = await claimRpc(() => aliasConnection({ fetch: claimRpcFetch, disableRetryOnRateLimit: true }));
  const tx = await claimRpc(() => connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 }));
  if (!tx) throw new ApiError('Payment is still confirming on Solana. Please retry verification if needed.', 409, 'PAYMENT_PENDING');
  if (tx.meta?.err) throw new ApiError('The devnet transaction failed. No payment was recorded.', 400, 'PAYMENT_FAILED');
  verifyClaimPayment(tx, account, treasury, alias);
  const { error } = await appDb().from('cards_users').insert({ wallet_address: account, username: alias, tx_signature: signature,
    claim_cluster: 'devnet', claim_lamports: CLAIM_PRICE_LAMPORTS, claim_treasury: treasury, claim_verified_at: new Date().toISOString() });
  if (error) {
    const retry = await checkClaim(alias, account);
    if (retry.some(row => row.username === alias && row.wallet_address === account && row.tx_signature === signature)) return { alias, ok: true };
    claimConflict(retry, alias, account);
    throw new ApiError(error.code === '23505' ? 'This payment signature was already used. Keep the signature and contact support.' : 'Unable to register alias. Retry verification without paying again.', error.code === '23505' ? 409 : 503, error.code === '23505' ? 'PAYMENT_MISMATCH' : 'CLAIM_UNAVAILABLE');
  }
  return { alias, ok: true };
}
