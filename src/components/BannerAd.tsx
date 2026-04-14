import { useState, useEffect, memo } from 'react';
import { useBannerAds, type ActiveBanner } from '@/hooks/useBannerAds';
import { IPFS_GATEWAYS } from '@/lib/ipfsGateways';
import { sanitizeUrl } from '@/lib/sanitizeUrl';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { ExternalLinkWarningDialog, useExternalLinkWarning } from '@/components/ExternalLinkWarningDialog';

const ROTATION_INTERVAL = 30_000;
const PLACEHOLDER_IMAGE = '/cheese-banner-placeholder.png';

function getIpfsImageUrl(hash: string, gatewayIndex = 0): string {
  const gateway = IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length];
  return `${gateway}${hash}`;
}

function isPlaceholderBanner(banner: ActiveBanner): boolean {
  return banner.user === '__placeholder__';
}

interface SingleBannerProps {
  banner: ActiveBanner;
  className?: string;
  onLinkClick: (url: string) => void;
}

function SingleBanner({ banner, className = '', onLinkClick }: SingleBannerProps) {
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const placeholder = isPlaceholderBanner(banner);
  const safeUrl = sanitizeUrl(banner.websiteUrl);

  const handleError = () => {
    if (!placeholder) {
      setGatewayIdx(prev => (prev + 1) % IPFS_GATEWAYS.length);
    }
  };

  const handleClick = () => {
    if (safeUrl) onLinkClick(safeUrl);
  };

  const imgSrc = placeholder ? PLACEHOLDER_IMAGE : getIpfsImageUrl(banner.ipfsHash, gatewayIdx);

  return (
    <div
      className={`relative group overflow-hidden rounded-lg border border-cheese/20 bg-card ${safeUrl ? 'cursor-pointer' : ''} ${className}`}
      onClick={handleClick}
    >
      <img
        src={imgSrc}
        alt={placeholder ? 'Advertise here' : 'Advertisement'}
className="w-full h-full object-fill transition-opacity duration-300"
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

interface SharedBannerRotatorProps {
  banners: ActiveBanner[];
  className?: string;
  onLinkClick: (url: string) => void;
}

function SharedBannerRotator({ banners, className = '', onLinkClick }: SharedBannerRotatorProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [gatewayIdxMap, setGatewayIdxMap] = useState<Record<number, number>>({});

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % banners.length);
    }, ROTATION_INTERVAL);
    return () => clearInterval(interval);
  }, [banners.length]);

  const activeBanner = banners[activeIndex];
  if (!activeBanner) return null;

  const safeUrl = sanitizeUrl(activeBanner.websiteUrl);
  const handleClick = () => {
    if (safeUrl) onLinkClick(safeUrl);
  };

  return (
    <div
      className={`relative group overflow-hidden rounded-lg border border-cheese/20 bg-card ${safeUrl ? 'cursor-pointer' : ''} ${className}`}
      onClick={handleClick}
    >
      {banners.map((banner, idx) => {
        const isActive = idx === activeIndex;
        const gIdx = gatewayIdxMap[idx] || 0;
        const imgSrc = isPlaceholderBanner(banner) ? PLACEHOLDER_IMAGE : getIpfsImageUrl(banner.ipfsHash, gIdx);

        return (
          <img
            key={`banner-${idx}-${banner.ipfsHash || 'placeholder'}`}
            src={imgSrc}
            alt={isPlaceholderBanner(banner) ? 'Advertise here' : 'Advertisement'}
            className={`absolute inset-0 w-full h-full object-fill transition-opacity duration-[3000ms] ease-in-out ${isActive ? 'opacity-100' : 'opacity-0'}`}
            onError={() => {
              if (!isPlaceholderBanner(banner)) {
                setGatewayIdxMap(prev => ({
                  ...prev,
                  [idx]: ((prev[idx] || 0) + 1) % IPFS_GATEWAYS.length,
                }));
              }
            }}
            loading="lazy"
          />
        );
      })}
      {/* Invisible spacer to maintain container height */}
      <img
        src={isPlaceholderBanner(activeBanner) ? PLACEHOLDER_IMAGE : getIpfsImageUrl(activeBanner.ipfsHash, gatewayIdxMap[activeIndex] || 0)}
        alt=""
        className="w-full h-full object-fill invisible"
        aria-hidden="true"
      />
      <Badge
        variant="secondary"
        className="absolute top-1 right-1 text-[10px] px-1.5 py-0 opacity-60 group-hover:opacity-100 transition-opacity z-10"
      >
        Ad
      </Badge>
      {safeUrl && (
        <ExternalLink className="absolute bottom-1 right-1 h-3 w-3 text-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
      )}
    </div>
  );
}

function PlaceholderSlot({ onLinkClick, className = '' }: { onLinkClick: (url: string) => void; className?: string }) {
  return (
    <div
      onClick={() => onLinkClick('https://cheesehubwax.github.io/cheesehub/farm')}
      className={`rounded-lg border border-dashed border-cheese/20 bg-card/50 flex items-center justify-center text-xs text-muted-foreground hover:border-cheese/40 transition-colors cursor-pointer ${className}`}
    >
      Advertise here — CheeseHub Banner Ads
    </div>
  );
}

function BannerAdComponent() {
  const { data: banners, isLoading } = useBannerAds();
  const { pendingUrl, requestNavigation, confirm, cancel } = useExternalLinkWarning();

  // Group banners by position
  const positionBanners = new Map<number, ActiveBanner[]>();
  if (banners) {
    for (const b of banners) {
      const existing = positionBanners.get(b.position);
      if (existing) existing.push(b);
      else positionBanners.set(b.position, [b]);
    }
  }

  const renderSlot = (position: number) => {
    const slotBanners = positionBanners.get(position);
    if (!slotBanners || slotBanners.length === 0) return null;
    if (slotBanners.length === 1 && slotBanners[0].displayMode === 'full') {
      return <SingleBanner key={position} banner={slotBanners[0]} className="w-[580px] h-[150px]" onLinkClick={requestNavigation} />;
    }
    return <SharedBannerRotator key={position} banners={slotBanners} className="w-[580px] h-[150px]" onLinkClick={requestNavigation} />;
  };

  const occupiedPositions = [1, 2].filter(p => positionBanners.has(p));

  if (isLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 mb-4">
        <div className="flex justify-center gap-4">
          <div className="w-[580px] h-[150px] rounded-lg border border-dashed border-cheese/20 bg-card/50 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mb-4">
      <div className="flex justify-center gap-4">
        {occupiedPositions.length === 0
          ? <PlaceholderSlot onLinkClick={requestNavigation} className="w-[580px] h-[150px]" />
          : occupiedPositions.map(p => renderSlot(p))}
      </div>
      <div className="flex justify-center mt-1">
        <span
          onClick={() => requestNavigation('https://cheesehubwax.github.io/cheesehub/farm')}
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
