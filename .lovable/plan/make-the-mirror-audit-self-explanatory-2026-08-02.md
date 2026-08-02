# Make the mirror audit self-explanatory

Your latest audit is the result we wanted:

- **Primary (GitHub Pages):** 2575/2575 + all 3 ZIP parts — COMPLETE
- **Backup A (Netlify):** 2575/2575 — COMPLETE
- **Backup B (Cloudflare):** 2565/2575 — the 10 gaps are the files over Cloudflare's 25 MiB per-file limit

Every image now exists on at least two mirrors plus the ZIP release, so nothing is at risk. The only thing left is to stop the audit reporting a known, unavoidable limitation as a failure.

---

## What I will change in `scripts/audit-mirrors.mjs`

### 1. Treat Cloudflare's oversized files as expected exclusions

Cloudflare Pages refuses any single file over 25 MiB. Rather than hardcoding a list of ten filenames that could drift, the script will compute the exclusions from the manifest itself: for a mirror marked with a size cap, any entry whose recorded `bytes` exceeds that cap is counted as **excluded**, not **missing**.

- Add `maxFileBytes: 25 * 1024 * 1024` to the Cloudflare mirror entry.
- Excluded entries are skipped from the HEAD sweep and listed in a new `excluded-cloudflare.txt`.
- Summary gains an `excluded:` line, and the verdict reads:
  `COMPLETE (10 expected exclusions — over 25 MiB Cloudflare limit)`
- Safety net: if an excluded file is somehow *also* missing from the primary mirror, it is still reported as a real gap. Exclusion never hides a genuine loss.

### 2. Print the resolved URL next to every missing entry

Right now `missing-<mirror>.txt` shows only the manifest key and a status, which is why the earlier atomic-path bug looked like 515 lost files. Each line becomes:

```text
<manifest key>	<status>	<full URL that was requested>
```

A wrong base URL then looks obviously wrong instead of looking like a gap. Same treatment for `wrongsize-` and `sha-mismatch-` files.

### 3. Print the script's version and date in the header

The first lines of output become:

```text
audit-mirrors.mjs v2 — updated 2026-08-02
Mirror audit — <timestamp>
```

If your desktop copy is stale, the version line makes it obvious before you spend twenty minutes chasing phantom gaps.

---

## After I make the changes — what you do

1. In Lovable, open `scripts/audit-mirrors.mjs`, select all (**Ctrl+A**), copy (**Ctrl+C**).
2. On your PC open `C:\Users\User\Desktop\gpk-app-latest2\scripts\audit-mirrors.mjs` in Notepad, select all, delete, paste, save.
3. Run it:

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
node scripts/audit-mirrors.mjs
```

4. Expected result — all three mirrors report COMPLETE, with Cloudflare noting 10 expected exclusions. Paste the summary here and I will confirm.

---

## Technical notes

- Only `scripts/audit-mirrors.mjs` changes. No app code, no manifest edits, no mirror re-uploads.
- Exclusion is driven by `meta.bytes` from the manifest, so if a future rebuild adds another oversized image it is classified automatically.
- `urlFor()` already handles the `atomic/` base split; the change just surfaces its output in the reports.
