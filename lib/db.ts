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
