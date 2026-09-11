import { API } from '@/lib/chain';

type DasResult<T> = { result?: T; error?: { message?: string } };

/** Cookiescan runs a Metaplex DAS endpoint on the API root (JSON-RPC 2.0). */
export async function das<T>(method: string, params: unknown, revalidate = 120): Promise<T> {
  const res = await fetch(API + '/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`DAS ${method}: HTTP ${res.status}`);
  const json = (await res.json()) as DasResult<T>;
  if (json.error) throw new Error(`DAS ${method}: ${json.error.message ?? 'unknown error'}`);
  if (json.result === undefined) throw new Error(`DAS ${method}: empty result`);
  return json.result;
}

export type TokenAccount = { address: string; owner: string; amount: string; frozen: boolean };

/** Full holder list for a mint. Pages until exhausted (capped at 5,000 accounts). */
export async function getHolders(mint: string): Promise<{ total: number; accounts: TokenAccount[] }> {
  const accounts: TokenAccount[] = [];
  let total = 0;
  for (let page = 1; page <= 5; page++) {
    const r = await das<{ total: number; token_accounts: TokenAccount[] }>(
      'getTokenAccounts',
      { mint, limit: 1000, page },
      300,
    );
    total = r.total;
    accounts.push(...r.token_accounts);
    if (r.token_accounts.length < 1000) break;
  }
  return { total, accounts };
}

export type OwnedAsset = {
  id: string;
  interface: string;
  content?: { metadata?: { name?: string; symbol?: string }; links?: { image?: string } };
  token_info?: { balance?: number; decimals?: number; symbol?: string; price_info?: { price_per_token?: number; total_price?: number } };
};

export async function getAssetsByOwner(owner: string): Promise<OwnedAsset[]> {
  const r = await das<{ items: OwnedAsset[] }>(
    'getAssetsByOwner',
    { ownerAddress: owner, page: 1, limit: 1000, displayOptions: { showFungible: true, showZeroBalance: false } },
    0,
  );
  return r.items ?? [];
}

export type SearchHit = {
  assetId: string;
  name: string | null;
  symbol: string | null;
  curated: boolean;
  liquidityTier: string | null;
  primaryVariant?: { mint?: string };
  stats?: { liquidity?: number; holder?: number };
};

/** Registry search. Same symbol on a different mint than the curated entry is an impostor. */
export async function searchRegistry(q: string): Promise<SearchHit[]> {
  const res = await fetch(`${API}/v1/assets/search?q=${encodeURIComponent(q)}`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: SearchHit[] };
  return json.results ?? [];
}
