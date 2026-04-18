

## Price Alerts — Capped at 5 + API-Friendly Polling

### Cap
- **Hard limit: 5 active alerts per browser.** Enforced in `usePriceAlerts.setAlert()` — at cap, returns error + toast: "Alert limit reached (5/5). Remove one to add another."
- `PriceAlertDialog` shows count (e.g. "3 / 5 alerts used").
- JSON import respects the cap — extras skipped with a toast listing them.

### API-call reductions

1. **Single batched request per cycle** — `template_whitelist=id1,...,id5` returns lowest WAX listings for all 5 in one call. Worst case: 1 request/hour.
2. **Pause when no alerts exist** — interval doesn't run if `alerts.length === 0`.
3. **Pause on hidden tab** — `document.visibilityState !== 'visible'` skips cycle. Resume only triggers a check if `>60 min` since `lastCheckedAt`.
4. **Throttle manual "Check Now"** — 60s cooldown with countdown on button.
5. **Skip triggered alerts** — once fired, exclude that `templateId` from future batches until user dismisses or updates.
6. **ETag / 304 short-circuit** — store response ETag, send `If-None-Match` next cycle for near-free re-checks.
7. **Reuse `fetchWithFallback`** — primary endpoint short-circuits on success.

### Net effect
With 5 alerts max: **1 request/hour while tab open** = ~24 requests/day worst case. Often fewer due to dedup + ETag.

### Files

- **NEW** `src/hooks/usePriceAlerts.ts` — `MAX_ALERTS = 5`, localStorage key `gpk:price-alerts:v1`, hourly batched poll, visibility handling, manual `checkNow()` w/ cooldown, ETag cache, triggered-dedup, JSON export/import.
- **NEW** `src/components/simpleassets/PriceAlertDialog.tsx` — set/edit/remove alert; shows count vs cap, last lowest known price, last-checked timestamp, "View on AtomicHub" link via `ExternalLinkWarningDialog`.
- **EDIT** `src/components/simpleassets/MissingCardPlaceholder.tsx` — bell icon overlay (top-right). States: outline (none) / yellow `text-cheese` (set) / red `animate-pulse` (triggered). Click stops propagation, opens dialog.
- **EDIT** `src/pages/Index.tsx` (binder header only) — three small buttons: **Check Alerts Now** (with cooldown), **Export Alerts** (downloads `gpk-price-alerts-YYYYMMDD.json`), **Import Alerts** (file picker, merges by `templateId`, newer `createdAt` wins, respects 5-cap).

### Alert shape (localStorage)
```ts
{ templateId, name, image, schema, maxPrice, createdAt,
  triggered, lowestPrice?, lastChecked? }
```

### JSON export format
```json
{
  "version": 1,
  "exportedAt": "2026-04-18T12:00:00Z",
  "alerts": [
    { "templateId": "12345", "name": "Adam Bomb", "maxPrice": 50, "createdAt": "..." }
  ]
}
```
Only persistent fields exported; runtime state re-evaluated on next poll.

### Caveats
- Polling only runs while a tab is open. JSON export = crash safety net.
- Up to ~1 hour delay between a cheap listing appearing and alert firing; manual "Check Now" covers urgent cases.

