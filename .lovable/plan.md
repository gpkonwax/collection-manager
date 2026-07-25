## Goal
Run a one-time audit that proves — file by file — which images live on each mirror (Primary/GitHub Pages, Backup A/Netlify, Backup B/Cloudflare) versus the canonical manifest, and produces a printable report listing any gaps (e.g. the >25 MiB files Cloudflare rejected).

## Source of truth
`public/gpk-manifest.json` (plus `atomic-manifest.json` if present). It already lists every path, byte size, and sha256 that the mirrors are supposed to serve.

## New script: `scripts/audit-mirrors.mjs`
A single Node script, no dependencies added.

Inputs (defaults hardcoded, overridable via flags):
- Primary  = `https://gpkonwaxbackup.github.io/gpk-backup/mirror/`
- Backup A = `https://gpkonwaxbackup.netlify.app/`
- Backup B = `https://gpkonwaxbackup.pages.dev/`
- Manifests = `public/gpk-manifest.json`, `public/atomic-manifest.json` (skipped if missing)

For each mirror × each manifest entry:
1. `HEAD <mirror>/<path>` with a 15s timeout and small concurrency (8).
2. Record: reachable? HTTP status, `content-length`, whether size matches manifest `bytes`.
3. For a `--sample N` subset (default 25 per mirror, deterministic every-Nth), do a full `GET`, sha256 the body, and compare to manifest hash.
4. Retry once on transient network errors before marking as missing.

Also audit the multi-part ZIPs listed in the manifest (`zipParts`) on Primary and Backup A with `HEAD` + size check (Cloudflare intentionally excluded).

## Output
Writes to `scripts/mirror-output/audit-report/`:
- `summary.txt` — per-mirror totals: checked / ok / wrong-size / missing / sha-mismatch, plus overall verdict.
- `missing-<mirror>.txt` — one path per line for every file not present or size-mismatched on that mirror. This is the actionable list (expected non-empty for Cloudflare due to the 25 MiB cap).
- `sha-mismatch-<mirror>.txt` — any sampled files whose bytes differ from the manifest hash.
- Console prints the summary at the end.

## How the user runs it
```
node scripts/audit-mirrors.mjs
# or, for a deeper spot-check:
node scripts/audit-mirrors.mjs --sample 200
```
No app changes, no deploys, no rebuilds. Just one command, one report.

## Follow-up (only if audit finds gaps)
- Cloudflare misses: use the existing `move-big-files.ps1` pattern to list the >25 MiB paths from `missing-cloudflare.txt` so the user knows exactly which files must live on Primary/Netlify only (and, if desired, we update `.assetsignore` accordingly).
- Primary/Netlify misses: re-upload just the paths from the corresponding `missing-*.txt`.

## Non-goals
- No changes to runtime app code, UI, or manifests.
- No automatic re-uploads — the audit only reports.
