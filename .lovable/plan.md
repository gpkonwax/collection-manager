## Goal
Replace the CSS `rotateX/Y` tilt inside the card detail dialog with a real WebGL card: an extruded 3D mesh with front and back textures and a thick side edge, so the edge visibly thickens and thins as it tilts — closer to topps.wdny.io/catalog. Detail dialog only; grid stays as-is.

## Dependencies (exact versions, per project rule)
- `three@^0.160.0`
- `@react-three/fiber@^8.18.0`
- `@react-three/drei@^9.122.0`

No 3D asset files, no paid packages, no build config changes.

## New component
`src/components/simpleassets/Card3DViewer.tsx`
- Props: `{ frontUrl, backUrl, isLandscape, showBack, className }`.
- Renders a `<Canvas>` sized to the parent (uses the same aspect ratio the current `ImageWithModes` uses: `3/4` portrait, `4/3` landscape).
- Scene contents:
  - `PerspectiveCamera` at a fixed distance, framing the card.
  - Two lights: a soft ambient + one directional key light. No env HDR (keeps bundle small, matches Dark Cheese theme).
  - A single mesh built from `BoxGeometry(width, height, depth)` where `depth ≈ 2% of width` — this gives a real physical edge that thickens/thins on rotation.
  - Materials array (BoxGeometry submesh order: +X, -X, +Y, -Y, +Z=front, -Z=back):
    - Front face: `MeshStandardMaterial` with `map` = front texture (via `useTexture`), `roughness 0.55`, `metalness 0.05`.
    - Back face: same, with `map` = back texture. When landscape (Series 1 back), the texture is rotated 90° via `texture.center=(0.5,0.5); texture.rotation = Math.PI/2` so the artwork reads upright without needing a CSS rotate.
    - Four edge faces: solid off-white `MeshStandardMaterial` (`#f2ede4`, `roughness 0.9`) to mimic card stock.
  - A subtle top glare: an additive-blended `PlaneGeometry` slightly in front of the card whose position follows pointer X/Y (gives the moving highlight WDNY uses, without a full shader).
- Interaction: track pointer over the `<Canvas>` container; drive `mesh.rotation.x` and `mesh.rotation.y` with the same mapping the current `useCardTilt` uses (±12°), lerped each frame for smoothness. `showBack` flips `mesh.rotation.y` by `Math.PI` with a spring-like lerp.
- Texture loading uses `useTexture` (drei). Passes the already-resolved gateway URL — no changes to IPFS resolution logic. Sets `texture.anisotropy = 8` and `texture.colorSpace = SRGBColorSpace` for sharp results.
- Loading fallback: while textures load, render the existing `<IpfsMedia>` as a `<Suspense>` fallback via a wrapper so users never see a blank canvas.

## Wiring into the detail dialog
`src/components/simpleassets/SimpleAssetDetailDialog.tsx`
- In `ImageWithModes`, when `mode === 'tilt'`, render `<Card3DViewer ... />` in place of the current tilt wrapper. Magnifier and Draw modes stay on the existing flat `<IpfsMedia>` path unchanged (drawing on a WebGL canvas is out of scope).
- Remove the CSS `perspective` / `transform` wrapper only in the tilt branch; keep everything else (aspect ratio container, mode toolbar, canvas overlays for draw) exactly as it is.
- Keep `useCardTilt` in the codebase — still used by the grid.

## Non-goals (explicit)
- No per-card parallax / "elements popping out" of the artwork itself — that requires a depth map per card (option C, deferred).
- No holo/foil shader — can be layered on later as a second pass.
- No changes to grid cards.
- No changes to IPFS pipeline, mirrors, or offline bundle.

## Verification
- Open a Series 1 card detail (portrait front, landscape back): the 3D tilt shows a visible thick edge that widens on the side rotating toward the camera and narrows on the far side. Back flip presents the landscape art upright.
- Open a Series 2 / Exotic card: front + back both portrait, edge behavior identical.
- Switch to Magnifier and Draw: works exactly as today (flat image path).
- Check bundle size delta is limited to three + fiber + drei tree-shaken imports (`Canvas`, `useTexture`, `PerspectiveCamera`).
- Confirm no console warnings about `colorSpace` or texture flip.