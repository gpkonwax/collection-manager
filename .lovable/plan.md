## Goal
Reshape the "Bright" skin: keep the dark background from Dark mode, but keep the pink/yellow/blue accent palette. Card containers become yellow so cards pop against the dark backdrop.

## Approach
Everything is already token-driven, so this is another CSS-variable swap in the `.bright` block of `src/index.css`. No component rewrites; the existing `theme-bright-*` utilities keep working.

## Token changes (`.bright` in `src/index.css`)

| Token | New value | Notes |
|---|---|---|
| `--background` | `30 20% 8%` | Same as Dark mode |
| `--foreground` | `45 30% 92%` | Light text on dark bg |
| `--card` | `50 100% 55%` | **Yellow card surface** |
| `--card-foreground` | `0 0% 8%` | Near-black text inside yellow cards for readability |
| `--popover` / `--popover-foreground` | dark surface + light text | Match dark mode so dropdowns stay legible |
| `--primary` | `330 100% 55%` | Pink (unchanged) |
| `--accent` | `210 100% 55%` | Blue (unchanged) |
| `--cheese` family | pink (unchanged) | Headers stay pink |
| `--muted` / `--secondary` | dark neutrals | Match dark mode so filter chips/inputs blend |
| `--border` | pink tint (`330 100% 55% / darker`) or dark | Pick whichever keeps card outlines visible on both dark bg and yellow cards |
| `--input` | dark surface | Search/select fields sit on dark bg |
| `--cream` (grid lines) | pink, kept from current | |
| `--brown` (secondary orb) | pink, kept from current | |
| `--glass` / `--glass-border` | dark surface + pink border | |
| Sidebar tokens | dark surface variants | |

## Component text color audit
Because `--card` flips from dark to yellow, any text currently rendered inside cards needs to be re-checked:

- Pack cards (`GpkPackCard`, `AtomicPackCard`) currently use `theme-bright-text` (blue) for label/symbol/amount. On yellow that blue is fine — keep.
- Card grid tiles (`SimpleAssetCard`) render metadata *outside* the media shell; verify the surrounding tile now being yellow doesn't clash with existing text tokens. Adjust only if a stray `text-foreground`/`text-muted-foreground` becomes unreadable on yellow — in that case add a `theme-bright-on-yellow` utility that forces near-black text in bright mode.
- Landing-page FeatureCards / info boxes: same check. If any use `bg-card` they'll turn yellow; confirm their inner text (currently blue via `theme-bright-text`) is still readable on yellow. Blue on yellow reads well, so likely no change.
- Dropdown menus / popovers use `--popover` — kept dark so they remain legible.

I'll do this audit during implementation and only add overrides where readability actually breaks.

## Background decorations
`BackgroundDecorations.tsx` already uses `bg-primary` and `hsl(var(--brown))` — pink orbs on dark bg will look great, no change needed. Grid line opacity (`0.015`) may need a small bump since it's back on dark; will nudge only if invisible.

## Out of scope
- No layout, spacing, animation, or component structure changes.
- Dark mode untouched.
- Toggle button, `useTheme` hook, and `.bright` mechanism all stay as-is.

## Files touched
- `src/index.css` — rewrite the `.bright` variable block
- Possibly one small utility class added for text-on-yellow if the audit finds a readability issue
- `src/components/BackgroundDecorations.tsx` — only if grid opacity needs a nudge