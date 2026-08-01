# Finish from Step 7 — build the ZIPs, publish, audit

The staging folder `C:\Users\User\Desktop\gpk-zip-src` is now correct: 2575 images plus the merged `manifest.json`. Everything left is packaging and uploading. Nothing gets downloaded again.

Run one line at a time in Command Prompt and paste back what it prints. If any step prints something different from what is described, stop there and send it to me rather than continuing.

## Step 7a — Point the build at the staging folder

The build script reads a small settings file to know which folder to zip. Right now it points at a different folder, so you must change one line.

1. Press the Windows key, type `notepad`, press Enter.
2. In Notepad choose **File → Open**.
3. In the file-name box paste this exactly and press Enter:

```text
C:\Users\User\Desktop\gpk-app-latest2\scripts\mirror-config.json
```

4. Near the top you will see a line like:

```json
"outDir": "./mirror-output",
```

5. Change that whole line so it reads exactly:

```json
"outDir": "C:\\Users\\User\\Desktop\\gpk-zip-src",
```

Two things matter: the backslashes must be **doubled**, and the comma at the end must stay. Leave every other line alone.

6. **File → Save**, then close Notepad.

## Step 7b — Make sure no old ZIP parts are sitting in the folder

If old parts are still there, the new ZIP will contain the old ZIPs inside it.

```bat
dir /b C:\Users\User\Desktop\gpk-zip-src\*.zip
```

- `File Not Found` — good, skip to Step 7c.
- If it lists any `gpk-image-mirror-part-*.zip` files, delete them:

```bat
del /q C:\Users\User\Desktop\gpk-zip-src\gpk-image-mirror-part-*.zip
```

Then run the `dir` line again and confirm `File Not Found`.

## Step 7c — Build the split ZIPs

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/build-image-mirror.mjs --zip-only --split-zip
```

`--zip-only` means "do not download anything, just package what is on disk". `--split-zip` means "cut it into pieces of about 1.8 GB" so each piece fits GitHub's upload limit.

This takes several minutes and the window may look frozen while it works. That is normal — do not close it.

When it finishes it prints a summary. Copy the last 10-15 lines and paste them to me. The things I need to see:

- the number of parts it wrote,
- each part's size and its SHA-256 (a long string of letters and numbers),
- the total file count, which should be **2576** — that is 2575 images plus `manifest.json`.

If the total is not 2576, stop and send me the output.

## Step 7d — Confirm the parts exist on disk

```bat
dir C:\Users\User\Desktop\gpk-zip-src\*.zip
```

You should see the part files with sizes around 1.8 GB each. Paste this listing too.

## Step 8 — Publish

Four places get the update. Do them in this order.

### 8a. GitHub Release (the ZIP download)

1. In a browser go to the `gpkonwaxbackup` repository, click **Releases**, and open the release that currently holds the ZIP parts.
2. Click **Edit** (the pencil icon).
3. Under the existing assets, delete every old `gpk-image-mirror-part-*.zip` by clicking the small **x** next to each.
4. Open `C:\Users\User\Desktop\gpk-zip-src` in File Explorer and drag the new part files onto the upload box.
5. Wait for every upload bar to reach 100% — they are large, this takes a while — then click **Update release**.

### 8b. GitHub Pages mirror (the browsable images)

1. Copy the merged manifest into your local copy of the mirror repo, overwriting the old one:

```bat
copy /Y C:\Users\User\Desktop\gpk-zip-src\manifest.json C:\Users\User\Desktop\gpkonwaxbackup-repo\manifest.json
```

2. Copy across any images that are in staging but not yet in the repo (this skips files already there, so it is safe to re-run):

```bat
robocopy C:\Users\User\Desktop\gpk-zip-src C:\Users\User\Desktop\gpkonwaxbackup-repo /E /XF *.zip /XO
```

3. Commit and push that repo the way you normally do.

Do **not** copy the ZIP parts into this repo — that is what `/XF *.zip` prevents. The ZIPs live only on the Release.

### 8c. Netlify

Deploy the same folder tree you just pushed. One critical detail: the `_headers` file must stay at the root of what you deploy. Without it the browser blocks the images and the mirror shows as failed.

### 8d. Cloudflare Pages

Deploy the images and `manifest.json` only. Do **not** upload the ZIP parts — Cloudflare rejects any file over 25 MB and the deploy will fail.

## Step 9 — Audit

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```bat
node scripts/audit-mirrors.mjs
```

All three mirrors must report `COMPLETE`. If one reports missing files, the script writes the list to `scripts\mirror-output\audit-report\` — send me the summary and I will tell you what to re-upload.

## Step 10 — Live test in the app

1. Open the app and go to **Offline backup**.
2. Check the download size shown matches the total size of the new parts.
3. Download one part and import it, then open a card and confirm the image loads from the local copy.

## Technical notes

- `--zip-only` skips all network fetching and zips whatever is under `outDir`, so the contents are exactly the 2575 verified images plus the merged manifest.
- Splitting is required because a single GitHub release asset cannot exceed 2 GB; the app's importer accepts the parts individually, so no re-joining is needed on the user's side.
- The SHA-256 values printed in Step 7c are what the app displays for integrity checking; they change with every rebuild, which is why the old release assets must be removed rather than left alongside.
- No code changes are needed for any of this — the scripts already in the project do all the work.
