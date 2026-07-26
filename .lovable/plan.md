## Goal
Add a second "Bright" skin alongside the existing Dark Cheese theme, inspired by geepeekay.com (hot pink, yellow, electric blue on light background). Same structure, same grid, same pulsing orbs — only colors change. Card frames/borders stay the same neutral color so cards themselves read identically.

## Approach
Everything runs through the existing HSL design tokens in `src/index.css`. Because components already use semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, `hsl(var(--cheese))`, etc.), adding a new skin is almost entirely a CSS-variable swap — no component rewrites.

## Steps

### 1. Theme mechanism
- Add a `.bright` class variant in `src/index.css` (peer to the existing `.dark` block). Both `.dark` and `.bright` will override the `:root` defaults.
- Create `src/hooks/useTheme.ts` — small hook that reads/writes `localStorage['gpk-theme']` (`'dark' | 'bright'`, default `'dark'`) and toggles the class on `document.documentElement`.
- Update `src/App.tsx` — replace the hardcoded `classList.add('dark')` with the hook so the correct class is applied on load.

### 2. Bright palette (geepeekay.com-inspired)
Define these tokens in the new `.bright` block. All values HSL to match the existing system:

| Token | Value | Purpose |
|---|---|---|
| `--background` | `50 100% 60%` | GPK yellow page background |
| `--foreground` | `0 0% 8%` | Near-black body text |
| `--primary` | `330 100% 55%` | Bubblegum pink (buttons, accents) |
| `--primary-foreground` | `0 0% 100%` | White on pink |
| `--accent` | `210 100% 55%` | Electric blue (links, highlights) |
| `--cheese` | `50 100% 55%` | Keep yellow role, tuned for light bg |
| `--cheese-light` / `--cheese-glow` | pink/blue tints | Glow orbs use pink+blue instead of amber |
| `--card` | *(unchanged from dark)* | **Card surface stays dark** so card frames look identical |
| `--card-foreground` | `45 30% 92%` | Light text inside cards (unchanged) |
| `--border`, `--muted`, `--secondary` | tuned light-mode neutrals | |
| `--brown`, `--cream` | remapped to pink/yellow tones | Used by decorations |

Card container (`--card`) intentionally keeps the dark value so each card's surrounding box remains dark — per your requirement.

### 3. Background decorations
`src/components/BackgroundDecorations.tsx` already uses `bg-primary/15`, `bg-accent/10`, `hsl(var(--brown)/0.2)`. Because tokens change, the pulsing orbs will automatically become pink + blue + yellow in bright mode. No component change needed — but I'll verify opacity levels look right on a yellow background and nudge only if orbs disappear.

### 4. Theme toggle UI
Add a small sun/moon toggle button to the header in `src/pages/Index.tsx`, next to the existing controls (Info, Offline backup, etc.). Uses `lucide-react` `Sun` / `Moon` icons.

### 5. Verify components
Quick audit of any component that hardcodes colors instead of using tokens. From memory the codebase is disciplined about this, but I'll scan for `bg-black`, `text-white`, `bg-[#...]`, `text-[#...]` and route any strays through tokens so bright mode doesn't leak dark artifacts.

## Out of scope
- No layout, grid, spacing, animation, or component structure changes.
- Card artwork frames unchanged (dark `--card`).
- Pack reveal / deal animation visuals unchanged (they render over their own backdrop).
- No new fonts — geepeekay uses a custom drippy GPK logo; we're only borrowing the color palette, not typography.

## Files touched
- `src/index.css` — add `.bright` variable block
- `src/App.tsx` — apply theme via hook instead of hardcoded `.dark`
- `src/hooks/useTheme.ts` — new
- `src/pages/Index.tsx` — add toggle button in header
- (Possibly) small token fixes wherever a hardcoded color is found during the audit
