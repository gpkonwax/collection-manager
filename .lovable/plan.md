I checked the current reveal code. The real pack flow now has an all-or-nothing `preloading` phase before it ever enters the same visible reveal phase that demo mode uses. On your screenshot, the app already knows there are 25 cards, but the image preloader has reported `0 / 25`, so the UI is trapped before reveal. The current `Reveal now` handler also depends on the active preload run object, so if that run is missing, finalized, or wedged, the button can no-op instead of forcing the reveal.

Plan:

1. **Remove the blocking preload gate from real pack reveals**
   - Once the pending `pendingnft.a` rows are found and the 25/30/35 card list is built, transition into the normal reveal grid immediately, the same way demo mode does.
   - Keep image loading/fallbacks inside each card tile so images can still use mirrors/gateways, but do not block the entire pack opening on image preload completion.

2. **Make `Reveal now` unconditional**
   - Store the built reveal card list separately from the preload run.
   - Change the button to force `phase = 'revealing'` from that stored card list even if the preload controller/ref is gone or broken.
   - Make the button available immediately during preparation, not only after a long timeout.

3. **Keep a short best-effort warmup, not an infinite wait**
   - If we keep any preload step at all, cap it tightly and race mirrors/gateways in the background.
   - The warmup may improve image readiness, but it must never be required for reveal to start.

4. **Fix post-collect deal preparation the same way**
   - The collection/deal animation currently also waits on image preloads with no real escape if images hang.
   - Change that to best-effort only: wait briefly for images to warm, then deal every confirmed card anyway.
   - This prevents “cards are collected but animation never starts” or partial/no animation caused by image preloading.

5. **Preserve the working demo behavior as the reference**
   - Demo and real SA pack openings should share the same visible reveal mechanics: card backs appear, then cards flip one-by-one.
   - The only difference should be where the card list comes from: demo fixture cards vs. real `pendingnft.a` rows.

6. **Verify the exact failure path**
   - Test that clicking `Reveal now` immediately leaves the preparation screen.
   - Test that a reveal with unreachable image URLs still flips all card slots instead of staying at `0 / N`.
   - Test that collecting after reveal still triggers the collection deal animation and does not wait forever on image preload.