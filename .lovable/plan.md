# Refresh your local audit script, then re-run the audit

Nothing is wrong with the mirrors. Your local `audit-mirrors.mjs` is an old copy that builds the wrong URL for 515 files, which is why it reports them as missing. Replacing that one file fixes the false alarm.

Follow these in order. Each step says exactly what to click and type.

---

## Step 1 — Replace `audit-mirrors.mjs` on your PC

You are copying the up-to-date file from this project over the stale one on your Desktop. Two ways — pick **1A** if you are not sure.

### 1A — Copy and paste through Notepad (simplest)

1. In Lovable, switch to the code view and open `scripts/audit-mirrors.mjs`.
2. Click inside the file, press **Ctrl+A** (selects everything), then **Ctrl+C** (copies it).
3. On your PC open File Explorer and go to:
   `C:\Users\User\Desktop\gpk-app-latest2\scripts`
4. Right-click `audit-mirrors.mjs` → **Open with** → **Notepad**.
   (If Notepad is not listed, click **Choose another app**, pick Notepad, then **Just once**.)
5. In Notepad press **Ctrl+A**, then **Delete** — the window should now be empty.
6. Press **Ctrl+V** to paste the new version in.
7. Press **Ctrl+S** to save, then close Notepad.

Repeat the same seven steps for `scripts/verify-mirror.mjs`.

### 1B — If you keep this folder synced with git

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
git pull
```

### Check it worked

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
findstr /C:"atomicBaseUrl" scripts\audit-mirrors.mjs
```

You should see a line or two printed back. **If nothing prints, the copy did not save** — go back and redo Step 1A, making sure you pressed Ctrl+S.

---

## Step 2 — Re-run the audit

Open Command Prompt and run:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
node scripts/audit-mirrors.mjs
```

It takes a few minutes and prints a counter like `HEAD 2100/2575` as it works. Let it finish.

### What a correct result looks like

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

Cloudflare's 10 are **correct and expected** — they are the 10 files bigger than Cloudflare's hard 25 MiB per-file limit. They exist on the primary mirror, on Netlify, and inside the ZIPs, so nothing is at risk.

### If the numbers are different

- Netlify or Cloudflare shows hundreds missing again → the script did not get replaced. Redo Step 1.
- Cloudflare shows more than 10 → paste the output here and stop; do not re-upload anything.

Either way, paste the summary and I will confirm.

---

## Step 3 — Optional cleanup so this never confuses you again

These are edits I would make to `scripts/audit-mirrors.mjs` in this project (you would then copy it over once more using Step 1):

1. **Mark the 10 oversized files as expected.** Add a `KNOWN_OVERSIZE` list of those paths so Cloudflare reads `COMPLETE (10 expected exclusions)` instead of `GAPS`.
2. **Show the full URL next to every missing file** in `missing-<mirror>.txt`, so a wrong-URL bug is obvious instead of looking like a real gap.
3. **Print the script's version and date in the header**, so a stale local copy gives itself away on the first line of output.

Tell me if you want these and I will make the changes.
