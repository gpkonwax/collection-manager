import { memo, useMemo, useState, DragEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import { useCardTilt } from '@/hooks/useCardTilt';
import { Bell, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { PriceAlertDialog } from '@/components/simpleassets/PriceAlertDialog';
import type { BinderTemplate } from '@/hooks/useBinderTemplates';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface SimpleAssetCardProps {
  asset: SimpleAsset;
  onClick: () => void;
  draggable?: boolean;
  className?: string;
  selectionMode?: boolean;
  selected?: boolean;
  stackCount?: number;
  onSelect?: (id: string) => void;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void;
  priceAlertTemplate?: BinderTemplate;
}

function getMintInfo(asset: SimpleAsset): string | null {
  const combined = { ...asset.idata, ...asset.mdata };
  const mintKeys = ['edition', 'mint', 'serial', 'num', 'mint_num'];
  for (const key of mintKeys) {
    const val = combined[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const str = String(val);
      if (str.includes('/')) return str;
      const supply = combined.maxsupply ?? combined.max_supply ?? combined.supply;
      if (supply !== undefined && supply !== null) return `#${str} / ${supply}`;
      return `#${str}`;
    }
  }
  return null;
}

function getMintNumber(asset: SimpleAsset): number | null {
  const combined = { ...asset.idata, ...asset.mdata };
  const mintKeys = ['edition', 'mint', 'serial', 'num', 'mint_num'];
  for (const key of mintKeys) {
    const val = combined[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const str = String(val).split('/')[0].replace('#', '').trim();
      const n = parseInt(str, 10);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function getAtomicMintInfo(asset: SimpleAsset): string | null {
  if (asset.source !== 'atomicassets') return null;
  const mint = asset.idata?._atomic_mint;
  const supply = asset.idata?._atomic_supply;
  if (mint === undefined || mint === null || String(mint).trim() === '') return null;
  const mintStr = String(mint).trim();
  const supplyStr = supply !== undefined && supply !== null && String(supply).trim() !== '' && String(supply).trim() !== '0'
    ? String(supply).trim()
    : null;
  return supplyStr ? `AA #${mintStr} / ${supplyStr}` : `AA #${mintStr}`;
}

function SimpleAssetCardComponent({ asset, onClick, draggable, className, selectionMode, selected, stackCount, onSelect, onDragStart, onDragOver, onDrop, onDragEnd, priceAlertTemplate }: SimpleAssetCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const { ref: tiltRef, glareRef, onMouseMove: tiltMouseMove, onMouseLeave: tiltMouseLeave } = useCardTilt({ disabled: isDragging });
  const { getAlert } = usePriceAlerts();

  const isAnimatedGif = useMemo(() => asset.image?.toLowerCase().includes('.gif'), [asset.image]);
  const mintInfo = getMintInfo(asset);
  const atomicMintInfo = getAtomicMintInfo(asset);
  const mintNumber = getMintNumber(asset);
  const isMintOne = mintNumber === 1;
  const hasContained = (asset.container?.length ?? 0) > 0 || (asset.containerf?.length ?? 0) > 0;

  const alert = priceAlertTemplate ? getAlert(priceAlertTemplate.templateId) : undefined;
  const hasAlert = Boolean(alert);
  const isAlertTriggered = Boolean(alert?.triggered);
  const showAlertButton = Boolean(priceAlertTemplate) && !selectionMode;

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => { setIsDragging(true); onDragStart?.(e); };
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragOver(true); onDragOver?.(e); };
  const handleDragLeave = () => { setIsDragOver(false); };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragOver(false); onDrop?.(e); };
  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => { setIsDragging(false); setIsDragOver(false); onDragEnd?.(e); };
  const handleClick = () => {
    if (selectionMode && onSelect) { onSelect(asset.id); return; }
    if (!isDragging) onClick();
  };

  const isStacked = (stackCount ?? 0) > 1;

  return (
    <>
    <Card
      className={`overflow-hidden cursor-pointer bg-card border-border relative
        ${isDragging ? 'opacity-50 scale-95' : 'hover:ring-2 hover:ring-cheese/50 hover:shadow-lg hover:shadow-cheese/10'}
        ${isDragOver ? 'ring-2 ring-primary shadow-lg shadow-primary/20 scale-105' : ''}
        ${selected ? 'ring-2 ring-cheese shadow-lg shadow-cheese/20' : ''}
        ${isMintOne && !selected && !isDragOver ? 'ring-2 ring-cheese animate-pulse-glow shadow-lg shadow-cheese/40' : ''}
        ${className || ''}`}
      onClick={handleClick}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      {showAlertButton && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setAlertOpen(true); }}
          className={cn(
            "absolute top-1.5 left-1.5 z-20 h-7 w-7 rounded-full flex items-center justify-center backdrop-blur-sm border-2 transition-colors",
            isAlertTriggered
              ? "border-black bg-red-600 text-white animate-pulse"
              : hasAlert
                ? "border-cheese bg-emerald-500 text-white hover:bg-emerald-400"
                : "bg-background/80 border-border/60 text-muted-foreground hover:text-cheese hover:border-cheese/50"
          )}
          aria-label={hasAlert ? "Edit price alert" : "Set price alert"}
          title={hasAlert ? `Alert: max ${alert!.maxPrice.toFixed(2)} WAX` : "Set price alert"}
        >
          {isAlertTriggered ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        </button>
      )}
      {isStacked && (
        <div className="absolute top-2 right-2 z-10 bg-cheese text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md">
          x{stackCount}
        </div>
      )}
      {selectionMode && (
        <div className="absolute top-2 left-2 z-10">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
            ${selected ? 'bg-cheese border-cheese' : 'bg-background/80 border-muted-foreground/50'}`}>
            {selected && <span className="text-xs text-primary-foreground font-bold">✓</span>}
          </div>
        </div>
      )}

      {/* 3D tilt artwork area */}
      <div style={{ perspective: '1200px' }}>
        <div
          ref={tiltRef}
          onMouseMove={tiltMouseMove}
          onMouseLeave={tiltMouseLeave}
          className="relative"
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
          <div
            className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden pointer-events-none"
            style={isAnimatedGif ? { contain: 'paint', transform: 'translateZ(0)', backfaceVisibility: 'hidden' } : undefined}
          >
            <IpfsMedia
              url={asset.image}
              alt={asset.name}
              className="w-full h-full"
              context="card"
            />
          </div>
          <div ref={glareRef} className="absolute inset-0 pointer-events-none z-10" style={{ opacity: 0, transition: 'opacity 0.15s ease' }} />
        </div>
      </div>

      {/* Flat text area — no 3D transforms */}
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-foreground truncate">{asset.name}</p>
          {asset.cardid && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese shrink-0">
              {asset.cardid}{asset.side || ''}{asset.quality ? ` ${asset.quality}` : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">by {asset.author}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">{asset.category}</span>
            <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
              asset.source === 'atomicassets' ? 'bg-primary/15 text-primary' : 'bg-emerald-500/15 text-emerald-400'
            }`}>
              {asset.source === 'atomicassets' ? 'AA' : 'SA'}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">#{asset.id}</span>
        </div>
        {(mintInfo || hasContained) && (
          <div className="flex items-center gap-1.5 pt-0.5">
            {mintInfo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">{mintInfo}</span>}
            {hasContained && <span className="text-[10px] text-muted-foreground" title="Contains attached assets">📎</span>}
          </div>
        )}
      </CardContent>
    </Card>
    {priceAlertTemplate && (
      <PriceAlertDialog template={priceAlertTemplate} open={alertOpen} onOpenChange={setAlertOpen} />
    )}
    </>
  );
}

export const SimpleAssetCard = memo(SimpleAssetCardComponent, (prev, next) => {
  return (
    prev.asset.id === next.asset.id &&
    prev.asset.image === next.asset.image &&
    prev.asset.name === next.asset.name &&
    prev.asset.author === next.asset.author &&
    prev.asset.category === next.asset.category &&
    prev.asset.quality === next.asset.quality &&
    prev.asset.side === next.asset.side &&
    prev.asset.source === next.asset.source &&
    prev.selectionMode === next.selectionMode &&
    prev.selected === next.selected &&
    prev.draggable === next.draggable &&
    prev.className === next.className &&
    prev.stackCount === next.stackCount &&
    prev.priceAlertTemplate?.templateId === next.priceAlertTemplate?.templateId &&
    prev.onDragStart === next.onDragStart &&
    prev.onDragOver === next.onDragOver &&
    prev.onDrop === next.onDrop &&
    prev.onDragEnd === next.onDragEnd
  );
});
