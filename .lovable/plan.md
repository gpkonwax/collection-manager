# Fix the folder layout, then finish the ZIP build

The merge worked. The verify output tells us exactly one thing is wrong, and it is not the manifest.

The 1030 SimpleAssets images are sitting one folder too deep. They are inside `gpk-zip-src\mirror\...` but the manifest lists them as `QmSRti.../base/1a.jpg` — with no `mirror\` in front. That is why the same 1030 files show up twice in the report: once as MISSING (the manifest looked for them at the top level) and once as EXTRA (the checker found them under `mirror\`). The 1545 AtomicAssets files under `atomic\` are all fine.

The fix is to move those files up one level. Nothing is re-downloaded and nothing is deleted except one duplicate bookkeeping file.

## Step 1 — Look before moving

```bat
dir /b C:\Users\User\Desktop\gpk-zip-src
```

You should see `atomic`, `mirror`, and `manifest.json`. If there is no `mirror` folder, stop and paste what you see.

## Step 2 — Move the images up one level

```bat
cd /d C:\Users\User\Desktop\gpk-zip-src
```

```bat
robocopy mirror . /E /MOVE /XF manifest.json
```

`/MOVE` moves rather than copies, so nothing is duplicated on disk. `/XF manifest.json` leaves the nested `mirror\manifest.json` behind — that is the old SimpleAssets-only copy and it must not overwrite the merged one at the top level.

Robocopy prints a table at the end. Any exit code under 8 is success; ignore the number it shows.

## Step 3 — Remove the leftover folder

```bat
rd /s /q C:\Users\User\Desktop\gpk-zip-src\mirror
```

Then confirm it is gone and the CID folders are now at the top:

```bat
dir /b C:\Users\User\Desktop\gpk-zip-src
```

Expect `atomic`, `manifest.json`, and a list of `Qm...` folders. No `mirror`.

## Step 4 — Confirm the image count is still right

```bat
cd /d C:\Users\User\Desktop
```

```bat
dir /s /b gpk-zip-src\*.jpg gpk-zip-src\*.gif gpk-zip-src\*.png gpk-zip-src\*.webp | find /c /v ""
```

Must print **2575**. If it prints anything else, stop and paste it.

## Step 5 — Verify again

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/verify-mirror.mjs C:\Users\User\Desktop\gpk-zip-src
```

Target: `missing 0`, `corrupt 0`, and no EXTRA lines. Do not continue until missing and corrupt are both zero.

## Step 6 — Delete old ZIP parts

```bat
del /q C:\Users\User\Desktop\gpk-zip-src\gpk-image-mirror-part-*.zip
```

```bat
dir /b C:\Users\User\Desktop\gpk-zip-src\*.zip
```

`File Not Found` is the result you want.

## Step 7 — Build the new split ZIPs

Check `C:\Users\User\Desktop\gpk-app-latest2\scripts\mirror-config.json` in Notepad has:

```json
"outDir": "C:\\Users\\User\\Desktop\\gpk-zip-src",
```

The doubled backslashes are required. Save and close.

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/build-image-mirror.mjs --zip-only --split-zip
```

Paste the final lines: number of parts, each part's size and SHA-256, and the total file count. Total should be **2576** (2575 images plus `manifest.json`).

## Step 8 — Publish

1. **GitHub Release** — in the `gpkonwaxbackup` release holding the ZIPs, delete the old parts and upload the new ones from `gpk-zip-src`.
2. **GitHub Pages mirror** — copy the merged `manifest.json` into the `gpkonwaxbackup-repo` root, plus any images present in staging but not in the repo, then commit and push.
3. **Netlify** — deploy the same tree. Keep the existing `_headers` file at the root or CORS breaks.
4. **Cloudflare Pages** — images and manifest only. No ZIPs; Cloudflare rejects files over 25 MB.

## Step 9 — Audit

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/audit-mirrors.mjs
```

All three mirrors must report `COMPLETE`. Then open **Offline backup** in the app, confirm the download size matches the new parts, and import one part as a live test.

## Technical notes

- `remoteMirror.ts` resolves an image by looking up `manifest.files[<cid>/<variant>/<file>]` and fetching that same relative path from the mirror base URL. A `mirror/` prefix on disk breaks both the ZIP import and any host serving the folder, so moving the files is the correct fix rather than rewriting the manifest keys.
- AtomicAssets entries are unaffected: they carry an explicit `path` field (`atomic/<cid>.<ext>`) which `verify-mirror.mjs` resolves ahead of the key.
- No code change is needed in this project — the merge script already produced the right manifest.
