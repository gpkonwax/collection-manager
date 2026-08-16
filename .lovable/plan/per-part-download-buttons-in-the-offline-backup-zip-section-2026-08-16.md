# Per-part download buttons in the offline backup ZIP section

Replace the single large yellow "Start download: Part 1 of 3" launcher with one download button per ZIP part, listed inline.

## What changes

In the "Recommended: keep a copy on your device" card:

- Remove the big yellow "Download ZIP parts from GitHub" button that reveals the launcher panel, and remove the launcher's "Start download / Start next download: Part N of 3" button plus the "wait until Part N finishes" wording.
- Show the three parts directly (no reveal step), each row as:
  `Part 1 — 1.76 GB   [Download]`
  where the Download button links straight to that part's GitHub release asset URL.
- Keep the started/✓ state per part: clicking a part's button marks it green with a "(started)" tick, and the `N/3 started` counter stays.
- Keep the short note that each part must be downloaded separately, and the "Keep all files together before loading them in Step 3" message once all parts are started.
- Keep the source selector (GitHub / other mirrors) and the "Open the release page" fallback link unchanged.
- Single-file (non-split) sources keep their existing single Download button.

## Technical notes

- File: `src/components/BackupPanel.tsx`, `RecommendedZipCard`.
- Drop `showDownloadLauncher` state and `nextPart` / `startNextPartDownload` sequential logic; each part row renders an anchor-style `Button asChild` pointing at `part.url` with `download={part.fileName}`, and an `onClick` calling `markPartStarted(part.fileName)`.
- URLs already come from `getZipDownloadUrls(zipInfo)` reading `zipParts` in `public/gpk-manifest.json`, which points at the GitHub release assets — no URL changes needed.
