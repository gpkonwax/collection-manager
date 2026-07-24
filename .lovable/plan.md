## Goal
Swap Backup B from the (abandoned) GitLab Pages URL to the live Netlify mirror at `https://gpkonwaxbackup.netlify.app/`, and relabel it everywhere the user sees "GitLab" so the indicator, tooltip, and backup panel match reality.

## Verified current state
- `src/lib/ipfsGateways.ts` line 29: `BACKUP_MIRROR_B = 'https://bewbzz.gitlab.io/gpkonwaxbackup/mirror/'` — needs to change.
- `src/hooks/useImageSourceStatus.ts` already probes `BACKUP_MIRROR_B` via `${base}manifest.json` — no logic change needed, just the constant.
- `src/components/ImageSourceIndicator.tsx` line 61 hardcodes the label `Backup B (GitLab Pages)` — needs relabel.
- `SOURCE_LABELS.backupB = 'Backup B'` is generic, safe to leave.
- `BACKUP_MIRROR_B` is also consumed by `src/lib/remoteMirror.ts` (for hash-verified image fallback and mirror listing in the Backup Panel) — the URL change flows through automatically.

## Changes

### 1. `src/lib/ipfsGateways.ts`
Replace the `BACKUP_MIRROR_B` constant and update the comment above it.
```ts
// Backup mirror A is Cloudflare Pages; backup mirror B is Netlify.
export const BACKUP_MIRROR_B = 'https://gpkonwaxbackup.netlify.app/';
```

### 2. `src/components/ImageSourceIndicator.tsx`
Change the tooltip row label from `Backup B (GitLab Pages)` to `Backup B (Netlify)`.

### 3. `src/components/BackupPanel.tsx`
Any user-facing string that says "GitLab" (mirror list, verify labels, download source names) becomes "Netlify". No structural changes — just text.

### 4. `src/lib/remoteMirror.ts`
If the mirror registry / labels array references "GitLab" for Backup B, rename to "Netlify". URL is picked up automatically from `BACKUP_MIRROR_B`.

### 5. `src/hooks/useImageSourceStatus.ts`
No code change required. The doc comment on line 10 (`Backup B (GitLab Pages)`) gets updated to `Backup B (Netlify)` for accuracy.

### 6. Verification (post-build)
- Confirm `https://gpkonwaxbackup.netlify.app/manifest.json` returns JSON (in-browser sanity check).
- In the app, open the header pill tooltip and confirm the third mirror row reads "Backup B (Netlify)" and shows "Reachable".
- Open the Offline Backup panel and confirm Netlify appears in the mirror list.
- Trigger a "Recheck now" and confirm no console errors.

## What is intentionally NOT changing
- Primary mirror (GitHub Pages) and Backup A (Cloudflare) — untouched.
- Fallback ordering — IPFS → GitHub → Cloudflare → Netlify → Local ZIP stays as-is.
- ZIP part download URLs — those still come from the GitHub Release; Netlify is images-only for now (matches how you deployed it).
- No changes to `.gitlab-ci.yml`, `scripts/`, or any GitLab-specific tooling — those files are inert now and can be deleted later if you want, but leaving them costs nothing.

## Open question
Do you want me to also **delete** the leftover GitLab plan file (`.lovable/plan.md` currently describes the GitLab deploy) and the mention of GitLab in any README/scripts, or leave them as historical notes? Default: leave them alone unless you say otherwise.
