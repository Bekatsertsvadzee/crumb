'use client';

import { useState } from 'react';

// ipfs.io and a few other hosts block cross-origin embeds; fall back to initials.
export default function TokenIcon({ src, symbol, size = 24 }: { src: string | null; symbol: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (!src || broken) {
    return (
      <span className="tok-img-ph" style={style}>
        {symbol.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="tok-img" style={style} src={src} alt="" loading="lazy" onError={() => setBroken(true)} />;
}
