

## Add CheeseHub Logo, Info Dialog, and Detailed Features List

### Overview
Three changes to `src/pages/Index.tsx`:
1. Add the CheeseHub logo (already copied to `src/assets/cheesehub-logo.png`) to the top-left header -- visible in both connected and disconnected states
2. Add an Info button (ℹ icon) to the left of the Connect Wallet / wallet dropdown, opening a dialog with a detailed feature list
3. Expand the landing page feature descriptions with more detail focused on flexibility

### 1. Persistent Header Bar
Currently the sticky header only renders when connected (line 971). Change to always render a header bar:
- **Left side**: CheeseHub logo (h-7 w-7) + "CHEESE" (yellow) "Hub" (white) text, linking to `https://cheesehubwax.github.io/cheesehub/` (opens in new tab via trusted URL)
- **Right side**: Info button + wallet dropdown (connected) or Info button + Connect Wallet button (disconnected)
- Same styling as CheeseHub's header: `sticky top-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/50`

### 2. Info Button + Features Dialog
- Add an `Info` icon button (from lucide-react) to the left of the login/wallet button
- Opens a Dialog with a scrollable list of features, organized into sections:
  - **Collection Views**: Classic View, Collector Binder, Saved Collection with drag-and-drop
  - **Pack Openings**: All Topps packs supported, card-by-card reveal animation, card-deal sequence, skip anytime
  - **Flexibility**: Both SimpleAssets and AtomicAssets, multi-account support, any GPK sub-collection, filter by series/variant, sort options
  - **Puzzle Builder**: Series 2 puzzle pieces, drag/rotate/arrange, save/load progress
  - **Inspection & Magnification**: Click-to-zoom, magnifying lens on hover
  - **Transfer & Management**: Transfer SimpleAssets between accounts, bulk selection
  - **Import/Export**: Save layouts as JSON, import/export collection arrangements
  - **Community**: Free to use, built by $CHEESE, banner ads via CheeseHub

### 3. Files Changed
- `src/pages/Index.tsx` -- restructure header, add Info dialog state, add info button, import logo image

### Technical Details
- Import: `import cheesehubLogo from '@/assets/cheesehub-logo.png'` and `import { Info } from 'lucide-react'`
- Add state: `const [showInfoDialog, setShowInfoDialog] = useState(false)`
- The header block (lines 971-1037) will be restructured to always show, with the logo on the left and wallet controls on the right
- Remove the duplicate "Connect Wallet" button from inside the landing page hero since it will now be in the header
- Keep the bottom "Connect Wallet" CTA in the landing page

