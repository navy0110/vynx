'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AddressType, useAccounts, useConnect, useDisconnect, useModal, usePhantom } from '@phantom/react-sdk';

type SessionContext = { wallet: string; connectedWallet: string; checking: boolean; authenticate: () => Promise<string>; signIn: () => Promise<string>; ensureSession: () => Promise<string>; logout: () => Promise<void>; open: () => void };
const Context = createContext<SessionContext | null>(null);
export function WalletSessionProvider({ children }: { children: ReactNode }) {
  const accounts = useAccounts();
  const connectedWallet = accounts?.find(account => account.addressType === AddressType.solana)?.address ?? '';
  const { open } = useModal();
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();
  const { sdk } = usePhantom();
  const authentication = useRef<Promise<string> | null>(null);
  const [wallet, setWallet] = useState('');
  const [checking, setChecking] = useState(true);
  const currentWallet = useRef(connectedWallet);
  useEffect(() => { currentWallet.current = connectedWallet; }, [connectedWallet]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/session', { signal: controller.signal, cache: 'no-store' })
      .then(async response => response.ok ? response.json() : { wallet: null })
      .then(session => { if (!controller.signal.aborted) { setWallet(session.wallet ?? ''); setChecking(false); } })
      .catch(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);
  async function signIn(selectedWallet = connectedWallet) {
    const solana = sdk?.solana;
    if (!selectedWallet || !solana || solana.publicKey !== selectedWallet) throw new Error('Connect your selected Phantom wallet first.');
    const nonceResponse = await fetch('/api/auth/nonce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: selectedWallet }) });
    const nonce = await nonceResponse.json();
    if (!nonceResponse.ok) throw new Error(nonce.error);
    const signed = await solana.signMessage(new TextEncoder().encode(nonce.message));
    if (solana.publicKey !== selectedWallet || signed.publicKey !== selectedWallet) throw new Error('Your wallet changed. Sign in with the current account.');
    const signature = Array.from(signed.signature, byte => byte.toString(16).padStart(2, '0')).join('');
    const response = await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: selectedWallet, id: nonce.id, signature }) });
    const session = await response.json();
    if (!response.ok) throw new Error(session.error);
    setWallet(session.wallet);
    return session.wallet as string;
  }
  function authenticate() {
    if (authentication.current) return authentication.current;
    const attempt = (async () => {
      if (!sdk) throw new Error('Wallet is loading. Please try again.');
      await sdk.discoverWallets();
      if (!sdk.solana.publicKey) await connect({ provider: 'injected' });
      const selectedWallet = sdk.solana.publicKey;
      if (!selectedWallet) throw new Error('Connect your Phantom wallet to continue.');
      currentWallet.current = selectedWallet;
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      const existing = await response.json();
      if (!response.ok) throw new Error(existing.error);
      if (existing.wallet === selectedWallet) { setWallet(selectedWallet); return selectedWallet; }
      return signIn(selectedWallet);
    })();
    authentication.current = attempt;
    void attempt.finally(() => { authentication.current = null; }).catch(() => {});
    return attempt;
  }
  async function ensureSession() {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    const session = await response.json();
    if (!response.ok) throw new Error(session.error);
    if (session.wallet && (!currentWallet.current || session.wallet === currentWallet.current)) { setWallet(session.wallet); return session.wallet as string; }
    return signIn();
  }
  async function logout() {
    const response = await fetch('/api/auth/session', { method: 'DELETE' });
    if (!response.ok) throw new Error((await response.json()).error);
    setWallet('');
    if (connectedWallet) await disconnect();
  }
  const sessionWallet = connectedWallet && wallet !== connectedWallet ? '' : wallet;
  return <Context.Provider value={{ wallet: sessionWallet, connectedWallet, checking, authenticate, signIn, ensureSession, logout, open }}>{children}</Context.Provider>;
}
export function useWalletSession() {
  const context = useContext(Context);
  if (!context) throw new Error('WalletSessionProvider is missing.');
  return context;
}
