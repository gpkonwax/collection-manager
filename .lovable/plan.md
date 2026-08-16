# Tiger King cards blank with the ZIPs loaded — diagnose, then fix

## What I checked (and what it rules out)

- Pulled all 1,385 `gpk.topps` AtomicAssets templates from the chain API and diffed every `img` / `backimg` path against `public/gpk-manifest.json`: **zero missing**. All 312 Tiger King (schema `exotic`) images are in the snapshot, including the 30 "golden" cards, which live under a separate CID (`QmeLsJK...`) from the main exotic CID (`QmYkMDkB...`).
- The mirror audit (`scripts/mirror-output/audit-report/summary.txt`) reports COMPLETE on the hosted mirrors.
- Probed IPFS directly: the exotic CID genuinely has only 15 cards × 2 sides, and `sketch` / `relic` / `originalart` don't exist there — so those absences are correct, not gaps.

So this is **not** a coverage problem in the backup. The images are in the manifest, and therefore should be in the ZIPs. Which means the blanks come from one of:

1. The ZIP contents didn't fully land in the browser's in-memory mirror (a part failed to ingest, or one part wasn't loaded), and the cards fall through to public IPFS gateways which are currently failing — the console already shows repeated `Failed to fetch` against gateways.
2. The lookup key computed at render time doesn't match the key the ZIP was stored under, so a present file is never found.

Both are real risks in the current code, and I can't tell them apart from outside the browser — the 4 GB ZIPs only exist on your machine. So step 1 is a diagnostic you can run with the ZIPs loaded; steps 2–4 fix the key-matching weaknesses I did find while reading the code.

## Step 1 — Coverage self-check in the Offline Backup panel

Add a "Check loaded backup" button next to the ZIP parts. It loads `gpk-manifest.json`, looks up every manifest entry against the in-memory mirror exactly the way the card grid does, and reports:

- files expected vs. files actually resolvable
- a per-series / per-variant breakdown of what's unresolvable (e.g. "Tiger King golden: 30 of 30 missing")
- a "copy report" button so you can paste the result back to me

This turns "a bunch of cards are blank" into a precise list, and it stays useful every time the snapshot is refreshed.

## Step 2 — Make the local-mirror lookup forgiving

Card URLs are percent-encoded when built (`src/lib/gpkCardImages.ts:135` runs `encodeURIComponent` on the variant folder and file name), while the mirror scripts store the raw folder name. Any variant whose name contains a space — Series 2's `tiger stripe` and `tiger claw` — therefore produces the key `CID/tiger%20stripe/1a.gif`, which can never match the stored `CID/tiger stripe/1a.gif`. Fix in `src/lib/localMirror.ts`:

- index each ingested entry under both its raw path and its percent-decoded path
- try the key as-is, then decoded, then encoded, before giving up
- index atomic entries under both the bare `CID/file` form and the stored `atomic/CID/file` form

## Step 3 — Show why a card is blank

When a card fails after every source, surface the reason in the existing image-source indicator: "local mirror miss → gateways failed". Right now a blank tile is silent, which is why this took a manifest diff to investigate.

## Step 4 — Re-verify

With the ZIPs loaded, run the Step 1 check and confirm Tiger King reports full coverage and the tiles render offline.

## Technical notes

- `src/lib/localMirror.ts:73-83` (`resolveLocalMirror`) is a plain `Map.get` with a single atomic fallback; `indexAtomicPath` (`:106-121`) only special-cases a bare CID that gained an extension. Key normalization goes here.
- `src/hooks/useIpfsMedia.ts:246` computes `localMirrorUrl` and `:496` uses it as the winning `src`; no change needed beyond it receiving a hit.
- Manifest shape: keys are the bare IPFS path (`QmeLsJK.../1b.gif`) with a `path` field pointing at the ZIP-relative location (`atomic/QmeLsJK.../1b.gif`) — the self-check must compare against `path` as ingested, not the key.
- The coverage check runs entirely client-side against already-loaded blobs; no network beyond the manifest fetch.
