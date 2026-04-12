

## Fix Banner Images to Fit 580×150px Without Cropping

### Problem
Banner images use `object-cover` CSS which crops/zooms images to fill the container, cutting off parts of the banner artwork.

### Fix
In `src/components/BannerAd.tsx`, change `object-cover` to `object-contain` on all `<img>` elements (in `SingleBanner` ~line 52 and `SharedBannerRotator` ~line 114). This ensures the full image is visible within the 580×150 container without cropping.

### Files Changed
- `src/components/BannerAd.tsx` — replace `object-cover` with `object-contain` on banner `<img>` tags (2 occurrences)

