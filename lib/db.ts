import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
}

// Anon key + RLS public-read. Server components only; no auth, no sessions.
export const db = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type TokenRow = {
  mint: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  image_url: string | null;
  category: string | null;
  curated: boolean;
  liquidity_tier: string | null;
  first_seen_at: string;
  price_usd: number | null;
  price_in_cook: number | null;
  liquidity_usd: number | null;
  market_cap: number | null;
  volume_24h: number | null;
  price_change_24h: number | null;
  holder_count: number | null;
  supply: number | null;
  pool_count: number | null;
  updated_at: string;
};

export type ChainStats = {
  bucket: string;
  cook_usd: number | null;
  active_tokens: number | null;
  market_count: number | null;
  tracked_tokens: number | null;
  total_liquidity_usd: number | null;
};

type StateRow = Omit<TokenRow, 'symbol' | 'name' | 'decimals' | 'image_url' | 'category' | 'curated' | 'liquidity_tier' | 'first_seen_at'>;
type MetaRow = Pick<TokenRow, 'symbol' | 'name' | 'decimals' | 'image_url' | 'category' | 'curated' | 'liquidity_tier' | 'first_seen_at'>;

export async function getScreener(): Promise<TokenRow[]> {
  const { data, error } = await db
    .from('token_state')
    .select(
      'mint,price_usd,price_in_cook,liquidity_usd,market_cap,volume_24h,price_change_24h,holder_count,supply,pool_count,updated_at,' +
        'tokens!inner(symbol,name,decimals,image_url,category,curated,liquidity_tier,first_seen_at)',
    )
    .order('liquidity_usd', { ascending: false, nullsFirst: false })
    .returns<(StateRow & { tokens: MetaRow })[]>();
  if (error) throw new Error(`token_state: ${error.message}`);

  return (data ?? []).map(({ tokens, ...state }) => ({ ...state, ...tokens }));
}

export async function getChainStats(): Promise<{ latest: ChainStats | null; first: ChainStats | null }> {
  const [latest, first] = await Promise.all([
    db.from('chain_stats_5m').select('*').order('bucket', { ascending: false }).limit(1).maybeSingle(),
    db.from('chain_stats_5m').select('*').order('bucket', { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (latest.error) throw new Error(`chain_stats_5m: ${latest.error.message}`);
  return { latest: latest.data, first: first.data };
}

export type MarketRow = {
  market_id: string;
  type: string | null;
  base_mint: string | null;
  base_symbol: string | null;
  base_amount: number | null;
  base_price_usd: number | null;
  quote_mint: string | null;
  quote_symbol: string | null;
  quote_amount: number | null;
  liquidity_usd: number | null;
  first_seen_at: string;
  updated_at: string;
};

export type Candle = {
  bucket: string;
  o: number;
  h: number;
  l: number;
  c: number;
  liquidity_usd: number | null;
  samples: number;
};

export async function getToken(mint: string): Promise<TokenRow | null> {
  const { data, error } = await db
    .from('token_state')
    .select(
      'mint,price_usd,price_in_cook,liquidity_usd,market_cap,volume_24h,price_change_24h,holder_count,supply,pool_count,updated_at,' +
        'tokens!inner(symbol,name,decimals,image_url,category,curated,liquidity_tier,first_seen_at)',
    )
    .eq('mint', mint)
    .maybeSingle<StateRow & { tokens: MetaRow }>();
  if (error) throw new Error(`token_state: ${error.message}`);
  if (!data) return null;
  const { tokens, ...state } = data;
  return { ...state, ...tokens };
}

export async function getPools(mint: string): Promise<MarketRow[]> {
  const { data, error } = await db
    .from('markets')
    .select('*')
    .or(`base_mint.eq.${mint},quote_mint.eq.${mint}`)
    .order('liquidity_usd', { ascending: false, nullsFirst: false })
    .returns<MarketRow[]>();
  if (error) throw new Error(`markets: ${error.message}`);
  return data ?? [];
}

export async function getCandles(mint: string, tf: '5m' | '1h'): Promise<Candle[]> {
  const { data, error } = await db
    .from(tf === '5m' ? 'candles_5m' : 'candles_1h')
    .select('bucket,o,h,l,c,liquidity_usd,samples')
    .eq('mint', mint)
    .order('bucket', { ascending: true })
    .limit(5000)
    .returns<Candle[]>();
  if (error) throw new Error(`candles_${tf}: ${error.message}`);
  return data ?? [];
}

export async function getStates(mints: string[]): Promise<Map<string, TokenRow>> {
  if (mints.length === 0) return new Map();
  const { data, error } = await db
    .from('token_state')
    .select(
      'mint,price_usd,price_in_cook,liquidity_usd,market_cap,volume_24h,price_change_24h,holder_count,supply,pool_count,updated_at,' +
        'tokens!inner(symbol,name,decimals,image_url,category,curated,liquidity_tier,first_seen_at)',
    )
    .in('mint', mints)
    .returns<(StateRow & { tokens: MetaRow })[]>();
  if (error) throw new Error(`token_state: ${error.message}`);
  return new Map((data ?? []).map(({ tokens, ...state }) => [state.mint, { ...state, ...tokens }]));
}
