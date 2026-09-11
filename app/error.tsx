'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const msg = /token_state|candles|markets|chain_stats|supabase|fetch failed/i.test(error.message)
    ? 'Crumb’s history database did not answer. It is usually back within a minute.'
    : error.message;
  return (
    <section className="card center">
      <h1>Something broke</h1>
      <p className="mute">{msg}</p>
      <button className="btn btn-ghost" onClick={reset}>Try again</button>
    </section>
  );
}
