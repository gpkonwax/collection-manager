# Push the backup repo to GitHub in small chunks

The single 3.29 GiB push failed. The fix is to send the same commit as several smaller pushes. Nothing is lost — the files are all still on your disk.

Run one line at a time in Command Prompt and paste back anything that looks like an error.

## Step 1 — Undo the giant commit (keeps all files)

```bat
cd /d C:\Users\User\Desktop\gpkonwaxbackup-repo
```

```bat
git reset --soft HEAD~1
```

```bat
git reset
```

The first reset removes the commit, the second un-stages the files. Your images stay exactly where they are.

## Step 2 — Make sure no ZIPs are in the repo

```bat
dir /s /b *.zip
```

`File Not Found` is what you want. If any are listed, run:

```bat
git rm --cached -r . 2>nul & del /s /q *.zip
```

Then re-run `dir /s /b *.zip` and confirm it says `File Not Found`. ZIPs belong on the Release only.

## Step 3 — Confirm the folder names

```bat
dir /b
```

You should see something close to:

```text
atomic
QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ
QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p
QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25
manifest.json
_headers
```

If a name is different or there are extra folders, paste the output and stop here.

## Step 4 — Skip the small stuff

You already pushed `manifest.json` and `_headers` earlier, so they are on GitHub. Do **not** add or commit them again — just move straight to the image folders.

## Step 5 — Push each image folder, one at a time

Do these in order. Each block is add → commit → push. Wait for each push to finish before starting the next one.

### 5a. Series 1 folder

```bat
git add QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p
```

```bat
git commit -m "Add images: QmSRti (series 1)"
```

```bat
git push origin main
```

### 5b. Series 2 folder

```bat
git add QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ
```

```bat
git commit -m "Add images: QmcAky (series 2)"
```

```bat
git push origin main
```

### 5c. Exotic folder

```bat
git add QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25
```

```bat
git commit -m "Add images: QmYkMD (exotic)"
```

```bat
git push origin main
```

### 5d. Atomic folder — in four slices

`atomic\` holds 1545 loose files, too many for one push, so it goes in four alphabetical slices. The quotes matter — they stop Command Prompt expanding the `*` itself.

```bat
git add "atomic/Qm[a-f]*"
```

```bat
git commit -m "Add images: atomic a-f"
```

```bat
git push origin main
```

```bat
git add "atomic/Qm[g-p]*"
```

```bat
git commit -m "Add images: atomic g-p"
```

```bat
git push origin main
```

```bat
git add "atomic/Qm[q-z]*"
```

```bat
git commit -m "Add images: atomic q-z"
```

```bat
git push origin main
```

```bat
git add atomic
```

```bat
git commit -m "Add images: atomic remainder"
```

```bat
git push origin main
```

The last block catches anything the three slices missed (files not starting with `Qm`, uppercase names, and so on). If it prints `nothing to commit, working tree clean`, that is fine — it means everything was already sent. Skip its push and move on.

## Step 6 — Confirm everything is up

```bat
git status -sb
```

You want exactly `## main...origin/main` with **no** `[ahead N]`.

```bat
git count-objects -vH
```

Not required, just useful if something looks off.

Then open https://github.com/bewbzz/gpkonwaxbackup/actions and wait for the green tick on the last commit. Reply "green tick" when you see it and I will fetch the live manifest and update the app's `public/gpk-manifest.json` to the full 2575 entries.

## If a push still fails

If one of the pushes dies with `RPC failed` or `unexpected disconnect`, that folder is still too big. Split it:

```bat
dir /b <foldername>
```

Then add its subfolders individually, for example:

```bat
git add QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/base
git commit -m "Add images: QmcAky base"
git push origin main
```

```bat
git add QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/back
git commit -m "Add images: QmcAky back"
git push origin main
```

Raising the buffer once can also help on a flaky connection:

```bat
git config http.postBuffer 524288000
```

## Technical notes

- `git reset --soft HEAD~1` followed by bare `git reset` rewinds the commit and the index without touching the working tree, so no image files are deleted at any point.
- Each push sends only the objects in that commit, which is why splitting by folder keeps every transfer well under GitHub's pack-size ceiling.
- ZIP parts must never enter the repo — they live on the GitHub Release. Cloudflare Pages also rejects any file over 25 MB, so keeping the repo ZIP-free keeps all three mirrors deployable from the same tree.
