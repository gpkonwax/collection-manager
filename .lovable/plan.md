## Goal
In Collector Binder view, when 1+ price alerts are set, turn the `#/5` (or "X triggered") counter into a clickable button that opens a popup listing all cards with alerts, where each entry can be removed individually.

## Changes

### 1. New component: `src/components/simpleassets/AlertsManagerPopover.tsx`
- Wraps a Popover (from `@/components/ui/popover`) around the existing counter span as the trigger.
- Trigger button:
  - Shows the same content currently rendered (Bell + `X/5`, or BellRing + `N triggered` in destructive color).
  - Styled as a button only when `alerts.length >= 1`; otherwise rendered as a non-interactive span (current behavior).
  - Hover state: subtle bg + cheese border to signal interactivity.
- Popover content (`w-80`, scrollable, max-h ~`70vh`):
  - Header: "Active price alerts (N/5)" with small "Clear all" link.
  - Empty state fallback (defensive — shouldn't render given the gate).
  - List of alert rows, sorted: triggered first, then by `createdAt` desc. Each row:
    - Small thumbnail using `IpfsMedia` (`alt={alert.name}`, ~40px square).
    - Name (truncate) + schema/variant chip.
    - Max price line: `≤ {maxPrice} WAX`. If `lowestPrice` known, second line: `Lowest: {lowestPrice} WAX` in emerald when ≤ max, otherwise muted.
    - Triggered badge (red, pulsing) when `alert.triggered`.
    - "Remove" icon button (Trash2) calling `removeAlert(templateId)`. Toast confirmation `Removed alert for {name}`.
  - Footer hint: "Tip: click the bell on any card to edit its alert."
- Uses `usePriceAlerts()` directly (gets `alerts`, `maxAlerts`, `removeAlert`, `clearAll`).

### 2. Wire it in `src/pages/Index.tsx` (binder view, lines ~1247-1257)
- Replace the existing `<span title=…>` block with `<AlertsManagerPopover triggeredCount={triggeredCount} />`.
- Keep the surrounding flex layout, JsonMenu, and Clear Alerts button untouched.

### 3. (Optional polish) Apply same popover in Classic + Saved views
- Lines ~1313 and ~1355 also pass `alertsCount` to JsonMenu but don't render the standalone counter the same way. Leave those as-is unless the user asks; the request specifically mentions Collector Binder view.

## Technical notes
- All alert state is already global/singleton in `usePriceAlerts`, so removing from the popover instantly updates card placeholders elsewhere.
- No new deps; Popover component already exists at `src/components/ui/popover.tsx`.
- Removal triggers `setModuleAlerts` which notifies all listeners — bell icons on `MissingCardPlaceholder` cards will revert to the unset state automatically.
- Behavior when count drops to 0: popover closes (controlled `open` state), trigger reverts to non-interactive span.

## Out of scope
- No changes to alert checking logic, persistence, JSON import/export, or the per-card `PriceAlertDialog` editor.
