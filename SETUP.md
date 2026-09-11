# Day 0 — get the collector running (≈25 minutes)

Do this today. Every hour you wait is an hour of chart history you will never have.
Nothing here touches a wallet, a key, or any money.

---

## 1 · Supabase project (5 min)

1. supabase.com → **New project**
   - Name `crumb`
   - Region **Frankfurt (eu-central-1)** — closest to Tbilisi and to GitHub's EU runners
   - Set a DB password, save it in your password manager
2. Wait for it to provision (~2 min)
3. **SQL Editor** → New query → paste the entire contents of `supabase/schema.sql` → **Run**
   - Expect: `Success. No rows returned`
4. **Project Settings → API**, copy these three:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

> The `service_role` key bypasses RLS. It goes in GitHub Secrets and nowhere else.
> Never put it in `NEXT_PUBLIC_*`, never commit it, never paste it into a chat.

---

## 2 · Repo (5 min)

```bash
unzip crumb-day0.zip -d crumb
cd crumb
git init -b main
git add .
git commit -m "feat: Cookie Chain price history collector

Cookie Chain exposes no OHLC or time-series data. This collects it:
aggregates all 160 AMM pools into liquidity-weighted marks every 5
minutes and writes 5m/1h candles to Supabase via one atomic RPC."
```

Create `Rezimod/Crumb` on GitHub — **public**, no README, no .gitignore, MIT license.

```bash
git remote add origin https://github.com/Rezimod/Crumb.git
git push -u origin main
```

---

## 3 · Local smoke test (5 min)

```bash
cp .env.example .env
# fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

npm run collect:test     # offline, must print ALL PASS
node --env-file=.env scripts/collect.mjs
```

The real run should print something like:

```
  chain: COOK $0.000092 · 6481 tokens indexed
  markets: 160
  enriched: 20 tokens
  tracking 47 tokens (>= $10 liquidity or curated)
  ingest: {"ok":true,"bucket_5m":"...","tokens":47,"markets":160,...}
```

Then in Supabase → **Table Editor → candles_5m** you should see rows. **That is the moat starting.**

If `tracking 0 tokens` — the API shape moved. Send me the full log, don't guess.

---

## 4 · GitHub Actions (5 min)

Repo → **Settings → Secrets and variables → Actions → New repository secret**, twice:

| Name | Value |
|---|---|
| `SUPABASE_URL` | your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key |

Then **Actions** tab → enable workflows if prompted → **crumb-collector** → **Run workflow**.

Green check = done. It now runs every 5 minutes on its own.

---

## 5 · Verify tomorrow morning

Supabase → SQL Editor:

```sql
select count(*) as candles,
       count(distinct mint) as tokens,
       min(bucket) as since,
       max(bucket) as latest
from candles_5m;
```

Expect ~12 buckets/hour × tokens tracked. If `latest` is more than 15 minutes old,
check the Actions tab — GitHub deprioritises schedules under load, and a couple of
skipped slots is normal. A whole missing hour is not.

---

## Notes

- **GitHub's cron minimum is 5 minutes**, and it is best-effort — runs can be delayed
  several minutes under load. That's fine: a chain doing ~$4/day of volume does not
  need 1-minute candles, and 5m is honest granularity for it.
- **Vercel Hobby cron only fires once per day**, which is why this is a GitHub Action
  and not a Vercel cron. Don't move it.
- If you later want true 60-second candles, the same script runs unchanged on Railway
  with a `setInterval`. Not needed for the bounty.
- `MIN_LIQUIDITY_USD=10` keeps ~50 tokens out of 6,481 and stays far inside the Supabase
  free tier. Curated tokens are always kept regardless of liquidity.

---

## What I need back from you

1. The **Actions run log** (paste it) — confirms the live API shape matches what I built against
2. The **repo URL** once it's public
3. The **anon** key + project URL (safe to share — they're public by design; the
   `service_role` key is the one that must never leave your machine)

Then I start on the screener.
