## Root cause (confirmed)

On the published site the primary mirror shows **Unreachable** because the app can't load its pinned manifest.

- The app fetches `fetch('/gpk-manifest.json')` in `src/lib/remoteMirror.ts:149` — an absolute path from the domain root.
- The GitHub Pages deploy is served under `/collection-manager/` (see `vite.config.ts` → `base: '/collection-manager/'`).
- So on `gpkonwax.github.io` the request goes to `https://gpkonwax.github.io/gpk-manifest.json` → **404** (verified with curl). The real file lives at `/collection-manager/gpk-manifest.json` (verified: returns the 832-file manifest).
- With no manifest, `verifyMirror()` marks the primary as `failed` → red "Unreachable" pill.
- On Lovable preview the app is served at the domain root, so `/gpk-manifest.json` resolves correctly and the badge is green. That's why the two environments disagree.

CORS and the mirror files themselves are fine (curl to `bewbzz.github.io/gpkonwaxbackup/mirror/...` returns 200 with `access-control-allow-origin: *`).

## Fix

Make the manifest fetch respect Vite's configured base path instead of assuming the app is at the domain root.

1. **`src/lib/remoteMirror.ts`** — replace the hardcoded path:
   ```ts
   const res = await fetch(`${import.meta.env.BASE_URL}gpk-manifest.json`, { cache: 'no-store' });
   ```
   `import.meta.env.BASE_URL` is `/` in dev / on Lovable preview and `/collection-manager/` on the GitHub Pages build, so the same code works in both environments.

2. **`src/lib/remoteMirror.test.ts`** — tests currently mock `'/gpk-manifest.json'`. Vitest's default `BASE_URL` is `/`, so the mocked prefix will still match. No test change needed, but I'll re-run the suite to confirm.

## Out of scope
- No changes to mirror URLs, hash-verify logic, ZIP download UI, or `sync-pinned-manifest.mjs`.
- Backup A / Backup B deployment (separate follow-up).

## After merge
Once published, reopen the Offline Backup panel on `gpkonwax.github.io/collection-manager/` — the primary mirror pill should flip to green "Reachable".