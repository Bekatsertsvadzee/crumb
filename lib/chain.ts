export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://rpc.cookiescan.io';
export const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER ?? 'https://cookiescan.io';
export const API = 'https://api.cookiescan.io';

export const COOK_MINT = '36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1';
/** Wrapped COOK reuses the wSOL address. Pools quote against this. */
export const WCOOK_MINT = 'So11111111111111111111111111111111111111112';
export const COOK_DECIMALS = 9;

/** Cookiebox DAMM is a byte-compatible redeploy of Meteora CP-AMM (verified by discriminator + simulated swap). */
export const COOKIEBOX_DAMM = 'DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY';
export const METEORA_DAMM = 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG';

export const AMM_PROGRAMS: Record<string, { label: string; programId: string }> = {
  'COOKIESWAP CPAMM': { label: 'Cookieswap CPAMM', programId: 'xYBN2zddsqSy41tg1yD9nJScCmqquZnHUyzXBfLEqC8' },
  'COOKIEBOX DAMM': { label: 'Cookiebox DAMM', programId: COOKIEBOX_DAMM },
  'COOKIESWAP SAMM': { label: 'Cookieswap SAMM', programId: 'WTzkPUoprVx7PDc1tfKA5sS7k1ynCgU89WtwZhksHX5' },
  'COOKIEBOX CLMM': { label: 'Cookiebox CLMM', programId: 'CLMMmWqTtyNSomqXP3kETJy2SGKPdr31USsm4GfbLyKs' },
  'METEORA DAMM': { label: 'Meteora DAMM', programId: METEORA_DAMM },
};

/** Pool types Crumb can route a swap through. */
export const SWAPPABLE_TYPES = new Set(['COOKIEBOX DAMM', 'METEORA DAMM']);

export const TIER1_MIN_USD = 250;
export const TIER2_MIN_USD = 50;

export const txUrl = (sig: string) => `${EXPLORER}/tx/${sig}`;
export const addrUrl = (pk: string) => `${EXPLORER}/address/${pk}`;
