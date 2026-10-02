Use a locally bundled Archivo Black font only for bright-mode headings, so the offline download retains its typography without affecting dark mode.
Use paired locally bundled banner-title artwork for bright and dark mode so both show the same lettering without changing dark-mode body typography or background.
Use shared interactive artwork controls for NFT details and pack artwork, so tilt, magnifier, and drawing stay consistent while pack operations remain separate.
Keep original SimpleAssets pack-art source URLs separate from bundled image paths and retain AtomicAssets raw image references, so the enlarged viewer can credit provenance without mistaking a backup gateway for the source.
Resolve SimpleAssets mint numbers from the self-hosted sharded mint backup on the data mirror first and live AtomicHub second, so mints survive AtomicHub outages and CORS blocks while new mints still appear once live access opens.
Show only the original mint number on grid ribbons; keep circulating and burned supply in tooltips and details because bridge order and surviving supply are not the original mint or total printed.
Keep default grid ordering in a shared natural-card comparator, sorting identical card copies by original mint after card ID, side, and variant so saved layouts and alternate sort modes retain their own ordering.
- Ship holders + mint backup as one session-only records ZIP (gpk-records.zip) rebuilt by the monthly holders workflow; a loaded ZIP is read before network mirrors so records survive every host going away.
