import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { assertPaymentMatches, challengeMessage, tokenAccount, USDC_MINT, validWalletSignature } from '../lib/sponsorship-server.ts';

const creator = new PublicKey(new Uint8Array(32).fill(1)).toBase58();
const brand = new PublicKey(new Uint8Array(32).fill(2)).toBase58();
const campaign = { id: 'a55a4d3d-2cc8-4e64-9534-df7b9b1ff333', creator_wallet: creator, brand_wallet: brand, price_cents: 2500 };
const destination = tokenAccount(creator);
const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

function transaction() {
  return { transaction: { message: {
    accountKeys: [{ pubkey: new PublicKey(brand), signer: true }, { pubkey: destination, signer: false }],
    instructions: [
      { programId: memoProgram, parsed: `vynx:sponsor:${campaign.id}` },
      { programId: tokenProgram, parsed: { type: 'transferChecked', info: {
        authority: brand, source: tokenAccount(brand).toBase58(), destination: destination.toBase58(),
        mint: USDC_MINT.toBase58(), tokenAmount: { amount: '25000000', decimals: 6 },
      } } },
    ],
  } }, meta: { err: null, preTokenBalances: [{ accountIndex: 1, uiTokenAmount: { amount: '10' } }],
    postTokenBalances: [{ accountIndex: 1, mint: USDC_MINT.toBase58(), owner: creator, uiTokenAmount: { amount: '25000010' } }] } };
}

test('payment binds payer, receiver, mint, exact amount and campaign reference', () => {
  assert.doesNotThrow(() => assertPaymentMatches(campaign, transaction()));
  const changes = [
    tx => { tx.transaction.message.accountKeys[0].signer = false; },
    tx => { tx.transaction.message.instructions[0].parsed = 'vynx:sponsor:another-campaign'; },
    tx => { tx.transaction.message.instructions[1].parsed.info.tokenAmount.amount = '24999999'; },
    tx => { tx.transaction.message.instructions[1].parsed.info.mint = creator; },
    tx => { tx.transaction.message.instructions[1].parsed.info.destination = brand; },
    tx => { tx.transaction.message.instructions[1].parsed.info.authority = creator; },
    tx => { tx.meta.postTokenBalances[0].uiTokenAmount.amount = '10'; },
    tx => { tx.meta.err = { InstructionError: [0, 'Failed'] }; },
  ];
  for (const change of changes) { const tx = transaction(); change(tx); assert.throws(() => assertPaymentMatches(campaign, tx)); }
});

test('wallet authorization rejects modified content and another signer', () => {
  const pair = generateKeyPairSync('ed25519');
  const raw = pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const key = new PublicKey(raw);
  const message = challengeMessage('https://vynx.test', key.toBase58(), 'approve', { id: campaign.id }, 'nonce', '2026-10-01T00:00:00.000Z');
  const signature = sign(null, Buffer.from(message), pair.privateKey).toString('hex');
  assert.equal(validWalletSignature(key, message, signature), true);
  assert.equal(validWalletSignature(key, message + 'changed', signature), false);
  assert.equal(validWalletSignature(new PublicKey(brand), message, signature), false);
  assert.equal(validWalletSignature(key, message, 'invalid'), false);
  assert.notEqual(message, challengeMessage('https://other.test', key.toBase58(), 'approve', { id: campaign.id }, 'nonce', '2026-10-01T00:00:00.000Z'));
});
