# Why the public IPFS gateways look "down" — and how to fix it

## What I measured just now

Fetching a real GPK card hash (`QmSRti2HK...`) through each gateway in the app's rotation:

| Gateway | Result |
|---|---|
| `ipfs.io` | 200 OK in 0.4s — healthy |
| `gateway.pinata.cloud` | 200 OK but 11.5s — slower than the 6s card timeout, so the app gives up on it |
| `dweb.link` | 301 redirect to a per-CID subdomain, then hangs past 20s |
| `nftstorage.link` | 302 redirect, then hangs past 20s (nft.storage retired its free public gateway) |
| `cloudflare-ipfs.com` | DNS failure — Cloudflare shut this gateway down |
| `w3s.link` (used by the mirror build script) | 504 |

So it is **not** related to the AtomicAssets upgrade. Nothing about the contract change touches image hosting — the card art is plain IPFS content addressed by hash, and the chain only stores the hash string. What changed is the free public gateway ecosystem: three of the five gateways the app rotates through are now either dead or effectively dead, and a fourth is too slow for the card timeout. Only `ipfs.io` is genuinely healthy, which is exactly the "some load, some hang forever" symptom.

## What to change

1. **Drop the dead gateways.** Remove `cloudflare-ipfs.com` (DNS gone) and `nftstorage.link` (retired) from `PUBLIC_IPFS_GATEWAYS` in `src/lib/ipfsGateways.ts`. Remove `cloudflare-ipfs.com` from the extraction regex list only if it stops matching legacy URLs — keep it there for parsing old hashes.

2. **Reorder by measured health.** Put `ipfs.io` first, `gateway.pinata.cloud` second, `dweb.link` last (its subdomain redirect is the hang source).

3. **Add live replacements.** Add `https://flk-ipfs.xyz/ipfs/` and `https://ipfs.filebase.io/ipfs/` as extra public gateways, but health-probe them in the same run before committing them to the list — only ones that return 200 under 3s for the test hash go in.

4. **Lean harder on our own mirrors while IPFS is this bad.** The adaptive fallback already flips to mirror-first after 8 failures in a session. With only two working gateways the failure threshold should drop (e.g. `MIRROR_INSERT_AFTER` 2 → 1, degrade threshold 8 → 4) so grid images reach the Cloudflare/GitHub mirror in a couple of seconds instead of thirty.

5. **Update the build/audit scripts.** `scripts/mirror-config.json` still lists `w3s.link`, `nftstorage.link` and `cloudflare-ipfs.com`; prune those so future mirror rebuilds don't waste retries on dead hosts.

6. **Surface it.** The Image Source Indicator should read "IPFS degraded — serving from mirror" when the degraded flag is set, so it's obvious this is an upstream IPFS problem and not a broken app.

## Technical notes

- `src/lib/ipfsGateways.ts` — gateway array, ordering, `RACE_GATEWAY_COUNT` may need to drop from 3 to match the shorter list.
- `src/hooks/useIpfsMedia.ts` — threshold constants only; no structural change to the fallback machinery.
- `src/components/ImageSourceIndicator.tsx` — read the degraded flag and add the copy.
- `src/lib/ipfsGateways.test.ts` / `src/hooks/useIpfsMedia.test.tsx` — update expectations for the new list length and thresholds.

## Trade-offs

- More traffic to our own mirrors. They are static and cheap, and are byte-verified complete, so this is the right default while public IPFS is this degraded.
- Cards minted after the last mirror snapshot still need a gateway; with `ipfs.io` healthy they will still resolve, just after the mirror miss.
