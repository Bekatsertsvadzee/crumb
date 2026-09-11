import Screener from '@/components/Screener';
import { getChainStats, getScreener } from '@/lib/db';
import { fmtDate, fmtInt, fmtPrice, fmtUsd, timeAgo } from '@/lib/format';

export const revalidate = 60;

export default async function Home() {
  const [tokens, { latest, first }] = await Promise.all([getScreener(), getChainStats()]);

  const tradeable = tokens.filter((t) => t.price_usd != null && t.price_usd > 0).length;

  return (
    <>
      <div className="banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 17l5-6 4 4 5-8 4 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          <strong>Cookie Chain publishes no price history.</strong> Crumb records its own, every
          5 minutes since {first ? fmtDate(first.bucket) : '—'}.
        </span>
        <span className="mute" style={{ marginLeft: 'auto' }}>
          last tick {latest ? timeAgo(latest.bucket) : '—'}
        </span>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="tile-k">COOK price</div>
          <div className="tile-v">{fmtPrice(latest?.cook_usd)}</div>
        </div>
        <div className="tile">
          <div className="tile-k">Total liquidity</div>
          <div className="tile-v">{fmtUsd(latest?.total_liquidity_usd)}</div>
          <div className="tile-s">across {fmtInt(latest?.market_count)} pools</div>
        </div>
        <div className="tile">
          <div className="tile-k">Tradeable tokens</div>
          <div className="tile-v">{fmtInt(tradeable)}</div>
          <div className="tile-s">of {fmtInt(latest?.active_tokens)} on chain</div>
        </div>
        <div className="tile">
          <div className="tile-k">Tracked by Crumb</div>
          <div className="tile-v">{fmtInt(latest?.tracked_tokens)}</div>
          <div className="tile-s">with a pool</div>
        </div>
      </div>

      <Screener tokens={tokens} />
    </>
  );
}
