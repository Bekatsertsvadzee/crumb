'use client';

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { NightlyWalletAdapter } from '@solana/wallet-adapter-nightly';
import { createContext, useContext, useMemo, useState } from 'react';
import { RPC_URL } from '@/lib/chain';

const ModalCtx = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({ open: false, setOpen: () => {} });
export const useWalletModal = () => useContext(ModalCtx);

export default function WalletProviders({ children }: { children: React.ReactNode }) {
  // Nightly is registered explicitly so it is listed (with an install link) even when the
  // extension is absent. Any other Wallet Standard wallet the browser exposes is picked up too.
  const wallets = useMemo(() => [new NightlyWalletAdapter()], []);
  const [open, setOpen] = useState(false);
  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: 'confirmed' }}>
      <WalletProvider wallets={wallets} autoConnect onError={() => { /* surfaced by the caller's try/catch */ }}>
        <ModalCtx.Provider value={{ open, setOpen }}>{children}</ModalCtx.Provider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
