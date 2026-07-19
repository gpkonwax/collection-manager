# Deploy the Primary Mirror (GitHub Pages) — resume this after the build errors are fixed

Repo: https://github.com/bewbzz/gpkonwaxbackup
Live URL will be: `https://bewbzz.github.io/gpkonwaxbackup/mirror/`

Once `node scripts/build-image-mirror.mjs` finishes with a small error count and `node scripts/verify-mirror.mjs` reports `0 corrupted`, pick up here.

---

## Phase 7 — Create a fresh folder for the backup repo

We do not upload the whole app. Only the mirror.

1. Create a new empty folder somewhere easy, e.g. `C:\Users\User\Desktop\gpk-backup-repo`.

## Phase 8 — Copy the built mirror into that folder

1. Open `C:\Users\User\Desktop\gpk-app\scripts\mirror-output\`.
2. Select everything inside it (`manifest.json`, `gpk-image-mirror.zip`, and all the long-hash folders).
3. Copy.
4. In `gpk-backup-repo`, create a subfolder called `mirror`.
5. Paste the files into `gpk-backup-repo\mirror\`.

Final layout:
```
gpk-backup-repo/
  mirror/
    manifest.json
    gpk-image-mirror.zip
    QmSRti2HK95NX.../ ...
    QmcAkyEvUNgc6.../ ...
    QmYkMDkB1d8To.../ ...
```

## Phase 9 — Create a GitHub Personal Access Token

1. Sign into GitHub as **bewbzz**.
2. Go to https://github.com/settings/tokens?type=beta
3. **Generate new token**.
4. Name: `gpk backup upload`. Expiration: as long as GitHub allows.
5. **Repository access → Only select repositories → `bewbzz/gpkonwaxbackup`**.
6. **Permissions → Repository permissions → Contents = Read and write**.
7. **Generate token** and copy the string into a temporary text file. You cannot view it again.

## Phase 10 — Push to GitHub

Open a terminal in `gpk-backup-repo`:

```
git init
git add .
git commit -m "Initial image mirror snapshot"
git branch -M main
git remote add origin https://github.com/bewbzz/gpkonwaxbackup.git
git push -u origin main
```

When prompted:
- Username: `bewbzz`
- Password: paste the token from Phase 9. (Cursor doesn't move while pasting — normal.)

## Phase 11 — Turn on GitHub Pages

1. Open https://github.com/bewbzz/gpkonwaxbackup/settings/pages
2. Source: **Deploy from a branch**. Branch: **main**. Folder: **/ (root)**. Save.
3. Wait ~1 min. The page will show *"Your site is live at https://bewbzz.github.io/gpkonwaxbackup/"*.

## Phase 12 — Test the three URLs

All three should load without error:

- https://bewbzz.github.io/gpkonwaxbackup/mirror/manifest.json
- https://bewbzz.github.io/gpkonwaxbackup/mirror/gpk-image-mirror.zip (downloads the ZIP)
- https://bewbzz.github.io/gpkonwaxbackup/mirror/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg (any known-good file from the manifest)

## Phase 13 — Optional: attach the ZIP to a Release

1. https://github.com/bewbzz/gpkonwaxbackup/releases → **Draft a new release**.
2. Tag: `v1.0.0`. Title: `Initial mirror snapshot`.
3. Drag `gpk-image-mirror.zip` from `gpk-backup-repo/mirror/` into the assets box. Publish.

## Done signal

Reply **"primary mirror live"** once Phase 12's three URLs all load. Then we set up Backup A (Cloudflare Pages) and Backup B (GitLab Pages).
