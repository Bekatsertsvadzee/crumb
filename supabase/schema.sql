-- ============================================================
--  CRUMB — Cookie Chain analytics
--  Supabase schema + ingest RPC
--  Run once in Supabase SQL editor.
-- ============================================================

-- ---------- tables ----------

create table if not exists tokens (
  mint            text primary key,
  symbol          text,
  name            text,
  decimals        int,
  image_url       text,
  asset_id        text,
  category        text,
  curated         boolean     default false,
  liquidity_tier  text,
  first_seen_at   timestamptz default now(),
  last_seen_at    timestamptz default now()
);

-- current state, upserted every run. powers the screener with one query.
create table if not exists token_state (
  mint              text primary key references tokens(mint) on delete cascade,
  price_usd         double precision,
  price_in_cook     double precision,
  liquidity_usd     double precision,
  market_cap        double precision,
  volume_24h        double precision,
  price_change_24h  double precision,
  holder_count      int,
  supply            double precision,
  pool_count        int,
  updated_at        timestamptz default now()
);

create table if not exists candles_5m (
  mint           text        not null,
  bucket         timestamptz not null,
  o              double precision,
  h              double precision,
  l              double precision,
  c              double precision,
  liquidity_usd  double precision,
  volume_24h     double precision,
  samples        int default 1,
  primary key (mint, bucket)
);

create table if not exists candles_1h (
  mint           text        not null,
  bucket         timestamptz not null,
  o              double precision,
  h              double precision,
  l              double precision,
  c              double precision,
  liquidity_usd  double precision,
  volume_24h     double precision,
  samples        int default 1,
  primary key (mint, bucket)
);

create table if not exists markets (
  market_id      text primary key,
  type           text,
  base_mint      text,
  base_symbol    text,
  base_amount    double precision,
  base_price_usd double precision,
  quote_mint     text,
  quote_symbol   text,
  quote_amount   double precision,
  liquidity_usd  double precision,
  first_seen_at  timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists market_liquidity_1h (
  market_id      text        not null,
  bucket         timestamptz not null,
  liquidity_usd  double precision,
  base_amount    double precision,
  quote_amount   double precision,
  primary key (market_id, bucket)
);

create table if not exists chain_stats_5m (
  bucket               timestamptz primary key,
  cook_usd             double precision,
  active_tokens        int,
  market_count         int,
  tracked_tokens       int,
  total_liquidity_usd  double precision
);

create index if not exists candles_5m_bucket_idx   on candles_5m (bucket desc);
create index if not exists candles_1h_bucket_idx   on candles_1h (bucket desc);
create index if not exists token_state_liq_idx     on token_state (liquidity_usd desc nulls last);
create index if not exists markets_base_mint_idx   on markets (base_mint);

-- ---------- ingest RPC ----------
-- One atomic call per collector run.
-- payload: {
--   cook_usd, active_tokens, market_count,
--   tokens:  [{mint,symbol,name,decimals,image_url,asset_id,category,curated,
--              liquidity_tier,price_usd,price_in_cook,liquidity_usd,market_cap,
--              volume_24h,price_change_24h,holder_count,supply,pool_count}],
--   markets: [{market_id,type,base_mint,base_symbol,base_amount,base_price_usd,
--              quote_mint,quote_symbol,quote_amount,liquidity_usd}]
-- }

create or replace function crumb_ingest(payload jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  now_ts   timestamptz := now();
  b5       timestamptz := date_trunc('hour', now_ts)
                          + floor(extract(minute from now_ts) / 5) * interval '5 minutes';
  b1h      timestamptz := date_trunc('hour', now_ts);
  n_tok    int := 0;
  n_mkt    int := 0;
  total_liq double precision := 0;
begin
  -- tokens + state
  with t as (
    select * from jsonb_to_recordset(coalesce(payload->'tokens','[]'::jsonb)) as x(
      mint text, symbol text, name text, decimals int, image_url text,
      asset_id text, category text, curated boolean, liquidity_tier text,
      price_usd double precision, price_in_cook double precision,
      liquidity_usd double precision, market_cap double precision,
      volume_24h double precision, price_change_24h double precision,
      holder_count int, supply double precision, pool_count int
    )
  ),
  ins_tokens as (
    insert into tokens (mint,symbol,name,decimals,image_url,asset_id,category,curated,liquidity_tier,last_seen_at)
    select mint,symbol,name,decimals,image_url,asset_id,coalesce(category,'unknown'),
           coalesce(curated,false),liquidity_tier, now_ts
    from t
    on conflict (mint) do update set
      symbol         = coalesce(excluded.symbol, tokens.symbol),
      name           = coalesce(excluded.name, tokens.name),
      decimals       = coalesce(excluded.decimals, tokens.decimals),
      image_url      = coalesce(excluded.image_url, tokens.image_url),
      asset_id       = coalesce(excluded.asset_id, tokens.asset_id),
      category       = coalesce(excluded.category, tokens.category),
      curated        = excluded.curated or tokens.curated,
      liquidity_tier = coalesce(excluded.liquidity_tier, tokens.liquidity_tier),
      last_seen_at   = now_ts
    returning 1
  ),
  ins_state as (
    insert into token_state (mint,price_usd,price_in_cook,liquidity_usd,market_cap,
                             volume_24h,price_change_24h,holder_count,supply,pool_count,updated_at)
    select mint,price_usd,price_in_cook,liquidity_usd,market_cap,
           volume_24h,price_change_24h,holder_count,supply,pool_count, now_ts
    from t
    on conflict (mint) do update set
      price_usd        = excluded.price_usd,
      price_in_cook    = excluded.price_in_cook,
      liquidity_usd    = excluded.liquidity_usd,
      market_cap       = coalesce(excluded.market_cap, token_state.market_cap),
      volume_24h       = coalesce(excluded.volume_24h, token_state.volume_24h),
      price_change_24h = coalesce(excluded.price_change_24h, token_state.price_change_24h),
      holder_count     = coalesce(excluded.holder_count, token_state.holder_count),
      supply           = coalesce(excluded.supply, token_state.supply),
      pool_count       = excluded.pool_count,
      updated_at       = now_ts
    returning 1
  ),
  ins_c5 as (
    insert into candles_5m (mint,bucket,o,h,l,c,liquidity_usd,volume_24h,samples)
    select mint, b5, price_usd, price_usd, price_usd, price_usd, liquidity_usd, volume_24h, 1
    from t where price_usd is not null and price_usd > 0
    on conflict (mint,bucket) do update set
      h = greatest(candles_5m.h, excluded.c),
      l = least(candles_5m.l, excluded.c),
      c = excluded.c,
      liquidity_usd = excluded.liquidity_usd,
      volume_24h    = coalesce(excluded.volume_24h, candles_5m.volume_24h),
      samples       = candles_5m.samples + 1
    returning 1
  ),
  ins_c1h as (
    insert into candles_1h (mint,bucket,o,h,l,c,liquidity_usd,volume_24h,samples)
    select mint, b1h, price_usd, price_usd, price_usd, price_usd, liquidity_usd, volume_24h, 1
    from t where price_usd is not null and price_usd > 0
    on conflict (mint,bucket) do update set
      h = greatest(candles_1h.h, excluded.c),
      l = least(candles_1h.l, excluded.c),
      c = excluded.c,
      liquidity_usd = excluded.liquidity_usd,
      volume_24h    = coalesce(excluded.volume_24h, candles_1h.volume_24h),
      samples       = candles_1h.samples + 1
    returning 1
  )
  select count(*), coalesce(sum(liquidity_usd),0) into n_tok, total_liq from t;

  -- markets
  with m as (
    select * from jsonb_to_recordset(coalesce(payload->'markets','[]'::jsonb)) as x(
      market_id text, type text,
      base_mint text, base_symbol text, base_amount double precision, base_price_usd double precision,
      quote_mint text, quote_symbol text, quote_amount double precision,
      liquidity_usd double precision
    )
  ),
  ins_m as (
    insert into markets (market_id,type,base_mint,base_symbol,base_amount,base_price_usd,
                         quote_mint,quote_symbol,quote_amount,liquidity_usd,updated_at)
    select market_id,type,base_mint,base_symbol,base_amount,base_price_usd,
           quote_mint,quote_symbol,quote_amount,liquidity_usd, now_ts
    from m
    on conflict (market_id) do update set
      type = excluded.type,
      base_amount = excluded.base_amount, base_price_usd = excluded.base_price_usd,
      quote_amount = excluded.quote_amount, liquidity_usd = excluded.liquidity_usd,
      updated_at = now_ts
    returning 1
  ),
  ins_mh as (
    insert into market_liquidity_1h (market_id,bucket,liquidity_usd,base_amount,quote_amount)
    select market_id, b1h, liquidity_usd, base_amount, quote_amount from m
    on conflict (market_id,bucket) do update set
      liquidity_usd = excluded.liquidity_usd,
      base_amount   = excluded.base_amount,
      quote_amount  = excluded.quote_amount
    returning 1
  )
  select count(*) into n_mkt from m;

  insert into chain_stats_5m (bucket,cook_usd,active_tokens,market_count,tracked_tokens,total_liquidity_usd)
  values (b5,
          (payload->>'cook_usd')::double precision,
          (payload->>'active_tokens')::int,
          (payload->>'market_count')::int,
          n_tok, total_liq)
  on conflict (bucket) do update set
    cook_usd            = excluded.cook_usd,
    active_tokens       = excluded.active_tokens,
    market_count        = excluded.market_count,
    tracked_tokens      = excluded.tracked_tokens,
    total_liquidity_usd = excluded.total_liquidity_usd;

  return jsonb_build_object(
    'ok', true, 'bucket_5m', b5, 'bucket_1h', b1h,
    'tokens', n_tok, 'markets', n_mkt, 'total_liquidity_usd', total_liq
  );
end;
$$;

-- ---------- retention ----------
create or replace function crumb_prune()
returns void language sql as $$
  delete from candles_5m          where bucket < now() - interval '14 days';
  delete from market_liquidity_1h where bucket < now() - interval '60 days';
  delete from chain_stats_5m      where bucket < now() - interval '30 days';
$$;

-- ---------- RLS: public read, writes only via service role ----------
alter table tokens              enable row level security;
alter table token_state         enable row level security;
alter table candles_5m          enable row level security;
alter table candles_1h          enable row level security;
alter table markets             enable row level security;
alter table market_liquidity_1h enable row level security;
alter table chain_stats_5m      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tokens','token_state','candles_5m','candles_1h',
                           'markets','market_liquidity_1h','chain_stats_5m']
  loop
    execute format('drop policy if exists %I on %I', t || '_public_read', t);
    execute format('create policy %I on %I for select using (true)', t || '_public_read', t);
  end loop;
end $$;
