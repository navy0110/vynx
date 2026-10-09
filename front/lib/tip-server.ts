import { Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { appDb } from '@/lib/app-db';
import { publicCreator } from '@/lib/public-creator';
import { aliasConnection } from '@/lib/alias-network';
import { tipLamports, MEMO_PROGRAM, validPaymentSignature, verifySolPayment } from '@/lib/sol-payment';
import { walletKey } from '@/lib/sponsorship-server';
import { ApiError } from '@/lib/wallet-session';

export async function buildTip(alias: string, wallet: string, amount: string) {
  const creator = await publicCreator(alias);
  if (!creator || !creator.tipsEnabled) throw new ApiError('This creator is not receiving tips.', 404);
  const payer = walletKey(wallet);
  const recipient = walletKey(creator.wallet);
  if (payer.equals(recipient)) throw new ApiError('Use a different wallet to tip this creator.');
  const lamports = tipLamports(amount);
  const connection = await aliasConnection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction({ feePayer: payer, blockhash, lastValidBlockHeight });
  transaction.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: recipient, lamports }));
  transaction.add(new TransactionInstruction({ programId: MEMO_PROGRAM, data: Buffer.from(`vynx:tip:${creator.id}`), keys: [] }));
  return { transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'), blockhash, lastValidBlockHeight, lamports, recipient: creator.wallet };
}
export async function confirmTip(alias: string, wallet: string, amount: string, signature: string) {
  if (!validPaymentSignature(signature)) throw new ApiError('Invalid payment signature.');
  const lamports = tipLamports(amount);
  const db = appDb();
  const { data: creator, error: creatorError } = await db.from('cards_users').select('id,wallet_address').eq('username', alias).maybeSingle();
  if (creatorError) throw new ApiError('Creator storage is unavailable.', 503);
  if (!creator) throw new ApiError('Creator not found.', 404);
  const existing = async () => {
    const { data, error } = await db.from('tips').select('creator_id,payer,lamports,signature').eq('signature', signature).maybeSingle();
    if (error) throw new ApiError('Tip verification is temporarily unavailable. Please try again.', 503);
    if (!data) return false;
    if (data.creator_id !== creator.id || data.payer !== wallet || Number(data.lamports) !== lamports) throw new ApiError('This signature already belongs to another payment.', 409);
    return true;
  };
  if (await existing()) return { ok: true, signature };
  const connection = await aliasConnection();
  const tx = await connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  if (!tx) throw new ApiError('Payment is still confirming on Solana. Please retry verification if needed.', 409, 'PAYMENT_PENDING');
  if (tx.meta?.err) throw new ApiError('The devnet transaction failed. No payment was recorded.', 400, 'PAYMENT_FAILED');
  verifySolPayment(tx, wallet, creator.wallet_address, lamports, `vynx:tip:${creator.id}`);
  const { error } = await db.from('tips').insert({ creator_id: creator.id, payer: wallet, recipient: creator.wallet_address, lamports, signature });
  if (error) {
    if (error.code === '23505' && await existing()) return { ok: true, signature };
    throw new ApiError('Unable to record your tip. Keep the signature and retry verification without paying again.', 503);
  }
  return { ok: true, signature };
}
