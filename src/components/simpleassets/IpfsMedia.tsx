import { memo, useMemo, useState, useRef, useEffect, MouseEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import { useIpfsMedia } from '@/hooks/useIpfsMedia';
import { isVideoUrl } from '@/lib/ipfsGateways';
import { Skeleton } from '@/components/ui/skeleton';

interface IpfsMediaProps {
  url: string | undefined;
  alt: string;
  className?: string;
  context?: 'card' | 'detail';
  /** Show skeleton while loading */
  showSkeleton?: boolean;
  /** Additional video URL (e.g. from metadata) */
  videoUrl?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
}

function useIntersectionVisible(rootMargin = '400px'): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return [ref, visible];
}

function RetryOverlay({ onRetry }: { onRetry: (e: MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm hover:bg-background/85 transition-colors group"
      aria-label="Retry loading image"
      title="Retry loading image"
    >
      <div className="h-10 w-10 rounded-full bg-cheese/20 border border-cheese/50 flex items-center justify-center group-hover:bg-cheese/30 transition-colors">
        <RefreshCw className="h-5 w-5 text-cheese" />
      </div>
      <span className="text-[11px] font-medium text-cheese">Retry</span>
    </button>
  );
}

function IpfsMediaComponent({ url, alt, className = '', context = 'card', showSkeleton = false, videoUrl, style, loading }: IpfsMediaProps) {
  const isLazy = loading === 'lazy' || (!loading && context === 'card');
  const [sentinelRef, isVisible] = useIntersectionVisible('400px');
  
  // For eager or detail context, always enabled. For lazy, wait for visibility.
  const enabled = loading === 'eager' || context === 'detail' || isVisible;
  
  const { src, onError, onLoad, isLoading, failed, ready, retry } = useIpfsMedia(url, { context, enabled });

  const isVideo = useMemo(() => {
    return videoUrl || isVideoUrl(url) || isVideoUrl(src);
  }, [videoUrl, url, src]);

  const videoSrc = videoUrl || (isVideo ? src : null);

  const handleRetry = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    retry();
  };

  if (videoSrc && !failed) {
    return (
      <div ref={isLazy ? sentinelRef : undefined} className={`relative ${className}`} style={style}>
        {showSkeleton && (isLoading || !ready) && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}
        {ready && (
          <video
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain"
            onLoadedData={onLoad}
            onError={onError}
            preload={context === 'detail' ? 'auto' : 'metadata'}
          />
        )}
      </div>
    );
  }

  const isAnimated = src.toLowerCase().includes('.gif');

  return (
    <div ref={isLazy ? sentinelRef : undefined} className={`relative ${className}`} style={style}>
      {showSkeleton && (isLoading || !ready) && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      {ready && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-contain ${isLoading && showSkeleton ? 'opacity-0' : ''}`}
          loading={loading === 'eager' ? 'eager' : 'lazy'}
          fetchPriority={context === 'detail' ? 'high' : 'auto'}
          decoding="async"
          onError={onError}
          onLoad={onLoad}
          style={
            context === 'card'
              ? { transform: 'translateZ(0)', backfaceVisibility: 'hidden', imageRendering: 'auto' as const, ...style }
              : isAnimated
                ? { transform: 'translateZ(0)', backfaceVisibility: 'hidden', ...style }
                : style
          }
        />
      )}
      {failed && enabled && url && <RetryOverlay onRetry={handleRetry} />}
    </div>
  );
}

export const IpfsMedia = memo(IpfsMediaComponent);
