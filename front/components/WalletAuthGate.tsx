'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import { useWalletSession } from '@/components/WalletSessionProvider';

export function WalletAuthGate() {
  const session = useWalletSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signIn() {
    setBusy(true); setError('');
    try { await session.authenticate(); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in. Retry.'); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#07070a] p-6 text-white"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101015] p-8"><BrandLogo /><h1 className="mt-6 text-2xl font-semibold">Unlock your dashboard</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Open Phantom and approve the sign-in message to continue.</p><button type="button" disabled={busy} onClick={() => void signIn()} className="mt-6 w-full rounded-xl bg-[#00F5A0] px-5 py-3 font-semibold text-black disabled:opacity-40">{busy ? 'Signing in…' : 'Connect wallet'}</button>{error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}</section></main>;
}
