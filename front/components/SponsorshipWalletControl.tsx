'use client';

import { useState } from 'react';
import { useDisconnect } from '@phantom/react-sdk';
import { useSponsorshipWallet } from '@/lib/use-sponsorship-wallet';

export default function SponsorshipWalletControl() {
  const { wallet, open } = useSponsorshipWallet();
  const { disconnect, isDisconnecting } = useDisconnect();
  const [error, setError] = useState('');

  async function disconnectWallet() {
    setError('');
    try { await disconnect(); }
    catch { setError('No se pudo desconectar. Reintenta o recarga la página.'); }
  }

  return <div className="flex flex-col items-end gap-2">
    <div className="flex flex-wrap items-center justify-end gap-3">
      {wallet ? <><span className="text-xs text-zinc-400" title={wallet}>{wallet.slice(0,5)}…{wallet.slice(-4)}</span><button type="button" disabled={isDisconnecting} onClick={() => void disconnectWallet()} className="rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-40">{isDisconnecting ? 'Desconectando…' : 'Desconectar'}</button></> : <button type="button" onClick={open} className="rounded-xl border border-white/15 px-4 py-2 text-sm">Conectar wallet</button>}
    </div>
    {error && <p role="alert" className="max-w-xs text-xs text-red-200">{error}</p>}
  </div>;
}
