'use client';

import { useState } from 'react';

export default function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      // clipboard blocked — nothing to do, the text is on screen
    }
  }
  return (
    <button type="button" className="icon-btn" onClick={copy} aria-label={done ? 'Copied' : label} title={done ? 'Copied' : label}>
      {done ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
