import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import { sendDevnetTransaction } from '../lib/devnet-wallet.ts';
const owner = Keypair.generate(), sponsor = Keypair.generate();
function transaction() {
  const tx = new Transaction({ feePayer: sponsor.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58() });
  tx.add(SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: sponsor.publicKey, lamports: 1 })); tx.partialSign(sponsor); return tx;
}
function wallet(send, address = owner.publicKey.toBase58(), chains = ['solana:mainnet', 'solana:devnet']) {
  return { chains, accounts: [{ address, chains, publicKey: owner.publicKey.toBytes(), features: ['solana:signAndSendTransaction'] }], features: { 'solana:signAndSendTransaction': { signAndSendTransaction: send } } };
}
test('mainnet-first wallets receive explicit devnet and preserve the sponsor signature and message', async () => {
  const tx = transaction(); let request;
  const signature = new Uint8Array(64).fill(7);
  const result = await sendDevnetTransaction(tx, owner.publicKey.toBase58(), [wallet(async input => { request = input; return [{ signature }]; })]);
  assert.equal(request.chain, 'solana:devnet'); assert.equal(request.options.skipPreflight, false);
  const sent = Transaction.from(request.transaction); assert(sent.serializeMessage().equals(tx.serializeMessage())); assert(sent.signatures[0].signature.equals(tx.signatures[0].signature)); assert(sent.feePayer.equals(sponsor.publicKey));
  assert.equal(result.signature, bs58.encode(signature));
});
test('unsupported or mismatched wallet accounts fail before requesting a signature', async () => {
  let calls = 0; const send = async () => { calls++; return []; };
  for (const wallets of [[], [wallet(send, owner.publicKey.toBase58(), ['solana:mainnet'])], [wallet(send, sponsor.publicKey.toBase58())]]) {
    await assert.rejects(sendDevnetTransaction(transaction(), owner.publicKey.toBase58(), wallets), error => error.code === 'WALLET_DEVNET_UNAVAILABLE');
  }
  assert.equal(calls, 0);
});
