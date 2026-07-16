## Plan: Label mirrors by hosting provider

### What
Keep the primary mirror as the automatic fallback, but detect and display the hosting provider name (GitHub Pages, Cloudflare Pages, GitLab Pages, etc.) for each configured mirror in the BackupPanel. Unconfigured mirrors stay labeled "Not configured yet."

### Why
You are deploying 3 mirrors on different providers. The current generic "Backup mirror A / B" labels don't tell you which provider each entry points to, which makes the fallback UI harder to reason about.

### Changes

1. **`src/lib/remoteMirror.ts`**
   - Add `getMirrorProviderName(url: string): { name: string; colorClass?: string }` that recognizes common static hosts from the hostname (GitHub Pages, Cloudflare Pages, GitLab Pages, Vercel, Netlify, Surge, etc.).
   - Add `getMirrorDisplayLabel(config: MirrorConfig): string` that returns a friendly label like "Backup mirror A — Cloudflare Pages" when a provider is detected, otherwise falls back to the base label.
   - Export both helpers.

2. **`src/components/BackupPanel.tsx`**
   - Use `getMirrorDisplayLabel` for backup mirror card titles and action buttons.
   - Show a small provider badge next to each configured mirror URL.
   - Update the "Recommended" ZIP download buttons so the primary mirror button shows its detected provider name (e.g., "GitHub Pages") instead of the generic "Built-in primary mirror."

3. **`src/lib/remoteMirror.test.ts`**
   - Add tests for provider detection from hostnames.
   - Add tests for display label formatting.

### Edge cases handled
- Empty/unconfigured mirrors still show "Not configured yet."
- Unknown providers fall back to the existing generic labels.
- The primary mirror remains automatic; this plan does not turn it into a manual selectable option.
- Provider detection is purely presentational — no routing or fallback logic changes.