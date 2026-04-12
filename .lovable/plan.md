

## Fix Puzzle Builder Images Not Loading

### Problem
The PuzzleBuilder renders puzzle piece images using plain `<img>` tags with a single hardcoded IPFS gateway URL (from `buildGpkCardBackUrl` → `getIpfsUrl`). If that first gateway (Pinata) is down or slow, all 18 images fail with no fallback. The `IpfsMedia` component (which handles gateway rotation) is not used here.

### Solution
Replace the plain `<img>` tags in PuzzleBuilder with the `IpfsMedia` component, which automatically rotates through IPFS gateways on error/timeout. This is the same component used throughout the rest of the app for reliable image loading.

### Changes

**`src/components/simpleassets/PuzzleBuilder.tsx`**
- Import `IpfsMedia` from `@/components/simpleassets/IpfsMedia`
- Replace the `<img>` tag (line ~418-423) with `<IpfsMedia>`, passing `url={backUrl}`, `context="card"`, `loading="eager"`, and appropriate classes
- Keep the `pointer-events-none` and `draggable={false}` behavior via wrapper styling

**`src/components/simpleassets/MissingPuzzlePiecePlaceholder.tsx`**
- Similarly replace the plain `<img>` tag (line ~33-38) with `IpfsMedia` for consistent gateway fallback on the missing piece placeholders too

