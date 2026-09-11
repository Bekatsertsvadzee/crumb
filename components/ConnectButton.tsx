'use client';

import { WalletReadyState } from '@solana/wallet-adapter-base';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useWalletModal } from '@/components/WalletProviders';
import { COOK_DECIMALS } from '@/lib/chain';
import { shortAddr } from '@/lib/format';

const NIGHTLY_URL = 'https://nightly.app/download';

export function useCookBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [lamports, setLamports] = useState<number | null>(null);
  useEffect(() => {
    if (!publicKey) {
      setLamports(null);
      return;
    }
    let live = true;
    // polled, not subscribed: the chain's websocket host differs from its RPC host
    const load = () => connection.getBalance(publicKey, 'confirmed').then((b) => live && setLamports(b)).catch(() => {});
    load();
    const id = setInterval(load, 15_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [connection, publicKey]);
  return {
    lamports,
    cook: lamports == null ? null : lamports / 10 ** COOK_DECIMALS,
    refresh: () => publicKey && connection.getBalance(publicKey, 'confirmed').then(setLamports).catch(() => {}),
  };
}

function WalletModal() {
  const { open, setOpen } = useWalletModal();
  const { wallets, select, connect, connecting, wallet } = useWallet();
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // wallet-adapter connects on select; finish the handshake once the selection lands
  useEffect(() => {
    if (!open || !wallet || connecting) return;
    if (wallet.adapter.connected) {
      setOpen(false);
      return;
    }
    connect().then(() => setOpen(false)).catch((e: Error) => setErr(friendlyWalletError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, open]);

  const nightly = wallets.find((w) => w.adapter.name === 'Nightly');
  const others = wallets.filter((w) => w !== nightly && w.readyState === WalletReadyState.Installed);
  const list = nightly ? [nightly, ...others] : others;

  return (
    <dialog ref={ref} className="modal" onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && setOpen(false)}>
      {/* wallet readyState differs between server and browser; render the list only once open */}
      {open && (
      <div className="modal-in">
        <div className="modal-hd">
          <h2>Connect a wallet</h2>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <ul className="wallet-list">
          {list.map((w) => {
            const installed = w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable;
            return (
              <li key={w.adapter.name}>
                {installed ? (
                  <button
                    className="wallet-row"
                    disabled={connecting}
                    onClick={() => {
                      setErr(null);
                      select(w.adapter.name);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.adapter.icon} alt="" width={28} height={28} />
                    <span>{w.adapter.name}</span>
                    <span className="mute">{connecting && wallet?.adapter.name === w.adapter.name ? 'Connecting…' : 'Detected'}</span>
                  </button>
                ) : (
                  <a className="wallet-row" href={w.adapter.name === 'Nightly' ? NIGHTLY_URL : w.adapter.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.adapter.icon} alt="" width={28} height={28} />
                    <span>{w.adapter.name}</span>
                    <span className="mute">Not installed — get it</span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        {err && <p className="form-err" role="alert">{err}</p>}
        <p className="mute modal-ft">
          Cookie Chain is Solana-compatible. Nightly is the reference wallet; add the network in Nightly if it is not listed.
        </p>
      </div>
      )}
    </dialog>
  );
}

export function friendlyWalletError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error ? e.name : '';
  if (/WalletNotReady|not installed|NotDetected/i.test(name + msg)) return 'Wallet not installed. Install Nightly, then reload this page.';
  if (/WalletConnectionError|User rejected|rejected the request|WalletNotSelected/i.test(name + msg)) return 'Connection cancelled in the wallet.';
  if (/WalletWindowClosed/i.test(name)) return 'The wallet window was closed before approving.';
  return msg || 'Could not connect the wallet.';
}

export default function ConnectButton() {
  const { publicKey, disconnect, connected, connecting } = useWallet();
  const { setOpen } = useWalletModal();
  const { cook } = useCookBalance();
  const [menu, setMenu] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu]);

  return (
    <>
      {connected && publicKey ? (
        <div className="acct" ref={wrap}>
          <button className="btn btn-ghost" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
            <span className="dot" aria-hidden="true" />
            <span className="mono">{shortAddr(publicKey.toBase58())}</span>
            {cook != null && <span className="mute">{cook.toLocaleString('en-US', { maximumFractionDigits: 3 })} COOK</span>}
          </button>
          {menu && (
            <div className="menu" role="menu">
              <Link href="/portfolio" role="menuitem" onClick={() => setMenu(false)}>Portfolio</Link>
              <button role="menuitem" onClick={() => { navigator.clipboard?.writeText(publicKey.toBase58()); setMenu(false); }}>Copy address</button>
              <button role="menuitem" onClick={() => { disconnect(); setMenu(false); }}>Disconnect</button>
            </div>
          )}
        </div>
      ) : (
        <button className="btn btn-primary" onClick={() => setOpen(true)} disabled={connecting}>
          {connecting ? 'Connecting…' : 'Connect wallet'}
        </button>
      )}
      <WalletModal />
    </>
  );
}
