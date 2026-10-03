# Hotlink protection for the Netlify backup mirror (backup A)

These two files stop other websites from embedding the mirrored GPK images on
their own pages (which would burn the Netlify free-tier bandwidth allowance).

## What is here

- `edge-functions/hotlink-guard.ts` — checks each request's Referer header.
  - Referer from `*.lovable.app`, `localhost`, or empty → allowed through.
  - Referer from any other site → 403 "Hotlinking is not permitted".
- `netlify.toml` — tells Netlify where the edge function lives.

## How to deploy (next time you update the Netlify mirror)

1. On your PC, open the folder you drag-and-drop into Netlify (the one
   containing all the mirrored image folders).
2. Copy `netlify.toml` from this folder into the ROOT of that folder.
3. Copy the whole `edge-functions` folder into the ROOT of that folder too,
   so you end up with:

   ```text
   <netlify-site-folder>/
     netlify.toml
     edge-functions/
       hotlink-guard.ts
     prism/
     atomic/
     ... (existing image folders)
   ```

4. Drag the folder into Netlify as usual. After the deploy finishes, Netlify
   shows "1 edge function" on the deploy summary — that confirms it is live.

## Quick test after deploying

- Open any mirrored image URL directly in your browser → should load fine
  (empty referer is allowed).
- The collection manager keeps working as before (its referer is lovable.app).

## Notes

- Netlify free tier includes 1 million edge-function invocations per month;
  mirror image traffic is far below that.
- This does NOT change the images themselves or the manifest — it only adds a
  gatekeeper in front of them.
