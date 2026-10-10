import { getWallets } from '@wallet-standard/app';
import type { Wallet } from '@wallet-standard/base';
import type { SolanaSignAndSendTransactionFeature } from '@solana/wallet-standard-features';
import type { Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

const CHAIN = 'solana:devnet' as const;
// SDK 2.0.2's extension switchNetwork is a no-op and its Wallet Standard
// adapter chooses account.chains[0]. Never let wallet defaults pick our cluster.
export async function sendDevnetTransaction(transaction: Transaction, address: string, wallets: readonly Wallet[] = getWallets().get()) {
  const wallet = wallets.find(wallet => wallet.chains.includes(CHAIN) && wallet.accounts.some(account => account.address === address && account.chains.includes(CHAIN)) && 'solana:signAndSendTransaction' in wallet.features);
  const account = wallet?.accounts.find(account => account.address === address && account.chains.includes(CHAIN));
  if (!wallet || !account) throw Object.assign(new Error('Connect the Phantom extension with devnet support enabled. In Phantom, enable Testnet Mode and select Solana Devnet, then reconnect.'), { code: 'WALLET_DEVNET_UNAVAILABLE' });
  const feature = wallet.features['solana:signAndSendTransaction'] as SolanaSignAndSendTransactionFeature['solana:signAndSendTransaction'];
  const outputs = await feature.signAndSendTransaction({ account, chain: CHAIN, transaction: transaction.serialize({ requireAllSignatures: false, verifySignatures: true }), options: { preflightCommitment: 'confirmed', skipPreflight: false } });
  if (outputs.length !== 1 || outputs[0].signature.length !== 64) throw new Error('Wallet did not return a valid devnet transaction signature. Check wallet activity before retrying.');
  return { signature: bs58.encode(outputs[0].signature) };
}
