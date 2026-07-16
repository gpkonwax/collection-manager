# Plan: Make the offline ZIP durable and proactively recommended

## Why

Right now the ZIP download only points at GitHub Releases. If GitHub disappears — the exact scenario the mirrors exist for — the ZIP disappears with it. And users only think to grab it when images already stopped loading, which is too late. Fix both.

## What changes

### 1. Host the ZIP on all three mirrors, not just GitHub Releases

Place `gpk-image-mirror.zip` inside the `mirror/` folder itself, so it deploys alongside the images to every host:

- Primary (GitHub Pages): `…/mirror/gpk-image-mirror.zip`
- Backup A (Cloudflare Pages): `…/gpk-image-mirror.zip`
- Backup B (GitLab Pages): `…/gpk-image-mirror.zip`

If any one host survives, the ZIP is reachable. GitHub Release stays as a fourth link — bonus, not sole source.

### 2. Hash-verify the downloaded ZIP

Add `zipSha256` and `zipBytes` fields to the pinned `gpk-manifest.json` at build time. The BackupPanel shows the expected SHA-256 next to the download links, and (nice-to-have) auto-verifies the file when the user then loads it via "Load backup ZIP" — same "trust the math, not the host" story as the image mirrors.

### 3. Proactively recommend the download — strong but polite

Two nudges, both dismissible, never blocking:

**a. First-visit banner** (thin bar under the header, once per device):
> "Tip: download the offline backup ZIP now while everything's working — it's your safety net if all mirrors ever go down." `[Download ZIP]` `[Maybe later]` `[×]`

Dismissal is remembered in localStorage. Auto-hides forever once the user either downloads or loads a ZIP with the "Remember on this device" toggle on.

**b. Prominent card at the top of the BackupPanel dialog**, above Step 1:
> "**Recommended: keep a copy on your device**
> The ZIP is ~[size] and works fully offline. Grab it from any of the three mirrors below — all hashes are checked against the pinned manifest."
> `[Download from Primary]` `[Download from Backup A]` `[Download from Backup B]`
> Small text: `SHA-256: abc123…`

Once a verified ZIP is loaded and persisted, this card collapses to a green "You're protected — offline backup loaded ([N] files, [size])" line.

### 4. Copy tone

Reassuring, not alarmist. No red warnings, no "you must do this now." Uses the cheese/muted palette, not `destructive`. Phrases like "safety net", "recommended", "while everything's working" — not "act now" or "before it's too late".

## Files to touch

- `scripts/build-image-mirror.mjs` — place `gpk-image-mirror.zip` inside `mirror/`; write `zipSha256` and `zipBytes` into `manifest.json`; keep copying it to `public/gpk-manifest.json`.
- `scripts/README.md` — update deploy instructions: the ZIP ships inside `mirror/` and is served by all three hosts automatically.
- `src/lib/remoteMirror.ts` — expose `getZipDownloadUrls()` returning `{ primary, backupA, backupB }` and `getZipManifest()` returning `{ sha256, bytes }` from the pinned manifest.
- `src/components/BackupPanel.tsx` — add the "Recommended" card at the top with three download links + hash; collapse it when a persisted ZIP is loaded.
- `src/components/BackupNudgeBanner.tsx` — new dismissible banner shown under the header on first visit; hidden after download, persisted-ZIP load, or explicit dismiss.
- `src/pages/Index.tsx` — mount the banner just under the header.
- `src/lib/localMirror.ts` — (small) add a `hasPersistedMirror()` helper the banner and card can subscribe to so they auto-hide once the user is protected.
- `src/lib/remoteMirror.test.ts` — cover ZIP URL/hash lookup.

## Out of scope

- No changes to image-loading logic, IPFS rotation, or the 3-step mirror fallback shipped last turn.
- No backend, no analytics, no forced download.

## Acceptance criteria

- The ZIP is downloadable from all three mirror hosts, not just GitHub.
- BackupPanel shows three download buttons + the expected SHA-256.
- A polite, dismissible banner recommends downloading on first visit and disappears once the user is protected or dismisses it.
- Manifest build step emits `zipSha256` and `zipBytes`, and tests pass.
- No alarmist copy or red styling anywhere in the nudge.

## After the plan lands

You run the mirror builder once, then deploy the same `mirror/` folder (now containing the ZIP) to GitHub Pages, Cloudflare Pages, and GitLab Pages. I then swap the placeholder URLs in `src/lib/ipfsGateways.ts` for your real ones in a small follow-up.
