# Plan: Deploy the Data Mirror to Cloudflare Pages

## Quick answers to your questions

- **Where do I download the ZIP?** It's inside the Lovable project at `scripts/data-mirror-output/gpk-data.zip` (8.4 MB, 134 files). You download it from the Lovable editor's file browser (details below).
- **Will this affect the Cloudflare image mirror?** No. The image mirror (`gpkonwaxbackup.pages.dev`) and the data mirror (`gpk-data.pages.dev`) are **two completely separate Cloudflare Pages projects**. They don't share files, settings, or anything else. Creating one does not touch the other.
- **Can I use the same Cloudflare account?** Yes. One account can host many Pages projects.
- **Can I have 2 public Pages projects?** Yes. Cloudflare's free plan allows unlimited public Pages projects. You already have one (the image mirror); this adds a second.

## What the data mirror is

A tiny static site (8.4 MB) containing:
- `manifests/gpk-topps-holders.json` — the holders list (14,255 accounts)
- `manifests/data-mirror-index.json` — an index of every file in the mirror
- `packs/` — 7 pack artwork images (Series 1, 2, Exotic, Megas)
- `puzzles/` — 124 puzzle piece images (OS2–OS5)
- `_headers` — a Cloudflare config file that allows cross-origin access (CORS)

The app uses this as the primary source for puzzle pieces and holders data, falling back to geepeekay.com if the mirror is unreachable.

## Step-by-step instructions (first-timer friendly)

### Step 1 — Download the ZIP from Lovable

1. In the Lovable editor, click the **file browser** icon (the folder icon in the left sidebar).
2. Navigate to: `scripts` → `data-mirror-output`.
3. You'll see `gpk-data.zip` (8.4 MB). Right-click it and choose **Download** (or click the download icon).
4. Save it somewhere easy to find, like your **Desktop** or **Downloads** folder.

### Step 2 — Unzip the file on your computer

1. Find `gpk-data.zip` where you saved it (Desktop or Downloads).
2. **Double-click** it to unzip (Windows) or right-click → **Extract All** (macOS: double-click).
3. This creates a folder called `gpk-data`.
4. Open that folder — you should see `_headers`, `manifests/`, `packs/`, and `puzzles/` at the top level. **If you see a nested `gpk-data/gpk-data/` folder, open the inner one** — you want `_headers` at the top level.

### Step 3 — Go to Cloudflare and create a new Pages project

1. Go to **[dash.cloudflare.com](https://dash.cloudflare.com)** and log into your existing account (the same one you used for the image mirror).
2. In the left sidebar, click **Workers & Pages** (under "Compute").
3. Click the **Create** button (top right) or **Create application**.
4. Choose **Pages** (not Workers).
5. Choose **Upload assets** (not "Connect to Git").
6. In the project name field, type: **`gpk-data`**
   - This determines the URL: `https://gpk-data.pages.dev`
   - If that name is taken, Cloudflare will add a random suffix — that's fine, just tell me the actual URL later.
7. Click **Create project**.

### Step 4 — Upload the files

1. You'll see a "Drop your files here" area.
2. **Drag the CONTENTS of the `gpk-data` folder** (not the folder itself) into this area.
   - You should be dragging `_headers`, `manifests/`, `packs/`, and `puzzles/`.
   - **Important**: `_headers` must be at the root (top level), NOT inside a subfolder.
3. Wait for all files to upload (134 files, ~8.4 MB — should take a few seconds).
4. Click **Deploy site** or **Save and Deploy**.

### Step 5 — Confirm the deployment

1. Cloudflare will show a "Success" screen with your new URL: `https://gpk-data.pages.dev`
2. Click the URL to open it in a new tab. You should see a directory listing or a 404 (that's normal — there's no `index.html`).
3. Test a real file: add `manifests/data-mirror-index.json` to the URL:
   `https://gpk-data.pages.dev/manifests/data-mirror-index.json` — you should see JSON text.
4. Test CORS: the `_headers` file makes this work. If the JSON loads in your browser, CORS is active.

### Step 6 — Tell me the URL

1. Copy the full URL (including the trailing slash), e.g. `https://gpk-data.pages.dev/`.
2. Paste it in chat here.

## What happens after you paste the URL

Once you give me the `gpk-data.pages.dev` URL, I will:

1. **Wire it into the app**: Update `src/lib/dataMirror.ts` — set `DATA_MIRROR_URL` to your new URL so the app knows to use it.
2. **Verify the manifest**: Run the audit script against the new mirror to confirm all 134 files are present and correct sizes.
3. **Test in the browser**: Open the app, load the puzzle builder, and confirm puzzle pieces and holders data now load from the Cloudflare mirror.
4. **Update the BackupPanel**: Add a "Data mirror" health-check row showing the new Cloudflare Pages URL and its status (green = online, files verified).

## What NOT to do

- Do **not** drag the entire `gpk-data` **folder** into Cloudflare — drag its **contents**. If `_headers` ends up at `gpk-data/_headers` instead of `/_headers`, CORS won't work and the app will fail to fetch.
- Do **not** delete or touch the existing `gpkonwaxbackup.pages.dev` project — that's the image mirror and is completely separate.
- Do **not** rename the files or folders inside the zip — the app expects exact paths like `manifests/gpk-topps-holders.json` and `puzzles/os2/piece-01.png`.
