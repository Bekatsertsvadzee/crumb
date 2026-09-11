'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCookBalance } from '@/components/ConnectButton';
import CopyButton from '@/components/CopyButton';
import SendPanel from '@/components/SendPanel';
import TokenIcon from '@/components/TokenIcon';
import { useWalletModal } from '@/components/WalletProviders';
import { addrUrl, COOK_MINT, WCOOK_MINT } from '@/lib/chain';
import { fmtAmount, fmtPrice, fmtUsd, shortAddr } from '@/lib/format';

type Holding = { mint: string; symbol: string; name: string | null; image: string | null; amount: number; priceUsd: number | null; valueUsd: number | null; tracked: boolean };

type StateLite = { mint: string; price_usd: number | null; tokens: { symbol: string | null; name: string | null; image_url: string | null } };

export default function Portfolio() {
  const { publicKey, connected } = useWallet();
  const { setOpen } = useWalletModal();
  const { cook } = useCookBalance();
  const [rows, setRows] = useState<Holding[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cookUsd, setCookUsd] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setRows(null);
      return;
    }
    let live = true;
    setErr(null);
    setRows(null);
    (async () => {
      const owner = publicKey.toBase58();
      const res = await fetch(`/api/portfolio?owner=${owner}`);
      if (!res.ok) throw new Error(`Portfolio lookup failed (HTTP ${res.status}).`);
      const json = (await res.json()) as { holdings: Holding[]; cookUsd: number | null; error?: string };
      if (json.error) throw new Error(json.error);
      if (!live) return;
      setRows(json.holdings);
      setCookUsd(json.cookUsd);
    })().catch((e: Error) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, [publicKey]);

  if (!connected || !publicKey) {
    return (
      <section className="card center">
        <h1>Portfolio</h1>
        <p className="mute">Connect a wallet to see your Cookie Chain holdings priced by Crumb.</p>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>Connect wallet</button>
      </section>
    );
  }

  const addr = publicKey.toBase58();
  const cookValue = cook != null && cookUsd != null ? cook * cookUsd : null;
  const total = (rows ?? []).reduce((s, r) => s + (r.valueUsd ?? 0), cookValue ?? 0);

  return (
    <>
      <header className="tok-hd">
        <div className="tok-hd-main">
          <h1>Portfolio</h1>
          <div className="tok-hd-mint">
            <code>{addr}</code>
            <CopyButton text={addr} label="Copy address" />
            <a href={addrUrl(addr)} target="_blank" rel="noreferrer" className="ext">Cookiescan</a>
          </div>
        </div>
        <div className="tok-hd-price">
          <div className="tok-hd-px">{rows ? fmtUsd(total, 2) : '—'}</div>
          <div className="mute" style={{ fontSize: 12 }}>total, priced from Crumb&apos;s last tick</div>
        </div>
      </header>

      <div className="grid-main">
        <div className="col">
          <section className="card">
            <div className="card-hd"><div><h2>Holdings</h2><p className="mute">Fungible tokens from the DAS API. Unpriced tokens have no pool.</p></div></div>
            {err ? (
              <div className="empty"><p>Could not load holdings.</p><p className="mute">{err}</p></div>
            ) : rows == null ? (
              <div className="skeleton-rows" aria-busy="true"><i /><i /><i /></div>
            ) : (
              <div className="tbl-wrap flat">
                <table>
                  <thead><tr><th>Token</th><th>Balance</th><th>Price</th><th>Value</th></tr></thead>
                  <tbody>
                    <tr>
                      <td className="tok"><span className="tok-cell"><TokenIcon src={null} symbol="COOK" /><span className="tok-sym">COOK</span><span className="tok-name">native</span></span></td>
                      <td>{cook == null ? '—' : fmtAmount(cook)}</td>
                      <td>{fmtPrice(cookUsd)}</td>
                      <td>{fmtUsd(cookValue, 2)}</td>
                    </tr>
                    {rows.map((r) => (
                      <tr key={r.mint}>
                        <td className="tok">
                          {r.tracked ? (
                            <Link href={`/token/${r.mint}`} className="tok-cell"><TokenIcon src={r.image} symbol={r.symbol} /><span><span className="tok-sym">{r.symbol}</span>{r.name && r.name !== r.symbol && <span className="tok-name">{r.name}</span>}</span></Link>
                          ) : (
                            <span className="tok-cell"><TokenIcon src={r.image} symbol={r.symbol} /><span><span className="tok-sym">{r.symbol}</span><span className="tok-name">{shortAddr(r.mint)}</span></span></span>
                          )}
                        </td>
                        <td>{fmtAmount(r.amount)}</td>
                        <td className={r.priceUsd ? '' : 'mute'}>{fmtPrice(r.priceUsd)}</td>
                        <td className={r.valueUsd ? '' : 'mute'}>{fmtUsd(r.valueUsd, 2)}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={4} className="empty">No SPL tokens in this wallet. Swap for one from any token page.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        <aside className="col">
          <SendPanel />
          <section className="card">
            <div className="card-hd"><div><h2>Need COOK?</h2></div></div>
            <p className="mute" style={{ margin: 0 }}>
              Bridge from Solana at{' '}
              <a href="https://hyperlane.cookiescan.io" target="_blank" rel="noreferrer" className="ext">hyperlane.cookiescan.io</a>.
              COOK pays fees on Cookie Chain; wrapped COOK uses the {shortAddr(WCOOK_MINT)} address, native COOK mint is {shortAddr(COOK_MINT)}.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
