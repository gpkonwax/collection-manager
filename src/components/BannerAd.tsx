import { useState, useEffect, memo } from 'react';
import { useBannerAds, type ActiveBanner } from '@/hooks/useBannerAds';
import { IPFS_GATEWAYS } from '@/lib/ipfsGateways';
import { sanitizeUrl } from '@/lib/sanitizeUrl';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { ExternalLinkWarningDialog, useExternalLinkWarning } from '@/components/ExternalLinkWarningDialog';

const ROTATION_INTERVAL = 30_000;

function getIpfsImageUrl(hash: string, gatewayIndex = 0): string {
  const gateway = IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length];
  return `${gateway}${hash}`;
}

interface BannerSlotProps {
  banner: ActiveBanner;
  className?: string;
  onLinkClick: (url: string) => void;
}

function BannerSlot({ banner, className = '', onLinkClick }: BannerSlotProps) {
  const [showShared, setShowShared] = useState(false);
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const [sharedGatewayIdx, setSharedGatewayIdx] = useState(0);

  useEffect(() => {
    if (!banner.isShared || !banner.sharedIpfsHash) return;
    const interval = setInterval(() => setShowShared(prev => !prev), ROTATION_INTERVAL);
    return () => clearInterval(interval);
  }, [banner.isShared, banner.sharedIpfsHash]);

  const currentHash = showShared && banner.sharedIpfsHash ? banner.sharedIpfsHash : banner.ipfsHash;
  const currentUrl = showShared && banner.sharedWebsiteUrl ? banner.sharedWebsiteUrl : banner.websiteUrl;
  const currentGatewayIdx = showShared ? sharedGatewayIdx : gatewayIdx;
  const safeUrl = sanitizeUrl(currentUrl);

  const handleError = () => {
    if (showShared) {
      setSharedGatewayIdx(prev => (prev + 1) % IPFS_GATEWAYS.length);
    } else {
      setGatewayIdx(prev => (prev + 1) % IPFS_GATEWAYS.length);
    }
  };

  const handleClick = () => {
    if (safeUrl) onLinkClick(safeUrl);
  };

  return (
    <div
      className={`relative group overflow-hidden rounded-lg border border-cheese/20 bg-card ${safeUrl ? 'cursor-pointer' : ''} ${className}`}
      onClick={handleClick}
    >
      <img
        src={getIpfsImageUrl(currentHash, currentGatewayIdx)}
        alt="Advertisement"
        className="w-full h-full object-cover transition-opacity duration-300"
        onError={handleError}
        loading="lazy"
      />
      <Badge
        variant="secondary"
        className="absolute top-1 right-1 text-[10px] px-1.5 py-0 opacity-60 group-hover:opacity-100 transition-opacity"
      >
        Ad
      </Badge>
      {safeUrl && (
        <ExternalLink className="absolute bottom-1 right-1 h-3 w-3 text-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

function BannerAdComponent() {
  const { data: banners, isLoading } = useBannerAds();
  const { pendingUrl, requestNavigation, confirm, cancel } = useExternalLinkWarning();

  if (isLoading || !banners || banners.length === 0) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 mb-4">
        <div className="flex justify-center gap-4">
          <div
            onClick={() => requestNavigation('https://cheesehubwax.github.io/cheesehub/bannerads')}
            className="max-w-[580px] w-full h-[150px] rounded-lg border border-dashed border-cheese/20 bg-card/50 flex items-center justify-center text-xs text-muted-foreground hover:border-cheese/40 transition-colors cursor-pointer"
          >
            Advertise here — CheeseHub Banner Ads
          </div>
        </div>
        <ExternalLinkWarningDialog url={pendingUrl} onConfirm={confirm} onCancel={cancel} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mb-4">
      <div className="flex justify-center gap-4">
        {banners.map(banner => (
          <BannerSlot
            key={banner.position}
            banner={banner}
            className="max-w-[580px] w-full h-[150px]"
            onLinkClick={requestNavigation}
          />
        ))}
      </div>
      <div className="flex justify-center mt-1">
        <span
          onClick={() => requestNavigation('https://cheesehubwax.github.io/cheesehub/bannerads')}
          className="text-[10px] text-muted-foreground/60 hover:text-cheese/80 cursor-pointer transition-colors"
        >
          Advertise with CheeseHub
        </span>
      </div>
      <ExternalLinkWarningDialog url={pendingUrl} onConfirm={confirm} onCancel={cancel} />
    </div>
  );
}

export const BannerAd = memo(BannerAdComponent);
