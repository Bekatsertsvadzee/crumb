import type { HolderStats } from '@/lib/analytics';
import { addrUrl } from '@/lib/chain';
import { fmtAmount, fmtShare, shortAddr } from '@/lib/format';

export default function HoldersPanel({ stats, error, symbol }: { stats: HolderStats | null; error: string | null; symbol: string }) {
  return (
    <section className="card">
      <div className="card-hd">
        <div>
          <h2>Holders</h2>
          <p className="mute">Top 20 owners of {symbol}, aggregated across token accounts. Live from the DAS API.</p>
        </div>
      </div>

      {!stats ? (
        <div className="empty">
          <p>Holder data unavailable.</p>
          <p className="mute">{error ?? 'The DAS endpoint returned nothing for this mint.'}</p>
        </div>
      ) : stats.top.length === 0 ? (
        <div className="empty">No token accounts hold {symbol}.</div>
      ) : (
        <>
          <div className="conc">
            <div className="conc-bar" role="img" aria-label={`Pools ${fmtShare(stats.poolShare)}, top 10 wallets ${fmtShare(stats.top10WalletShare)}, everyone else ${fmtShare(100 - stats.poolShare - stats.top10WalletShare)}`}>
              <i className="conc-pool" style={{ width: `${Math.min(100, stats.poolShare)}%` }} />
              <i className="conc-top" style={{ width: `${Math.min(100, stats.top10WalletShare)}%` }} />
            </div>
            <div className="conc-legend">
              <span><i className="sw sw-series" /> pools {fmtShare(stats.poolShare)}</span>
              <span><i className="sw sw-top" /> top 10 wallets {fmtShare(stats.top10WalletShare)}</span>
              <span><i className="sw sw-rest" /> other {stats.total - Math.min(stats.total, 10)} holders</span>
            </div>
          </div>

          <div className="tbl-wrap flat">
            <table>
              <thead>
                <tr>
                  <th className="rank">#</th>
                  <th>Owner</th>
                  <th>Balance</th>
                  <th>Share</th>
                  <th style={{ textAlign: 'left' }}>Share of supply</th>
                </tr>
              </thead>
              <tbody>
                {stats.top.map((h, i) => (
                  <tr key={h.owner}>
                    <td className="rank">{i + 1}</td>
                    <td className="tok">
                      <a href={addrUrl(h.owner)} target="_blank" rel="noreferrer" className="mono">
                        {shortAddr(h.owner, 5)}
                      </a>
                      {h.isPool && <span className="tier tier-2" style={{ marginLeft: 8 }}>Pool</span>}
                      {h.accounts > 1 && <span className="mute" style={{ marginLeft: 8, fontSize: 11 }}>{h.accounts} accounts</span>}
                    </td>
                    <td>{fmtAmount(h.amount)}</td>
                    <td>{fmtShare(h.share)}</td>
                    <td style={{ textAlign: 'left', width: 160 }}>
                      <div className="share-bar">
                        <i className={h.isPool ? 'pool' : ''} style={{ width: `${Math.min(100, h.share)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
