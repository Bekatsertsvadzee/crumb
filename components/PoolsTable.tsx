import { addrUrl, AMM_PROGRAMS } from '@/lib/chain';
import type { MarketRow } from '@/lib/db';
import { fmtAmount, fmtUsd, shortAddr } from '@/lib/format';

export default function PoolsTable({ pools, mint }: { pools: MarketRow[]; mint: string }) {
  return (
    <section className="card">
      <div className="card-hd">
        <div>
          <h2>Pools</h2>
          <p className="mute">Every on-chain pool holding this token, from the last collector run.</p>
        </div>
      </div>
      {pools.length === 0 ? (
        <div className="empty">No pool holds this token.</div>
      ) : (
        <div className="tbl-wrap flat">
          <table>
            <thead>
              <tr>
                <th>Pool</th>
                <th>AMM</th>
                <th>Pair</th>
                <th>Reserve</th>
                <th>Reserve</th>
                <th>Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => {
                const flip = p.quote_mint === mint;
                const [tSym, tAmt, oSym, oAmt] = flip
                  ? [p.quote_symbol, p.quote_amount, p.base_symbol, p.base_amount]
                  : [p.base_symbol, p.base_amount, p.quote_symbol, p.quote_amount];
                const amm = p.type ? AMM_PROGRAMS[p.type]?.label ?? p.type : '—';
                return (
                  <tr key={p.market_id}>
                    <td className="tok">
                      <a href={addrUrl(p.market_id)} target="_blank" rel="noreferrer" className="mono">
                        {shortAddr(p.market_id, 5)}
                      </a>
                    </td>
                    <td className="tok">{amm}</td>
                    <td className="tok">
                      {tSym ?? '?'} / {oSym ?? '?'}
                    </td>
                    <td>
                      {fmtAmount(tAmt)} <span className="mute">{tSym}</span>
                    </td>
                    <td>
                      {fmtAmount(oAmt)} <span className="mute">{oSym}</span>
                    </td>
                    <td>{fmtUsd(p.liquidity_usd, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
