# Hybrid handwriting replacement

## Goal
Add an optional handwriting tool to card details and pack artwork. Users can either scribble a name and have it recognized, or type the exact text directly. In both paths, the final text is placed on the artwork in the selected handwriting style and active ink color.

## Experience
- Keep the existing tilt, magnifier, pencil, color, and clear controls.
- Add a small handwriting toggle beside the pencil; it is off by default whenever artwork opens.
- When enabled, offer two paths:
  - **Rewrite scribble:** the user draws rough text, then taps Rewrite. The app recognizes only the latest rough strokes and opens a text field containing the result.
  - **Type text:** the user clicks the desired position on the artwork and types the exact name or word without recognition.
- Before changing the canvas, show the text in an editable confirmation field so a mistaken recognition can be corrected.
- If recognition is unavailable, uncertain, offline, or out of credits, open an empty typed-entry field and leave the rough strokes untouched.
- Offer six locally bundled handwriting styles, including cursive, neat print, pencil, marker, childlike, and messy handwriting. Style previews use the actual fonts.
- On confirmation, remove only the rough strokes being replaced, then render the corrected text at their position, approximate size, active ink color, and selected style.
- Allow cancel, undo of the replacement, and clear. The feature remains temporary artwork markup, matching the current drawing tool; it does not alter the NFT or blockchain data.

## Build approach
- Extend the shared artwork canvas used by both NFT details and pack close-ups so cards and packs receive identical behavior.
- Track stroke groups, bounds, active canvas, placement point, and a reversible canvas snapshot rather than treating all marks as one unstructured bitmap.
- Add a compact handwriting editor for text, style, size, confirmation, cancellation, and recognition progress/errors.
- Bundle all six font files locally so typed handwriting and the offline app retain the same appearance.
- Enable Lovable Cloud and add one server-side handwriting-recognition function using the Lovable AI Gateway. Send only a tightly cropped transparent image of the user’s rough strokes, request text-only structured output, and keep the private gateway key off the page.
- Use the current default vision-capable Gateway model after confirming live model availability. Recognition is a user-triggered request and uses workspace AI credits; typed handwriting remains fully offline and free.
- Preserve independent markup on card front/back canvases and operate on the most recently used artwork.

## Validation
- Add focused tests for the default-off state, all six styles, typed placement, active color, successful recognition confirmation, typed fallback, cancel preserving strokes, replacement clearing only its source strokes, and undo restoration.
- Verify card fronts, card backs, landscape backs, and pack artwork in both themes and at desktop and phone widths.
- Exercise one real recognition request end to end, then confirm typed placement still works with network access disabled.
