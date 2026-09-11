import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="card center">
      <h1>Not found</h1>
      <p className="mute">
        No token with that mint is tracked by Crumb. Only tokens with at least one pool are indexed; the other 6,400 have no market.
      </p>
      <Link href="/" className="btn btn-ghost">Back to the screener</Link>
    </section>
  );
}
