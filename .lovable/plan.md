## What is happening

The repeated `error 0` lines are almost certainly timeout/abort failures from IPFS gateways, not normal file corruption. The examples are all rare Series 1 variants like `collector` and `golden`, which likely do not exist for many card numbers.

The current script records those timeout files as retryable first, so even after `--retry-errors` you can still see thousands of errors instead of getting a clean final `missing` list.

## Plan

1. **Update the mirror build script retry behavior**
   - Make `node scripts/build-image-mirror.mjs --retry-errors` act as the final slow pass.
   - If a file still fails on every gateway during that slow pass, mark it as `missing-timeout` instead of leaving it as a retryable error.
   - This prevents the same thousands of likely-nonexistent files from looping forever.

2. **Keep real successful files safe**
   - The script will still skip files already downloaded and hash-verified in `scripts/mirror-output/`.
   - It will not delete existing downloaded images.
   - It will only change how unresolved timeout files are classified after the deliberate slow retry pass.

3. **Make the terminal message clearer**
   - Update the final output so it explains:
     - normal run = retry later if there are pending timeout errors
     - `--retry-errors` run = remaining timeout files were treated as missing
   - This should make it obvious when you are allowed to move on.

4. **Your next local steps after the fix**
   - Re-download the updated code from Lovable.
   - Copy your existing `scripts/mirror-output/` folder into the newly downloaded app folder if needed.
   - Run:
     ```bash
     node scripts/build-image-mirror.mjs --retry-errors
     ```
   - Then run:
     ```bash
     node scripts/verify-mirror.mjs scripts/mirror-output
     ```
   - If it says `OK`, you can resume the saved GitHub Pages deployment plan.

## Success criteria

- The retry command no longer leaves thousands of `pending-retry` files.
- `manifest.json` has the successfully downloaded images plus a `missing` list for unresolved/nonexistent variants.
- `verify-mirror.mjs` reports no missing or corrupted downloaded files.