# Fix the Netlify mirror after the wrong folder was uploaded

## What went wrong

Netlify is currently showing a 404 for the holders list because the wrong folder was dragged in.

When you drag a folder into Netlify, it treats that folder as the entire website. You dragged the `manifests` folder, so Netlify replaced the whole site with just the contents of that folder. The file ended up at:

```text
https://gpkonwaxbackup.netlify.app/gpk-topps-holders.json
```

But the app looks for it at:

```text
https://gpkonwaxbackup.netlify.app/manifests/gpk-topps-holders.json
```

This also deleted the images and the `_headers` file that were already on Netlify. We need to put everything back by uploading the full `mirror-output` folder.

---

## What you need to do

### Step 1 — Find the correct folder on your computer

Open File Explorer and go to this path:

```text
C:\Users\User\Desktop\gpk-app-latest2\mirror-output
```

You should see something like this inside it:

```text
mirror-output
  _headers
  manifests
    gpk-topps-holders.json
    pinned.json
  ipfs
    ...lots of image files and subfolders
```

If you do not see an `ipfs` folder or image files, the images are somewhere else on your computer. Stop here and tell me, because uploading without them will leave the mirror broken.

If the `_headers` file is missing, create it now:

1. Right-click inside the `mirror-output` folder.
2. Choose New → Text Document.
3. Name it exactly `_headers` (including the underscore, no `.txt` on the end). If Windows warns about changing the extension, click Yes.
4. Open it in Notepad and paste this exactly:

```text
/*
  Access-Control-Allow-Origin: *
```

5. Save and close.

### Step 2 — Upload the whole folder to Netlify

1. Go to `https://app.netlify.com/sites/gpkonwaxbackup/deploys` in your browser.
2. You will see an area that says "Drag and drop your site folder here" or similar.
3. In File Explorer, click once on the `mirror-output` folder to select it.
4. Drag the **folder itself**, not the files inside it, onto the Netlify drop zone.
5. Wait for the upload to finish. Netlify will show a progress bar and then a "Published" message.

Important: do not open the `mirror-output` folder and select the files inside. Select the whole `mirror-output` folder.

### Step 3 — Check that it worked

Open these three links in your browser. Each one should load successfully, not show a 404 page.

1. `https://gpkonwaxbackup.netlify.app/manifests/gpk-topps-holders.json`
   - Should show a big block of JSON text.

2. `https://gpkonwaxbackup.netlify.app/manifests/pinned.json`
   - Should also show JSON text.

3. One image URL, for example:
   `https://gpkonwaxbackup.netlify.app/ipfs/Qm.../something.png`
   - Replace this with a real image path from the manifest. It should show the actual card image.

If all three load, Netlify is fixed.

### Step 4 — Test it inside the Collection Manager

1. Open the Collection Manager in your browser.
2. Press Ctrl+F5 to hard-refresh the page.
3. Click the **View Wallet** button in the header.
4. Click **Show List**.
5. You should now see a ranked list of GPK holders with columns for Account, SA, AA, and Total.

---

## After Netlify is fixed, do the same for the other mirrors

### GitHub Pages (Primary mirror)

1. Open your `gpkonwaxbackup` GitHub repository folder on your computer.
2. Copy the file `gpk-topps-holders.json` from:
   `C:\Users\User\Desktop\gpk-app-latest2\mirror-output\manifests\gpk-topps-holders.json`
3. Paste it into the repository at `mirror\manifests\`.
4. Open Git Bash or Command Prompt in that repository folder and run:

```bash
git add mirror/manifests/gpk-topps-holders.json
git commit -m "Add gpk.topps holders snapshot"
git push
```

### Cloudflare Pages (Backup B)

1. Take the same `gpk-topps-holders.json` file.
2. Put it inside a folder called `manifests`.
3. Use Wrangler to upload that folder to Cloudflare, the same way you uploaded images before.

You do not need to upload the images again to Cloudflare unless you are also updating them. Just add the new manifest file.

---

## Remember this for next time

Netlify manual deploys always replace the entire site. Never drag a subfolder like `manifests` or `ipfs`. Always drag the complete site root folder, which is `mirror-output`.
