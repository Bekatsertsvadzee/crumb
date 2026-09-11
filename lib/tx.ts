import type { Connection, TransactionSignature, VersionedTransaction } from '@solana/web3.js';

export type TxPhase = 'idle' | 'building' | 'signing' | 'sending' | 'confirming' | 'confirmed' | 'error';

export type TxState = { phase: TxPhase; signature?: string; error?: string; slot?: number };

export const PHASE_LABEL: Record<TxPhase, string> = {
  idle: '',
  building: 'Building transaction',
  signing: 'Waiting for wallet signature',
  sending: 'Sending to Cookie Chain',
  confirming: 'Waiting for confirmation',
  confirmed: 'Confirmed',
  error: 'Failed',
};

/** Map wallet, RPC and program errors to copy a user can act on. */
export function describeTxError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
  const name = e instanceof Error ? e.name : '';
  const all = `${name} ${msg}`;

  if (/WalletNotConnected/i.test(all)) return 'Connect a wallet first.';
  if (/User rejected|rejected the request|WalletSignTransactionError|WalletSendTransactionError.*reject|declined/i.test(all)) return 'You rejected the transaction in your wallet.';
  if (/insufficient lamports|Insufficient funds|insufficient funds for rent|0x1\b/i.test(all)) return 'Not enough COOK to cover the amount plus network fee.';
  if (/Blockhash not found|block height exceeded|expired|TransactionExpiredBlockheightExceeded/i.test(all)) return 'The transaction expired before it was confirmed. Nothing was sent; try again.';
  if (/ExceededSlippage|0x1771|slippage|minimum.*out/i.test(all)) return 'Price moved beyond your slippage tolerance. Raise it or try a smaller amount.';
  if (/Failed to fetch|NetworkError|ECONNREFUSED|fetch failed|503|502|timeout/i.test(all)) return 'Cookie Chain RPC is unreachable right now. Check your connection and retry.';
  if (/WalletNotReady|not installed/i.test(all)) return 'Wallet not installed. Install Nightly, then reload this page.';
  if (/AccountNotFound|could not find account/i.test(all)) return 'The account does not exist on Cookie Chain.';
  if (/custom program error/i.test(all)) return `The pool program rejected the swap (${msg.match(/0x[0-9a-f]+/i)?.[0] ?? 'unknown code'}).`;
  return msg.length > 200 ? msg.slice(0, 200) + '…' : msg;
}

/**
 * Send a signed-by-wallet transaction and poll for confirmation.
 * `sendTransaction` from wallet-adapter signs + sends in one step, so `signing` and `sending`
 * are reported around that call.
 */
export async function sendAndConfirm(
  connection: Connection,
  tx: VersionedTransaction,
  send: (tx: VersionedTransaction) => Promise<TransactionSignature>,
  lastValidBlockHeight: number,
  onState: (s: TxState) => void,
): Promise<string> {
  onState({ phase: 'signing' });
  let sig: string;
  try {
    sig = await send(tx);
  } catch (e) {
    onState({ phase: 'error', error: describeTxError(e) });
    throw e;
  }
  onState({ phase: 'confirming', signature: sig });

  // poll — wss on this chain is best-effort, HTTP polling is reliable
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const st = await connection.getSignatureStatuses([sig]);
    const s = st.value[0];
    if (s) {
      if (s.err) {
        const err = `Transaction failed on-chain: ${JSON.stringify(s.err)}`;
        onState({ phase: 'error', signature: sig, error: describeTxError(err) });
        throw new Error(err);
      }
      if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') {
        onState({ phase: 'confirmed', signature: sig, slot: s.slot });
        return sig;
      }
    }
    const h = await connection.getBlockHeight('confirmed').catch(() => 0);
    if (h > lastValidBlockHeight) {
      onState({ phase: 'error', signature: sig, error: 'The transaction expired before it was confirmed. Nothing was sent; try again.' });
      throw new Error('blockhash expired');
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  onState({ phase: 'error', signature: sig, error: 'Still unconfirmed after 90s. Check the signature on Cookiescan before retrying.' });
  throw new Error('confirmation timeout');
}
