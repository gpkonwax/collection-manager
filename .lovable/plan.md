## Safer fix so you do not waste another hours-long ZIP run

You are right — just changing one line is not enough. The current ZIP step still risks wasting hours because it:

- Re-checks/download-skips all image candidates before zipping.
- Uses `JSZip`, which can still hold too much file data/state for a 2GB+ archive.
- Only proves the ZIP works at the very end.

### I will change the scripts so the next run is safe

#### 1. Stop using JSZip for the large mirror ZIP
Replace the ZIP builder with a true streaming ZIP writer so files are read from disk one at a time and hashed chunk-by-chunk.

This means:

- No giant ZIP buffer in memory.
- No `Hash.update()` call with a >2GB buffer.
- No loading all image files into RAM before writing.

#### 2. Add a fast preflight test before the real ZIP
Before it spends hours writing the full archive, the script will run a tiny streaming ZIP test on a few files and confirm:

- ZIP stream starts correctly.
- sha256 hashing works chunk-by-chunk.
- output file can be created.

If that test fails, it fails in seconds, not hours.

#### 3. Add a `--zip-only` mode
After your images are already downloaded, you should not have to wait through:

```text
1547/1547 processed
7681/7681 processed
```

every time just to retry the ZIP.

I will add:

```cmd
node scripts/build-atomic-mirror.mjs --zip-only
```

That will:

- Not redownload anything.
- Not reprocess AtomicAssets templates.
- Not reprocess the old Series 1/2/Exotic candidate list.
- Only rebuild `gpk-image-mirror.zip` from the existing `scripts/mirror-output` folder.
- Update `zipSha256`, `zipBytes`, and `public/gpk-manifest.json`.

#### 4. Add clearer progress during ZIP creation
Instead of waiting for hours with no useful feedback, it will show progress like:

```text
Zipping 2378 files...
  250/2378 files, 410.2 MB written
  500/2378 files, 825.7 MB written
```

So you can tell it is genuinely moving.

#### 5. Keep `--no-zip` working
The existing `--no-zip` path will stay intact, so if we ever need to verify/upload folder files without building the ZIP, that still works.

### What you will run after I patch it

From:

```cmd
C:\Users\User\Desktop\gpk-app-new
```

run only this:

```cmd
node scripts/build-atomic-mirror.mjs --zip-only
```

That should avoid another full download/check loop and go straight to the corrected streaming ZIP build.

After it finishes:

```cmd
node scripts/verify-mirror.mjs scripts/mirror-output
```

Then continue uploading:

1. Push folder files to GitHub, excluding the ZIP.
2. Upload `gpk-image-mirror.zip` as a GitHub Release asset.
3. Upload the mirror folder to Cloudflare, excluding the ZIP.
4. Publish the app in Lovable.

### Why this is safer

The next expensive operation will use the same streaming path from the first byte to the last byte. There will be no final >2GB buffer/hash step left that can suddenly fail at the end.