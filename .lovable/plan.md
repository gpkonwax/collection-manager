## Extend GPK Mirror to All WAX Series — 6-Step Plan for First-Timers

### Why you got that error
The file `scripts/build-atomic-mirror.mjs` does **not exist yet**. This plan is a proposal — once you approve it, I will create that script and update the app. Then you can run the commands.

### Goal
Add every remaining GPK series (AtomicAssets templates) plus pack artwork to your existing GitHub + Cloudflare mirrors. The 833 Series 1/2/Exotic files already online stay untouched — this just adds more files.

### Before you start
Make sure you are in the project folder on your computer. On Windows open **Command Prompt** or **Git Bash**. On Mac open **Terminal**. Type this and press Enter:

```cmd
cd C:\Users\User\Desktop\gpk-app
```

Then check you are in the right place:

```cmd
dir package.json
```

If you see `package.json` listed, you are good to go.

---

### Step 1 — See what will be downloaded before downloading anything

This is called a **dry run**. It is like a practice run — it tells you how many images it found and where they will go, but it does **not** download anything yet.

Run this command:

```cmd
node scripts/build-atomic-mirror.mjs --dry-run
```

**What you will see:** a list of schemas (like `foodfightb`, `crashgordon`, `packs`, etc.) and a total file count.

**Expected result:** around 2,600 or more new image files across all schemas plus packs.

If this step works, move to Step 2.

---

### Step 2 — Download the missing images for real

Now run the same command but without `--dry-run`:

```cmd
node scripts/build-atomic-mirror.mjs
```

**What it does:**
- Talks to the WAX AtomicAssets API.
- Finds every GPK template for every series.
- Downloads the front image and back image for each card.
- Saves them into a new folder called `mirror-output/atomic/`.
- Updates the file list in `mirror-output/manifest.json`.

**This will take a while** because there are thousands of images. If your internet cuts out or the script stops, just run the same command again. It skips files already downloaded and continues where it left off.

---

### Step 3 — Check that everything downloaded correctly

Run the verify command:

```cmd
node scripts/verify-mirror.mjs
```

**What it does:** compares every image on your computer against the list in `manifest.json` and checks the file size is correct.

**What you want to see:** something like `files=2600 missing=0 errors=0`.

If it says some files are missing or have errors, go back to Step 2 and run the download command again. Do **not** upload until this step shows zero missing files and zero errors.

---

### Step 4 — Upload the new files to your GitHub mirror

You already have a GitHub mirror at `https://github.com/bewbzz/gpkonwaxbackup.git`. You only need to add the new `atomic/` folder and the updated `manifest.json`.

Run these commands one at a time:

```cmd
git add mirror-output/manifest.json
git add mirror-output/atomic
git commit -m "Add all remaining GPK series and packs to mirror"
```

Now push it. Because there are many files, push in small batches so GitHub does not time out:

```cmd
git push origin main
```

If the push fails because it is too big, push the manifest first, then push the `atomic` folder in smaller chunks. I can help you with that if it happens.

---

### Step 5 — Upload the new files to your Cloudflare mirror

1. Go to the Cloudflare Pages dashboard.
2. Find your `gpkonwaxbackup` project.
3. Click **Upload files** or **Deploy site**.
4. Upload the new `atomic/` folder and the updated `manifest.json`.
5. Do **not** upload the ZIP file — Cloudflare has a 25 MB limit per file.
6. Click **Deploy**.

Wait a few minutes, then test these URLs in a new browser tab:

```text
https://gpkonwaxbackup.pages.dev/manifest.json
https://gpkonwaxbackup.pages.dev/atomic/<some-cid>.png
```

Replace `<some-cid>` with an actual CID from the new `atomic/` folder, or test any image that loads in the folder.

---

### Step 6 — Update the app and publish it

Once both mirrors are live and the test URLs work, I will update the app code so it knows how to find the new `atomic/` images and verify them against the expanded manifest.

After I make those code changes, you just click the **Publish** button in Lovable to push the updated frontend live.

Then open the app, go to the **Offline Backup** panel in the header, and check that the mirrors show as reachable.

---

### Summary of commands in order

```cmd
cd C:\Users\User\Desktop\gpk-app
dir package.json

node scripts/build-atomic-mirror.mjs --dry-run
node scripts/build-atomic-mirror.mjs
node scripts/verify-mirror.mjs

git add mirror-output/manifest.json
git add mirror-output/atomic
git commit -m "Add all remaining GPK series and packs to mirror"
git push origin main
```

Then upload to Cloudflare and click **Publish**.

### What I need from you now
Approve this plan. Then I will create `scripts/build-atomic-mirror.mjs` and update the app code. After that the commands above will work.