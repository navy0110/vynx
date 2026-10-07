"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AddressType, useAccounts, useModal, usePhantom } from "@phantom/react-sdk";

type Profile = {
  username: string; wallet_address: string; display_name: string | null;
  bio: string | null; avatar_url: string | null; banner_url: string | null;
  created_at: string; tx_signature: string | null;
};
const action = "inline-flex items-center justify-center rounded-xl bg-[#00F5A0] px-5 py-3 text-sm font-semibold text-black hover:bg-[#8affd6]";

function WalletProfile({ wallet, alias }: { wallet: string; alias: string }) {
  const [result, setResult] = useState<{ profile: Profile | null; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ wallet });
    if (alias) params.set('alias', alias);
    fetch(`/api/profile?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Your profile could not be loaded.');
        if (!controller.signal.aborted) setResult(data);
      })
      .catch(error => {
        if (!controller.signal.aborted) setResult({ profile: null, error: error instanceof Error ? error.message : 'Your profile could not be loaded.' });
      });
    return () => controller.abort();
  }, [wallet, alias, attempt]);

  if (!result) return <p role="status" className="py-16 text-zinc-400">Loading your profile…</p>;
  if (result.error) return <div className="py-16"><p role="alert" className="mb-5 text-red-400">{result.error}</p><button className={action} onClick={() => { setResult(null); setAttempt(value => value + 1); }}>Retry</button></div>;
  const profile = result.profile;
  if (!profile) return <section className="rounded-3xl border border-white/10 bg-white/5 p-8"><h1 className="mb-3 text-3xl font-bold">{alias ? 'Alias not found for this wallet' : 'Your profile starts with an alias'}</h1><p className="mb-3 text-zinc-400">{alias ? 'Connect the wallet that claimed this alias, or view the profile for your current wallet.' : 'This wallet has not claimed an alias yet.'}</p><p className="mb-6 break-all font-mono text-sm text-zinc-400">{wallet}</p><Link href={alias ? '/profile' : '/'} className={action}>{alias ? 'View current wallet profile' : 'Claim an alias'}</Link></section>;

  return <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#101015]">
    {profile.banner_url && <div className="h-48 bg-cover bg-center sm:h-64" style={{ backgroundImage: `url(${JSON.stringify(profile.banner_url)})` }} role="img" aria-label={`@${profile.username} banner`} />}
    <div className="p-6 sm:p-10">
      <div className="flex flex-wrap items-center gap-5">
        {profile.avatar_url && <div className="h-24 w-24 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(profile.avatar_url)})` }} role="img" aria-label={`@${profile.username} avatar`} />}
        <div><p className="mb-2 text-sm text-[#00F5A0]">Your VYNX profile</p><h1 className="break-all text-3xl font-bold sm:text-5xl">{profile.display_name || `@${profile.username}`}</h1>{profile.display_name && <p className="mt-2 text-lg text-[#00F5A0]">@{profile.username}</p>}</div>
      </div>
      {profile.bio && <p className="mt-6 whitespace-pre-wrap text-zinc-300">{profile.bio}</p>}
      <dl className="mt-8 grid gap-6 border-t border-white/10 pt-8">
        <div><dt className="mb-2 text-sm text-zinc-500">Solana address</dt><dd className="break-all font-mono text-sm">{profile.wallet_address}</dd></div>
        <div><dt className="mb-2 text-sm text-zinc-500">Alias claimed</dt><dd>{new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</dd></div>
        {profile.tx_signature && <div><dt className="mb-2 text-sm text-zinc-500">Claim transaction</dt><dd><a className="break-all text-sm text-[#00F5A0] hover:underline" href={`https://explorer.solana.com/tx/${encodeURIComponent(profile.tx_signature)}?cluster=devnet`} target="_blank" rel="noopener noreferrer">View on Solana Explorer ↗</a></dd></div>}
      </dl>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/dashboard/mypage" className={action}>Customize your page</Link><Link href="/dashboard" className="rounded-xl border border-white/10 px-5 py-3 text-sm hover:bg-white/5">Open dashboard</Link></div>
    </div>
  </article>;
}

function ProfileContent() {
  const accounts = useAccounts();
  const { isConnected } = usePhantom();
  const { open } = useModal();
  const params = useSearchParams();
  const alias = (params.get('alias') ?? '').toLowerCase();
  const wallet = isConnected ? accounts?.find(account => account.addressType === AddressType.solana)?.address ?? '' : '';
  return <div className="min-h-screen bg-[#07070A] text-white"><nav className="flex items-center justify-between border-b border-white/10 px-6 py-5"><Link href="/" className="text-xl font-black tracking-widest">VYNX</Link><Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">Dashboard</Link></nav><main className="mx-auto max-w-4xl px-4 py-12 sm:px-8">
    {wallet ? <WalletProfile key={`${wallet}:${alias}`} wallet={wallet} alias={alias} /> : <section className="rounded-3xl border border-white/10 bg-white/5 p-8"><h1 className="mb-3 text-3xl font-bold">Your VYNX profile</h1><p className="mb-6 text-zinc-400">Connect your Solana wallet to view your claimed alias and profile.</p><button className={action} onClick={open}>Connect wallet</button></section>}
  </main></div>;
}

export default function ProfilePage() {
  return <Suspense fallback={<div role="status" className="min-h-screen bg-[#07070A] p-8 text-zinc-400">Loading your profile…</div>}><ProfileContent /></Suspense>;
}
