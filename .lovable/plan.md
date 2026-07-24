## Backup B (Netlify) is fully live

All three ZIP parts respond on Netlify, and the manifest is already reachable. The app was wired to `https://gpkonwaxbackup.netlify.app/` in the previous step, so no further code changes are required.

### What's already in place
- `BACKUP_MIRROR_B` → `https://gpkonwaxbackup.netlify.app/` (in `src/lib/ipfsGateways.ts`)
- Header pill (`ImageSourceIndicator`) labels the third mirror as **Backup B (Netlify)**
- `remoteMirror.getZipDownloadUrls` auto-includes Netlify as a second ZIP source in the Offline Backup panel because parts 001–003 exist at the mirror root

### Verification steps (no code changes)
1. Hard-reload the Collection Manager (Ctrl+F5) to bust the manifest cache.
2. Confirm the header pill shows three green dots: IPFS, Backup A (Cloudflare), Backup B (Netlify).
3. Open the Offline Backup panel and confirm each of parts 1/2/3 now lists **two** download sources (GitHub Release + Netlify).

### If anything looks off
- Header pill red on Backup B → CORS or caching; re-check `https://gpkonwaxbackup.netlify.app/manifest.json` returns 200 with `application/json`.
- Only GitHub shown for ZIP parts → the runtime probe hasn't picked Netlify yet; reload once more.

No plan step requires editing files. Approve to switch to build mode only if you want me to run the in-app verification via the preview and confirm the three-dot state visually.
