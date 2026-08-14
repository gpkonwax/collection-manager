# New Netlify site — holders list + puzzle/pack image backup

A tiny, free website on Netlify that holds small files (a holders list and some card images), so you never have to touch or re-upload the big multi-gigabyte image backup again.

## Why

Two things currently depend on files that aren't on the backup mirrors yet:

1. **The View Wallet → holder list.** It reads a file called `gpk-topps-holders.json`. Right now that file returns "not found" (404) on all three backup mirrors, so the list is empty.
2. **The extra puzzles.** Their card-back images are pulled live from `geepeekay.com`. If that site ever goes offline, every extra puzzle (OS2, OS3, OS4, OS5) breaks. The classic GPK puzzle piece backs and pack artwork should be backed up too.

One small Netlify site fixes both, and you do NOT have to download or re-upload the big image mirror.

---

## Step 1 — I build the files (you don't do anything yet)

When you approve this plan, I will create a script that gathers everything into a single folder called `gpk-data`. It will contain:

```text
gpk-data/
  _headers                          (a tiny settings file — makes the browser allow the downloads)
  manifests/
    gpk-topps-holders.json          (the holders list)
    data-mirror-index.json          (a checklist of every file + its size, for auditing)
  packs/                            (the pack artwork images)
  puzzles/                          (the geepeekay card-back scans + completed-puzzle reference sheets)
```

You will run one command to build it:

```bash
node scripts/build-data-mirror.mjs
```

That command downloads the puzzle images from geepeekay.com (polite, with pauses so we don't overload the site), copies the pack images, and writes the holders list. It only needs to run once.

---

## Step 2 — Sign up for Netlify (free)

If you already have a Netlify account, skip to Step 3.

1. Go to **https://app.netlify.com/signup** in your web browser.
2. Sign up with your email, or click "Continue with GitHub" / "Continue with Google" — any of them works.
3. Netlify will ask what you want to do. You can skip the onboarding questions; you don't need to pick a plan or connect anything.

You now have a Netlify account. Nothing is published yet.

---

## Step 3 — Create a new, empty site by dragging a folder in

This is the "manual deploy" method — no coding, no git, no build settings.

1. On the Netlify dashboard (`https://app.netlify.com`), click **Add new site** (a button, usually top-right) and choose **Deploy manually**.
2. You'll see a big dotted box that says "Drag and drop your site output folder here".
3. Open the `gpk-data` folder on your computer (the one from Step 1) so you can see the files **inside it** (`_headers`, `manifests`, `packs`, `puzzles`).
4. Drag the **whole `gpk-data` folder** onto that dotted box. Netlify uploads it and gives the site a random name like `green-turtle-1234abc.netlify.app`.
5. Wait for it to say "Published" / "Deploy succeeded" (usually a few seconds to a minute).

You now have a live site. That random name is its web address for now.

---

## Step 4 — Give the site a memorable name

1. On your new site's page in Netlify, click **Site settings** (usually a tab or link on the left).
2. Find **Change site name** (under "Site information" or "Site details").
3. Type a name you'll remember, for example `gpk-data` or `gpkbackups`. Click **Save**.
4. Your site's address is now `https://<the-name-you-chose>.netlify.app` — for example `https://gpk-data.netlify.app`.

Copy that full address and send it to me in chat.

---

## Step 5 — I wire it into the app

Once you send me the Netlify address, I update the app code so it knows to look there first:

- The **View Wallet holder list** loads `manifests/gpk-topps-holders.json` from your new Netlify site (falling back to the old mirrors, then erroring gracefully if everything is down).
- The **extra puzzles** load their card-back images from `puzzles/...` on your Netlify site first, and only contact geepeekay.com as a last-resort fallback — so the puzzles keep working even if geepeekay disappears.
- The **pack artwork** is mirrored at `packs/...` for the offline/local build.
- A new "Data mirror" row appears in the Backup panel so you can see at a glance whether the Netlify site is reachable.

---

## Updating it later

To refresh the holders list or add new images later: re-run `node scripts/build-data-mirror.mjs`, then drag the `gpk-data` folder onto the same Netlify site again (Netlify dashboard → your site → "Deploys" → drag and drop, or "Add new site → Deploy manually"). It overwrites the old files. Takes seconds, not gigabytes.

---

## Technical notes (for the record)

- Filenames are normalised to lowercase on disk and in code (geepeekay mixes `.JPG` and `.jpg`, which breaks on case-sensitive hosts like Netlify's CDN).
- No hash-pinning enforcement at runtime for these files — they are public artwork; the index file exists for auditing, not trust.
- The image mirror, its pinned manifest, and the offline ZIP bundles are left untouched.
- Downloads from geepeekay.com are rate-limited (small concurrency with backoff) so we don't hammer the site.

Approve this plan and I'll build the script and the app wiring. You'll then run one command, drag one folder to Netlify, and send me the URL.
