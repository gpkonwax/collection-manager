

## External Link Warning Dialog

### What this does
Adds a safety warning dialog that appears when users click any external/affiliate link (banner ads, AtomicHub buy links, etc.), showing them the destination URL and requiring confirmation before navigating away. This matches the pattern used by CheeseHub to protect users from potentially malicious advertiser URLs.

### New file

**`src/components/ExternalLinkWarningDialog.tsx`**
A reusable warning dialog component using the existing `AlertDialog` UI components. It:
- Shows a warning icon and "You are leaving this site" title
- Displays the full destination URL so users can verify it
- Warns that the link is an external/third-party site not controlled by the app
- Has "Cancel" and "Continue" buttons
- On "Continue", opens the URL in a new tab with `noopener noreferrer`
- Exports a simple hook `useExternalLinkWarning()` that returns `{ pendingUrl, requestNavigation, confirm, cancel }` for easy integration

### Modified files

**`src/components/BannerAd.tsx`**
- Replace the direct `<a href>` wrapper with an `onClick` handler that calls `requestNavigation(url)` instead
- Integrate the `ExternalLinkWarningDialog` into the component
- Also apply to the placeholder "Advertise here" link

**`src/components/simpleassets/MissingCardPlaceholder.tsx`**
- Replace the direct `<a href>` to AtomicHub with an `onClick` + warning dialog
- Same pattern: click shows warning, confirm opens external link

### Technical details
- Uses existing `AlertDialog` components from `@/components/ui/alert-dialog` -- no new dependencies
- The hook manages a single `pendingUrl` state -- set it to show the dialog, clear it to dismiss
- URL is still sanitized via `sanitizeUrl` before display and navigation
- Warning text: "You are about to visit an external website. This link is not controlled by GPK Pack Opener. Please verify the URL before continuing."

