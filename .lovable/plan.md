# Push `atomic` in small chunks

`atomic` holds ~150 loose image files plus **10 subfolders** — those subfolders are the heavy ones (full card series). Pushing them all in one commit was 2.08 GiB, which GitHub rejects. We push them one at a time instead.

## Step 1 — Open the repo

```bat
cd /d C:\Users\User\Desktop\gpkonwaxbackup-repo
```

## Step 2 — Undo the failed commit, keep every file

```bat
git reset --soft HEAD~1
git reset
```

`--soft` forgets the commit only; no file is deleted. The second line unstages everything so we can add it in pieces.

Check:

```bat
git status -sb
```

`atomic/` should show as untracked (`??`).

## Step 3 — Push each subfolder, one at a time

Run these **in order**. Wait for each `git push` to finish before starting the next block. Copy-paste one block at a time.

```bat
git add atomic/QmbcnAE5c4PpA8rnEyx4Zh7Qn83VLo7cGzpnzXNwZ1835Z
git commit -m "atomic: QmbcnAE5"
git push origin main
```

```bat
git add atomic/QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ
git commit -m "atomic: QmcAkyEv"
git push origin main
```

```bat
git add atomic/QmeLsJK72q7F5yJhQpWkUCz39YT14d72gKdC5jnv8yXrzs
git commit -m "atomic: QmeLsJK7"
git push origin main
```

```bat
git add atomic/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p
git commit -m "atomic: QmSRti2H"
git push origin main
```

```bat
git add atomic/QmTS7dmxagM4h5UQaULAG8a8Mef1x35YwavMJ6uqWzobKX
git commit -m "atomic: QmTS7dmx"
git push origin main
```

```bat
git add atomic/QmUkRt94GkTDUa2tTgTCDAm7xne2xYTpzSQizw5mJPf61y
git commit -m "atomic: QmUkRt94"
git push origin main
```

```bat
git add atomic/QmUt1n6b5re5FhuP7dFj73BS57MGNBYPP3uZeTnvYDtiyN
git commit -m "atomic: QmUt1n6b"
git push origin main
```

```bat
git add atomic/QmYiXshxX23h4J68Z8HUGVbVZmCwrrjEi3TKA41jW6hcSH
git commit -m "atomic: QmYiXshx"
git push origin main
```

```bat
git add atomic/QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25
git commit -m "atomic: QmYkMDkB"
git push origin main
```

```bat
git add atomic/QmZ128PWeEEvkZBZxxNjSxAfUCD8h1n5FagvqhfoaauXmi
git commit -m "atomic: QmZ128PW"
git push origin main
```

If any one of these fails with HTTP 500, that single folder is over ~1 GB on its own. Stop, tell me which one, and I will split it by its inner subfolders (`base`, `back`, `prism`, etc.).

## Step 4 — Push the remaining loose files

These are the single `.jpg` / `.webp` / `.gif` / `.png` files sitting directly in `atomic`. They are small, so three batches is plenty. The quotes matter — they let git do the matching, not Windows.

```bat
git add "atomic/Qma*" "atomic/Qmb*" "atomic/Qmc*" "atomic/Qmd*" "atomic/Qme*" "atomic/Qmf*"
git commit -m "atomic: loose files a-f"
git push origin main
```

```bat
git add "atomic/QmN*" "atomic/QmP*" "atomic/QmQ*" "atomic/QmR*" "atomic/QmS*"
git commit -m "atomic: loose files N-S"
git push origin main
```

```bat
git add "atomic/QmT*" "atomic/QmU*" "atomic/QmV*" "atomic/QmW*" "atomic/QmX*" "atomic/QmY*" "atomic/QmZ*"
git commit -m "atomic: loose files T-Z"
git push origin main
```

## Step 5 — Catch anything left over

```bat
git add atomic
git commit -m "atomic: remaining files"
git push origin main
```

If it says `nothing to commit`, that is good — everything is already pushed.

## Step 6 — Confirm clean

```bat
git status -sb
```

You want `## main...origin/main` with no `[ahead N]`. Then wait for the green tick at https://github.com/bewbzz/gpkonwaxbackup/actions.

## Step 7 — I finish the app side

Once Pages is live I will fetch the live merged manifest and replace the 832-entry file list in `public/gpk-manifest.json` with the full 2575 entries, then run the mirror audit and a live import test.
