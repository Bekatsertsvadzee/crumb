'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddressSync, NATIVE_MINT } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCookBalance } from '@/components/ConnectButton';
import TxStatus from '@/components/TxStatus';
import { useWalletModal } from '@/components/WalletProviders';
import { COOK_DECIMALS } from '@/lib/chain';
import { fmtAmount } from '@/lib/format';
import { buildSwapTx, loadPool, quoteSwap, type LoadedPool, type Quote } from '@/lib/swap';
import { describeTxError, sendAndConfirm, type TxState } from '@/lib/tx';

type Props = {
  mint: string;
  symbol: string;
  decimals: number;
  pool: { id: string; type: string; liquidityUsd: number } | null;
};

const SLIPPAGES = [50, 100, 300];

function toBase(amount: string, decimals: number): BN | null {
  if (!/^\d*\.?\d*$/.test(amount) || amount === '' || amount === '.') return null;
  const [w, f = ''] = amount.split('.');
  const s = (w || '0') + f.padEnd(decimals, '0').slice(0, decimals);
  const bn = new BN(s.replace(/^0+(?=\d)/, ''));
  return bn.isZero() ? null : bn;
}
const fromBase = (v: BN, decimals: number) => Number(v.toString()) / 10 ** decimals;

export default function SwapPanel({ mint, symbol, decimals, pool }: Props) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { setOpen } = useWalletModal();
  const { cook, refresh } = useCookBalance();

  const [dir, setDir] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [slip, setSlip] = useState(100);
  const [loaded, setLoaded] = useState<LoadedPool | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [tokenBal, setTokenBal] = useState<number | null>(null);
  const [tx, setTx] = useState<TxState>({ phase: 'idle' });
  const busy = tx.phase !== 'idle' && tx.phase !== 'error' && tx.phase !== 'confirmed';
  const quoteSeq = useRef(0);

  const tokenMint = useMemo(() => new PublicKey(mint), [mint]);
  const inMint = dir === 'buy' ? NATIVE_MINT : tokenMint;
  const outMint = dir === 'buy' ? tokenMint : NATIVE_MINT;
  const inDecimals = dir === 'buy' ? COOK_DECIMALS : decimals;
  const outDecimals = dir === 'buy' ? decimals : COOK_DECIMALS;
  const inSym = dir === 'buy' ? 'COOK' : symbol;
  const outSym = dir === 'buy' ? symbol : 'COOK';

  useEffect(() => {
    if (!pool) return;
    let live = true;
    loadPool(connection, pool.id, pool.type)
      .then((p) => live && setLoaded(p))
      .catch((e: Error) => live && setLoadErr(describeTxError(e)));
    return () => {
      live = false;
    };
  }, [connection, pool]);

  useEffect(() => {
    if (!publicKey) {
      setTokenBal(null);
      return;
    }
    const ata = getAssociatedTokenAddressSync(tokenMint, publicKey);
    connection
      .getTokenAccountBalance(ata)
      .then((b) => setTokenBal(b.value.uiAmount ?? 0))
      .catch(() => setTokenBal(0));
  }, [connection, publicKey, tokenMint, tx.phase]);

  const amountIn = useMemo(() => toBase(amount, inDecimals), [amount, inDecimals]);

  useEffect(() => {
    setQuote(null);
    setQuoteErr(null);
    if (!loaded || !amountIn) return;
    const seq = ++quoteSeq.current;
    const t = setTimeout(() => {
      const [dA, dB] = loaded.state.tokenAMint.equals(NATIVE_MINT) ? [COOK_DECIMALS, decimals] : [decimals, COOK_DECIMALS];
      quoteSwap(connection, loaded, inMint, amountIn, slip, dA, dB)
        .then((q) => seq === quoteSeq.current && setQuote(q))
        .catch((e: Error) => seq === quoteSeq.current && setQuoteErr(/liquidity|Insufficient/i.test(e.message) ? 'Not enough liquidity in the pool for that amount.' : describeTxError(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [amountIn, connection, decimals, inMint, loaded, slip]);

  const inBal = dir === 'buy' ? cook : tokenBal;
  const insufficient = inBal != null && amountIn != null && fromBase(amountIn, inDecimals) > inBal - (dir === 'buy' ? 0.01 : 0);

  async function submit() {
    if (!publicKey || !loaded || !amountIn || !quote) return;
    setTx({ phase: 'building' });
    try {
      const { tx: vtx, lastValidBlockHeight } = await buildSwapTx(connection, loaded, publicKey, inMint, outMint, amountIn, quote.minOut);
      await sendAndConfirm(connection, vtx, (t) => sendTransaction(t, connection, { skipPreflight: false }), lastValidBlockHeight, setTx);
      setAmount('');
      refresh();
    } catch (e) {
      setTx((s) => (s.phase === 'error' ? s : { phase: 'error', error: describeTxError(e) }));
    }
  }

  if (!pool) {
    return (
      <section className="card">
        <div className="card-hd"><div><h2>Swap</h2></div></div>
        <div className="empty">
          <p>No swap route.</p>
          <p className="mute">Crumb routes through Cookiebox DAMM pools paired with COOK. {symbol} has none with liquidity.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-hd">
        <div>
          <h2>Swap</h2>
          <p className="mute">Cookiebox DAMM · ${pool.liquidityUsd.toFixed(0)} pool</p>
        </div>
        <div className="seg" role="tablist" aria-label="Direction">
          <button role="tab" aria-selected={dir === 'buy'} onClick={() => { setDir('buy'); setAmount(''); }}>Buy</button>
          <button role="tab" aria-selected={dir === 'sell'} onClick={() => { setDir('sell'); setAmount(''); }}>Sell</button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="swap-in">
          You pay <span className="mute">{inSym}</span>
          {inBal != null && (
            <button type="button" className="link" onClick={() => setAmount(String(Math.max(0, dir === 'buy' ? inBal - 0.01 : inBal)))}>
              max {fmtAmount(inBal)}
            </button>
          )}
        </label>
        <input
          id="swap-in"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={amount}
          disabled={busy}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          aria-invalid={insufficient || undefined}
        />
      </div>

      <div className="field">
        <span className="lbl">
          You receive <span className="mute">{outSym}</span>
        </span>
        <div className="out">{quote ? fmtAmount(fromBase(quote.out, outDecimals), 6) : <span className="mute">—</span>}</div>
      </div>

      <div className="row-kv">
        <span className="mute">Slippage</span>
        <div className="seg sm">
          {SLIPPAGES.map((s) => (
            <button key={s} aria-pressed={slip === s} onClick={() => setSlip(s)}>{s / 100}%</button>
          ))}
        </div>
      </div>
      {quote && (
        <>
          <div className="row-kv"><span className="mute">Minimum received</span><span>{fmtAmount(fromBase(quote.minOut, outDecimals), 6)} {outSym}</span></div>
          <div className="row-kv"><span className="mute">Pool fee</span><span>{fmtAmount(fromBase(quote.fee, inDecimals), 6)} {inSym}</span></div>
          <div className="row-kv">
            <span className="mute">Price impact</span>
            <span className={quote.priceImpact > 5 ? 'down' : quote.priceImpact > 1 ? '' : 'up'}>{quote.priceImpact.toFixed(2)}%</span>
          </div>
        </>
      )}
      {(loadErr || quoteErr) && <p className="form-err" role="alert">{loadErr ?? quoteErr}</p>}
      {insufficient && <p className="form-err" role="alert">Not enough {inSym}. Swaps need the amount plus a little COOK for fees.</p>}
      {quote && quote.priceImpact > 10 && <p className="form-warn">Price impact above 10%. This pool is tiny; consider a smaller amount.</p>}

      {!connected ? (
        <button className="btn btn-primary wide" onClick={() => setOpen(true)}>Connect wallet to swap</button>
      ) : (
        <button className="btn btn-primary wide" disabled={!quote || busy || insufficient || !!loadErr} onClick={submit}>
          {busy ? 'Working…' : dir === 'buy' ? `Buy ${symbol}` : `Sell ${symbol}`}
        </button>
      )}
      <TxStatus state={tx} onReset={() => setTx({ phase: 'idle' })} />
    </section>
  );
}
