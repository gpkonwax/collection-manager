
The user reports that many placeholder images and even collected card images are failing to load in the last 24 hours, making the collector look bad. Let me investigate.

Key files to check:
- `src/lib/ipfsGateways.ts` - gateway list and rotation
- `src/hooks/useIpfsMedia.ts` - retry/fallback logic
- `src/lib/fetchWithFallback.ts` - timeout handling
- `src/components/simpleassets/IpfsMedia.tsx` - already viewed

Let me look at these.
