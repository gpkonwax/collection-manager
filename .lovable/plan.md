# Unblock the backup repo pull, then finish publishing

The pull stopped because GitHub already has some of these files (from an earlier push), while on your PC the same files sit there as **untracked** — git refuses to overwrite files it never tracked. Nothing is lost or broken.

The fix: park the blocking folders in a temp folder, pull, then copy back only what is genuinely missing.

## Step 1 — Open the repo folder

```bat
cd /d C:\Users\User\Desktop\gpkonwaxbackup-repo
```

## Step 2 — Your 3 local commits (already checked)

```text
c1f992c Add images: QmcAky (series 2)
99ab000 Add images: QmcAky (series 2)
14d6fb1 Update manifest to full 2575 entries
```

These are safe, chunked commits — the old 3.29 GiB commit is gone. Nothing to drop.


## Step 3 — Park the blocking untracked files

```bat
mkdir C:\Users\User\Desktop\gpk-park
move .assetsignore C:\Users\User\Desktop\gpk-park\
move .gitignore C:\Users\User\Desktop\gpk-park\
move status.txt C:\Users\User\Desktop\gpk-park\
robocopy .wrangler C:\Users\User\Desktop\gpk-park\.wrangler /E /MOVE
robocopy QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25 C:\Users\User\Desktop\gpk-park\QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25 /E /MOVE
```

`robocopy` prints a table and usually exits with code 1 — that means success, not failure.

Leave `atomic\` and `mirror\` where they are for now; the pull did not complain about them.

## Step 4 — Pull again

```bat
git pull origin main
```

You will get one conflict: `.gitignore` (you moved it aside in Step 3, GitHub changed it). Keep GitHub's version — it is already sitting in the folder:

```bat
git add .gitignore
git commit -m "Merge origin/main"
```

If an editor opens for the commit message, just close it (or `Ctrl+X`, `Y`, Enter).

Then:

```bat
git status -sb
```

You want `## main...origin/main [ahead 4]` (no `behind`).


## Step 5 — Copy back only the files GitHub does not already have

```bat
robocopy C:\Users\User\Desktop\gpk-park\QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25 C:\Users\User\Desktop\gpkonwaxbackup-repo\QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25 /E /XC /XN /XO
copy C:\Users\User\Desktop\gpk-park\.assetsignore .
```

`/XC /XN /XO` means "skip any file that already exists" — so the versions GitHub sent you are kept and only truly new images are added.

Do **not** copy `.wrangler` or `status.txt` back into the repo — they are local build junk and should never be pushed.

## Step 6 — Fix the broken `.gitignore`

Your `.gitignore` currently looks like one broken line:

```text
mirror/gpk-image-mirror.zip*.zip
```

It should be three separate lines. Overwrite it with this exact content:

```text
mirror/gpk-image-mirror.zip
*.zip
.wrangler/
```

The easiest way is to run:

```bat
(
echo mirror/gpk-image-mirror.zip
echo *.zip
echo .wrangler/
) > .gitignore
```

Then check it:

```bat
type .gitignore
```

You should see three clean lines.


## Step 7 — Commit and push in small chunks

Repeat this trio once per folder, waiting for each push to finish:

```bat
git add .assetsignore .gitignore manifest.json
git commit -m "Config and manifest"
git push origin main
```

```bat
git add QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25
git commit -m "Images: series folder"
git push origin main
```

```bat
git add atomic
git commit -m "Images: atomic"
git push origin main
```

If any single push fails with an HTTP 500 or "remote hung up", that folder is too big — reply and I'll split it into subfolder-sized pushes.

## Step 8 — Confirm clean

```bat
git status -sb
```

Should read `## main...origin/main` with no `[ahead N]`. Then wait for the green tick at https://github.com/bewbzz/gpkonwaxbackup/actions.

## Step 9 — I finish the app side

Once Pages is live I will fetch the live merged manifest and replace the 832-entry file list in `public/gpk-manifest.json` with the full 2575 entries, then we run the mirror audit and a live import test.

## Note

The 3 pending commits are the manifest update plus two chunked series-2 image commits, so Step 7 pushes should each go through. Only split further if a push returns HTTP 500.

