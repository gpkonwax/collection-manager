// Unified IPFS gateway configuration
// Ordered by reliability and speed (based on real-world testing)
// Note: cloudflare-ipfs.com removed — has been failing consistently for weeks.
export const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://ipfs.io/ipfs/',
];

// Timeout configuration for different contexts
export const IMAGE_LOAD_TIMEOUT = {
  card: 2500,        // 2.5s for cards – fail fast under load to free slots
  detail: 5000,      // 5s for detail page (only 2 images)
  increment: 1000,   // Add 1s per retry
  max: 6000,         // Max 6 seconds
};

// Maximum gateway attempts per context. Card sweep stops earlier so failures
// don't hog concurrency slots while the user scrolls.
export const MAX_GATEWAY_ATTEMPTS = {
  card: 3,
  detail: IPFS_GATEWAYS.length,
};

// Helper to get primary IPFS gateway URL
export function getIpfsUrl(hash: string): string {
  return `${IPFS_GATEWAYS[0]}${hash}`;
}

// Helper to extract IPFS hash from various URL formats
export function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  
  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', '').split('/')[0];
  }
  
  // Handle /ipfs/ paths - capture hash and any path after it
  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/);
  if (ipfsMatch) return ipfsMatch[1];
  
  // Handle bare CID (Qm... or bafy...)
  if (/^Qm[a-zA-Z0-9]{44}/.test(url) || /^bafy[a-zA-Z0-9]+/.test(url)) {
    return url;
  }
  
  // Original patterns for URLs
  const patterns = [
    /ipfs\.io\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /gateway\.pinata\.cloud\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /cloudflare-ipfs\.com\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /dweb\.link\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /nftstorage\.link\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Helper to check if URL is likely a video file by extension
export function isVideoUrl(url: string | undefined): boolean {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
}
