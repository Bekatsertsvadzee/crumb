import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Crumb — Cookie Chain analytics';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#0b0d10', color: '#e6e8eb', fontFamily: 'Menlo, monospace' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 34, letterSpacing: 6, fontWeight: 700 }}>
          <div style={{ width: 28, height: 28, borderRadius: 999, background: '#c98500' }} />
          CRUMB
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1 }}>Cookie Chain publishes no price history.</div>
          <div style={{ fontSize: 34, color: '#9aa3ad' }}>Crumb records its own, every 5 minutes.</div>
        </div>
        <div style={{ display: 'flex', gap: 40, fontSize: 24, color: '#9aa3ad' }}>
          <span>Screener</span><span>Candles</span><span>Holders</span><span>Risk flags</span><span>Swaps</span>
        </div>
      </div>
    ),
    size,
  );
}
