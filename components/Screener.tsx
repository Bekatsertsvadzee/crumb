'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import TokenIcon from '@/components/TokenIcon';
import type { TokenRow } from '@/lib/db';
import { fmtInt, fmtPct, fmtPrice, fmtUsd, shortAddr } from '@/lib/format';

type SortKey = 'liquidity_usd' | 'price_usd' | 'price_change_24h' | 'volume_24h' | 'market_cap' | 'holder_count' | 'pool_count';
type Filter = 'all' | 'tier1' | 'tier2' | 'curated' | 'priced';

const COLS: { key: SortKey; label: string }[] = [
  { key: 'price_usd', label: 'Price' },
  { key: 'price_change_24h', label: '24h' },
  { key: 'liquidity_usd', label: 'Liquidity' },
  { key: 'volume_24h', label: 'Vol 24h' },
  { key: 'market_cap', label: 'Mkt cap' },
  { key: 'holder_count', label: 'Holders' },
  { key: 'pool_count', label: 'Pools' },
];

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'priced', label: 'Priced' },
  { key: 'tier1', label: 'Tier 1 ≥ $250' },
  { key: 'tier2', label: 'Tier 2 ≥ $50' },
  { key: 'curated', label: 'Curated' },
];

function SortIcon({ dir }: { dir: 'asc' | 'desc' | null }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" style={{ opacity: dir ? 1 : 0.35 }}>
      {dir === 'asc' ? (
        <path d="M5 2l4 5H1z" fill="currentColor" />
      ) : (
        <path d="M5 8L1 3h8z" fill="currentColor" />
      )}
    </svg>
  );
}

function Tier({ t }: { t: string | null }) {
  if (t === 'tier1') return <span className="tier tier-1">T1</span>;
  if (t === 'tier2') return <span className="tier tier-2">T2</span>;
  return <span className="tier">—</span>;
}

export default function Screener({ tokens }: { tokens: TokenRow[] }) {
  const [sort, setSort] = useState<SortKey>('liquidity_usd');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = tokens;
    if (filter === 'tier1') r = r.filter((t) => t.liquidity_tier === 'tier1');
    else if (filter === 'tier2') r = r.filter((t) => t.liquidity_tier === 'tier2');
    else if (filter === 'curated') r = r.filter((t) => t.curated);
    else if (filter === 'priced') r = r.filter((t) => t.price_usd != null && t.price_usd > 0);
    if (needle) {
      r = r.filter(
        (t) =>
          t.symbol?.toLowerCase().includes(needle) ||
          t.name?.toLowerCase().includes(needle) ||
          t.mint.toLowerCase().startsWith(needle),
      );
    }
    const m = dir === 'desc' ? -1 : 1;
    return [...r].sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls always last
      if (bv == null) return -1;
      return (av - bv) * m;
    });
  }, [tokens, sort, dir, filter, q]);

  function onSort(k: SortKey) {
    if (k === sort) setDir(dir === 'desc' ? 'asc' : 'desc');
    else {
      setSort(k);
      setDir('desc');
    }
  }

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search symbol, name, or mint"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search tokens"
        />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className="chip"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <span className="toolbar-count">
          {rows.length} of {tokens.length}
        </span>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th className="rank">#</th>
              <th>Token</th>
              {COLS.map((c) => (
                <th key={c.key} aria-sort={sort === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button onClick={() => onSort(c.key)}>
                    {c.label}
                    <SortIcon dir={sort === c.key ? dir : null} />
                  </button>
                </th>
              ))}
              <th>Tier</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 3} className="empty">
                  No tokens match.
                </td>
              </tr>
            ) : (
              rows.map((t, i) => {
                const chg = t.price_change_24h;
                const chgCls = chg == null ? 'mute' : chg > 0 ? 'up' : chg < 0 ? 'down' : 'mute';
                const sym = t.symbol ?? shortAddr(t.mint);
                return (
                  <tr key={t.mint}>
                    <td className="rank">{i + 1}</td>
                    <td className="tok">
                      <Link href={`/token/${t.mint}`} className="tok-cell">
                        <TokenIcon src={t.image_url} symbol={sym} />
                        <span>
                          <span className="tok-sym">{sym}</span>
                          {t.name && t.name !== t.symbol && <span className="tok-name">{t.name}</span>}
                        </span>
                      </Link>
                    </td>
                    <td className={t.price_usd ? '' : 'mute'}>{fmtPrice(t.price_usd)}</td>
                    <td className={chgCls}>{fmtPct(chg)}</td>
                    <td>{fmtUsd(t.liquidity_usd)}</td>
                    <td className={t.volume_24h ? '' : 'mute'}>{fmtUsd(t.volume_24h)}</td>
                    <td className={t.market_cap ? '' : 'mute'}>{fmtUsd(t.market_cap)}</td>
                    <td className={t.holder_count ? '' : 'mute'}>{fmtInt(t.holder_count)}</td>
                    <td>{fmtInt(t.pool_count)}</td>
                    <td>
                      <Tier t={t.liquidity_tier} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
