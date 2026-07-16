I’ll fix the header button by separating “has received cards to show” from dismissing the notice.

Plan:
1. Update the Show Received Cards click handler so it focuses the collection view without clearing `collectionSyncNotice` immediately.
2. Keep the button rendered while the received-card notice exists, so it does not disappear right after click.
3. Preserve the no-refresh behavior: no full refetch/reconstruct on button press, only view/filter changes and scroll-to-top.
4. Verify the button still appears next to Offline Backup / Recover Stuck Cards and clicking it moves the user to the received-card view.