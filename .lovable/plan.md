## Problem
The Offline Backup panel currently shows a big primary "Download backup ZIP" button and a smaller row of "alternate sources". Right now both are GitHub — the primary button is the direct GitHub Release asset, and the only alternate is the GitHub Release landing page. This is confusing because it looks like there are multiple independent sources when there is only one.

## Goal
Make the download UI honest and easy to understand until Backup A and Backup B mirrors are deployed.

## Changes
1. **Relabel the primary button**
   - Change text from `Download backup ZIP (1.2 GB)` to `Download from GitHub Release (1.2 GB)`.
   - Keep the direct asset URL (`https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/gpk-image-mirror.zip`).

2. **Remove misleading alternate-source row when no alternates exist**
   - In `src/components/BackupPanel.tsx`, only render the alternate-source row if at least one configured mirror other than `primary` exists.
   - While only the primary mirror is configured, show a small info line: "Backup A and Backup B download links will appear here once those mirrors are online."

3. **Keep the release landing page as a text fallback, not a second download button**
   - Replace the `GitHub Releases page` button with a subtle link: "Can't download directly? Open the release page".

4. **Future-proof the logic**
   - `getZipDownloadUrls()` in `src/lib/remoteMirror.ts` already iterates over all configured mirrors, so Backup A/B ZIP buttons will appear automatically once their URLs are set in `src/lib/ipfsGateways.ts`.

## Files to edit
- `src/components/BackupPanel.tsx` (button labels, conditional alternate row, fallback link)
- `src/lib/remoteMirror.ts` (minor: remove or reword the hardcoded GitHub release landing-page entry so it doesn't duplicate the primary source)

## Out of scope
- No changes to mirror fetching logic, hash verification, or ZIP ingestion.
- No new mirrors are being deployed in this plan.