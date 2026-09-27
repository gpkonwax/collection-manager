# Set up the two GitHub secrets that let the monthly holders list auto-publish to Cloudflare

## Why you're doing this

Every month on the 10th, a GitHub Action scans the WAX blockchain and rebuilds
the "Top Holders" list (`manifests/gpk-topps-holders.json`). It then does two
things with that fresh list:

1. **Commits it back into the GitHub repo** — this always works, no setup needed.
2. **Uploads it to your Cloudflare Pages site called `gpk-data`** — this only
   works if GitHub can prove to Cloudflare who it is. That proof is two pieces
   of information stored as **repo secrets**:

   | Secret name            | What it is                                      | Where it comes from         |
   |-----------------------|-------------------------------------------------|-----------------------------|
   | `CF_API_TOKEN`        | A Cloudflare API token (a long password)        | Created in your Cloudflare account |
   | `CF_ACCOUNT_ID`       | Your Cloudflare account ID (a short hex string) | Shown on your Cloudflare dashboard |

Until both secrets exist, step 2 is skipped (the run log prints a clear warning)
and step 1 still happens — so the site never breaks, it just doesn't auto-update
the Cloudflare copy. Once you add them, the full pipeline runs hands-free.

You only do this **once**. After that it runs forever.

---

## Part 1 — Create the Cloudflare API token

This token is a scoped password: it can only touch Cloudflare Pages, only in
your account, nothing else. Do NOT use the "Global API Key" — that's too broad.

1. Sign in to **https://dash.cloudflare.com** (the account that owns the
   `gpk-data` Pages project — the same one the data mirror already lives on).
2. Click your profile picture (top-right) → **My Profile**.
3. In the left sidebar, click **API Tokens**.
4. Click **Create Token** (the button, not "Create Custom Token" yet).
5. Scroll to the bottom and click **Get started** next to
   **Create Custom Token**. (There is no ready-made template for "Pages Edit",
   so a custom token is the clean way.)
6. Fill in the form exactly like this:

   - **Token name:** `gpk-holders-deploy` (any name works; this is just a label)
   - **Permissions:**
     - First row: choose **Account** · **Cloudflare Pages** · **Edit**
     - That's the only row you need. Click **Add more** only if you need more —
       you don't here.
   - **Account Resources:**
     - Choose **Include** · **your account** (the one with the `gpk-data`
       project). If you only have one account, it's pre-selected.
   - **Client IP Address Filtering:** leave blank.
   - **TTL:** leave blank (no expiry) — this is a long-lived automation token.
     You can set an expiry later if you prefer, but then you'll have to repeat
     Part 3 when it expires.

7. Click **Continue to summary**.
8. Review the summary — it should say:
   `Account · Cloudflare Pages · Edit` on your account.
9. Click **Create Token**.
10. Cloudflare shows you the token string **once**, on a green banner that says
    *"Here is your API token."* It looks like a long random string of letters
    and numbers (no spaces). **Copy it now** — you cannot see it again after
    you leave this page. Paste it somewhere safe temporarily (a notes app is
    fine for a few minutes; a password manager is better).

> If you miss it: go back to API Tokens, find `gpk-holders-deploy`, click the
> **⋯** menu → **Roll** to generate a new value, copy that, and delete the old
> one. You don't lose anything; you just re-roll.

---

## Part 2 — Find your Cloudflare Account ID

This is a short hex string that identifies your Cloudflare account.

1. Go to **https://dash.cloudflare.com**.
2. Click on **any** domain or site you own in the left list (it can be the
   `gpk-data` Pages project, or any domain). The home dashboard itself also
   shows it on the right-hand "API" card on some accounts.
3. Once you're inside any site/project, look at the **right-hand sidebar**
   (scroll down if needed). You'll see a box titled **API** with two fields:
   - **Account ID** ← copy this value (32 hex characters, e.g.
     `a1b2c3d4e5f6...`)
   - (Account Token — ignore this one)
4. Copy the **Account ID** value.

If you can't find it on a site page: from the dashboard home, click
**Workers & Pages** in the left nav, open the `gpk-data` project, and the
Account ID appears in the right sidebar there too.

---

## Part 3 — Add both values as GitHub repo secrets

This is where you paste the two values into your GitHub repo so the monthly
Action can read them. GitHub encrypts them; nobody can read them back, only
use them.

1. Open your backup repo in a browser. Based on prior work that's:
   **https://github.com/gpkonwaxbackup/gpk-backup**
   (If you've renamed it, use your actual backup repo URL.)
2. Click the **Settings** tab (top of the repo, not the gear icon next to a
   file). If you don't see Settings, you don't have admin rights on the repo —
   ask the owner to do this, or check you're signed in as the owner.
3. In the left sidebar, under the **Security** heading, click **Secrets and
   variables** → **Actions**.
4. You'll see a section titled **Repository secrets** with an
   **Add new secret** button. Add the two secrets one at a time:

   **First secret — the API token:**
   - Click **Add new secret**.
   - **Name:** `CF_API_TOKEN`  ← exactly this, all caps, underscores. Type it;
     don't paste a label.
   - **Secret:** paste the long token string you copied in Part 1.
   - Click **Add secret**.

   **Second secret — the account ID:**
   - Click **Add new secret** again.
   - **Name:** `CF_ACCOUNT_ID`  ← exactly this.
   - **Secret:** paste the Account ID you copied in Part 2.
   - Click **Add secret**.

5. You should now see both names listed under Repository secrets. The values
   are hidden; that's correct and expected. GitHub will never show them again
   to anyone — only the workflow can read them.

---

## Part 4 — Test it works (run the Action manually once)

Don't wait for the 10th of the month — run it now to confirm the secrets work.

1. In the same repo, click the **Actions** tab (top of the repo).
2. In the left sidebar under **Workflows**, click **Refresh GPK holders
   manifest**.
3. On the right side, click the **Run workflow** dropdown (green/grey button).
4. Leave the branch as `main` and click the green **Run workflow** button.
5. Within a few seconds a new run appears at the top of the list titled
   "Refresh GPK holders manifest". Click its title to open it.
6. The job `rebuild-and-publish` will run. It takes roughly **30 minutes**
   (it scans the whole WAX chain — be patient, don't cancel it).
7. Watch the **Deploy to Cloudflare Pages (gpk-data)** step:
   - ✅ Success → you'll see Wrangler upload files and finish with something
     like `✨ Successfully deployed!` The secrets work. You're done.
   - ⚠️ If it says `CF_API_TOKEN / CF_ACCOUNT_ID not set — … skipped` → the
     secret names don't match exactly. Re-check Part 3 (names are case-sensitive
     and must be exactly `CF_API_TOKEN` and `CF_ACCOUNT_ID`).
   - ❌ If Wrangler fails with **"Authentication error" / 403 / "Could not
     authenticate"** → the token's permissions are wrong. Re-check Part 1: it
     must be **Account · Cloudflare Pages · Edit** on the correct account.
     Re-roll or recreate the token and update the `CF_API_TOKEN` secret
     (Settings → Secrets and variables → Actions → click the pencil/⭐ next
     to `CF_API_TOKEN` → **Update** → paste new value → **Save**).
   - ❌ If Wrangler fails with **"Project not found: gpk-data"** → the Pages
     project name in Cloudflare isn't exactly `gpk-data`. Go to
     Cloudflare → Workers & Pages, confirm the project name, and tell me if it
     differs so the workflow can be updated.

---

## Part 5 — Confirm the live site updated

After a successful run:

1. Visit the data mirror URL you use for the holders manifest. (This is the
   `gpk-data` Cloudflare Pages site — e.g.
   `https://gpk-data.pages.dev/manifests/gpk-topps-holders.json`.)
2. The JSON should reflect the new run date. The file's top-level `generatedAt`
   or `scanDate` field (depending on the manifest shape) should be today's date.
3. Open the Collection Manager, use **View Wallet**, and confirm the Top
   Holders list still loads correctly from that URL.

---

## Quick reference checklist

```
[ ] Cloudflare: created API token "gpk-holders-deploy"
    (Account · Cloudflare Pages · Edit)  →  copied token string
[ ] Cloudflare: copied Account ID from right sidebar
[ ] GitHub: Settings → Secrets and variables → Actions
      CF_API_TOKEN    = <token string>
      CF_ACCOUNT_ID   = <account id>
[ ] GitHub: Actions tab → Refresh GPK holders manifest → Run workflow
[ ] Watch "Deploy to Cloudflare Pages" step → ✨ Successfully deployed
[ ] Live site: holders JSON shows today's date
```

That's the entire one-time setup. After this, the 10th-of-the-month run is
fully automatic — no human intervention, and a failed run never leaves the
site empty because the previous manifest keeps serving.
