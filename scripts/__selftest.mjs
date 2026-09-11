/**
 * Offline self-test for collect.mjs.
 * Stubs fetch with fixtures captured from the live Cookiescan API,
 * asserts the aggregation maths and the payload shape, and prints
 * the exact body that would be POSTed to Supabase.
 *
 *   node scripts/__selftest.mjs
 */

process.env.SUPABASE_URL = 'https://fixture.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-key';
process.env.MIN_LIQUIDITY_USD = '10';

// ---- fixtures (real shapes, captured 2026-09-11) ----
const STATUS = {
  status: 'running',
  cookUsd: 0.00009197665976710182,
  cookMint: '36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1',
  activeTokens: 6481,
  totalTokens: 6481,
};

const WCOOK = 'So11111111111111111111111111111111111111112';
const BCOOK = 'EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz';
const MON = '6H7xnYfBFeEU8S8mhrZRkFNS5vEegRqEwv7h42WbntCL';
const DUST = 'DuStMintXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

const MARKETS = {
  success: true,
  cookUsd: STATUS.cookUsd,
  marketCount: 4,
  markets: [
    { marketId: 'Dmzx', type: 'COOKIESWAP CPAMM',
      baseToken:  { mint: BCOOK, symbol: 'bCOOK', amount: 5922084.5, priceUsd: 0.00012000466 },
      quoteToken: { mint: WCOOK, symbol: 'wCOOK', amount: 7726718.4, priceUsd: 0.00009197665 },
      liquidityUsd: 1421.35 },
    // same token, second pool, different price → tests liquidity weighting
    { marketId: 'GHfz', type: 'COOKIEBOX DAMM',
      baseToken:  { mint: BCOOK, symbol: 'bCOOK', amount: 5930760.7, priceUsd: 0.00011970955 },
      quoteToken: { mint: WCOOK, symbol: 'wCOOK', amount: 7719009.9, priceUsd: 0.00009197665 },
      liquidityUsd: 500.00 },
    { marketId: 'MONp', type: 'COOKIESWAP CPAMM',
      baseToken:  { mint: MON, symbol: 'MON', amount: 1e9, priceUsd: 9.538618372647756e-8 },
      quoteToken: { mint: WCOOK, symbol: 'wCOOK', amount: 1802345, priceUsd: 0.00009197665 },
      liquidityUsd: 165.83 },
    // below MIN_LIQUIDITY_USD and not curated → must be dropped
    { marketId: 'Dust', type: 'COOKIESWAP CPAMM',
      baseToken:  { mint: DUST, symbol: 'DUST', amount: 1e9, priceUsd: 1e-12 },
      quoteToken: { mint: WCOOK, symbol: 'wCOOK', amount: 10, priceUsd: 0.00009197665 },
      liquidityUsd: 0.9 },
  ],
};

const TRENDING = {
  count: 1,
  trending: [{
    assetId: 'cookie-monster', name: 'Cookie Monster', symbol: 'MON',
    category: 'meme', curated: true, imageUrl: 'https://example/mon.png',
    liquidityTier: 'tier2',
    primaryVariant: { mint: MON, symbol: 'MON', name: 'Cookie Monster', market: { decimals: 9 } },
    stats: { holder: 19, liquidity: 165.83, marketCap: 95.38,
             price: 9.538618372647756e-8, priceChange24hPercent: 2.8487,
             priceInCook: 0.0010370694, supply: 1e9, volume24hUSD: 4.5989 },
  }],
};

const SPA_SHELL = '<!DOCTYPE html><html><head><title>Cookiescan DAS API</title></head></html>';

let posted = null;

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const ok = (obj) => ({ ok: true, status: 200, text: async () => JSON.stringify(obj) });

  if (u.includes('/rest/v1/rpc/crumb_ingest')) {
    posted = JSON.parse(init.body);
    return { ok: true, status: 200,
             text: async () => JSON.stringify({ ok: true, tokens: posted.payload.tokens.length }) };
  }
  if (u.endsWith('/api/status')) return ok(STATUS);
  if (u.endsWith('/api/markets')) return ok(MARKETS);
  if (u.includes('/v1/assets/trending')) return ok(TRENDING);
  // every other enrichment route serves the SPA shell — exercises the HTML guard
  if (u.includes('/v1/assets')) return { ok: true, status: 200, text: async () => SPA_SHELL };
  throw new Error('unexpected fetch: ' + u);
};

await import('./collect.mjs');

// ---- assertions ----
let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
  if (!cond) failed++;
};

console.log('\n--- assertions ---');
const p = posted?.payload;
check('posted a payload', !!p);

const byMint = Object.fromEntries((p?.tokens ?? []).map((t) => [t.mint, t]));

check('dust token dropped', !byMint[DUST]);
check('tracked 3 tokens', p.tokens.length === 3, `got ${p.tokens.length}`);
check('all 4 markets recorded', p.markets.length === 4, `got ${p.markets.length}`);

// bCOOK: liquidity-weighted across two pools
// (0.00012000466*1421.35 + 0.00011970955*500) / 1921.35
const expected = (0.00012000466 * 1421.35 + 0.00011970955 * 500) / (1421.35 + 500);
const got = byMint[BCOOK]?.price_usd;
check('bCOOK price is liquidity-weighted', Math.abs(got - expected) < 1e-12,
      `got ${got}, expected ${expected}`);
check('bCOOK liquidity summed', Math.abs(byMint[BCOOK].liquidity_usd - 1921.35) < 1e-9,
      `${byMint[BCOOK].liquidity_usd}`);
check('bCOOK pool_count = 2', byMint[BCOOK].pool_count === 2);

check('MON enriched with holders', byMint[MON]?.holder_count === 19);
check('MON marked curated', byMint[MON]?.curated === true);
check('MON tier from registry', byMint[MON]?.liquidity_tier === 'tier2');
check('MON has image', !!byMint[MON]?.image_url);

check('wCOOK tracked (quote side)', !!byMint[WCOOK]);
check('wCOOK aggregates all pools', byMint[WCOOK].pool_count === 4, `${byMint[WCOOK].pool_count}`);

check('tier derived when registry silent',
      byMint[BCOOK].liquidity_tier === 'tier1', byMint[BCOOK].liquidity_tier);
check('price_in_cook derived', byMint[BCOOK].price_in_cook > 1,
      String(byMint[BCOOK].price_in_cook));
check('chain stats carried', p.cook_usd === STATUS.cookUsd && p.active_tokens === 6481);

const m0 = p.markets.find((m) => m.market_id === 'Dmzx');
check('market row shape', m0.base_symbol === 'bCOOK' && m0.quote_symbol === 'wCOOK'
      && m0.base_amount > 0 && m0.liquidity_usd === 1421.35);

console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILURE(S)'}\n`);
process.exit(failed === 0 ? 0 : 1);
