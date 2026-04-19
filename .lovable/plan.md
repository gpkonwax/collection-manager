
The user is asking about image loading crashes around 100 cards. Let me investigate.

Key files to inspect:
- `src/hooks/useIpfsMedia.ts` (already in context)
- `src/components/simpleassets/IpfsMedia.tsx` (already in context)
- `src/lib/ipfsGateways.ts` (already in context)
- Pagination — memory says 36 items/page, but user says ~100 cards crash. Maybe binder mode loads more.

Let me check the actual cards-per-page logic and the IntersectionObserver behavior.
