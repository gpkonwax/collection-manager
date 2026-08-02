# Refresh the mirror audit script and make the results easy to read

This plan fixes the false alarm you saw earlier (515 missing files) and makes the audit easier to trust next time.

---

## Step 1 — Make sure your local audit script is up to date

You already checked this and the right code is there, so this step is just for confirmation.

Open Command Prompt and run:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
findstr /C:"atomicBaseUrl" scripts\audit-mirrors.mjs
```

You should see three lines printed back, including:

```text
atomicBaseUrl: 'https://bewbzz.github.io/gpkonwaxbackup/',
```

If you see that, **skip to Step 2**.

If nothing prints, your local copy is old and you need to replace it. Here is the safest way:

1. In Lovable, open `scripts/audit-mirrors.mjs`.
2. Press **Ctrl+A**, then **Ctrl+C** to copy the whole file.
3. On your PC, go to `C:\Users\User\Desktop\gpk-app-latest2\scripts`.
4. Right-click `audit-mirrors.mjs` → **Open with** → **Notepad**.
5. Press **Ctrl+A**, then **Delete** to clear the file.
6. Press **Ctrl+V**, then **Ctrl+S** to save.
7. Do the same for `scripts/verify-mirror.mjs`.

---

## Step 2 — Run the audit again

This checks every image on all three mirrors and tells you exactly what is missing.

In Command Prompt run:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
node scripts/audit-mirrors.mjs
```

It will print lines like `HEAD 2100/2575` while it works. Wait for it to finish.

### What you want to see

```text
## Primary (GitHub Pages)
  missing:      0
  verdict:      COMPLETE

## Backup A (Netlify)
  missing:      0
  verdict:      COMPLETE

## Backup B (Cloudflare)
  missing:      10
  verdict:      GAPS (missing=10, ...)
```

The 10 Cloudflare gaps are **expected** — those 10 files are larger than Cloudflare's 25 MiB per-file limit. They exist on the primary mirror, on Netlify, and inside the ZIP release files, so the data is safe.

### What to do if the numbers are wrong

- **Netlify shows missing files** → it did not get the full upload. Do not re-upload a partial folder (that would erase what is already there). Tell me the number and I will guide you through adding only the missing files.
- **Cloudflare shows more than 10 missing** → something went wrong during upload. Stop and paste the summary here.
- **Primary shows any missing** → that is the source of truth; we need to fix the primary mirror first.

Paste the final summary here either way and I will confirm it.

---

## Step 3 — Make the audit easier to understand next time

These are small edits to `scripts/audit-mirrors.mjs` in this project. Once they are done you would copy the updated file to your PC again using Step 1.

1. **Mark the 10 oversized Cloudflare files as expected exclusions.**
   Add a list of those 10 paths to the script. Cloudflare's verdict will then read `COMPLETE (10 expected exclusions)` instead of `GAPS`.

2. **Print the full URL next to every missing file.**
   In `missing-<mirror>.txt`, each line will show the actual URL that was checked. This way a wrong URL looks like a wrong URL, not a missing file.

3. **Print the script version and date in the header.**
   The first line of output will show when the script was last updated, so a stale local copy is obvious.

Say the word and I will make these three changes.
