# Enlarge pack artwork with card-style controls

## What you’ll see

- Clicking the artwork on a pack tile opens a larger view of that pack’s image. The image itself is the target; **Open Pack**, **Trade**, **Demo Open**, and the pack-information hover remain separate and unchanged.
- The large view opens in **3D tilt** mode by default. The same icon controls as card details switch to **magnifier** and **draw**, including colour choices and a clear-drawing control. Closing and reopening starts fresh in tilt mode.
- This works for both the locally bundled Series 1/2/Exotic pack art and the AtomicAssets pack art loaded from IPFS. The enlarged view is available for unowned and read-only packs too, wherever artwork is shown in the main pack grid.
- In the multiple-pack browser, clicking a pack thumbnail opens the same artwork viewer; the existing **Open** button remains the only way to unbox a pack. Closing the artwork returns to the browser without resetting its page or selection.
- The enlarged image fits phone and desktop screens without cropping important artwork. Both dark and bright themes retain their existing styling.

## Technical approach

- Extract the existing card-detail media interaction (tilt, lens, drawing canvas, mode controls) into a reusable artwork viewer, preserving the card-detail behaviour and its separate mint/metadata presentation. Use the existing `useCardTilt` hook and `IpfsMedia` image fallback for AtomicAssets; support bundled image URLs for SimpleAssets without forcing them through an IPFS gateway. Ensure the magnifier uses the artwork actually displayed, including a working mirror/local ZIP source where applicable.
- Add a small pack-art dialog with the pack name, large image and shared controls, rather than attempting to pass a pack through the card NFT detail dialog. Mount and manage it from each pack tile and multiple-pack browser, with accessible image buttons and independent dialog state so hovering for information, opening a pack, trading, and closing nested dialogs still work.
- Keep drawing temporary to the open viewer; clearing only removes those strokes. No changes to blockchain operations, pack images, trading or saved data.

## Verification

- Test both pack types in the main grid and multiple-pack browser: open image, tilt on entry, magnify, draw/clear, close/reopen, then verify **Open Pack** is still distinct. Check a missing/slow IPFS image has a visible loading or failure state rather than a blank viewer.
- Check desktop and phone sizes in both themes, and confirm card-detail tilt/magnifier/draw interactions remain unchanged.
