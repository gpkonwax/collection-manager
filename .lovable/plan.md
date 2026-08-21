# Why the primary mirror is serving everything

## What I measured just now (real GPK card hash `QmSRti2HK95NX…`)

| Host | Result |
|---|---|
| `ipfs.io` | 200 in 0.25s — healthy |
| `dweb.link` | 200 in 0.38s — healthy |
| `gateway.pinata.cloud` | 200 but 12.6s — always past the 6s card timeout, so it counts as a failure every time |
| `resizer.atomichub.io` | alive (502/404 on my probe params) — AtomicHub's own cache, not raw IPFS |
| `ipfs.atomichub.io`, `atomichub-ipfs.com` | DNS gone |

So public IPFS is **not** down right now. Two of the three gateways answer in under half a second.

## So why is the mirror being used?

The adaptive fallback added last week latches on and never lets go:

- `MIRROR_INSERT_AFTER = 1` — one slow attempt on a single image sends that image to the mirror.
- `DEGRADED_THRESHOLD = 4` — four net gateway failures flip the whole session to mirror-first.
- Pinata alone can produce those failures: it always exceeds the 6s timeout, and every timeout calls `noteGatewayFailure()`.
- Once the session is degraded, every new card image goes mirror-first. `noteGatewaySuccess()` only fires when a **public gateway** serves an image — mirror hits never decay the score. With no gateway attempts happening, the score can't come down, so "degraded" stays on until you reload the page.

That is the whole answer: a latch, not an outage.

## What AtomicHub does

AtomicHub does not hit public IPFS gateways from the browser at all. It runs its own caching image service (`resizer.atomichub.io`) that pulls each CID from IPFS once, stores it, and serves resized thumbnails from its CDN forever. Our three mirrors (GitHub Pages / Netlify / Cloudflare Pages) are the same architecture — a pre-warmed snapshot of every card. So when the app serves from the mirror it is doing exactly what AtomicHub does; it just shouldn't claim IPFS is degraded while doing it.

## What to change

1. **Break the latch.** Decay `gatewayFailureScore` on mirror hits too (smaller decrement than a gateway success), and add a re-probe: while degraded, let roughly 1 in every N card images still try a gateway first so the session can measure recovery instead of assuming failure.
2. **Stop Pinata poisoning the score.** Pinata is structurally slower than the card timeout. Either drop it from the rotation or exclude its timeouts from `noteGatewayFailure()` — it is a guaranteed false signal for "IPFS is down".
3. **Loosen the thresholds now that only real signals feed them.** `MIRROR_INSERT_AFTER` 1 → 2 and `DEGRADED_THRESHOLD` 4 → 6, so one flaky image no longer represents the network.
4. **Time-box degraded mode.** Auto-clear the flag after ~90s so the worst case is one slow minute rather than a whole session.
5. **Honest label.** Keep the mirror as a legitimate fast path, but only show "IPFS degraded" when measured failures are current — otherwise show the normal mirror-serving state.

## Technical notes

- `src/hooks/useIpfsMedia.ts` — all changes are in the module-level health block (lines ~90-130) plus `advance()` and `onLoadFinal()`: add `noteMirrorServed()` decay, a `degradedSince` timestamp with expiry inside `isIpfsDegraded()`, and a probe counter consulted by `canTryMirror()`.
- `src/lib/ipfsGateways.ts` — if Pinata is dropped, `RACE_GATEWAY_COUNT` drops from 3 to 2.
- `src/components/ImageSourceIndicator.tsx` — label wording only.
- Tests: extend `src/hooks/useIpfsMedia.test.tsx` for latch-release (degraded clears after expiry), mirror-hit decay, and the periodic gateway re-probe.

## Trade-off

Re-probing costs an occasional slow image while IPFS is genuinely bad. Without it the app can never notice IPFS coming back, which is the state it is in now.
