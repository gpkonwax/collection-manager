# GPK image mirror — scripts

Scripts to build, verify, and publish a **one-time** snapshot of every GPK card
image (fronts + backs, every variant, every side) currently hosted on IPFS.

The GPK/Topps collection is frozen. Once you've built the mirror once, it never
needs to be rebuilt.

## Files

- **`mirror-config.json`** — enumeration of every series, variant, side, and card ID range to fetch. Edit this to change what gets mirrored.
- **`build-image-mirror.mjs`** — fetches every file, writes them to `./mirror-output/<hash>/<variant>/<id><side>.<ext>`, emits `manifest.json` with a sha256 per file, and zips the tree into `./mirror-output/gpk-image-mirror.zip` (inside the folder, so every mirror host serves it). The manifest also records `zipSha256` and `zipBytes` for the app to display. **Resumable** — re-running skips files already on disk with valid hashes, and won't retry entries recorded as missing.
- **`verify-mirror.mjs`** — checks every file in a local mirror folder against the manifest sha256s. Exits non-zero on missing / corrupted / extra files.
- **`verify-remote-mirror.mjs`** — same check, but against a live URL (e.g. someone's Cloudflare Pages fork).

## How to build the mirror (one-time)

```bash
# From the repo root:
node scripts/build-image-mirror.mjs
```

This will take a while (potentially hours). It's fully resumable — kill it and re-run any time.

Output:
- `./mirror-output/` — full folder tree
- `./mirror-output/manifest.json` — sha256 per file + `zipSha256`, `zipBytes`
- `./mirror-output/gpk-image-mirror.zip` — the whole folder, ready to serve from every host

Verify it:
```bash
node scripts/verify-mirror.mjs
```

## How to publish (to all three hosts)

Deploy the **same `mirror-output/` folder** to each of these — the app expects
the ZIP at `<baseUrl>gpk-image-mirror.zip` on every one:

1. **Primary (GitHub Pages):** push `mirror-output/` as `mirror/` in `bewbzz/gpkonwaxbackup`; Pages source = `main`, folder = `/mirror`. Serves at `https://bewbzz.github.io/gpkonwaxbackup/mirror/`.
2. **Backup A (Cloudflare Pages):** create a Pages project, drop `mirror-output/` in as the build output, deploy.
3. **Backup B (GitLab Pages):** same folder, `.gitlab-ci.yml` publishing `public/` = `mirror-output/`.

Update `PRIMARY_MIRROR`, `BACKUP_MIRROR_A`, `BACKUP_MIRROR_B` in `src/lib/ipfsGateways.ts` with the resulting base URLs (each must end with `/`).

A GitHub Release with the ZIP attached is still nice-to-have as a fourth
download source, but it is no longer the only place users can grab it.

## "If I'm gone" — how a collaborator republishes

If the primary account or GitHub Pages disappears, any collaborator (or anyone
holding the ZIP) can re-serve the same content elsewhere:

1. Get the mirror: either clone `bewbzz/gpkonwaxbackup` or unzip `gpk-image-mirror.zip`.
2. Verify it matches the canonical hashes: `node scripts/verify-mirror.mjs ./mirror`.
3. Publish `mirror/` anywhere that serves static files: GitHub Pages fork, Cloudflare Pages, Netlify, an S3 bucket, an IPFS pin (e.g. web3.storage), or a home HTTP server. No build step needed.
4. Share the base URL. Users paste it into the app's **Offline backup → Community mirror URL** field.
5. Anyone can double-check the alternate host: `node scripts/verify-remote-mirror.mjs https://your-host/mirror/ --manifest ./mirror/manifest.json`.

## For the backup repo `README.md`

Copy this into `bewbzz/gpkonwaxbackup/README.md`:

> # gpk-backup
>
> Frozen, verifiable mirror of every GPK card image hosted on IPFS. Served at
> <https://bewbzz.github.io/gpkonwaxbackup/mirror/> and packaged as a ZIP
> in the latest [Release](../../releases/latest).
>
> Every file's sha256 is recorded in `mirror/manifest.json`. Verify a local copy
> with `node scripts/verify-mirror.mjs ./mirror`. Verify a remote host with
> `node scripts/verify-remote-mirror.mjs https://host/base/ --manifest ./mirror/manifest.json`.
>
> This mirror never updates — the underlying collection is frozen.
