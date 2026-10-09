'use client';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { useWalletSession } from '@/components/WalletSessionProvider';
import { CreatorPublicView } from '@/components/CreatorPublicView';
import { DRAFT_KEY, readDraft, type CreatorDraft } from '@/lib/creator-draft';

const subscribe = () => () => {};
export default function DraftPreviewPage() {
  const { wallet, checking } = useWalletSession();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return ready && !checking && wallet ? <DraftPreview key={wallet} wallet={wallet} /> : <main className="min-h-screen bg-[#07070a] p-8 text-zinc-400" role="status">Cargando tu borrador…</main>;
}
function DraftPreview({ wallet }: { wallet: string }) {
  const [result] = useState<{draft:CreatorDraft | null;error:string}>(() => {
    try {
      const raw = localStorage.getItem(`${DRAFT_KEY}:${wallet}`);
      return {draft:raw ? readDraft(raw) : null,error:''};
    } catch { return {draft:null,error:'No se pudo recuperar el borrador guardado.'}; }
  });
  if (!result.draft) return <main className="flex min-h-screen items-center justify-center bg-[#07070a] p-6 text-white"><section className="max-w-lg rounded-3xl border border-white/10 bg-[#101015] p-8"><h1 className="text-2xl font-semibold">Primero, dale forma a tu página</h1><p className="mt-4 text-sm leading-7 text-zinc-400">{result.error || 'Guarda un borrador en el editor para verlo como una página completa. Solo estará disponible en este navegador.'}</p><Link href="/dashboard/mypage" className="mt-6 inline-block rounded-xl bg-[#00F5A0] px-5 py-3 text-sm font-semibold text-black">Volver al editor</Link></section></main>;
  const draft = result.draft;
  return <CreatorPublicView profile={{wallet:'',alias:draft.alias,display_name:draft.name,bio:draft.bio,website:'',price_cents:0,duration_days:7,accepting:true}} ad={null} design={draft} preview />;
}
