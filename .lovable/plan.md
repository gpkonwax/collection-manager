## Fix for the GitHub 2GB ZIP limit

GitHub Release assets cannot reliably accept your new 4GB `gpk-image-mirror.zip`. Do not keep retrying that upload — it is expected to fail.

The correct fix is to split the backup into smaller independent ZIP files and make the app understand them.

---

## What I will change

### 1. Keep the mirror folders exactly as they are

Nothing about your actual backed-up image files is wasted or undone.

Your existing folder stays valid:

```text
C:\Users\User\Desktop\gpk-app-latest\scripts\mirror-output\
```

It still contains:

```text
atomic/
QmSRti...
QmcAky...
QmYkMD...
manifest.json
```

Those are the important files.

---

### 2. Replace the single huge ZIP with smaller ZIP parts

Instead of making one file:

```text
gpk-image-mirror.zip   3.97 GB
```

The script will make several smaller valid ZIPs, for example:

```text
gpk-image-mirror-part-001.zip   about 1.7 GB
gpk-image-mirror-part-002.zip   about 1.7 GB
gpk-image-mirror-part-003.zip   about 0.6 GB
```

Each part will be a normal ZIP file by itself.

This is important: these will not be `.zip.001`, `.zip.002` split archives that require special software. They will be separate normal ZIP files that the app can load one after another.

---

### 3. Add a safe command for you to run

After I patch the scripts, you will run:

```cmd
node scripts/build-atomic-mirror.mjs --zip-only --split-zip
```

That will:

- Not download the images again.
- Not process AtomicAssets again.
- Use the files already in `scripts\mirror-output`.
- Create the smaller ZIP parts.
- Update `manifest.json` with the size and hash of each ZIP part.

---

### 4. Update the app backup panel

The Offline backup panel will stop treating the backup as one giant ZIP.

It will show multiple download files instead, something like:

```text
Download backup ZIP part 1
Download backup ZIP part 2
Download backup ZIP part 3
```

The load button will also support selecting multiple ZIP files at once, so a user can select all parts together instead of loading them one by one.

---

### 5. What you will upload after the fix

#### GitHub Release

Instead of uploading this failing file:

```text
gpk-image-mirror.zip
```

You will upload:

```text
gpk-image-mirror-part-001.zip
gpk-image-mirror-part-002.zip
gpk-image-mirror-part-003.zip
```

Each one will be under GitHub's asset limit.

#### Cloudflare

Same as before: upload the mirror files but exclude ZIP files.

So on Cloudflare, upload:

```text
atomic/
QmSRti...
QmcAky...
QmYkMD...
manifest.json
```

Do not upload:

```text
gpk-image-mirror.zip
gpk-image-mirror-part-001.zip
gpk-image-mirror-part-002.zip
gpk-image-mirror-part-003.zip
```

---

## Beginner workflow after this is patched

You will do this:

### Step 1 — Get the updated code from Lovable

Download the latest codebase from Lovable again and copy your existing `scripts\mirror-output` folder into it, like before.

### Step 2 — Build smaller ZIP parts

From the new app folder, run:

```cmd
node scripts/build-atomic-mirror.mjs --zip-only --split-zip
```

### Step 3 — Upload ZIP parts to GitHub Release

On GitHub Releases, delete the old ZIP asset if it exists, then upload the new part files:

```text
gpk-image-mirror-part-001.zip
gpk-image-mirror-part-002.zip
gpk-image-mirror-part-003.zip
```

### Step 4 — Upload mirror files to Cloudflare

Upload the mirror folder contents to Cloudflare again, excluding all ZIP files.

### Step 5 — Publish the Lovable app

Publish/update the app so the Backup Panel knows about the new split backup files.

---

## Why this is the right fix

- GitHub cannot take the 4GB single asset.
- Your existing downloaded images are still good.
- Cloudflare can still host the loose image files.
- GitHub Release can host multiple smaller ZIP assets.
- The app can still support offline recovery, just using multiple ZIP files instead of one giant ZIP.