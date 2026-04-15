

## Plan: Add Social Links to Footer

Add a row of social/website links centered at the bottom of the footer, below the existing Donate button. Each link will use a recognizable icon and open in a new tab (via the external link warning dialog).

### Links & Icons
- **Website** (cheeseonwax.github.io) → `Globe` icon from lucide-react
- **Telegram** → SVG inline icon (Telegram paper plane — lucide doesn't have one)
- **CHEESEHub** → `Home` icon (or `LayoutGrid`) from lucide-react
- **X / Twitter** → SVG inline icon (X logo — lucide doesn't have one)

### Implementation (single file: `src/pages/Index.tsx`)

1. After the Donate button (line ~1604), add a centered `div` with flex row of icon links
2. Each link will be a small icon button using `requestNavigation()` (the existing external link warning system) on click
3. Style: muted foreground icons that brighten on hover to cheese yellow, small gap between them, centered via `flex justify-center`
4. Telegram and X icons will be small inline SVGs; Website and CHEESEHub use lucide `Globe` and `Home`
5. Add subtle label text below or as tooltip for accessibility

### Visual Layout
```text
[existing footer text]
[Donate button]

  🌐  ✈️  🏠  𝕏
 Web  TG  Hub  X
```

Icons will be ~20px, spaced evenly, centered below the donate button with a small `mt-4` gap.

