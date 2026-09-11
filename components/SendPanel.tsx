'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { useState } from 'react';
import { useCookBalance } from '@/components/ConnectButton';
import TxStatus from '@/components/TxStatus';
import { COOK_DECIMALS } from '@/lib/chain';
import { describeTxError, sendAndConfirm, type TxState } from '@/lib/tx';

const FEE_RESERVE = 0.001;

export default function SendPanel() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { cook, refresh } = useCookBalance();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [tx, setTx] = useState<TxState>({ phase: 'idle' });
  const busy = tx.phase !== 'idle' && tx.phase !== 'error' && tx.phase !== 'confirmed';

  let toErr: string | null = null;
  let dest: PublicKey | null = null;
  if (to) {
    try {
      dest = new PublicKey(to);
      if (publicKey && dest.equals(publicKey)) toErr = 'That is your own address.';
    } catch {
      toErr = 'Not a valid Cookie Chain address.';
    }
  }
  const amt = Number(amount);
  const amtErr =
    amount === '' ? null : !Number.isFinite(amt) || amt <= 0 ? 'Enter an amount above zero.' : cook != null && amt > cook - FEE_RESERVE ? `Not enough COOK. Balance ${cook.toFixed(4)}, keep ${FEE_RESERVE} for the fee.` : null;
  const ready = !!publicKey && !!dest && !toErr && amount !== '' && !amtErr && !busy;

  async function submit() {
    if (!publicKey || !dest) return;
    setTx({ phase: 'building' });
    try {
      const lamports = BigInt(Math.round(amt * 10 ** COOK_DECIMALS));
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const msg = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: dest, lamports })],
      }).compileToV0Message();
      const vtx = new VersionedTransaction(msg);
      await sendAndConfirm(connection, vtx, (t) => sendTransaction(t, connection), lastValidBlockHeight, setTx);
      setAmount('');
      refresh();
    } catch (e) {
      setTx((s) => (s.phase === 'error' ? s : { phase: 'error', error: describeTxError(e) }));
    }
  }

  return (
    <section className="card">
      <div className="card-hd">
        <div>
          <h2>Send COOK</h2>
          <p className="mute">Native transfer on Cookie Chain. Fee is a fraction of a cent.</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="send-to">Recipient</label>
        <input id="send-to" className="mono" placeholder="Cookie Chain address" value={to} disabled={busy} onChange={(e) => setTo(e.target.value.trim())} aria-invalid={!!toErr || undefined} autoComplete="off" spellCheck={false} />
        {toErr && <p className="form-err">{toErr}</p>}
      </div>
      <div className="field">
        <label htmlFor="send-amt">
          Amount <span className="mute">COOK</span>
          {cook != null && (
            <button type="button" className="link" onClick={() => setAmount(String(Math.max(0, cook - FEE_RESERVE)))}>
              max {cook.toLocaleString('en-US', { maximumFractionDigits: 4 })}
            </button>
          )}
        </label>
        <input id="send-amt" inputMode="decimal" placeholder="0.0" value={amount} disabled={busy} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} aria-invalid={!!amtErr || undefined} autoComplete="off" />
        {amtErr && <p className="form-err">{amtErr}</p>}
      </div>
      <button className="btn btn-primary wide" disabled={!ready} onClick={submit}>
        {busy ? 'Working…' : 'Send'}
      </button>
      <TxStatus state={tx} onReset={() => setTx({ phase: 'idle' })} />
    </section>
  );
}
