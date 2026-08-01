# Backup A (Netlify) — verified healthy, no fix needed

## What the 404 actually was

The image links I gave you earlier used a filename that does not exist in the snapshot (`1lg.jpg`). The real files are named `1a.jpg`, `1.jpg`, etc. Nothing is missing from Netlify.

Verified live right now:

- `https://gpkonwaxbackup.netlify.app/manifests/manifest.json` — 200
- `https://gpkonwaxbackup.netlify.app/manifests/gpk-topps-holders.json` — 200
- `https://gpkonwaxbackup.netlify.app/atomic/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg` — 200
- `https://gpkonwaxbackup.netlify.app/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg` — 200

Both the `atomic/`-prefixed path (what the manifest records) and the bare CID path resolve, so the app's mirror lookups will hit correctly either way.

## Working image links you can open in a browser

```text
https://gpkonwaxbackup.netlify.app/atomic/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg
https://gpkonwaxbackup.netlify.app/atomic/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/back/1.jpg
```

## Next step (optional, run locally)

To confirm every single file in the manifests exists byte-for-byte on all three mirrors:

```powershell
cd C:\Users\User\Desktop\gpk-app-latest2
node scripts/audit-mirrors.mjs
```

It HEAD-checks each manifest entry against Primary (GitHub), Backup A (Netlify) and Backup B (Cloudflare) and prints any file that is missing or the wrong size. Cloudflare is expected to report the oversized images that could not be uploaded there.

## Code changes

None required. The mirror is correctly laid out and the app is already wired to it.
