# Stack-aware selection in Collector Binder

Today, in the Collector Binder, clicking a stacked card (a card you own multiple copies of) opens a chooser dialog listing every copy — but only when Select mode is OFF. With Select mode ON, clicking the stack silently selects just the first copy, so there is no way to pick a specific duplicate or send both.

## What changes

When Select mode is on and you click a stacked binder slot, the same copy-chooser dialog opens, this time in selection mode:

- Each copy is shown as a card with a checkbox, exactly like the grid.
- Tapping a copy toggles it for transfer/burn; you can pick one, some, or all.
- A "Select all copies" / "Deselect all" control at the top of the dialog.
- The dialog header shows how many of the copies are currently selected.
- Closing the dialog keeps the selections; the bottom selection bar count updates live.

Non-stacked cards keep behaving exactly as they do now (one click toggles selection).

The binder slot for a stack will show a selection indicator when at least one copy inside is selected, so you can tell at a glance which stacks contribute to the current transfer.

## Technical notes

- `src/components/simpleassets/BinderStackDialog.tsx`: add optional `selectionMode`, `selectedIds`, and `onToggleSelect` props. When `selectionMode` is true, render each `SimpleAssetCard` with `selectionMode`/`selected`/`onSelect` instead of the detail `onClick`, and add the select-all/deselect-all row plus an "N of M selected" line in the header. Default (view) behaviour is unchanged.
- `src/pages/Index.tsx` `renderBinderCard`: drop the `!selectionMode` condition so a stack opens `BinderStackDialog` in both modes; pass `selectionMode`, `selectedIds`, and `toggleSelection` into the dialog. For the stack slot card itself, mark `selected` when any copy in `owned` is selected so the ring/checkbox reflects partial selection, and keep `onSelect` only for single-copy slots.
- No changes to transfer/burn logic — they already act on `selectedIds`, so multi-copy selections flow through unchanged.
