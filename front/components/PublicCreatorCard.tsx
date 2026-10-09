'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Link2, UserRound } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { TipForm } from '@/components/TipForm';
import { safeLink } from '@/lib/creator-draft';
import type { PublicCreator } from '@/lib/public-creator';

export function PublicCreatorCard({ creator }: { creator: PublicCreator }) {
  const { design } = creator;
  const light = design.theme === 'light';
  const accent = { mint: '#00F5A0', violet: '#b69aff', rose: '#ff94b9' }[design.accent];
  const [notice, setNotice] = useState('');
  async function share() {
    try {
      const url = `${window.location.origin}/${creator.alias}`;
      if (navigator.share) await navigator.share({ title: design.name, url });
      else { await navigator.clipboard.writeText(url); setNotice('Page link copied.'); }
    } catch (reason) { if (!(reason instanceof Error && reason.name === 'AbortError')) setNotice('Unable to share. Copy the page URL from your browser.'); }
  }
  return <main className={`min-h-screen px-5 py-7 ${light ? 'bg-[#f5f5f7] text-zinc-900' : 'bg-[#07070a] text-white'}`}><div className="mx-auto max-w-6xl">
    <nav className="mb-8 flex items-center justify-between gap-4"><BrandLogo light={light} /><Link href="/dashboard" className="text-sm opacity-60">My dashboard ↗</Link></nav>
    <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]"><section className={`overflow-hidden rounded-3xl border border-current/10 ${light ? 'bg-white' : 'bg-[#101015]'}`}>
      <div className="relative h-44 sm:h-56" style={{ background: `linear-gradient(135deg, ${accent}66, #3c245b)` }}>{design.cover && <Image src={design.cover} alt={`${design.name} cover`} fill sizes="(max-width: 1024px) 100vw, 650px" unoptimized className="object-cover" />}</div>
      <div className="relative -mt-12 p-6 pt-0 sm:p-8 sm:pt-0"><div className={`relative size-24 overflow-hidden rounded-full border-4 ${light ? 'border-white bg-zinc-200' : 'border-[#101015] bg-zinc-800'}`}>{design.avatar ? <Image src={design.avatar} alt={`${design.name} avatar`} fill sizes="96px" unoptimized className="object-cover" /> : <UserRound size={38} aria-hidden="true" className="m-auto mt-6 opacity-40" />}</div>
        <h1 className="mt-5 break-words text-3xl font-semibold">{design.name}</h1><p className="mt-2 text-sm opacity-50">@{creator.alias}</p><p className="mt-5 whitespace-pre-line break-words text-sm leading-7 opacity-70">{design.bio}</p>
        <div className="mt-5 flex flex-wrap gap-3">{Object.entries(design.socials).filter(([, url]) => safeLink(url)).map(([network, url]) => <a key={network} href={url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-current/15 px-4 py-2 text-sm">{network === 'x' ? 'X' : network === 'youtube' ? 'YouTube' : 'Instagram'}</a>)}</div>
        <div className="mt-6 space-y-3">{design.links.map(link => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 border px-4 py-4 text-sm ${design.rounded ? 'rounded-2xl' : 'rounded-md'}`} style={{ borderColor: `${accent}66`, background: `${accent}15` }}><Link2 size={16} aria-hidden="true" /><span className="min-w-0 flex-1 break-words">{link.title}</span><ArrowUpRight size={16} aria-hidden="true" /></a>)}</div>
        <button onClick={() => void share()} className="mt-6 rounded-xl border border-current/15 px-4 py-2.5 text-sm">Share creator page</button>{notice && <p role="status" className="mt-3 text-xs opacity-60">{notice}</p>}
      </div>
    </section><TipForm alias={creator.alias} creatorWallet={creator.wallet} enabled={creator.tipsEnabled} /></div>
    <footer className="mt-8 border-t border-current/10 py-6 text-xs opacity-50">A space of your own. Built on Solana devnet.</footer>
  </div></main>;
}
