# Fix the Netlify ZIP downloads

Right now the offline backup panel lists Netlify as a ZIP download source and links to
`gpk-image-mirror-part-001/002/003.zip` on `gpkonwaxbackup.netlify.app`. Those three
files are not there (all return 404), so anyone who picks Netlify gets a dead download.
GitHub Releases is the only place that actually has the new ZIP parts, and the audit
confirmed all three match size and hash there.

There are two ways to fix it. I recommend Option A.

## Option A (recommended): stop advertising ZIPs on Netlify

Change only the app code so the ZIP download section offers the GitHub Releases parts
and does not offer a Netlify ZIP link at all. Netlify stays exactly as it is today —
a complete image mirror, untouched, with no risk of wiping it.

Why this is the better choice:

- The ZIP parts are 1.8 GB, 1.8 GB and 0.9 GB (4.4 GB total). Netlify's free tier gives
  100 GB of bandwidth per month; about 22 full downloads would exhaust it and the site
  would be throttled or suspended — taking the image mirror down with it.
- Every Netlify upload is a whole-site replacement, so re-uploading means re-uploading
  all 2,575 images plus 4.4 GB of ZIPs in one go. That's the exact operation that
  erased the mirror last time.
- GitHub Releases has no bandwidth cap for public repos and is purpose-built for large
  binary assets.

What changes in the panel:

- ZIP download source list shows: **GitHub Releases (primary)** with the three parts.
- Netlify and Cloudflare are still shown as *image mirror* sources (that's what they
  are), but no longer as ZIP download sources.
- A short note explains the big archives live on GitHub Releases.

## Option B: actually put the ZIPs on Netlify

Only worth doing if you want a second ZIP host despite the bandwidth risk. It requires:

1. Assemble a full `mirror-upload` folder containing everything currently live
   (`atomic/`, all CID folders, `manifest.json`, `_headers`) **plus** the three ZIP parts.
2. Deploy that whole folder with the Netlify CLI (`netlify deploy --prod --dir=mirror-upload`).
   Browser drag-and-drop will not handle 4.4 GB reliably.
3. Re-run `scripts/audit-mirrors.mjs` to confirm images and ZIP parts both resolve.

I'd hold off on this until there's a clear need for a second ZIP host.

## Technical details (Option A)

- `src/lib/remoteMirror.ts` → `getZipDownloadUrls()`: currently skips only `backupB`
  (Cloudflare) and builds `${m.url}${part.fileName}` for every other mirror. Change it
  to emit ZIP parts for the `primary` key only, pointing at
  `ZIP_GITHUB_RELEASE_DOWNLOAD_BASE`, and skip `backupA` (Netlify) the same way
  Cloudflare is skipped. Update the doc comment above the function so the reasoning
  (bandwidth cap + whole-site-replacement risk) is recorded.
- `src/components/BackupPanel.tsx`: the ZIP source list is driven by
  `getZipDownloadUrls()`, so it collapses to the GitHub option automatically. Add a
  one-line caption clarifying that the image mirrors (Netlify/Cloudflare) serve
  individual images, while the full archives come from GitHub Releases.
- No change to the image-mirror probing (`useImageSourceStatus.ts`) — Netlify and
  Cloudflare remain live image sources.
- No change to `public/gpk-manifest.json`; the `zipParts` metadata (hashes, sizes,
  file counts) stays as the source of truth for verification.
