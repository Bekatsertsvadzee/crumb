import { PublicKey } from '@solana/web3.js';
import { COOKIEBOX_DAMM, METEORA_DAMM, TIER1_MIN_USD, TIER2_MIN_USD } from '@/lib/chain';
import type { SearchHit, TokenAccount } from '@/lib/cookiescan';
import type { MarketRow, TokenRow } from '@/lib/db';

export type Holder = { owner: string; amount: number; share: number; isPool: boolean; accounts: number };

export type HolderStats = {
  total: number;
  denominator: number;
  top: Holder[];
  topWalletShare: number; // largest non-pool holder
  top10WalletShare: number;
  poolShare: number;
};

const poolAuthorities = new Set(
  [COOKIEBOX_DAMM, METEORA_DAMM].map(
    (p) => PublicKey.findProgramAddressSync([Buffer.from('pool_authority')], new PublicKey(p))[0].toBase58(),
  ),
);

export function holderStats(
  accounts: TokenAccount[],
  total: number,
  decimals: number,
  supply: number | null,
  pools: MarketRow[],
): HolderStats {
  const poolIds = new Set(pools.map((p) => p.market_id));
  const byOwner = new Map<string, { amount: number; accounts: number }>();
  let sum = 0;
  for (const a of accounts) {
    const amt = Number(a.amount) / 10 ** decimals;
    sum += amt;
    const cur = byOwner.get(a.owner) ?? { amount: 0, accounts: 0 };
    cur.amount += amt;
    cur.accounts += 1;
    byOwner.set(a.owner, cur);
  }
  const denominator = Math.max(sum, supply ?? 0) || 1;
  const all: Holder[] = [...byOwner.entries()]
    .map(([owner, v]) => ({
      owner,
      amount: v.amount,
      share: (v.amount / denominator) * 100,
      isPool: poolIds.has(owner) || poolAuthorities.has(owner),
      accounts: v.accounts,
    }))
    .sort((a, b) => b.amount - a.amount);

  const wallets = all.filter((h) => !h.isPool);
  return {
    total,
    denominator,
    top: all.slice(0, 20),
    topWalletShare: wallets[0]?.share ?? 0,
    top10WalletShare: wallets.slice(0, 10).reduce((s, h) => s + h.share, 0),
    poolShare: all.filter((h) => h.isPool).reduce((s, h) => s + h.share, 0),
  };
}

export type Risk = { level: 'high' | 'warn' | 'ok' | 'info'; title: string; detail: string };

export function riskFlags(token: TokenRow, hits: SearchHit[], holders: HolderStats | null): Risk[] {
  const out: Risk[] = [];
  const sym = token.symbol?.toLowerCase();

  // identity — the registry marks the curated mint for a symbol; anything else wearing it is an impostor
  const sameSymbol = sym ? hits.filter((h) => h.symbol?.toLowerCase() === sym) : [];
  const curatedHit = sameSymbol.find((h) => h.curated);
  const curatedMint = curatedHit?.primaryVariant?.mint;
  if (token.curated || curatedMint === token.mint) {
    out.push({ level: 'ok', title: 'Curated by the Cookiescan registry', detail: 'This mint is the registry’s canonical entry for its symbol.' });
  } else if (curatedMint) {
    out.push({
      level: 'high',
      title: 'Possible impostor mint',
      detail: `The curated ${curatedHit?.symbol} is a different mint (${curatedMint.slice(0, 4)}…${curatedMint.slice(-4)}). This one shares the symbol only.`,
    });
  } else if (sameSymbol.length > 1) {
    out.push({
      level: 'warn',
      title: `${sameSymbol.length - 1} other mint${sameSymbol.length > 2 ? 's' : ''} use this symbol`,
      detail: 'None are curated. Verify the mint address before trading.',
    });
  } else {
    out.push({ level: 'info', title: 'Not curated', detail: 'Not in the Cookiescan registry. No other mint uses this symbol.' });
  }

  // liquidity
  const liq = token.liquidity_usd ?? 0;
  if (!token.pool_count || token.price_usd == null) {
    out.push({ level: 'high', title: 'No market', detail: 'No pool holds this token. It cannot be traded on-chain.' });
  } else if (liq < TIER2_MIN_USD) {
    out.push({ level: 'high', title: 'Thin liquidity', detail: `$${liq.toFixed(0)} across ${token.pool_count} pool${token.pool_count === 1 ? '' : 's'}. Any trade moves the price.` });
  } else if (liq < TIER1_MIN_USD) {
    out.push({ level: 'warn', title: 'Tier 2 liquidity', detail: `$${liq.toFixed(0)} pooled. Below the $${TIER1_MIN_USD} tier-1 line.` });
  } else {
    out.push({ level: 'ok', title: 'Tier 1 liquidity', detail: `$${liq.toFixed(0)} pooled across ${token.pool_count} pool${token.pool_count === 1 ? '' : 's'}.` });
  }

  // concentration
  if (holders) {
    if (holders.topWalletShare > 50) {
      out.push({ level: 'high', title: 'One wallet holds a majority', detail: `${holders.topWalletShare.toFixed(1)}% of supply in a single non-pool wallet.` });
    } else if (holders.topWalletShare > 25) {
      out.push({ level: 'warn', title: 'Concentrated supply', detail: `Largest wallet holds ${holders.topWalletShare.toFixed(1)}%; top 10 wallets hold ${holders.top10WalletShare.toFixed(1)}%.` });
    } else {
      out.push({ level: 'ok', title: 'Distributed supply', detail: `Largest wallet holds ${holders.topWalletShare.toFixed(1)}%; top 10 wallets hold ${holders.top10WalletShare.toFixed(1)}%.` });
    }
    if (holders.total < 10) {
      out.push({ level: 'warn', title: `Only ${holders.total} holder${holders.total === 1 ? '' : 's'}`, detail: 'Almost nobody holds this token yet.' });
    }
  }

  return out;
}
