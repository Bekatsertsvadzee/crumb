'use client';

import { useState } from 'react';

// ipfs.io and a few other hosts block cross-origin embeds; fall back to initials.
export default function TokenIcon({ src, symbol }: { src: string | null; symbol: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <span className="tok-img-ph">{symbol.slice(0, 2).toUpperCase()}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="tok-img" src={src} alt="" loading="lazy" onError={() => setBroken(true)} />;
}
