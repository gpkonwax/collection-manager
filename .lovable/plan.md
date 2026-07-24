## Plan

1. Replace the current hidden-anchor bulk click approach in `BackupPanel.tsx`.
   - The existing method clicks multiple hidden `<a target="_blank">` links in one user action, which browsers can partially block or collapse, causing only one ZIP part to download.

2. Make the primary button open a small in-app download launcher dialog/state instead of trying to force all 3 files automatically.
   - Show the 3 ZIP parts as explicit download buttons.
   - Add a “Start next download” / “Download part 1, 2, 3” flow so every click is a real user gesture and browsers do not block it.
   - Keep the individual fallback links visible.

3. Update the helper text.
   - Change wording from “This opens one download tab per part” to explain that browsers may require one click per part for large GitHub release files.

4. Verify the component compiles and that the UI now exposes all 3 release part URLs clearly.

## Technical details

- Modify only `src/components/BackupPanel.tsx`.
- Do not change mirror metadata, ZIP part URLs, or backup ingestion logic.
- The intended fix is reliability: browsers often block multiple programmatic downloads from one click, so the app should guide the user through separate direct downloads instead of promising one-click bulk downloads.