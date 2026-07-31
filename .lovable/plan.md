# Publish the holders snapshot to your mirrors

The scan worked. You now have one file on your Desktop:

```text
C:\Users\User\Desktop\gpk-app-latest2\mirror-output\manifests\gpk-topps-holders.json
```

14,255 accounts, 499,880 SimpleAssets and 436,424 AtomicAssets. Nothing else needs regenerating.

The app can't see the file yet because it lives only on your computer. It has to sit at the path `manifests/gpk-topps-holders.json` on your mirror hosts. The app races all three and uses whichever answers first, so **getting one host working is enough** — do the rest for redundancy.

---

## Step 1 — Netlify (Backup A) — easiest, do this one first

1. Open a terminal in `C:\Users\User\Desktop\gpk-app-latest2\mirror-output`.
2. Link this folder to your existing site. Run:
   ```bash
   netlify deploy --prod --site gpkonwaxbackup --dir .
   ```
   The `--site gpkonwaxbackup` flag tells Netlify which site to use, so it skips the link prompt.
   - If that name doesn't work, run `netlify sites:list` to see the exact site name or site ID, then use `--site <ID>` instead.
3. Wait for the deploy to finish. It re-uploads the folder including the new `manifests` subfolder.
4. Check it in a browser:
   `https://gpkonwaxbackup.netlify.app/manifests/gpk-topps-holders.json`
   You should see a wall of JSON text, not a 404 page.

If the full re-deploy feels heavy, you can instead drag just the `manifests` folder into the Netlify web UI's deploy area — but the CLI route above is safer because it keeps the existing files intact.

## Step 2 — GitHub Pages (Primary)

The file is ~1–2 MB of text, well under every GitHub limit, so a plain push works.

1. Open your backup repo folder (`gpk-backup-repo`, the one holding `mirror/`).
2. Create a folder `mirror\manifests\` and copy `gpk-topps-holders.json` into it.
3. In a terminal in that folder:
   ```bash
   git add mirror/manifests/gpk-topps-holders.json
   git commit -m "Add gpk.topps holders snapshot"
   git push
   ```
4. Wait ~1 minute, then check:
   `https://bewbzz.github.io/gpkonwaxbackup/mirror/manifests/gpk-topps-holders.json`

## Step 3 — Cloudflare Pages (Backup B)

Cloudflare rejects individual files over 25 MB, but this JSON is far smaller, so it uploads fine.

1. Copy `gpk-topps-holders.json` into your Cloudflare upload folder under `manifests\`.
2. Deploy with the same Wrangler command you used before, e.g.:
   ```bash
   npx wrangler pages deploy . --project-name gpkonwaxbackup
   ```
3. Check:
   `https://gpkonwaxbackup.pages.dev/manifests/gpk-topps-holders.json`

---

## Step 4 — Confirm in the app

1. Hard-refresh the Collection Manager (Ctrl+F5).
2. Open **View Wallet → Show List**.
3. You should see a ranked table: rank, account, SA count, AA count, total, with a snapshot date line above it.
4. Click any account name — it fills the input box, then press **View**.

If it still says "Holders snapshot not published yet", the file isn't reachable at the exact path on any mirror. Paste the browser console output and I'll pinpoint which host is wrong.

---

## Notes

- **CORS**: Netlify already has the `_headers` file allowing cross-origin reads, so it will work. If GitHub Pages or Cloudflare respond with a CORS error rather than a 404, tell me — Netlify alone is enough to make the feature work in the meantime.
- **Refreshing later**: this snapshot is a point-in-time picture. Re-run `node scripts/build-holders-manifest.mjs` and repeat the upload whenever you want it current. There's no automatic schedule, by design.
- **No app code changes needed** for this step — the client-side handling was finished in the previous round.
