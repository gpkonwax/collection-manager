# Auto-refresh the Top Holders list every month (GitHub Action)

Goal: the `gpk-topps-holders.json` manifest rebuilds and republishes itself on the 10th of every month, with no manual steps. The View Wallet "Top Holders" list then always shows a snapshot no older than ~1 month.

## What I will add

1. **New workflow: `.github/workflows/holders-manifest.yml`**
   - Schedule: `cron: '0 0 10 * *'` — runs at 00:00 UTC on the 10th of each month (10:00 AM Brisbane time). Also supports manual **Run workflow** from the Actions tab for an on-demand refresh.
   - Steps:
     1. Check out the repo, set up Node.
     2. Run `node scripts/build-holders-manifest.mjs` (the existing ~30-minute WAX scan; GitHub's 6-hour job limit is plenty).
     3. Deploy the manifest straight to the Cloudflare Pages data mirror with `wrangler pages deploy`:
        - Copies the fresh manifest into `scripts/data-mirror-output/gpk-data/manifests/gpk-topps-holders.json`.
        - Regenerates `data-mirror-index.json` via `node scripts/build-data-mirror.mjs` (puzzle/pack files are already on the site; the script skips existing downloads).
        - Deploys the whole `gpk-data` folder to the existing `gpk-data` Pages project. Cloudflare only changes the files that differ, so this is a fast, small deploy — not a re-upload of everything.
     4. Commits the updated manifest back to the repo (`manifests/gpk-topps-holders.json`) so the repo copy stays current too.

2. **Small script tweak: `scripts/build-holders-manifest.mjs`**
   - Add an `--out <path>` option (or env var) so the workflow can write directly into the data-mirror folder without a copy step. Default behaviour unchanged.

## What you need to do once (5 minutes)

The workflow needs permission to deploy to your Cloudflare Pages project:

1. In Cloudflare: **My Profile → API Tokens → Create Token** → use the "Edit Cloudflare Workers" template (or create a custom token with **Account → Cloudflare Pages → Edit**).
2. Note your **Account ID** (shown on the Pages/Workers overview page, right sidebar).
3. In the GitHub repo (`gpkonwax`): **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `CF_API_TOKEN` — the token from step 1
   - `CF_ACCOUNT_ID` — the account ID from step 2

After that, everything runs itself. If the secrets are missing, the workflow still rebuilds the manifest and commits it to the repo — it just skips the Cloudflare deploy and marks that step clearly in the log.

## Verification

- I'll trigger the workflow once manually after it's merged (or you can click **Run workflow**) and confirm:
  - the scan completes and writes ~14k accounts,
  - the Cloudflare deploy succeeds,
  - `https://gpk-data.pages.dev/manifests/gpk-topps-holders.json` shows a fresh `generatedAt`,
  - the app's Top Holders list picks it up (it fetches with no-cache, so no app change needed).

## Notes

- No app code changes required — `src/lib/gpkHolders.ts` already fetches the manifest fresh each session.
- The Active Traders list stays live-queried and is unaffected.
- If a monthly run fails (e.g. WAX RPCs all down), the previous manifest keeps serving — the site never ends up with no list.
