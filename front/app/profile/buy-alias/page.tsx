'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Transaction } from '@solana/web3.js';
import { useSolana } from '@phantom/react-sdk';
import { BrandLogo } from '@/components/BrandLogo';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { useClaimedAlias } from '@/lib/use-claimed-alias';
import { normalizeAlias, safeDestination } from '@/lib/alias';
import { confirmPayment } from '@/lib/payment-client';
import { CLAIM_PRICE_SOL } from '@/lib/alias-network';
import { claimErrorMessage, type ClaimStage } from '@/lib/claim-errors';

function BuyAliasContent() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useWalletSession();
  const { solana } = useSolana();
  const claimed = useClaimedAlias(session.wallet || session.connectedWallet);
  const [alias, setAlias] = useState(params.get('alias') ?? '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<{ alias: string; signature: string } | null>(null);
  async function post(path: string, body: unknown) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error), { code: result.code });
    return result;
  }
  async function claim(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice(''); setFailed(false);
    let stage: ClaimStage = 'sign-in';
    let reference = pending;
    try {
      if (!session.connectedWallet) { await session.authenticate(); return; }
      await session.ensureSession();
      if (solana.publicKey !== session.connectedWallet) throw new Error('Reconnect the selected wallet before claiming.');
      const key = `vynx:claim:${session.connectedWallet}`;
      try { const saved = localStorage.getItem(key); if (saved) reference = JSON.parse(saved); } catch { /* The in-memory recovery remains available. */ }
      if (reference) setPending(reference);
      if (!reference) {
        stage = 'prepare';
        const name = normalizeAlias(alias);
        setNotice('Preparing your devnet alias payment…');
        const payment = await post(`/api/actions/claim-alias?alias=${name}`, { account: session.connectedWallet });
        await solana.switchNetwork('devnet');
        stage = 'send';
        setNotice('Approve the alias payment in Phantom…');
        const tx = Transaction.from(Uint8Array.from(atob(payment.transaction), character => character.charCodeAt(0)));
        const { signature } = await solana.signAndSendTransaction(tx);
        reference = { alias: name, signature };
        setPending(reference);
        try { localStorage.setItem(key, JSON.stringify(reference)); } catch { /* The signature remains visible for recovery. */ }
      }
      setNotice('Payment sent. Verifying your alias…');
      stage = 'verify';
      const receipt = reference;
      await confirmPayment(() => post(`/api/actions/claim-alias/confirm?alias=${receipt.alias}`, { account: session.connectedWallet, signature: receipt.signature }));
      try { localStorage.removeItem(key); } catch { /* Server confirmation is idempotent. */ }
      setNotice(`@${reference.alias} claimed! Opening your profile editor…`);
      setPending(null);
      router.replace(safeDestination(params.get('next') ?? '/dashboard/mypage')); router.refresh();
    } catch (reason) {
      if (reason instanceof Error && 'code' in reason && reason.code === 'PAYMENT_FAILED') {
        setPending(null);
        try { localStorage.removeItem(`vynx:claim:${session.connectedWallet}`); } catch { /* A failed transaction transferred no funds. */ }
      }
      setFailed(true); setNotice(claimErrorMessage(reason, stage, !!reference)); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#07070a] p-6 text-white"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101015] p-8"><BrandLogo /><h1 className="mt-6 text-3xl font-semibold">Claim your alias</h1><p className="mt-3 text-sm leading-6 text-zinc-400">One alias per wallet. Registration costs {CLAIM_PRICE_SOL} SOL on Solana devnet, plus network fees.</p>
    {claimed.alias ? <div className="mt-6"><p>Your wallet already owns @{claimed.alias}.</p><Link href="/dashboard/mypage" className="mt-5 inline-block rounded-xl bg-[#00F5A0] px-5 py-3 font-semibold text-black">Edit my creator card</Link></div> : <form onSubmit={event => void claim(event)} className="mt-6 space-y-4"><label className="block text-sm">Alias<input name="alias" required minLength={3} maxLength={30} disabled={busy || !!pending} value={alias} onChange={event => setAlias(event.target.value.toLowerCase())} placeholder="your_alias" className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 outline-none focus:border-[#00F5A0]" /></label><button disabled={busy || claimed.loading || !!claimed.error} className="w-full rounded-xl bg-[#00F5A0] px-5 py-3 font-semibold text-black disabled:opacity-40">{busy ? 'Processing…' : pending ? 'Verify alias payment' : session.connectedWallet ? `Claim alias — ${CLAIM_PRICE_SOL} SOL` : 'Connect wallet'}</button></form>}
    {notice && <p role={failed ? 'alert' : 'status'} className={`mt-4 text-sm ${failed ? 'text-red-200' : 'text-emerald-200'}`}>{notice}</p>}
    {claimed.error && <p role="alert" className="mt-4 text-sm text-red-200">{claimed.error} <button onClick={claimed.retry} className="underline">Retry</button></p>}
    {pending && <p className="mt-4 break-all text-xs text-zinc-400">Payment sent: {pending.signature}. Retry verification instead of paying again.</p>}
  </section></main>;
}
export default function BuyAliasPage() { return <Suspense fallback={<p role="status">Loading claim…</p>}><BuyAliasContent /></Suspense>; }
