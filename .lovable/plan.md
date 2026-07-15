First: you are right to be upset. The reveal used the wrong numbering for this pack, so the cards shown during reveal were not the actual minted cards.

For the latest Series 1 pack I verified earlier, the actual cards received were:

```text
Asset 100000020303611 — Card #30b Prism — Graffiti Petey
Asset 100000020303612 — Card #11a Prism — Itchy Richie
Asset 100000020303613 — Card #39b Sketch — Green Jean
Asset 100000020303614 — Card #33b Base — Savage Stuart
Asset 100000020303615 — Card #4b Base — Electric Bill
```

Why this happened:
- The `pendingnft.a` table stores Series 1 pack card IDs as zero-based values.
- The minted `simpleassets::sassets` NFTs store the real collection card IDs as one-based values.
- The reveal UI was displaying the raw pending IDs, so it showed the wrong cards even though `getcards` minted the correct NFTs.

Plan:
1. Add a “Last Pack Opened” / “Show Newest Cards” recovery panel that lists the exact minted assets after collection:
   - asset ID
   - card number + side
   - variant
   - name
   - image
2. Build the panel from actual minted `sassets`, not from the pre-claim reveal rows.
3. Keep the reveal fix already started, but make it stricter:
   - Series 1: pending ID + 1
   - Series 2: pending ID + 42
   - Exotic: use category-constrained matching so it cannot accidentally match Series 1 cards with the same number.
4. Add a manual “Reconstruct Last Open” action:
   - reads the latest `pendingnft.a` unboxing rows
   - converts IDs correctly by boxtype
   - matches them to actual wallet NFTs
   - displays the exact cards received even if the animation/reveal failed.
5. Make failed/timeout states explicit:
   - if rows are `done: 0`, show `Collect Unclaimed`
   - if rows are `done: 1`, show “Already collected — show received cards” instead of leaving the user hunting.
6. Prevent misleading reveals going forward:
   - never show final reveal card identities until the app has applied the same ID normalization used for matching actual minted assets.