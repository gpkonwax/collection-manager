# Plan: Add Resilience Section to the Info Dialog

## Goal
Add a new section inside the existing **GPK Collection Manager Info** dialog (triggered by the header Info button) that explains the resistance/fallback layers built into the manager and how each one is used.

## Where the change goes
`src/pages/Index.tsx` — inside the `<DialogContent>` for `showInfoDialog`, added as a new block within the existing `<ScrollArea>` content, keeping the same visual style as the other sections (cheese heading, emoji icon, `list-disc` bullets).

## Content to add
A section titled **"Built-in Resistance"** (or similar) covering:

1. **Public IPFS gateway rotation**
   - The app tries multiple public IPFS gateways in parallel.
   - Top gateways race each other; the fastest healthy one wins.
   - Strict per-gateway timeouts (cards ~6s, detail view ~3.5s, max 8s) so dead gateways don't hang the UI.

2. **Primary mirror**
   - A frozen snapshot of every card/pack/puzzle image is hosted on GitHub Pages (`bewbzz.github.io/gpkonwaxbackup/mirror/`).
   - It mirrors the IPFS path structure exactly, so the same image URL resolves identically.
   - Used automatically when public IPFS gateways fail.

3. **Backup mirrors**
   - Backup A is Cloudflare Pages (`gpkonwaxbackup.pages.dev/`).
   - Backup B is intentionally left as a placeholder so a second provider (e.g. GitLab Pages) can be wired in later.
   - Users can manually switch to a backup mirror from the Offline backup panel.

4. **Hash verification**
   - Every mirrored file is recorded in a pinned manifest with its SHA-256 hash.
   - The app verifies bytes against the manifest before using them — the host doesn't have to be trusted, only the math.

5. **Local ZIP / fully offline backup**
   - Users can download split ZIP parts from the GitHub Release and load them directly into the browser.
   - Images are stored as blob URLs (with optional IndexedDB persistence) and served locally even with no internet.

6. **Live image-source indicator**
   - Header pill shows which layer is currently healthy: IPFS → Primary mirror → Backup A → Local ZIP → None.
   - Background canary checks run every 60 seconds and on tab focus.

7. **Offline app bundle (coming soon)**
   - The manager itself will be downloadable as a ZIP, unzippable, and runnable locally via `open-me.html`.
   - Wallet/live features will still need internet, but image viewing and collection management will keep working without any hosted site or mirror.

## Implementation details
- Add the new `<div>` block in the Info Dialog's `<ScrollArea>`, positioned logically among the existing sections (suggested placement: near the top, after "No New Smart Contracts" or after "Inspection & Magnification").
- Reuse existing Tailwind classes: `rounded-lg border border-cheese/30 bg-cheese/5 p-3`, `font-semibold text-cheese mb-1 flex items-center gap-2`, `list-disc pl-5 space-y-1 text-foreground`.
- No new components, hooks, or dependencies required.

## Verification
- Open the Info dialog in the preview.
- Confirm the new section renders with correct copy, no overflow issues, and consistent styling.
- Check that no existing sections are displaced or broken.