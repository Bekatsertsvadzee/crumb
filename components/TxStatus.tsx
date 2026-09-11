'use client';

import { txUrl } from '@/lib/chain';
import { shortAddr } from '@/lib/format';
import { PHASE_LABEL, type TxState } from '@/lib/tx';

const STEPS = ['building', 'signing', 'sending', 'confirming', 'confirmed'] as const;

export default function TxStatus({ state, onReset }: { state: TxState; onReset: () => void }) {
  if (state.phase === 'idle') return null;
  const idx = STEPS.indexOf(state.phase as (typeof STEPS)[number]);
  const failed = state.phase === 'error';
  return (
    <div className={`tx ${failed ? 'tx-err' : state.phase === 'confirmed' ? 'tx-ok' : ''}`} role="status" aria-live="polite">
      <ol className="tx-steps" aria-label="Transaction progress">
        {STEPS.filter((s) => s !== 'sending').map((s) => {
          const i = STEPS.indexOf(s);
          const done = idx > i || state.phase === 'confirmed';
          const active = state.phase === s || (s === 'signing' && state.phase === 'sending');
          return (
            <li key={s} className={done ? 'done' : active ? 'active' : ''}>
              <i aria-hidden="true" />
              {PHASE_LABEL[s]}
            </li>
          );
        })}
      </ol>
      {failed && <p className="form-err">{state.error}</p>}
      {state.signature && (
        <p className="tx-sig">
          Signature{' '}
          <a href={txUrl(state.signature)} target="_blank" rel="noreferrer" className="mono">
            {shortAddr(state.signature, 8)}
          </a>
          {state.phase === 'confirmed' && <span className="mute"> · view on Cookiescan</span>}
        </p>
      )}
      {(failed || state.phase === 'confirmed') && (
        <button className="btn btn-ghost" onClick={onReset}>
          {failed ? 'Dismiss' : 'Done'}
        </button>
      )}
    </div>
  );
}
