

## Add More WAX RPC Endpoints for Better Reliability

### What's happening
Your console logs show all current RPC endpoints failing — eosphere (aborted), waxsweden (aborted), pink.gg (Failed to fetch). This looks like a temporary widespread outage or network issue, but we can improve resilience by adding more endpoints from the EOS Nation validated list.

### New endpoints to add (not currently in your lists)

**RPC endpoints (for chain API calls and WharfKit):**
- `https://wax.cryptolions.io` — CryptoLions, Hetzner (EU)
- `https://wax.eu.eosamsterdam.net` — EOSAmsterdam, Hetzner (EU)
- `https://api.hivebp.io` — Hive BP, Cloudflare
- `https://api2.hivebp.io` — Hive BP backup, Cloudflare
- `https://wax.eosdac.io` — eosDAC, Cloudflare
- `https://wax.api.eosnation.io` — EOS Nation, Zayo/Flex (NA)
- `https://api-wax.eosauthority.com` — EOS Authority, Cloudflare
- `https://wax.dapplica.io` — dapplica, Hetzner (EU)

**Atomic Assets API endpoints (new):**
- `https://wax-aa.eosdac.io` — eosDAC
- `https://aa-wax-public1.neftyblocks.com` — NeftyBlocks
- `https://wax-atomic.alcor.exchange` — Alcor
- `https://wax-atomic-api.eosphere.io` — EOSphere
- `https://atomic.hivebp.io` — Hive BP

### Files to update

**`src/lib/waxRpcFallback.ts`**
- Add new endpoints to `WAX_RPC_ENDPOINTS` and `HYPERION_ENDPOINTS` arrays
- Prioritize Cloudflare-fronted endpoints (hivebp, eosdac, eosauthority) since they tend to have better CORS support

**`src/lib/waxConfig.ts`**
- Add new endpoints to `WAX_CHAIN.rpcUrls`
- Add new Atomic API base URLs to `ATOMIC_API.baseUrls`

**`src/lib/wharfKit.ts`**
- Update the chain URL from `wax.eosphere.io` to a more reliable default (e.g., `api.waxsweden.org` or `wax.api.eosnation.io`), or keep eosphere but ensure fallback works

### Proposed endpoint order (by expected reliability)
1. `https://wax.api.eosnation.io` — top guild, validated
2. `https://api.waxsweden.org` — top guild
3. `https://wax.eosphere.io` — usually reliable
4. `https://api.hivebp.io` — Cloudflare-fronted
5. `https://wax.cryptolions.io` — Hetzner EU
6. `https://wax.eosdac.io` — Cloudflare-fronted
7. `https://wax.eu.eosamsterdam.net` — Hetzner EU
8. `https://api.wax.alohaeos.com` — OVH US
9. `https://wax.pink.gg` — keep as fallback
10. `https://wax.eosusa.io` — keep as fallback

