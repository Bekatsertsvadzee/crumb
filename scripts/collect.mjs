#!/usr/bin/env node
/**
 * CRUMB collector — Cookie Chain price history
 *
 * Cookie Chain has no OHLC/history API. This builds one.
 * Runs every 5 minutes, writes candles + state to Supabase via one atomic RPC.
 *
 * Zero dependencies. Node 20+.
 *
 * Env:
 *   SUPABASE_URL                  https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     service_role key (never ship to the browser)
 *   MIN_LIQUIDITY_USD             optional, default 10
 */

const API = 'https://api.cookiescan.io';
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MIN_LIQUIDITY_USD = Number(process.env.MIN_LIQUIDITY_USD ?? 10);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const TIMEOUT_MS = 20_000;

async function getJSON(path, { required = true } = {}) {
  const url = path.startsWith('http') ? path : API + path;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { accept: 'application/json', 'user-agent': 'crumb-collector/1.0' },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // The API serves its SPA shell for unknown routes — guard against HTML.
    if (text.trimStart().startsWith('<')) throw new Error('got HTML, not JSON');
    return JSON.parse(text);
  } catch (err) {
    if (required) throw new Error(`${url}: ${err.message}`);
    console.warn(`  ! optional fetch failed ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The API is undocumented and shapes vary by route. Find the array wherever it lives. */
function asArray(obj, ...keys) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  for (const k of keys) if (Array.isArray(obj[k])) return obj[k];
  for (const v of Object.values(obj)) if (Array.isArray(v)) return v;
  return [];
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ---------------------------------------------------------------- collect

async function collect() {
  const startedAt = Date.now();

  const status = await getJSON('/api/status');
  const cookUsd = num(status?.cookUsd);
  console.log(`  chain: COOK $${cookUsd} · ${status?.activeTokens} tokens indexed`);

  // Primary source. Verified shape:
  // { success, cookUsd, marketCount, markets: [{ marketId, type,
  //   baseToken:{mint,symbol,amount,priceUsd}, quoteToken:{...}, liquidityUsd }] }
  const marketsRaw = await getJSON('/api/markets');
  const markets = asArray(marketsRaw, 'markets');
  if (!markets.length) throw new Error('/api/markets returned no markets');
  console.log(`  markets: ${markets.length}`);

  // ---- aggregate pools into per-token figures ----
  // A token can trade in several pools at different prices. Liquidity-weighted
  // average is a truer mark than any single pool, and nobody else computes it.
  const agg = new Map(); // mint -> { symbol, liq, wSum, wLiq, pools }

  const touch = (mint, symbol) => {
    if (!agg.has(mint)) agg.set(mint, { mint, symbol, liq: 0, wSum: 0, wLiq: 0, pools: 0 });
    const a = agg.get(mint);
    if (!a.symbol && symbol) a.symbol = symbol;
    return a;
  };

  const marketRows = [];
  for (const m of markets) {
    const base = m.baseToken ?? {};
    const quote = m.quoteToken ?? {};
    const liq = num(m.liquidityUsd) ?? 0;

    for (const side of [base, quote]) {
      if (!side?.mint) continue;
      const a = touch(side.mint, side.symbol);
      a.liq += liq;
      a.pools += 1;
      const p = num(side.priceUsd);
      if (p && p > 0 && liq > 0) {
        a.wSum += p * liq;
        a.wLiq += liq;
      } else if (p && p > 0 && a.wLiq === 0) {
        // pool has no liquidity reading — keep the price as a last resort
        a.wSum += p;
        a.wLiq += 1;
      }
    }

    if (m.marketId) {
      marketRows.push({
        market_id: m.marketId,
        type: m.type ?? null,
        base_mint: base.mint ?? null,
        base_symbol: base.symbol ?? null,
        base_amount: num(base.amount),
        base_price_usd: num(base.priceUsd),
        quote_mint: quote.mint ?? null,
        quote_symbol: quote.symbol ?? null,
        quote_amount: num(quote.amount),
        liquidity_usd: liq,
      });
    }
  }

  // ---- best-effort enrichment: holders, tiers, curation, images, supply ----
  const meta = new Map(); // mint -> partial token row
  const absorb = (entry) => {
    const v = entry?.primaryVariant ?? {};
    const mint = v.mint ?? entry?.mint;
    if (!mint) return;
    const s = entry.stats ?? v.market ?? {};
    const prev = meta.get(mint) ?? {};
    meta.set(mint, {
      ...prev,
      symbol: entry.symbol ?? v.symbol ?? prev.symbol ?? null,
      name: entry.name ?? v.name ?? prev.name ?? null,
      decimals: num(v.market?.decimals) ?? prev.decimals ?? null,
      image_url: entry.imageUrl ?? prev.image_url ?? null,
      asset_id: entry.assetId ?? prev.asset_id ?? null,
      category: entry.category ?? prev.category ?? null,
      curated: entry.curated ?? prev.curated ?? false,
      liquidity_tier: entry.liquidityTier ?? v.liquidityTier ?? prev.liquidity_tier ?? null,
      market_cap: num(s.marketCap) ?? prev.market_cap ?? null,
      volume_24h: num(s.volume24hUSD) ?? num(s.volume24h) ?? prev.volume_24h ?? null,
      price_change_24h: num(s.priceChange24hPercent) ?? prev.price_change_24h ?? null,
      holder_count: num(s.holder) ?? num(s.holderCount) ?? prev.holder_count ?? null,
      supply: num(s.supply) ?? prev.supply ?? null,
      price_in_cook: num(s.priceInCook) ?? prev.price_in_cook ?? null,
    });
  };

  const enrichRoutes = [
    '/v1/assets?limit=250&sort=liquidity',
    '/v1/assets/trending',
    '/v1/assets/curated?list=majors',
    '/v1/assets/curated?list=memes',
    '/v1/assets/curated?list=lsts',
  ];
  for (const route of enrichRoutes) {
    const data = await getJSON(route, { required: false });
    for (const entry of asArray(data, 'assets', 'trending', 'data')) absorb(entry);
  }
  console.log(`  enriched: ${meta.size} tokens`);

  // ---- build the token payload ----
  const tokens = [];
  for (const a of agg.values()) {
    const m = meta.get(a.mint) ?? {};
    const price = a.wLiq > 0 ? a.wSum / a.wLiq : null;
    const liquidity = a.liq;
    if (liquidity < MIN_LIQUIDITY_USD && !m.curated) continue;
    tokens.push({
      mint: a.mint,
      symbol: m.symbol ?? a.symbol ?? null,
      name: m.name ?? null,
      decimals: m.decimals ?? null,
      image_url: m.image_url ?? null,
      asset_id: m.asset_id ?? null,
      category: m.category ?? null,
      curated: !!m.curated,
      liquidity_tier: m.liquidity_tier ?? (liquidity >= 250 ? 'tier1' : liquidity >= 50 ? 'tier2' : null),
      price_usd: price,
      price_in_cook: m.price_in_cook ?? (price && cookUsd ? price / cookUsd : null),
      liquidity_usd: liquidity,
      market_cap: m.market_cap ?? null,
      volume_24h: m.volume_24h ?? null,
      price_change_24h: m.price_change_24h ?? null,
      holder_count: m.holder_count ?? null,
      supply: m.supply ?? null,
      pool_count: a.pools,
    });
  }

  const payload = {
    cook_usd: cookUsd,
    active_tokens: num(status?.activeTokens),
    market_count: num(marketsRaw?.marketCount) ?? markets.length,
    tokens,
    markets: marketRows,
  };

  console.log(`  tracking ${tokens.length} tokens (>= $${MIN_LIQUIDITY_USD} liquidity or curated)`);

  // ---- write ----
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/crumb_ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ payload }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`supabase rpc ${res.status}: ${body.slice(0, 400)}`);

  console.log(`  ingest: ${body}`);
  console.log(`  done in ${Date.now() - startedAt}ms`);
}

// one retry — the API occasionally blips, and a missed bucket is a gap forever
try {
  await collect();
} catch (err) {
  console.warn(`run failed (${err.message}) — retrying once in 5s`);
  await new Promise((r) => setTimeout(r, 5000));
  try {
    await collect();
  } catch (err2) {
    console.error(`FATAL: ${err2.message}`);
    process.exit(1);
  }
}
