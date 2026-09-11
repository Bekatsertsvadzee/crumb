# 🍪 Crumb

**Analytics and trading terminal for [Cookie Chain](https://cookiechain.wtf).**

Cookie Chain has no price history. The Cookiescan API exposes a live price and a 24-hour
change, and nothing else — no OHLC, no candles, no time series of any kind. So Crumb builds
its own: a collector runs every five minutes, aggregates all 160 on-chain pools into
liquidity-weighted marks, and writes candles to Postgres.

Crumb is the only place you can see what a Cookie Chain token did yesterday.

> Status: collector live since 2026-09-11. Frontend in progress.

---

## What it does

- **Screener** — every tradeable token ranked by liquidity, holders, volume, with tier and risk flags
- **Charts** — 5m and 1h candles from Crumb's own history
- **Holder analytics** — top-holder distribution and supply concentration, from the DAS API
- **Risk flags** — impostor mints, thin liquidity, concentrated supply
- **Portfolio** — connect Nightly, see your holdings priced
- **Swap** — trade directly against Cookie Chain AMM pools

## Architecture

```
  Cookiescan API ──► collector (GitHub Actions, */5min) ──► Supabase
  (live only)          liquidity-weighted aggregation        (history)
                                                                 │
  rpc.cookiescan.io ◄──── Next.js app (Vercel) ◄─────────────────┘
  (wallet, swaps)         server: history · client: live WS
```

## Collector

Zero dependencies, Node 20+. One atomic `crumb_ingest` RPC per run.

```bash
cp .env.example .env
npm run collect:test     # offline self-test against captured fixtures
npm run collect          # one real run
```

Every missed run is a permanent gap in the chart. The workflow has `workflow_dispatch`
enabled — if a run fails, re-run it manually rather than waiting for the next slot.

## Cookie Chain reference

| | |
|---|---|
| RPC | `https://rpc.cookiescan.io` |
| WebSocket | `https://wss.cookiescan.io` |
| Explorer | `https://cookiescan.io` |
| Core | solana-core 4.1.2 — standard `@solana/web3.js` works unchanged |
| Genesis hash | `9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2` |
| Native token | COOK, 9 decimals |
| COOK mint | `36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1` |
| Wrapped COOK | `So11111111111111111111111111111111111111112` |

There is no testnet, devnet, or faucet. One live network.

### AMM programs

| Type | Pools | Program |
|---|---|---|
| Cookieswap CPAMM | 96 | `xYBN2zddsqSy41tg1yD9nJScCmqquZnHUyzXBfLEqC8` |
| Cookiebox DAMM | 28 | `DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY` |
| Cookieswap SAMM | 23 | `WTzkPUoprVx7PDc1tfKA5sS7k1ynCgU89WtwZhksHX5` |
| Cookiebox CLMM | 11 | `CLMMmWqTtyNSomqXP3kETJy2SGKPdr31USsm4GfbLyKs` |
| Meteora DAMM | 2 | `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG` |

## Credits

Market and asset data from [Cookiescan](https://api.cookiescan.io).

## License

MIT
