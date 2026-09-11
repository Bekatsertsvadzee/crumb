import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CopyButton from '@/components/CopyButton';
import PriceChart from '@/components/PriceChart';
import TokenIcon from '@/components/TokenIcon';
import HoldersPanel from '@/components/HoldersPanel';
import RiskPanel from '@/components/RiskPanel';
import PoolsTable from '@/components/PoolsTable';
import SwapPanel from '@/components/SwapPanel';
import { holderStats, riskFlags } from '@/lib/analytics';
import { addrUrl, SWAPPABLE_TYPES, WCOOK_MINT } from '@/lib/chain';
import { getHolders, searchRegistry } from '@/lib/cookiescan';
import { getCandles, getPools, getToken } from '@/lib/db';
import { fmtInt, fmtPct, fmtPrice, fmtSupply, fmtUsd, shortAddr, timeAgo } from '@/lib/format';

export const revalidate = 60;

const isMint = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

export async function generateMetadata({ params }: { params: Promise<{ mint: string }> }): Promise<Metadata> {
  const { mint } = await params;
  if (!isMint(mint)) return { title: 'Token not found — Crumb' };
  const t = await getToken(mint).catch(() => null);
  if (!t) return { title: 'Token not found — Crumb' };
  const sym = t.symbol ?? shortAddr(mint);
  return {
    title: `${sym} ${fmtPrice(t.price_usd)} — Crumb`,
    description: `${sym} on Cookie Chain: price history, pools, holder distribution and risk flags. Liquidity ${fmtUsd(t.liquidity_usd)}.`,
  };
}

export default async function TokenPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  if (!isMint(mint)) notFound();

  const token = await getToken(mint);
  if (!token) notFound();

  const decimals = token.decimals ?? 9;
  const [pools, c5m, c1h, holdersRes, hits] = await Promise.all([
    getPools(mint),
    getCandles(mint, '5m'),
    getCandles(mint, '1h'),
    getHolders(mint).catch((e: Error) => ({ error: e.message })),
    token.symbol ? searchRegistry(token.symbol).catch(() => []) : Promise.resolve([]),
  ]);

  const holders = 'error' in holdersRes ? null : holderStats(holdersRes.accounts, holdersRes.total, decimals, token.supply, pools);
  const risks = riskFlags(token, hits, holders);
  const sym = token.symbol ?? shortAddr(mint);
  const chg = token.price_change_24h;
  const chgCls = chg == null ? 'mute' : chg > 0 ? 'up' : chg < 0 ? 'down' : 'mute';

  const swapPool = pools.find(
    (p) => p.type && SWAPPABLE_TYPES.has(p.type) && (p.base_mint === WCOOK_MINT || p.quote_mint === WCOOK_MINT) && (p.liquidity_usd ?? 0) > 0,
  );

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Screener</Link>
        <span aria-hidden="true">/</span>
        <span>{sym}</span>
      </nav>

      <header className="tok-hd">
        <TokenIcon src={token.image_url} symbol={sym} size={40} />
        <div className="tok-hd-main">
          <h1>
            {sym}
            {token.name && token.name !== token.symbol && <span className="tok-hd-name">{token.name}</span>}
            {token.curated && <span className="tier tier-1">Curated</span>}
          </h1>
          <div className="tok-hd-mint">
            <code>{mint}</code>
            <CopyButton text={mint} label="Copy mint" />
            <a href={addrUrl(mint)} target="_blank" rel="noreferrer" className="ext">
              Cookiescan
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
        <div className="tok-hd-price">
          <div className="tok-hd-px">{fmtPrice(token.price_usd)}</div>
          <div className={`tok-hd-chg ${chgCls}`}>
            {fmtPct(chg)} <span className="mute">24h</span>
          </div>
          <div className="mute" style={{ fontSize: 12 }}>updated {timeAgo(token.updated_at)}</div>
        </div>
      </header>

      <div className="tiles">
        <div className="tile"><div className="tile-k">Liquidity</div><div className="tile-v">{fmtUsd(token.liquidity_usd)}</div></div>
        <div className="tile"><div className="tile-k">Market cap</div><div className="tile-v">{fmtUsd(token.market_cap)}</div></div>
        <div className="tile"><div className="tile-k">Holders</div><div className="tile-v">{fmtInt(holders?.total ?? token.holder_count)}</div></div>
        <div className="tile"><div className="tile-k">Supply</div><div className="tile-v">{fmtSupply(token.supply ?? holders?.denominator)}</div></div>
        <div className="tile"><div className="tile-k">Pools</div><div className="tile-v">{fmtInt(token.pool_count)}</div></div>
      </div>

      <div className="grid-main">
        <div className="col">
          <PriceChart c5m={c5m} c1h={c1h} symbol={sym} />
          <PoolsTable pools={pools} mint={mint} />
          <HoldersPanel stats={holders} error={'error' in holdersRes ? holdersRes.error : null} symbol={sym} />
        </div>
        <aside className="col">
          <SwapPanel
            mint={mint}
            symbol={sym}
            decimals={decimals}
            pool={swapPool ? { id: swapPool.market_id, type: swapPool.type ?? '', liquidityUsd: swapPool.liquidity_usd ?? 0 } : null}
          />
          <RiskPanel risks={risks} />
        </aside>
      </div>
    </>
  );
}
