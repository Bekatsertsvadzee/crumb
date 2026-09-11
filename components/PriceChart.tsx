'use client';

import { useEffect, useRef, useState } from 'react';
import type { Candle } from '@/lib/db';
import { fmtDate, fmtPrice, fmtUsd } from '@/lib/format';

type TF = '5m' | '1h' | 'all';

const MIN_CANDLES = 2;

export default function PriceChart({ c5m, c1h, symbol }: { c5m: Candle[]; c1h: Candle[]; symbol: string }) {
  const [tf, setTf] = useState<TF>(c1h.length >= 24 ? '1h' : '5m');
  const ref = useRef<HTMLDivElement>(null);
  const candles = tf === '5m' ? c5m : c1h;
  const enough = candles.length >= MIN_CANDLES;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enough) return;
    let disposed = false;
    let cleanup = () => {};

    import('lightweight-charts').then(({ createChart, CandlestickSeries, LineSeries, ColorType, CrosshairMode }) => {
      if (disposed) return;
      const css = getComputedStyle(document.documentElement);
      const v = (n: string) => css.getPropertyValue(n).trim();

      const chart = createChart(el, {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: v('--text-dim'),
          fontFamily: v('--font-mono'),
          fontSize: 11,
          panes: { separatorColor: v('--border'), separatorHoverColor: v('--border-strong'), enableResize: false },
        },
        grid: { vertLines: { color: v('--border') }, horzLines: { color: v('--border') } },
        rightPriceScale: { borderColor: v('--border') },
        timeScale: { borderColor: v('--border'), timeVisible: true, secondsVisible: false },
        crosshair: { mode: CrosshairMode.Normal },
        localization: { priceFormatter: (p: number) => fmtPrice(p) },
      });

      const price = chart.addSeries(CandlestickSeries, {
        upColor: v('--up'),
        downColor: v('--down'),
        wickUpColor: v('--up'),
        wickDownColor: v('--down'),
        borderVisible: false,
        priceFormat: { type: 'custom', formatter: (p: number) => fmtPrice(p), minMove: 1e-12 },
      });
      price.setData(
        candles.map((k) => ({
          time: (Date.parse(k.bucket) / 1000) as import('lightweight-charts').UTCTimestamp,
          open: k.o,
          high: k.h,
          low: k.l,
          close: k.c,
        })),
      );

      const liq = chart.addSeries(
        LineSeries,
        {
          color: v('--series'),
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat: { type: 'custom', formatter: (p: number) => fmtUsd(p), minMove: 0.01 },
        },
        1,
      );
      liq.setData(
        candles
          .filter((k) => k.liquidity_usd != null)
          .map((k) => ({
            time: (Date.parse(k.bucket) / 1000) as import('lightweight-charts').UTCTimestamp,
            value: k.liquidity_usd as number,
          })),
      );
      const panes = chart.panes();
      if (panes[1]) panes[1].setHeight(90);

      if (tf === 'all' || candles.length <= 120) chart.timeScale().fitContent();
      else chart.timeScale().setVisibleLogicalRange({ from: candles.length - 120, to: candles.length + 2 });

      cleanup = () => chart.remove();
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [candles, enough, tf]);

  const first = c5m[0]?.bucket ?? c1h[0]?.bucket ?? null;
  const last = candles[candles.length - 1];

  return (
    <section className="card">
      <div className="card-hd">
        <div>
          <h2>Price</h2>
          <p className="mute">
            History since {first ? fmtDate(first) : 'the first collector run'} — Crumb&apos;s own index. Cookie Chain publishes none.
          </p>
        </div>
        <div className="seg" role="tablist" aria-label="Timeframe">
          {(['5m', '1h', 'all'] as TF[]).map((t) => (
            <button key={t} role="tab" aria-selected={tf === t} onClick={() => setTf(t)}>
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>
      {enough ? (
        <>
          <div ref={ref} className="chart" aria-label={`${symbol} price and liquidity chart`} />
          <div className="chart-legend">
            <span><i className="sw sw-up" /> up</span>
            <span><i className="sw sw-down" /> down</span>
            <span><i className="sw sw-series" /> pool liquidity, USD</span>
            <span className="mute" style={{ marginLeft: 'auto' }}>
              {candles.length} candles · last {last ? fmtDate(last.bucket) : '—'}
            </span>
          </div>
        </>
      ) : (
        <div className="empty">
          <p>Not enough history yet.</p>
          <p className="mute">
            {candles.length === 0
              ? `Crumb has not recorded a ${tf === 'all' ? '1h' : tf} candle for ${symbol} yet.`
              : `One ${tf === 'all' ? '1h' : tf} candle so far. A chart needs two.`}{' '}
            The collector runs every five minutes; nothing here is backfilled or simulated.
          </p>
        </div>
      )}
    </section>
  );
}
