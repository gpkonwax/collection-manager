

## Move bell to top-left and add price alerts to all binder cards

### Changes

**1. `src/components/simpleassets/MissingCardPlaceholder.tsx`**
- Move the bell button from `top-1.5 right-1.5` to `top-1.5 left-1.5` so it doesn't conflict with the stack multiplier (which lives in the top-right on owned cards). The placeholder doesn't have a multiplier itself, but moving it makes the corner placement consistent across the binder.

**2. `src/components/simpleassets/SimpleAssetCard.tsx`**
- Add an optional `priceAlertTemplateId?: string` prop. When provided, render a bell button in the top-left corner (mirroring the placeholder) that opens a `PriceAlertDialog`.
- The bell uses the same styling pattern as `MissingCardPlaceholder`: `absolute top-1.5 left-1.5 z-20`, with state classes for normal / has-alert / triggered.
- Keep the stack multiplier `x{n}` in the top-right (unchanged).
- The selection-mode checkbox currently sits in `top-2 left-2`. When in selection mode, hide the bell to avoid overlap (selection is the primary action).
- Wire `usePriceAlerts` and `PriceAlertDialog` inside the card. To avoid the alert button triggering card click/drag, stop propagation on its click handler.
- Build a minimal `BinderTemplate`-shaped object from the asset (templateId, name, image, schema) for passing to `PriceAlertDialog`.

**3. `src/pages/Index.tsx` (`renderBinderCard`, ~line 944)**
- Pass `priceAlertTemplateId={template.templateId}` and the template's `name`, `image`, `schema` to `SimpleAssetCard` so the bell knows which template to alert on. Simplest: pass a single `priceAlertTemplate={template}` prop containing the full `BinderTemplate`.
- Only the binder view passes this — Classic and Saved views won't show the bell on owned cards (no template binding).

### Notes
- Re-export comparator in `SimpleAssetCard` memo: add `priceAlertTemplate` (or its templateId) to the equality check.
- No changes to `usePriceAlerts` hook or `PriceAlertDialog` — both already accept a `BinderTemplate`.

### Files affected
- **EDIT** `src/components/simpleassets/MissingCardPlaceholder.tsx` — move bell to `top-1.5 left-1.5`.
- **EDIT** `src/components/simpleassets/SimpleAssetCard.tsx` — add optional `priceAlertTemplate` prop, render top-left bell + dialog.
- **EDIT** `src/pages/Index.tsx` — pass `priceAlertTemplate={template}` from `renderBinderCard` to `SimpleAssetCard`.

