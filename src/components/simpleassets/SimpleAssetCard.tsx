import { memo, useMemo, useState, DragEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import { useCardTilt } from '@/hooks/useCardTilt';
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

function SimpleAssetCardComponent({ asset, onClick, draggable, className, selectionMode, selected, stackCount, onSelect, onDragStart, onDragOver, onDrop, onDragEnd }: SimpleAssetCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { ref: tiltRef, glareRef, onMouseMove: tiltMouseMove, onMouseLeave: tiltMouseLeave } = useCardTilt({ disabled: isDragging });

  const isAnimatedGif = useMemo(() => asset.image?.toLowerCase().includes('.gif'), [asset.image]);
  const mintInfo = getMintInfo(asset);
  const hasContained = (asset.container?.length ?? 0) > 0 || (asset.containerf?.length ?? 0) > 0;

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
    <div className={isStacked ? 'relative' : ''} ref={tiltRef}
      onMouseMove={tiltMouseMove} onMouseLeave={tiltMouseLeave}
      style={{ transformStyle: 'preserve-3d', willChange: 'transform', backfaceVisibility: 'hidden', transition: 'transform 0.15s ease' }}>
      {isStacked && (
        <>
          <div className="absolute inset-0 rounded-lg border border-border bg-card translate-x-1.5 translate-y-1.5 opacity-40" />
          <div className="absolute inset-0 rounded-lg border border-border bg-card translate-x-0.5 translate-y-0.5 opacity-60" />
        </>
      )}
    <Card
      className={`overflow-hidden cursor-pointer bg-card border-border relative
        ${isDragging ? 'opacity-50 scale-95' : 'hover:ring-2 hover:ring-cheese/50 hover:shadow-lg hover:shadow-cheese/10'}
        ${isDragOver ? 'ring-2 ring-primary shadow-lg shadow-primary/20 scale-105' : ''}
        ${selected ? 'ring-2 ring-cheese shadow-lg shadow-cheese/20' : ''}
        ${className || ''}`}
      style={isAnimatedGif ? { contentVisibility: 'auto', contain: 'layout paint style', containIntrinsicSize: '280px 360px' } : undefined}
      onClick={handleClick}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
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
            {mintInfo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{mintInfo}</span>}
            {hasContained && <span className="text-[10px] text-muted-foreground" title="Contains attached assets">📎</span>}
          </div>
        )}
      <div ref={glareRef} className="absolute inset-0 rounded-lg pointer-events-none z-10" style={{ opacity: 0, transition: 'opacity 0.15s ease' }} />
      </CardContent>
    </Card>
    </div>
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
    prev.stackCount === next.stackCount
  );
});
