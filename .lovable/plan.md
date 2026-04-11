

## Add Exotic Pack Images (EXOFIVE / EXOMEGA)

### Images Found

Both pack wrapper images confirmed on geepeekay.com:

- **Standard 5-card pack (EXOFIVE)**: `https://geepeekay.com/gallery/wax/packs/wax_pack_exotic_sm.jpeg` — orange wrapper with Joe Exotic holding a tiger
- **Mega 25-card pack (EXOMEGA)**: `https://geepeekay.com/gallery/wax/packs/wax_pack_exotic_mega_sm.jpeg` — orange wrapper with standing Joe Exotic GPK character

Note: These have a small geepeekay watermark. They are the best publicly available pack images I could find.

### Changes

1. **Download images** to `src/assets/gpk_pack_exotic.jpeg` and `src/assets/gpk_pack_exotic_mega.jpeg`

2. **`src/components/simpleassets/GpkPackCard.tsx`** — add imports and map to SERIES_2_IMAGES:

```ts
import gpkExoticImg from '@/assets/gpk_pack_exotic.jpeg';
import gpkExoticMegaImg from '@/assets/gpk_pack_exotic_mega.jpeg';

const SERIES_2_IMAGES: Record<string, string> = {
  GPKFIVE: gpkSeries1Img, GPKMEGA: gpkSeries1MegaImg,
  GPKTWOA: gpkSeries2aImg, GPKTWOB: gpkSeries2bImg, GPKTWOC: gpkSeries2cImg,
  EXOFIVE: gpkExoticImg, EXOMEGA: gpkExoticMegaImg,
};
```

### Result
Exotic packs display their proper Tiger King pack artwork instead of the fallback box emoji.

