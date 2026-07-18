# Deploy Primary Mirror (GitHub Pages) — updated for `bewbzz/gpkonwaxbackup`

Repo is now: https://github.com/bewbzz/gpkonwaxbackup
Live URL will be: `https://bewbzz.github.io/gpkonwaxbackup/mirror/`

The app currently hardcodes the **old** URL (`https://gpkonwaxbackup.github.io/gpk-backup/mirror/`) in two places:
- `src/lib/ipfsGateways.ts` → `PRIMARY_MIRROR`
- `src/lib/remoteMirror.ts` → `ZIP_GITHUB_RELEASE_URL`

I'll update both to the new owner/repo as part of this plan.

---

## Phase 0 — Code update (I do this in build mode)

1. `PRIMARY_MIRROR = 'https://bewbzz.github.io/gpkonwaxbackup/mirror/'`
2. `ZIP_GITHUB_RELEASE_URL = 'https://github.com/bewbzz/gpkonwaxbackup/releases/latest'`
3. Update the same URLs in `scripts/README.md` for consistency.

No behavior changes — just the strings.

## Phase 1 — Confirm the repo is ready (you, browser)

1. Open https://github.com/bewbzz/gpkonwaxbackup
2. Confirm it is **Public** (Settings → General → Danger Zone shows "Change visibility" — should say currently Public). Free GitHub Pages requires public.
3. Leave it empty for now (no README needed — we'll push files in Phase 3).

## Phase 2 — Build the mirror locally (~30–90 min, resumable)

Runs on your computer, not in Lovable.

1. Get the app code locally: Lovable **Code editor → Download codebase**, unzip.
2. In a terminal inside that folder:
   ```
   npm install
   node scripts/build-image-mirror.mjs
   ```
3. If IPFS stalls, Ctrl+C and re-run — it resumes.
4. Result:
   ```
   mirror-output/
     <hash>/<variant>/<id><side>.<ext>   ← all images
     manifest.json                        ← SHA-256 of every file
     gpk-image-mirror.zip                 ← whole folder zipped
   ```
5. Verify:
   ```
   node scripts/verify-mirror.mjs
   ```
   Must report 0 missing / 0 corrupted.

## Phase 3 — Push `mirror-output/` to the repo as `/mirror`

We push only the built mirror — no app source code.

1. Fresh folder outside the app:
   ```
   mkdir ~/gpk-backup-repo && cd ~/gpk-backup-repo
   git init
   mkdir mirror
   cp -r /path/to/app/mirror-output/* mirror/
   ```
   You should see `mirror/manifest.json`, `mirror/gpk-image-mirror.zip`, and all the hash folders.
2. Push (use a fine-grained Personal Access Token as the password):
   ```
   git remote add origin https://github.com/bewbzz/gpkonwaxbackup.git
   git branch -M main
   git add .
   git commit -m "Initial image mirror snapshot"
   git push -u origin main
   ```
   Create the token at GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → **Repository access: only `bewbzz/gpkonwaxbackup`**, **Permissions → Contents: Read and write**.

## Phase 4 — Enable GitHub Pages

1. Repo → **Settings → Pages**.
2. Source: **Deploy from a branch**. Branch: **main**. Folder: **/ (root)**. Save.
3. Wait ~1 min. Page shows: *"Your site is live at https://bewbzz.github.io/gpkonwaxbackup/"*.
4. Verify these three URLs load in a browser:
   - `https://bewbzz.github.io/gpkonwaxbackup/mirror/manifest.json`
   - `https://bewbzz.github.io/gpkonwaxbackup/mirror/gpk-image-mirror.zip`
   - Any hash from the manifest, e.g. `https://bewbzz.github.io/gpkonwaxbackup/mirror/<hash>/base/1a.jpg`

## Phase 5 — Optional: attach the ZIP to a GitHub Release

Bonus fallback (the app already links to `/releases/latest`).
1. Repo → **Releases → Draft a new release**. Tag: `v1.0.0`. Title: `Initial mirror snapshot`.
2. Drag `mirror/gpk-image-mirror.zip` into the assets area. Publish.

---

## Done signal

Reply **"primary mirror live"** once Phase 4's three URLs load. Then we move on to Backup A (Cloudflare Pages).
