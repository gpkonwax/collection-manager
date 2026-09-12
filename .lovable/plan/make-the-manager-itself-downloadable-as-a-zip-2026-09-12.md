# Make the manager itself downloadable as a ZIP

## Where things already stand

The offline copy of the app is mostly built already:

- The "Offline backup" panel already shows a "Run the manager itself offline" box with a Download button.
- That button points at the GitHub release file `gpk-collection-manager-offline.zip`.
- A build command (`npm run build:offline`) already produces that ZIP, including a friendly `open-me.html` and a plain-English README, and the app already switches to an offline-friendly mode when opened that way (offline banner, links that work from a local folder).

The one thing missing is the part that actually matters: **nothing ever builds and publishes that ZIP**. Today it has to be produced by hand on a computer and dragged onto the GitHub release. So the download button in the app currently points at a file that may not exist.

## What this plan does

1. **Publish the ZIP automatically.** Add a GitHub workflow that builds the offline copy and attaches it to the backup release whenever it is triggered (manually, or when a new release is cut). After that, the download button always serves the newest version with no manual steps.
2. **Stamp the ZIP with a build date.** Write a small `version.txt` (date + commit) into the ZIP and show the same date inside the offline copy so anyone can tell how old their copy is.
3. **Make the download button honest.** Before showing it, quietly check whether the file exists on GitHub. If it does, show its size and build date next to the button. If it does not, show a short "not published yet" note with a link to the release page instead of a dead download.
4. **Tidy the release checklist.** Update the existing notes so they describe the automatic route, keeping the manual command as a fallback.

## What the user sees

In the Offline backup menu, the "Run the manager itself offline" box gains a line like:

```text
Download the offline app  (18.4 MB — built 12 Sep 2026)
```

and, inside a downloaded copy, the existing offline banner also states the build date.

## Technical notes

- New `.github/workflows/offline-bundle.yml`: `workflow_dispatch` + `release: published`; bun install, `bun run build:offline`, upload `dist-offline/gpk-collection-manager-offline.zip` as a release asset via `softprops/action-gh-release` (or `gh release upload`) against the latest release tag in `bewbzz/gpkonwaxbackup`. Needs a repo-scoped token secret since the asset lives in the backup repo, not this one.
- `scripts/build-offline-bundle.mjs`: also emit `version.txt` and inject `VITE_OFFLINE_BUILD_DATE` / `VITE_OFFLINE_COMMIT` at build time; log final size.
- `src/lib/offlineBundle.ts`: export `getOfflineBuildInfo()` reading those env constants; `OfflineBundleBanner.tsx` renders the date when present.
- `src/components/BackupPanel.tsx` `OfflineAppCard`: on mount, `fetch(OFFLINE_APP_RELEASE_ASSET_URL, { method: 'HEAD' })` (follows the `latest/download` redirect) to read `content-length`; states = checking / available (size) / unavailable (fallback link to `ZIP_GITHUB_RELEASE_URL`). Failures degrade to the current always-on button rather than hiding it.
- Update `.lovable/plan-offline-bundle.md` and `scripts/README.md` to describe the workflow-driven release.
