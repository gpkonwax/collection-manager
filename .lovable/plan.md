# Separate data mirror for the holders manifest

Confirmed: `manifests/gpk-topps-holders.json` currently returns 404 on all three image mirrors (GitHub Pages, Netlify, Cloudflare Pages), so the View Wallet holders dropdown has nothing to load from.

Yes — a brand new, tiny Netlify site is the right move. It holds only small JSON manifests, so you never touch or re-upload the multi-GB image mirror.

## What you do on Netlify (one time, ~3 minutes)

1. Make a folder on your computer, e.g. `gpk-data`.
2. Inside it create a folder `manifests` and drop `gpk-topps-holders.json` in there.
3. Inside `gpk-data` (top level, next to `manifests`) create a plain text file named `_headers` with:
   ```text
   /*
     Access-Control-Allow-Origin: *
     Cache-Control: public, max-age=300
   ```
   (This is the same CORS fix we used for the image mirror — without it the browser blocks the fetch.)
4. Netlify dashboard > Add new site > Deploy manually > drag the whole `gpk-data` folder in.
5. Rename the site to something memorable (Site settings > Change site name), then send me the final URL.

Future updates are a re-drag of the same folder — seconds, not gigabytes.

## What I change in the app

- Add a `DATA_MIRRORS` list in `src/lib/ipfsGateways.ts` / `src/lib/remoteMirror.ts`: the new Netlify data site first, then the existing three image mirrors as fallbacks (so if you ever do add the file to the big mirror, it still works).
- Update `src/lib/gpkHolders.ts` to race `DATA_MIRRORS` instead of `MIRRORS`, keeping the existing `not-published` vs `network` error distinction.
- Update the Backup panel's mirror status section to also probe the data mirror, labelled "Data mirror (manifests)", so you can see at a glance whether the holders snapshot is live.
- Update `scripts/README.md` / `build-holders-manifest.mjs` header comment to describe the new publish target.

## Technical notes

- Data mirror is manifest-only (JSON), no hash pinning needed — holders data is public, non-critical, and re-derivable from chain.
- Fetch keeps `cache: 'no-store'` plus the 8s timeout; Netlify's 5-minute cache header handles repeat loads.
- No change to the image mirror pipeline, the pinned manifest, or the offline ZIP bundles.

Once you give me the Netlify site URL I'll wire it in.
