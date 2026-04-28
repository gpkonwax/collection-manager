## Add bridge announcement to header

Add a single sentence under the "GPK.Topps Collection Manager" header (and on the logged-out hero) that reads:

> [SimpleAssets logo] Bridge your SimpleAssets to [AtomicAssets logo] AtomicAssets [here](https://atomichub.io/bridge).

The word **here** is a hyperlink to `https://atomichub.io/bridge`. The two brand marks from the uploaded image are shown inline at small size next to their respective names.

### Steps

1. **Prepare logo assets** — split the uploaded `simpleassets.png` banner into two transparent PNGs:
   - `src/assets/logo-simpleassets.png` (left half — diamond key icon + "SimpleAssets" wordmark)
   - `src/assets/logo-atomicassets.png` (right half — atom icon + "ATOMICASSETS" wordmark)
   Done with ImageMagick during implementation; both kept on the dark navy background already present in the source image so they read correctly against our dark theme.

2. **Add the line in `src/pages/Index.tsx`** in two places:
   - Inside the connected-state header block (around line 1655, right under the existing tagline `p`).
   - Inside the logged-out hero (around line 1668, near the "🔒 No new smart contracts" notice) so disconnected visitors also see it.

3. **Markup pattern** (same in both spots):
   ```tsx
   <p className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 text-sm text-cheese/80">
     Bridge your
     <img src={logoSimpleAssets} alt="SimpleAssets" className="h-5 w-auto" />
     to
     <img src={logoAtomicAssets} alt="AtomicAssets" className="h-5 w-auto" />
     <a
       href="https://atomichub.io/bridge"
       target="_blank"
       rel="noopener noreferrer"
       onClick={(e) => { e.preventDefault(); openExternalLink('https://atomichub.io/bridge'); }}
       className="text-cheese underline hover:text-cheese/80"
     >
       here
     </a>.
   </p>
   ```
   Routed through the existing `ExternalLinkWarningDialog` flow (already used elsewhere in `Index.tsx`) so outbound clicks get the standard safety prompt.

4. **Imports** — add `import logoSimpleAssets from '@/assets/logo-simpleassets.png'` and `import logoAtomicAssets from '@/assets/logo-atomicassets.png'` at the top of `Index.tsx`.

### Notes

- No new dependencies, no contract/state changes, no memory updates needed.
- Logos render at 20px tall to sit naturally on one line of body text; they wrap gracefully on narrow viewports thanks to `flex-wrap`.