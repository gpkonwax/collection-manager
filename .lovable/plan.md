# Split the `atomic` push into chunks under 1 GB

You are right — the failure is the `atomic` folder. That push tried to send **2.08 GiB** in one go. GitHub rejects pushes anywhere near 2 GB with exactly this HTTP 500 / "remote end hung up". Nothing is broken; the commit is still safe on your PC, it just never reached GitHub.

The fix is to break that one commit into several smaller commits and push after each one.

## Step 1 — Open the repo

```bat
cd /d C:\Users\User\Desktop\gpkonwaxbackup-repo
```

## Step 2 — Confirm what is still unpushed

```bat
git log --oneline origin/main..HEAD
```

Paste the output if it looks unexpected. You should see the `Images: atomic` commit (and possibly one or two earlier ones).

## Step 3 — Undo only the commit, keep the files

```bat
git reset --soft HEAD~1
```

`--soft` means: forget the commit, keep every file exactly where it is. Nothing is deleted.

Then unstage them so we can add them in pieces:

```bat
git reset
```

## Step 4 — List the subfolders inside `atomic`

```bat
dir /b atomic
```

Paste that list here. It tells me how many chunks we need and what to name them.

## Step 5 — Push one subfolder at a time

For **each** name from Step 4, run this trio and wait for the push to finish before starting the next:

```bat
git add atomic\<foldername>
git commit -m "Images: atomic/<foldername>"
git push origin main
```

Replace `<foldername>` with the real name each time. Once I see your Step 4 list I will write out every command with the real names so you can copy-paste straight through.

## Rules of thumb

- Keep each push roughly **under 1 GB**. To check a folder's size before pushing, right-click it in File Explorer and choose Properties.
- If one subfolder is still too big, go one level deeper and push its own subfolders the same way.
- If a push fails again with HTTP 500, do **not** retry the same push — reply here and we split that folder further.

## Step 6 — Confirm clean

```bat
git status -sb
```

Should read `## main...origin/main` with no `[ahead N]`. Then wait for the green tick at https://github.com/bewbzz/gpkonwaxbackup/actions.

## Step 7 — I finish the app side

Once Pages is live I will fetch the live merged manifest and replace the 832-entry file list in `public/gpk-manifest.json` with the full 2575 entries, then we run the mirror audit and a live import test.
