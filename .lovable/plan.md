
# ZIP-based image backup — one-time snapshot, `gpkonwaxbackup` repo

The GPK/Topps collection is **frozen** — no new cards, packs, variants, or puzzle pieces will ever be added. The mirror is a **one-time snapshot**. No update workflow, no cron, no republishing. Build once, done forever.

Fallback URL will be hardcoded as `https://gpkonwaxbackup.github.io/gpk-backup/mirror/`.

## Repo layout

**Main repo (this one, your access only)**
- `scripts/build-image-mirror.mjs` — enumerator + fetcher + zipper, driven by the same TS constants the app uses (`SERIES_HASH`, `GIF_VARIANTS`, pack art, puzzle IDs). Resumable across runs (skips files already on disk).
- `scripts/verify-mirror.mjs` — sha256 check of a local folder against `manifest.json`.
- `scripts/verify-remote-mirror.mjs` — same check against any base URL.
- `scripts/README.md` — instructions for verifying / re-publishing in the "if I'm gone" case.
- Script tests: `scripts/__tests__/build-mirror.test.mjs`, `scripts/__tests__/verify-mirror.test.mjs` (both use a local `http.createServer` mock — no real network).

**Backup repo `gpkonwaxbackup/gpk-backup` (new, public, small collaborator list)**
- `mirror/` — flat folder mirroring IPFS paths exactly (`<hash>/<variant>/<id><q>.<ext>`).
- `manifest.json` — sha256 per file. Frozen after the initial snapshot.
- `gpk-image-mirror.zip` — the same folder zipped, attached as a GitHub Release for direct download.
- `scripts/` — copies of the verify scripts so anyone can independently confirm integrity.
- `README.md` — what this repo is, and how a collaborator would republish it elsewhere if GitHub dies.
- GitHub Pages enabled on `main` → serves `mirror/` at `https://gpkonwaxbackup.github.io/gpk-backup/mirror/`.

Collaborators never need to update anything. They exist purely as a survivability net: if the account or Pages goes away, any collaborator can fork the repo (or hold the ZIP) and re-serve the same content at a new URL that gets pasted into the app's Community mirror URL field.

## In-app integration

Three layers, checked in this order at load time:

1. **Local ZIP (any user, no repo access needed).** In-app "Load offline image backup (.zip)" button ingests the ZIP client-side via `fflate` into an in-memory blob map, optionally persisted to IndexedDB. `useIpfsMedia` checks this first — hits are instant and fully offline.
2. **`gpkonwaxbackup` GitHub Pages mirror (default, everyone, zero user action).** Hardcoded as the **last** entry in `IPFS_GATEWAYS`. Because the folder mirrors IPFS paths exactly, the existing rotation just falls through to it when public IPFS gateways fail.
3. **Community mirror URL (optional per-user).** Small settings field to paste an additional base URL from another trusted host, appended to `IPFS_GATEWAYS` for that user's session. Includes a trust warning.

Mirror URLs are excluded from the parallel gateway race (still only race the first 3 public gateways), so mirrors stay true fallbacks and don't waste bandwidth.

## The "you're gone" scenario, end to end

1. IPFS gateways start failing.
2. App automatically falls through to `gpkonwaxbackup.github.io/gpk-backup/mirror/` — every user is fine, no action required.
3. If GitHub itself ever fails, any ZIP holder drops the ZIP into the in-app loader → works offline.
4. If a collaborator wants a second host for redundancy, they publish `mirror/` to Cloudflare Pages / IPFS pin / anywhere free — other users paste that URL into Community mirror URL.

No update workflow ever needs to run again. No single point of failure. Nothing hosted by Lovable. Nothing paid.

## Trust / verification

- `manifest.json` lists sha256 for every file, generated once and never changed.
- `verify-mirror.mjs` checks a local folder against it.
- `verify-remote-mirror.mjs` walks any base URL and verifies against a `manifest.json` at that URL — so before pasting a stranger's community URL, a user can confirm it matches the canonical sha256s.

## What ships in this repo (main)

Scripts:
- `scripts/build-image-mirror.mjs`
- `scripts/verify-mirror.mjs`
- `scripts/verify-remote-mirror.mjs`
- `scripts/README.md`
- `scripts/__tests__/*`

App code:
- `src/lib/localMirror.ts` — in-memory blob map, ZIP ingest (`fflate`), optional IndexedDB persistence, `resolveLocalMirror(hash, pathTail)` helper.
- `src/components/BackupPanel.tsx` — Load ZIP button, "Remember on this device" toggle, Clear, Community mirror URL input, status pill, one-line trust warning.
- Footer entry point ("Offline backup") to open the panel.
- `src/lib/ipfsGateways.ts` — append `https://gpkonwaxbackup.github.io/gpk-backup/mirror/` to `IPFS_GATEWAYS`; read optional community URL from `localStorage` and append after it; exclude both from the parallel race.
- `src/hooks/useIpfsMedia.ts` — ~10 lines: local blob first (returns a `blob:` URL, marks `hasLoadedRef.current = true`, skips timers), then existing rotation.

Dependencies:
- Runtime: `fflate` (~10 KB, unzip in browser).
- Runtime (only if persistence enabled): `idb-keyval`.
- Dev/script only: `jszip`.

Total in-app footprint stays small and presentation-only. No Lovable Cloud, no bucket, no edge function, no bill.

## Testability — every scenario verifiable without real IPFS

Fixture: `src/test/fixtures/mirror-tiny.zip` (~20 KB, 5 fake images with known sha256s).

Unit / integration:
- `src/lib/localMirror.test.ts` — ingest fixture ZIP, assert blob map + `resolveLocalMirror` return correct `blob:` URL. Test IndexedDB persistence + restore.
- `src/lib/ipfsGateways.test.ts` — assert backup URL always appended last, community URL appended after it, both excluded from race list.
- `scripts/__tests__/build-mirror.test.mjs` — run script against local mock HTTP server, assert output + manifest match; delete half the files and re-run to verify resumability.
- `scripts/__tests__/verify-mirror.test.mjs` — corrupt one file, assert script exits non-zero and names it. Same for remote variant using `http.createServer`.

End-to-end (Playwright with `page.route()` interception, no real network):
- **A — happy path:** allow gateway #1. Image loads from Pinata, backup URL never requested.
- **B — first gateway dead:** abort gateway #1. Rotation lands on #2, backup untouched.
- **C — all public gateways dead:** abort every public gateway. Request eventually hits `gpkonwaxbackup.github.io/gpk-backup/mirror/...` and image renders.
- **D — everything dead + local ZIP:** abort everything, load fixture ZIP via BackupPanel, assert image resolves from blob map with zero network attempts.
- **E — community mirror:** paste fake URL, block everything else, assert requests go there and remote-verify catches a tampered file.

Each scenario asserted via screenshot + a temporary `window.__ipfsDebug` counter (test-only) so we can prove exactly which layer served each image.

## Defaults I'll use unless you say otherwise

- **Persistence for the in-app ZIP loader:** off (session-only), with opt-in "Remember on this device" checkbox.
- **Community mirror URL field:** included from day one, empty preseed.
- **Footer placement:** small "Offline backup" link.

## Recommended execution order

1. **I build the plan** (scripts + in-app code + tests) with the URL hardcoded to `https://gpkonwaxbackup.github.io/gpk-backup/mirror/`.
2. **All tests pass** using fixtures and mock servers — no real IPFS needed to prove the mechanism works.
3. **You run `build-image-mirror.mjs` locally** — hours over IPFS, resumable, produces `./mirror-output/` + `manifest.json`.
4. **You run `verify-mirror.mjs`** against the output and eyeball a few files.
5. **You create `github.com/gpkonwaxbackup/gpk-backup`**, push `mirror/` + `manifest.json` + `scripts/` + `README.md`, attach the ZIP to a Release, enable Pages on `/mirror`.
6. **You add trusted collaborators** to the new repo.
7. Done. Never touched again.

Ready to build on your go.
