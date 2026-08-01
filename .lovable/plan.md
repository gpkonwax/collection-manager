# Refill the missing mirror images, step by step

Some Series 2 card pictures (the "raw" cards, the "returning" cards, and the "c" side cards) were never copied into your backup mirrors, so they show up blank in the app. The fix is: run the download script on your PC again so it grabs the missing pictures, then upload the folder to your three backup websites again.

You do not need to change any code. Everything below happens on your own computer.

Time needed: about 10 minutes of your attention, plus 30–90 minutes of waiting while the script downloads.

---

## Part 1 — Get the two updated files onto your computer

I changed two files inside the project: a settings file that lists which pictures to download, and the script that does the downloading. Your PC folder does not currently have `git` set up, so we use one of two simple methods below.

### Pick the method that matches your situation

**Method A — Use GitHub (best if your Lovable project is connected to GitHub):**

This is the cleanest way. It downloads the whole project fresh, including the two updated files.

**A.1** In Lovable, look at the top-right of the screen for the **GitHub** button and click it. It should say the project is synced and show a repository name like `gpkonwax/your-project-name`. Copy that repository name.

**A.2** Open **Command Prompt** on Windows. Press the Windows key, type `cmd`, press Enter.

**A.3** Move to your Desktop folder:

```
cd C:\Users\User\Desktop
```

**A.4** Clone the repository. Replace `YOUR_GITHUB_USERNAME` and `YOUR_REPO_NAME` with the actual names from step A.1:

```
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git gpk-app-latest2-new
```

For example, if the repo is `gpkonwax/collection-manager`, you would type:

```
git clone https://github.com/gpkonwax/collection-manager.git gpk-app-latest2-new
```

**A.5** Wait for it to finish. You now have a new folder called `gpk-app-latest2-new` on your Desktop with the latest code. Use this folder for the rest of the steps instead of the old `gpk-app-latest2` folder.

**A.6** Check the new file is there. Type this and press Enter:

```
findstr returning "C:\Users\User\Desktop\gpk-app-latest2-new\scripts\mirror-config.json"
```

If it prints a line containing the word `returning`, you are good. Move on to Part 2, but use `gpk-app-latest2-new` everywhere the plan mentions `gpk-app-latest2`.

---

**Method B — Copy the two files manually (best if your Lovable project is NOT connected to GitHub):**

If the GitHub button in Lovable says "Connect project" or you do not want to use git, you can copy just the two changed files by hand.

**B.1** In Lovable, open the **Code Editor** (the file tree on the left side of the screen).

**B.2** Find and click on `scripts/mirror-config.json` in the file tree.

**B.3** Select all the text in that file (`Ctrl` + `A`), copy it (`Ctrl` + `C`).

**B.4** On your PC, open **Notepad**. Paste the text (`Ctrl` + `V`).

**B.5** Click **File → Save As**. Navigate to `C:\Users\User\Desktop\gpk-app-latest2\scripts`. Make sure the file name at the bottom is exactly `mirror-config.json` (not `mirror-config.json.txt`). Change "Save as type" to "All files (*.*)" so Windows does not add `.txt`. Click Save. If it asks whether to replace the existing file, say Yes.

**B.6** Repeat steps B.2 to B.5 for the second file: `scripts/build-image-mirror.mjs`. Save it to the same `scripts` folder with the exact name `build-image-mirror.mjs`.

**B.7** Check it worked. Type this in Command Prompt and press Enter:

```
findstr returning C:\Users\User\Desktop\gpk-app-latest2\scripts\mirror-config.json
```

If it prints a line containing `returning`, the files are updated and you can continue using your existing `gpk-app-latest2` folder.

---

## Part 2 — Run the download script

**2.1** In Command Prompt, move into your project folder. Use whichever folder you ended up with from Part 1:

```
cd C:\Users\User\Desktop\gpk-app-latest2
```

Or, if you used Method A:

```
cd C:\Users\User\Desktop\gpk-app-latest2-new
```

**2.2** Type this and press Enter:

```
node scripts/build-image-mirror.mjs
```

**2.3** Now just watch. You will see lines scrolling past showing file names. Two things to know:

- The roughly 1,500 pictures you already downloaded last time will be **skipped instantly** — the script checks what is already on your disk. Do not worry when it flies past at the start.
- The new pictures download one at a time from IPFS, which is slow. This is the part that takes 30–90 minutes.

**2.4** You can leave it running and go do something else. If you need to stop it, press `Ctrl` + `C`. You can start it again later with the exact same command and it carries on where it stopped — nothing is lost.

**2.5** When it finishes it prints a summary with a count of downloaded files and a count of errors. **If the error count is not zero**, some downloads timed out (very normal with IPFS). Run this to retry just the failed ones:

```
node scripts/build-image-mirror.mjs --retry-errors
```

Repeat that command until the error count reaches zero, or until running it again stops reducing the number.

---

## Part 3 — Check the folder is healthy before uploading

**3.1** Type this and press Enter:

```
node scripts/verify-mirror.mjs
```

**3.2** You want the last line to say `OK`.

- If it lists **MISSING** files: go back and run the `--retry-errors` command from step 2.5 again.
- If it lists **CORRUPT** files: it prints their names. Delete just those files in File Explorer, then run the download command from step 2.2 again to re-fetch them.

---

## Part 4 — Create or fix the `_headers` file before you upload

The `_headers` file is what tells Netlify to allow the app to read from your mirror. Without it the app will report the mirror as broken even though the pictures are there.

Open **File Explorer** and go to the `mirror-output` folder inside whichever project folder you are using. Check whether a file called exactly `_headers` is there — with **no** `.txt` on the end.

### If the file is missing

**4a.1** Right-click in the empty space of the `mirror-output` folder, choose **New → Text Document**.

**4a.2** Windows names it `New Text Document.txt`. Rename it to `_headers`. Windows will warn you that changing the extension might make the file unusable — click **Yes**.

If Windows refuses to let you remove the `.txt` extension, do it through Command Prompt instead:

```
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
notepad _headers
```

This opens Notepad with a new empty file named `_headers` (no extension). Save it and close Notepad.

**4a.3** Right-click the `_headers` file, choose **Open with → Notepad**, and paste in exactly this:

```
/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Access-Control-Allow-Headers: *
```

**4a.4** Save the file and close Notepad.

### If the file is called `_headers.txt`

**4b.1** In Command Prompt, type this (replace `gpk-app-latest2` with your actual folder name):

```
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
ren _headers.txt _headers
```

**4b.2** Then open the file in Notepad and make sure it contains exactly this:

```
/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Access-Control-Allow-Headers: *
```

Save and close Notepad.

### Quick check

The file should now be sitting directly inside `mirror-output` and should be called `_headers` with no `.txt`. If you open it, the first line should be `/*` and the next three lines should start with two spaces and say `Access-Control-Allow-...`.

---

## Part 5 — Upload to Netlify (this is the important one)

Netlify is the mirror the app tries first, so this one matters most.

You can use the web browser drag-and-drop method, or the Command Prompt method if the browser keeps crashing. The Command Prompt method is usually more reliable for large folders.

### Option A — Command Prompt (recommended if browser upload fails)

**5A.1** Install the Netlify command-line tool. In Command Prompt, type this and press Enter:

```
npm install -g netlify-cli
```

Wait for it to finish. You only need to do this once on your PC.

**5A.2** Log in to Netlify through the command line. Type this and press Enter:

```
netlify login
```

A browser window opens. Click **Authorize**. Then come back to Command Prompt.

**5A.3** Move into the `mirror-output` folder inside your project folder. Replace `gpk-app-latest2` with whichever folder you are using:

```
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
```

**5A.4** Upload the folder to your Netlify site. Type this exactly and press Enter:

```
netlify deploy --prod --site gpkonwaxbackup --dir . --build-ignore
```

The `--build-ignore` part is important — it tells Netlify not to try to auto-detect a framework build, which is what caused the wrong menu before.

**5A.5** Wait. You will see a progress bar. When it finishes it prints a line like:

```
Website URL: https://gpkonwaxbackup.netlify.app
```

**5A.6** Test it. Paste each of these three links into your browser. Each one should show a picture, not a "Page not found" message:

- `https://gpkonwaxbackup.netlify.app/QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/base/58c.jpg`
- `https://gpkonwaxbackup.netlify.app/QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/raw/65.jpg`
- `https://gpkonwaxbackup.netlify.app/QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/returning/6b.gif`

If all three show pictures, the main job is done. Parts 6 and 7 are the two backup copies.

### Option B — Web browser drag-and-drop

If you prefer the browser method, follow these steps instead of 5A.

**5B.1** Go to <https://app.netlify.com> in your browser and sign in.

**5B.2** Click on your site named **gpkonwaxbackup**.

**5B.3** Click the **Deploys** tab at the top.

**5B.4** Scroll down until you see the drag-and-drop box (it says something like "Drag and drop your site output folder here").

**5B.5** Open File Explorer next to it, go to the project folder you are using, and drag the folder named **`mirror-output`** into that box.

**Very important:** drag the folder called `mirror-output` itself — not any folder that lives inside it. Last time dragging an inside folder wiped the whole site, because Netlify replaces everything with whatever you drop.

**5B.6** Wait for the page to say **Published**. Large uploads can take several minutes.

**5B.7** Test it using the same three links shown in step 5A.6.

---

## Part 6 — Upload to Cloudflare (backup copy)

Cloudflare Pages refuses any single file bigger than 25 MB. Your `mirror-output` folder contains `gpk-image-mirror.zip` (1.65 GB) and the split ZIP parts, so the upload stops with:

```
Error: Pages only supports files up to 25 MiB in size
```

The fix is a small text file called `.assetsignore` that tells Cloudflare "skip these files". The download script rewrites the folder each time it runs, so this file often gets lost — you need to recreate it before every Cloudflare upload.

**6.1** In Command Prompt, move into the `mirror-output` folder inside your project:

```
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
```

**6.2** Create the ignore file. Copy and paste this whole block in one go and press Enter:

```
(echo *.zip& echo *.zip.001& echo *.zip.002& echo *.zip.003& echo *.z01& echo *.z02& echo *.z03)> .assetsignore
```

**6.3** Check it worked. Type this and press Enter:

```
type .assetsignore
```

You should see the seven lines starting with `*.zip`. If the file is empty or you get "cannot find", repeat step 6.2 exactly.

**6.4** Find any other oversized files. Cloudflare rejects **any** file over 25 MB, not just ZIPs. Type this and press Enter:

```
forfiles /S /M *.* /C "cmd /c if @fsize GTR 26214400 echo @relpath @fsize"
```

- If it prints nothing (or only the ZIP files you already ignored), you are fine — go to step 6.5.
- If it prints other files (some large `.gif` cards can be oversized), note their names. For each one, add a line to `.assetsignore`. For example, if it printed `.\QmcAky...\prism\58a.gif`, run:

```
echo QmcAky...\prism\58a.gif>> .assetsignore
```

Use the path exactly as printed, but without the leading `.\` and with forward slashes, e.g. `QmcAky.../prism/58a.gif`. Those few pictures will simply be missing from Cloudflare, which is fine — Cloudflare is the third mirror the app tries, after Netlify and GitHub.

**6.5** Now upload. Type this and press Enter:

```
npx wrangler pages deploy . --project-name gpkonwaxbackup --commit-dirty=true
```

The `--commit-dirty=true` part just silences the "uncommitted changes" warning you saw.

**6.6** If it asks you to log in, a browser window opens — approve it, then the upload continues.

**6.7** When it finishes it prints a deployment URL. Test one picture:

`https://gpkonwaxbackup.pages.dev/QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/base/58c.jpg`

If that shows a picture, Cloudflare is done.

**If it still errors on a file size:** the error message names the exact file. Add that file's path to `.assetsignore` the same way as step 6.4 and run the deploy command again. Repeat until it goes through.


---

## Part 7 — Update GitHub Pages (backup copy)

This is your `gpkonwaxbackup` repository, which you have cloned somewhere separately on your PC.

**7.1** Copy the new picture files from `mirror-output` into the `mirror` folder inside that clone (File Explorer, copy and paste, choose "replace/merge" if asked).

**7.2** In Command Prompt, move into that cloned folder (replace the path with wherever you keep it):

```
cd C:\path\to\your\gpkonwaxbackup
git add mirror
git commit -m "Add Series 2 side-c, raw and returning card images"
git push
```

The new files are a small addition this time, so it should push in one go without hitting GitHub's size limits.

---

## Part 8 — Final check

**8.1** Back in the project folder, run the audit. It checks every single file against all three websites and tells you what is missing where:

```
cd C:\Users\User\Desktop\gpk-app-latest2
node scripts/audit-mirrors.mjs
```

Expected result: Netlify and GitHub complete; Cloudflare missing only the oversized files.

**8.2** Open the app in your browser, click the **IPFS Live** indicator in the header, and press **Check again**. All three mirrors should show as reachable.

**8.3** Open a Series 2 card that uses a `raw` or `returning` variant. The artwork should now appear instantly instead of hanging or showing blank.

---

## Technical notes

- The updated `scripts/mirror-config.json` now enumerates, for Series 2 (`QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ`): `base` with sides a/b/c, `raw` as a sideless `.jpg` with a shared `raw/back.jpg`, `returning` as ids 1–13 `.gif` with a shared back, plus `collector` and `originalart`. Exotic uses the on-chain variant names `tigerscratch` and `tigerborder`.
- `scripts/build-image-mirror.mjs` now honours per-variant `sides`, `cardIdRange`, `sharedBack`, and `backPattern` overrides — that is what makes those non-standard paths enumerable at all.
- `manifest.json` is rewritten on each run with a sha256 per file, so `verify-mirror.mjs` and `audit-mirrors.mjs` stay accurate after this refresh.
- No app redeploy is required; the client resolves these paths at runtime from the mirror base URLs already configured in `src/lib/ipfsGateways.ts`.
