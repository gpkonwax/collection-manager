# Unify ZIP download flow across GitHub and Netlify

## The problem

Right now the "Recommended: keep a copy on your device" card has two very different flows:

- **GitHub (primary)** uses the step-by-step launcher: one button per part, tick list, "Start next download" — this works because browsers block multi-file auto-downloads on a single click.
- **Netlify / Cloudflare (backup alternates)** are just single `<a href>` buttons pointing at `${baseUrl}` (the mirror root). Clicking only starts one download (effectively "part 1" or the index), which is exactly the bug you're seeing.

Backup A on Netlify actually hosts all 3 parts (`gpk-image-mirror-part-001.zip`, `-002.zip`, `-003.zip`) and `getZipDownloadUrls` already returns a `parts[]` array for it — the UI just isn't using it.

## The fix

Reuse the exact same launcher UI for every mirror that has multiple parts, and let the user pick which mirror to download from.

### 1. Add a source selector to `RecommendedZipCard`

- Build the list of "downloadable sources" from `getZipDownloadUrls(zipInfo)`, keeping only options whose `parts.length >= 1`. Label each with its provider name (`GitHub Release`, `Netlify`, etc.) via the existing `getMirrorProviderName` helper.
- Add a small segmented toggle (shadcn `Tabs` or a row of small `Button` variants) above the main download button: `[ GitHub ] [ Netlify ]` (and later Cloudflare when it's excluded-list-safe). Default to GitHub (primary).
- Keep a `selectedSourceKey` piece of state. Reset `startedPartNames` and close/reset the launcher whenever the user switches source, so the tick-list reflects the new mirror.

### 2. Drive the launcher off the selected source, not just primary

- Replace the hard-coded `primaryOption` with `activeOption = options.find(o => o.key === selectedSourceKey) ?? primaryOption`.
- Rename local vars accordingly (`activeParts`, `activeTotal`, etc.). All existing launcher logic (`nextPart`, `startNextPartDownload`, tick list, "All parts started" message) stays identical.
- Button copy becomes source-aware: `Download from ${providerName}${sizeLabel}` for single-file, `Download ZIP parts from ${providerName} (~${size})` for multi-part.

### 3. Remove the now-redundant "If GitHub is down, try another source" row

The selector replaces it. Keep the fallback text ("Backup mirrors will appear here once online") only when there is exactly one available source.

Keep the "Open the release page" link at the bottom, but make it link to the currently selected source's release/mirror page when possible (GitHub → release page URL, Netlify → `${baseUrl}`).

### 4. No changes to backend / manifest / `remoteMirror.ts`

`getZipDownloadUrls` already returns properly-signed per-part URLs for GitHub and per-part URLs for Netlify (`${baseUrl}gpk-image-mirror-part-NNN.zip`). This is purely a UI rewire inside `src/components/BackupPanel.tsx`.

## Technical notes

- File touched: `src/components/BackupPanel.tsx` only.
- No new dependencies. Uses existing `Button`, `cn`, `formatBytes`, and the option shape already returned by `getZipDownloadUrls`.
- Behavior preserved: one click = one download, tick list, "wait then click again" copy — just now available for both mirrors.
- The Cloudflare (Backup B) option stays excluded from ZIP downloads (25 MiB per-file limit) via the existing logic in `remoteMirror.ts`; the selector only shows mirrors that actually have parts.
