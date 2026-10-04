import { useEffect, useState } from 'react';
import type { RetroScan } from '@/lib/retroScans';

/** Plain image for a 1985 scan: data mirror first, geepeekay original on error. */
export function RetroScanImage({ scan, alt, className = '' }: { scan: RetroScan; alt: string; className?: string }) {
  const [src, setSrc] = useState(scan.src);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setSrc(scan.src); setFailed(false); }, [scan.src]);
  return (
    <div className={`relative ${className}`}>
      {failed ? (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Scan unavailable</span>
      ) : (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          decoding="async"
          onError={() => { if (src !== scan.fallback) setSrc(scan.fallback); else setFailed(true); }}
        />
      )}
    </div>
  );
}
