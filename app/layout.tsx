import type { Metadata } from 'next';
import Link from 'next/link';
import ConnectButton from '@/components/ConnectButton';
import WalletProviders from '@/components/WalletProviders';
import './globals.css';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://crumb.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Crumb — Cookie Chain analytics', template: '%s' },
  description: 'Analytics and trading terminal for Cookie Chain. The only source of price history on the chain.',
  openGraph: {
    type: 'website',
    siteName: 'Crumb',
    title: 'Crumb — Cookie Chain analytics',
    description: 'Cookie Chain publishes no price history. Crumb records its own every 5 minutes: charts, pools, holder distribution, risk flags, swaps.',
  },
  twitter: { card: 'summary_large_image' },
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
        <WalletProviders>
          <header className="hdr">
            <div className="wrap hdr-in">
              <Link href="/" className="logo" aria-label="Crumb home">
                <Logo />
                CRUMB
              </Link>
              <nav className="nav" aria-label="Primary">
                <Link href="/">Screener</Link>
                <Link href="/portfolio">Portfolio</Link>
              </nav>
              <div className="hdr-right">
                <ConnectButton />
              </div>
            </div>
          </header>
          <main className="wrap">{children}</main>
        </WalletProviders>
        <footer className="wrap footer">
          <span>Crumb — open source, MIT</span>
          <a href="https://github.com/Bekatsertsvadzee/crumb" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="https://cookiescan.io" target="_blank" rel="noreferrer">
            Data: Cookiescan
          </a>
          <a href="https://hyperlane.cookiescan.io" target="_blank" rel="noreferrer">
            Bridge COOK
          </a>
        </footer>
      </body>
    </html>
  );
}
