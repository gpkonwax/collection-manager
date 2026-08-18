# Adaptive mirror fallback for laggy IPFS

## How it works today

Each image already falls back on its own — `useIpfsMedia` rotates per-hash through the 5 public gateways (6s timeout each, +1.5s per retry, capped 8s), and the primary mirror sits at the **end** of that same rotation list. So a single stubborn image does eventually reach the mirror, but only after every public gateway has failed or timed out — roughly 30-40 seconds. When IPFS is merely slow rather than down, that is exactly the "some load, some hang forever" symptom.

Mirror-first loading currently exists only as an opt-in flag used by Pack History thumbnails; the grid does not use it.

## What to change

Make the grid adapt to gateway health instead of blindly walking the full rotation.

1. **Mirror inserted after 2 gateway failures, not 5.** For card context, once a hash has burned through two gateways, try the primary mirror next. If it hits, done. If it 404s (card newer than the snapshot), continue the remaining gateway rotation as today.

2. **Session-wide "IPFS is laggy" detection.** Track a rolling count of gateway attempts vs. successes. When the failure rate crosses a threshold (e.g. 8 failures in the recent window), flip a session flag that makes *new* images go mirror-first straight away — no more paying the gateway timeout tax per card. Any successful gateway load decays the counter, so the app drifts back to gateways when IPFS recovers.

3. **Reuse the existing mirror-miss bookkeeping.** `mirrorMissSet` and the `mirrorDown` circuit-breaker already exist; extend them so a hash known missing on the mirror skips the mirror insertion, and repeated mirror failures disable the whole shortcut for the session.

4. **Nothing visual changes.** No new spinners, badges or messages — same tiles, just faster to settle. The existing Image Source Indicator keeps reporting mirror health.

## Technical notes

- `src/hooks/useIpfsMedia.ts`
  - Add module-level `gatewayFailureScore` with increment on each `advance()` from a gateway attempt, decrement on `onLoadFinal` from a gateway, and a `ipfsDegraded()` helper reading a threshold constant.
  - Generalise the current `mirrorPhase` machinery: instead of only firing at mount when `mirrorFirst` is set, allow entering the mirror phase when `context === 'card'` and either (a) `triedCount >= MIRROR_INSERT_AFTER` (2), or (b) `ipfsDegraded()` at mount time.
  - On mirror-phase failure or the 1.5s mirror timeout, resume the gateway rotation from the current `gwIdx` rather than restarting — keep `attemptRef` bookkeeping intact so stale timers stay ignored.
  - Leave `mirrorFirst` prop semantics unchanged so Pack History behaviour is identical.
- No changes needed in `IpfsMedia.tsx`, the grid, or any component — the behaviour is entirely inside the hook.
- Extend `src/lib/ipfsGateways.test.ts` / add hook-level tests covering: mirror inserted after 2 failures, mirror miss falls through to remaining gateways, degraded flag decays after successes.

## Trade-offs

- Slightly more traffic to your own mirror during IPFS wobbles — that's the point, and the Cloudflare/GitHub mirrors are static and cheap.
- Cards minted after the last snapshot aren't on the mirror; they cost one extra ~1.5s attempt before continuing, and are then remembered as misses for the session.
