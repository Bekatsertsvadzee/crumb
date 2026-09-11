import { NextResponse } from 'next/server';
import { WCOOK_MINT } from '@/lib/chain';
import { getAssetsByOwner } from '@/lib/cookiescan';
import { getChainStats, getStates } from '@/lib/db';

export const dynamic = 'force-dynamic';

const isPk = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get('owner') ?? '';
  if (!isPk(owner)) return NextResponse.json({ error: 'Invalid owner address.' }, { status: 400 });
  try {
    const [assets, { latest }] = await Promise.all([getAssetsByOwner(owner), getChainStats()]);
    const fungible = assets.filter((a) => a.interface === 'FungibleToken' || a.interface === 'FungibleAsset');
    const states = await getStates(fungible.map((a) => a.id));
    const holdings = fungible
      .map((a) => {
        const dec = a.token_info?.decimals ?? 0;
        const amount = (a.token_info?.balance ?? 0) / 10 ** dec;
        const st = states.get(a.id);
        const priceUsd = st?.price_usd ?? (a.id === WCOOK_MINT ? latest?.cook_usd ?? null : null);
        return {
          mint: a.id,
          symbol: st?.symbol ?? a.token_info?.symbol ?? a.content?.metadata?.symbol ?? a.id.slice(0, 4),
          name: st?.name ?? a.content?.metadata?.name ?? null,
          image: st?.image_url ?? a.content?.links?.image ?? null,
          amount,
          priceUsd,
          valueUsd: priceUsd != null ? amount * priceUsd : null,
          tracked: !!st,
        };
      })
      .filter((h) => h.amount > 0)
      .sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1));
    return NextResponse.json({ holdings, cookUsd: latest?.cook_usd ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lookup failed.' }, { status: 502 });
  }
}
