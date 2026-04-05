

## Fix: Back images not loading in NFT detail

### Root cause
The back image is wrapped in a complex nested layout: a 533px-wide landscape container with `overflow-hidden`, containing an absolutely-positioned 400x533 div that gets rotated. The problem is `overflow-hidden` clips based on the **pre-transform** bounding box, not the visual result. The 400x533 inner div overflows the ~400px-tall container, gets clipped, and the image either doesn't appear or is mostly cut off.

### Fix (single file: `SimpleAssetDetailDialog.tsx`)
Simplify the back image layout. Instead of nesting a portrait div inside a landscape container and rotating:
- Keep the 533px-wide, 4:3 aspect container for the back
- Put IpfsMedia directly inside with `style={{ transform: 'rotate(90deg)' }}` on the IpfsMedia wrapper
- Remove the intermediate absolutely-positioned div
- Add `overflow-visible` or restructure so the rotation isn't clipped

Specifically: render the IpfsMedia at the container's full size and apply rotation + scaling so the portrait source image fills the landscape frame correctly without clipping.

### No other files changed.

