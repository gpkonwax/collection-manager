# Replace the second shared-slot placeholder banner

## What will change

1. Add the supplied GPK Collection Manager banner through the app’s image asset system so it works in both Lovable and the GitHub Pages site.
2. Keep WaxEDGE as the first vacant shared-slot placeholder.
3. When both shared positions have vacant halves, use the new GPK banner for the second vacancy instead of the old yellow CheeseHub banner.
4. Make the new GPK banner open `https://gpkonwax.github.io/collection-manager/` through the existing external-link warning.
5. Leave paid banners, rotation timing, slot dimensions, and IPFS loading unchanged.

## Technical notes

- Introduce a distinct GPK placeholder identity and image mapping rather than treating every non-WaxEDGE placeholder as the yellow banner.
- Update the deterministic second-vacancy assignment from the CheeseHub placeholder to the GPK placeholder.
- Keep the old yellow image file available, but it will no longer be assigned to the second shared-slot vacancy.
- Verify the first vacancy shows WaxEDGE, the second simultaneous vacancy shows the GPK banner, and both links point to their correct destinations.

## Not included

- No changes to the standalone empty banner area or banner rental rules.
- No changes to the supplied artwork.
