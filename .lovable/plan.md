

## Show Front Card Image for Missing Puzzle Pieces + Fix AtomicHub Links

### Problem
The missing puzzle piece placeholders currently show card back images with broken AtomicHub links (AtomicHub can't filter by schema_name). The user wants to show the "a" side front image instead, which maps to a specific template — enabling working template-based AtomicHub links.

### Solution
1. Show the front "a" card image using `buildGpkCardImageUrl('gpktwoeight', 'base', cardId, 'a')`
2. Use template-based AtomicHub URLs (like `MissingCardPlaceholder` does) by looking up the template ID from binder templates
3. Add a blurb noting that b and prism versions also contain the puzzle piece on the back

### Changes

**`src/components/simpleassets/MissingPuzzlePiecePlaceholder.tsx`**
- Accept an optional `templateId` prop alongside `cardId`
- Replace `buildGpkCardBackUrl` with `buildGpkCardImageUrl('gpktwoeight', 'base', cardId, 'a')` for the front image
- When `templateId` is provided, use `https://atomichub.io/market?collection_name=gpk.topps&template_id=${templateId}&order=asc&sort=price` (same format as `MissingCardPlaceholder`)
- Fall back to current URL format if no templateId
- Keep the greyscale/dimmed styling + "Buy on AtomicHub" overlay + ExternalLinkWarningDialog

**`src/pages/Index.tsx`** (lines ~1492-1514)
- In the missing puzzle pieces section, look up each card ID's template from `binderTemplates` (already loaded)
- Pass `templateId` to `MissingPuzzlePiecePlaceholder`
- Add a blurb below the heading: *"The a, b, and prism versions of these cards all contain the puzzle piece on the back."*

### Technical Details
- `binderTemplates` from `useBinderTemplates` already contains `templateId` and `cardid` fields — we filter for matching cardid + variant "base" + quality "a" to find the right template
- Image URL: `buildGpkCardImageUrl('gpktwoeight', 'base', cardId, 'a')` returns the IPFS URL for the front of the "a" side base variant

