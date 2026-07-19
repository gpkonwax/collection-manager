# Fix the mirror build errors, then continue with deployment

Good news: the script worked — it saved 827 files, made a valid ZIP, and is fully resumable. The 6854 "errors" are almost all files that either don't exist on IPFS (not every card has a `golden` or `collector` variant) or timed out on slow gateways. `error 0` means "no HTTP response at all" (timeout / connection abort), not "file confirmed missing".

We just need to re-run with better settings so real files get retried and phantom files get correctly marked as missing.

---

## Step 1 — Preserve this plan

I'll save the deployment walkthrough to `.lovable/plan-primary-mirror.md` so you can reopen it any time from the Code Editor after we're done fixing this. Nothing else changes.

## Step 2 — Diagnose the errors (code side, no user action)

Cause: `error 0` = fetch timed out or the gateway closed the connection before responding. This happens for two reasons:

1. **Files that don't exist** (e.g. card 1 has no `golden` variant). A well-behaved gateway returns 404, but Pinata / dweb.link often just **hang** on non-existent CIDs instead of 404ing. Our script only records "missing" on a real 404, so these get logged as errors.
2. **Real files that got rate-limited** on the first pass. Public IPFS gateways throttle after a burst.

## Step 3 — Improvements I'll make to the build script (build mode)

1. **Shorter per-gateway timeout, longer overall**: drop timeout from 30s → 12s per gateway, so a hang moves to the next gateway faster.
2. **Treat "all gateways timed out" as missing after N retries**: add a `--retry-errors` pass. Files that fail with `status 0` on every gateway across two full passes get recorded in `manifest.missing` so the next run skips them.
3. **Better gateway list**: reorder to put fastest/most reliable first (`ipfs.io`, `dweb.link`, `4everland.io`, `w3s.link`, then Pinata/Cloudflare as fallbacks). Add `https://w3s.link/ipfs/` and `https://4everland.io/ipfs/`.
4. **Lower concurrency default**: 6 → 4, to reduce rate-limiting.
5. **Clearer end-of-run summary**: show how many errors are "likely missing" (all gateways returned 0/404/timeout) vs "worth retrying" (mixed responses).

## Step 4 — What you do after I ship the fix

Back in your terminal in `C:\Users\User\Desktop\gpk-app`, run **the same command again**:

```
node scripts/build-image-mirror.mjs
```

Because the script is resumable, it will:
- Skip the 827 files already on disk.
- Retry the 6854 errored entries with the new timeout / gateway list.

Expect a similar runtime to the first pass. When it finishes you should see something like:
```
Done. files=~2500 missing=~5000 errors=<small number>
```
The `missing` number represents variants that don't exist for that card (this is expected and fine). What matters is that `errors` drops close to 0.

If `errors` is still large, run it a third time with:
```
node scripts/build-image-mirror.mjs --retry-errors
```
This forces retry of anything previously logged as an error using a slower, more patient pass (2s between requests, single gateway at a time).

## Step 5 — Verify

```
node scripts/verify-mirror.mjs
```

Should report `0 corrupted`. `missing` will be non-zero — that's expected (phantom variants). As long as no known-good file is missing, the mirror is complete.

## Step 6 — Continue with the deployment plan

Once the build is clean, reopen `.lovable/plan-primary-mirror.md` and resume from **Phase 7 — Create a fresh folder for the backup repo**. Everything from that point on is unchanged.

---

## Sanity check before we start

Two quick questions:

1. Did the 827 files that **did** save look right? (Open `C:\Users\User\Desktop\gpk-app\scripts\mirror-output\<hash>\base\1a.jpg` — should be card #1 side A.)
2. Is your internet stable / not on a VPN that might be rate-limiting IPFS gateways?

If both are yes, approve this plan and I'll ship the script improvements.