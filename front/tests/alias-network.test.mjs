import test from 'node:test';
import assert from 'node:assert/strict';
import { Connection, PublicKey } from '@solana/web3.js';
import { aliasConnection, DEVNET_GENESIS_HASH, verifyAliasPayment } from '../lib/alias-network.ts';

const wallet = '11111111111111111111111111111111';
const treasury = 'So11111111111111111111111111111111111111112';
const payment = () => ({ meta: { err: null }, transaction: { message: {
  accountKeys: [{ signer: true, pubkey: new PublicKey(wallet) }],
  instructions: [{ program: 'system', parsed: { type: 'transfer', info: { source: wallet, destination: treasury, lamports: 10000 } } }],
} } });

test('RPC cluster verification rejects mainnet and testnet, including opaque URLs', async () => {
  const original = Connection.prototype.getGenesisHash;
  const originalEnv = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  try {
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = 'https://custom.example.com';
    for (const hash of ['mainnet-genesis', 'testnet-genesis']) {
      Connection.prototype.getGenesisHash = async () => hash;
      await assert.rejects(aliasConnection(), /requires Solana devnet/);
    }
    Connection.prototype.getGenesisHash = async () => DEVNET_GENESIS_HASH;
    assert.equal((await aliasConnection()).rpcEndpoint, 'https://custom.example.com');
    delete process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    assert.equal((await aliasConnection()).rpcEndpoint, 'https://api.devnet.solana.com');
  } finally {
    Connection.prototype.getGenesisHash = original;
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    else process.env.NEXT_PUBLIC_SOLANA_RPC_URL = originalEnv;
  }
});

test('registration requires a successful signed payment with the correct recipient and amount', () => {
  assert.doesNotThrow(() => verifyAliasPayment(payment(), wallet, treasury));
  for (const invalid of [null, { ...payment(), meta: { err: 'failed' } }]) {
    assert.throws(() => verifyAliasPayment(invalid, wallet, treasury));
  }
  for (const mutate of [
    tx => { tx.transaction.message.accountKeys[0].signer = false; },
    tx => { tx.transaction.message.instructions[0].parsed.info.destination = wallet; },
    tx => { tx.transaction.message.instructions[0].parsed.info.source = treasury; },
    tx => { tx.transaction.message.instructions[0].parsed.info.lamports = 1; },
  ]) {
    const tx = payment(); mutate(tx);
    assert.throws(() => verifyAliasPayment(tx, wallet, treasury));
  }
});
