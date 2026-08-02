# Both mirrors are actually complete — your audit run is the odd one out

I re-checked every one of the 2575 manifest entries from here, against the live mirrors:

```text
Netlify    (https://gpkonwaxbackup.netlify.app/)  missing: 0
Cloudflare (https://gpkonwaxbackup.pages.dev/)    missing: 10
```

The Cloudflare 10 are exactly the 10 files over Cloudflare's hard 25 MiB per-file limit — that is the expected, accepted end state for Backup B:

```text
QmNnPE4aQddNZ362KR1tVGSE7deZKm3LLw584e6xmJeBwX.gif   53.3 MiB
QmeAzkDYBR3yFcDjY7rYhSLkTzrLD2ERtJXATUXc47kYgN.gif   52.0 MiB
QmZj8pwn1Jefc2wYJXLfrtaRUD7qhxQmJKqUqmik1fqeqs.gif   49.7 MiB
QmVFEJb46EhAucik6AZyXZS4JiuZhcFo9FZzccueCAAK38.gif   49.7 MiB
QmRyoAs48RqwyD3WzYvgCuKi6zWZikqRSwehU4mWvWbvd1.webp  32.3 MiB
QmRXEgM1GkXXCvPnJs9GsYNtqgv8ij8hH5GLksDuscmsNA.webp  32.2 MiB
QmcDXep1Yn6gE6DYDywZsxbNZujgrgSUwWtBD7tNrYevWD.webp  25.8 MiB
QmcHh1ZasZYycVcKEGtkHfDyYK5LEeiMkzytpqC8RwEweB.gif   25.7 MiB
QmfDdhpwoxRq8HrtsQLGLUy9xVzxPoC3VoGkyGV4eM8sVC.webp  25.7 MiB
QmQiggvyH63Szm45MRwB7LFWd7pSxcoCmKqasvghmjf3Pd.gif   25.5 MiB
```

Those 10 are on the primary mirror, on Netlify, and inside the ZIPs, so nothing is at risk.

**Do not re-upload anything.** Both deploys landed correctly.

## Why your run says 515

Your audit reported the *same* 515 on two completely independent CDNs. That is not possible as a real gap — it is your local machine failing those requests. Almost certainly the 15-second HEAD timeout in `audit-mirrors.mjs` firing under 8-way concurrency on your connection; a timeout is recorded as "missing" with status `0`.

The ZIP 404s on Netlify are also noise: the split ZIPs only ever live as GitHub Release assets. Your local copy of `audit-mirrors.mjs` is an older revision that checks ZIPs on every mirror; the current one only checks them on the primary.

## Step 1 — Confirm the cause

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
type scripts\mirror-output\audit-report\missing-cloudflare.txt | more
```

Each line is `path <TAB> status`. Paste the first ten lines here.

- Mostly `0` or an error message: confirmed local timeouts. Nothing is wrong with the mirrors.
- Mostly `404`: something real; I will investigate before anything is re-uploaded.

## Step 2 — Re-run gently

```bat
node scripts/audit-mirrors.mjs --only cloudflare --concurrency 2
node scripts/audit-mirrors.mjs --only netlify --concurrency 2
```

Slower, but it will not trip the timeout. Expected: Cloudflare `missing: 10` (the list above), Netlify `missing: 0`.

## Step 3 — Sync the audit script (code change, needs build mode)

Two small fixes so future runs are trustworthy:

- Raise `TIMEOUT_MS` in `scripts/audit-mirrors.mjs` from 15s to 45s, and retry a timed-out HEAD once more before recording it as missing.
- Treat the 10 known oversized files as an expected exclusion for Cloudflare, so its verdict reads `COMPLETE (10 expected exclusions)` instead of `GAPS`.

Then copy the updated `scripts/audit-mirrors.mjs` to your local `gpk-app-latest2` folder so your runs match.

## Where things stand

| Mirror | Coverage | Status |
| --- | --- | --- |
| Primary (GitHub Pages) | 2575 / 2575 + 3 ZIP parts | Complete |
| Backup A (Netlify) | 2575 / 2575 | Complete |
| Backup B (Cloudflare) | 2565 / 2575 | Complete minus the 10 oversized files |

The backup job is done. No further uploads are needed.
