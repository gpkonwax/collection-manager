import { HardDrive } from 'lucide-react';
import { isOfflineBundle } from '@/lib/offlineBundle';

/**
 * Persistent banner shown only in the offline-bundle build. Tells users the
 * viewer is running locally, wallet/RPC features won't work, and points them
 * at the image-backup ZIP so the collection actually renders.
 */
export function OfflineBundleBanner() {
  if (!isOfflineBundle()) return null;

  return (
    <div className="border-b border-cheese/30 bg-cheese/10">
      <div className="container flex items-start gap-2 py-2 text-xs">
        <HardDrive className="w-4 h-4 text-cheese flex-shrink-0 mt-0.5" aria-hidden />
        <p className="text-muted-foreground">
          <span className="font-medium text-cheese">Offline viewer mode.</span>{' '}
          You're running the manager locally. Wallet, live NFT, and network
          features are disabled or will fail — that's expected. Open the
          Offline backup panel and load your image backup ZIP to view every
          card.
        </p>
      </div>
    </div>
  );
}
