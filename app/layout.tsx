import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crumb — Cookie Chain analytics',
  description:
    'Analytics and trading terminal for Cookie Chain. The only source of price history on the chain.',
};

function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2a10 10 0 1 0 10 10c0-1.1-.9-2-2-2h-1a2 2 0 0 1-2-2V7a2 2 0 0 0-2-2h-1a2 2 0 0 1-2-2V2z"
        fill="currentColor"
      />
      <circle cx="8" cy="10" r="1.3" fill="#0b0d10" />
      <circle cx="10" cy="16" r="1.3" fill="#0b0d10" />
      <circle cx="15" cy="15" r="1.3" fill="#0b0d10" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="hdr">
          <div className="wrap hdr-in">
            <Link href="/" className="logo" aria-label="Crumb home">
              <Logo />
              CRUMB
            </Link>
            <nav className="nav" aria-label="Primary">
              <Link href="/">Screener</Link>
            </nav>
            <div className="hdr-right" />
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="wrap footer">
          <span>Crumb — open source, MIT</span>
          <a href="https://github.com/Bekatsertsvadzee/crumb" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="https://cookiescan.io" target="_blank" rel="noreferrer">
            Data: Cookiescan
          </a>
        </footer>
      </body>
    </html>
  );
}
