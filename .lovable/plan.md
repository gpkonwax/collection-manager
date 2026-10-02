# Add the Cloudflare keys to GitHub so the mint backup deploys to gpk-data

## Why

The workflow already commits the mint backup to GitHub (which is why mints now show via the raw-GitHub fallback). Adding the two Cloudflare keys lets the same workflow also deploy to `gpk-data.pages.dev` — the fast primary mirror the app checks first.

## Steps (all in your browser, no code changes)

1. **Open the secrets page**
   - Go to your **collection-manager** repo on GitHub (the main app repo, not gpk-backup).
   - Click **Settings** (top tab bar) → in the left sidebar under "Security" click **Secrets and variables** → **Actions**.
   - You should see a "Repository secrets" section with a green **New repository secret** button.

2. **Add the first secret: CF_API_TOKEN**
   - Click **New repository secret**.
   - Name: `CF_API_TOKEN` (exactly this, all caps, underscores — the workflow looks for this exact name).
   - Secret: paste your Cloudflare API token (the `cfat_...` or similar string).
   - Click **Add secret**.

3. **Add the second secret: CF_ACCOUNT_ID**
   - Click **New repository secret** again.
   - Name: `CF_ACCOUNT_ID`.
   - Secret: paste your Cloudflare account ID (a 32-character hex string, found on any Cloudflare dashboard page in the right-hand sidebar, or in the URL after `/dash.cloudflare.com/`).
   - Click **Add secret**.

4. **Re-run the workflow**
   - Click the **Actions** tab → **Refresh GPK holders manifest** in the left sidebar → **Run workflow** (right side) → confirm on the `main` branch.
   - This time the "Deploy to Cloudflare Pages (gpk-data)" step will actually deploy instead of printing the skip warning.

5. **Verify (optional, after the run finishes)**
   - Open `https://gpk-data.pages.dev/manifests/mints/index.json` in a browser tab.
   - Before: 404. After a successful deploy: a JSON index with `count: 503831` (or higher) and the shard list.

## Notes

- GitHub secrets are write-only: once saved, nobody (including you) can read them back through the UI — you can only replace them. That's normal.
- If a step fails with a Cloudflare 403, the token is missing the **Account → Cloudflare Pages → Edit** permission; create a fresh token with that permission and replace the secret.
- Nothing in the app code changes. Once the deploy works, the app automatically prefers the fast gpk-data mirror and only uses the GitHub fallback if the mirror is ever down.
- The workflow also re-runs by itself on the 10th of each month, so this is a one-time setup.
