# Refill the missing mirror images, step by step

Some Series 2 card pictures (the "raw" cards, the "returning" cards, and the "c" side cards) were never copied into your backup mirrors, so they show up blank in the app. The fix is: run the download script on your PC again so it grabs the missing pictures, then upload the folder to your three backup websites again.

You do not need to change any code. Everything below happens on your own computer.

Time needed: about 10 minutes of your attention, plus 30–90 minutes of waiting while the script downloads.

---

## Part 1 — Get the two updated files onto your computer

I changed two files inside the project: a settings file that lists which pictures to download, and the script that does the downloading. Your PC still has the old versions, so first you copy the new ones down.

**1.1** In Lovable, look at the top-right of the screen for the **GitHub** button and click it. If it says the project is synced/connected, you are good. If it asks you to connect, connect it — this is what lets your PC receive the changes.

**1.2** Open **Command Prompt** on Windows. To do this: press the Windows key, type `cmd`, press Enter. A black window opens.

**1.3** Type this exactly and press Enter. This moves the black window into your project folder:

```
cd C:\Users\User\Desktop\gpk-app-latest2
```

**1.4** Type this and press Enter. This pulls the new files down from GitHub onto your PC:

```
git pull
```

You should see a few lines mentioning `scripts/mirror-config.json` and `scripts/build-image-mirror.mjs`. That means it worked.

**1.5** Double-check it actually worked. Type this and press Enter:

```
findstr returning scripts\mirror-config.json
```

If it prints a line containing the word `returning`, you have the new file and you can move on. If it prints nothing, the pull did not bring the new file down — stop here and tell me, and I will give you a manual copy-paste method instead.

---

## Part 2 — Run the download script

**2.1** Still in the same black Command Prompt window, type this and press Enter:

```
node scripts/build-image-mirror.mjs
```

**2.2** Now just watch. You will see lines scrolling past showing file names. Two things to know:

- The roughly 1,500 pictures you already downloaded last time will be **skipped instantly** — the script checks what is already on your disk. Do not worry when it flies past at the start.
- The new pictures download one at a time from IPFS, which is slow. This is the part that takes 30–90 minutes.

**2.3** You can leave it running and go do something else. If you need to stop it, press `Ctrl` + `C`. You can start it again later with the exact same command and it carries on where it stopped — nothing is lost.

**2.4** When it finishes it prints a summary with a count of downloaded files and a count of errors. **If the error count is not zero**, some downloads timed out (very normal with IPFS). Run this to retry just the failed ones:

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

- If it lists **MISSING** files: go back and run the `--retry-errors` command from step 2.4 again.
- If it lists **CORRUPT** files: it prints their names. Delete just those files in File Explorer, then run the download command from step 2.1 again to re-fetch them.

---

## Part 4 — One thing to check before you upload

Open **File Explorer** and go to `C:\Users\User\Desktop\gpk-app-latest2\mirror-output`.

Look for a file called exactly `_headers` — with **no** `.txt` on the end. This is the file that tells the mirror website to allow the app to read it. If it is missing or is called `_headers.txt`, the app will report the mirror as broken even though the pictures are there.

If it says `_headers.txt`, fix it in Command Prompt:

```
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
ren _headers.txt _headers
```

---

## Part 5 — Upload to Netlify (this is the important one)

Netlify is the mirror the app tries first, so this one matters most.

**5.1** Go to <https://app.netlify.com> in your browser and sign in.

**5.2** Click on your site named **gpkonwaxbackup**.

**5.3** Click the **Deploys** tab at the top.

**5.4** Scroll down until you see the drag-and-drop box (it says something like "Drag and drop your site output folder here").

**5.5** Open File Explorer next to it, go to `C:\Users\User\Desktop\gpk-app-latest2`, and drag the folder named **`mirror-output`** into that box.

**Very important:** drag the folder called `mirror-output` itself — not any folder that lives inside it. Last time dragging an inside folder wiped the whole site, because Netlify replaces everything with whatever you drop.

**5.6** Wait for the page to say **Published**. Large uploads can take several minutes.

**5.7** Test it. Paste each of these three links into your browser. Each one should show a picture, not a "Page not found" message:

- `https://gpkonwaxbackup.netlify.app/QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/base/58c.jpg`
- `https://gpkonwaxbackup.netlify.app/QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/raw/65.jpg`
- `https://gpkonwaxbackup.netlify.app/QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/returning/6b.gif`

If all three show pictures, the main job is done. Parts 6 and 7 are the two backup copies.

---

## Part 6 — Upload to Cloudflare (backup copy)

**6.1** In Command Prompt:

```
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
npx wrangler pages deploy . --project-name gpkonwaxbackup
```

**6.2** If it asks you to log in, a browser window opens — approve it, then the upload continues.

**6.3** Cloudflare refuses files bigger than 25MB, so it will skip a handful of large pictures. **This is expected and fine** — Cloudflare is only the third mirror the app tries. As long as the `.assetsignore` file is still sitting in `mirror-output`, those oversized files are skipped automatically instead of failing the whole upload.

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
