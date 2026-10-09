import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImageWithModes, ArtworkModeControls, DRAW_COLORS } from './InteractiveArtwork';
import type { ViewMode } from './InteractiveArtwork';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import { getMintLabel, getMintSupplyLines, isBridgedAsset } from '@/lib/mintPresentation';
import { getAtomicTemplateSupply, type AtomicTemplateSupply } from '@/lib/atomicTemplateSupply';
import { fetchBridgeAccount, getCachedBridgeAccount } from '@/lib/bridgeAccount';
import { getProvenance, formatPackLabel, formatProvenanceDate, type ProvenanceEntry } from '@/lib/provenance';
import { TradeHistorySection } from './TradeHistorySection';
import { getRetroFront, getRetroBack } from '@/lib/retroScans';
import { CATEGORY_LABELS, normalizeAssetCategory } from '@/lib/gpkCategories';
import { ExternalLink } from 'lucide-react';
import { useExternalLinkWarning, ExternalLinkWarningDialog } from '@/components/ExternalLinkWarningDialog';

const fmtDate = (ms?: number) => {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

import atomicAssetsLogo from '@/assets/atomicassets-logo.png';
import atomicAssetsWordmark from '@/assets/atomicassets.svg.asset.json';
import atomicAssetsWordmarkDark from '@/assets/atomicassets-dark.svg.asset.json';
import simpleAssetsLogo from '@/assets/simpleassets-logo.png';
import poweredBySimpleAssets from '@/assets/powered-by-simpleassets.png.asset.json';
import waxLogo from '@/assets/wax-logo.png.asset.json';
import waxLogoWhite from '@/assets/wax-logo-white.png.asset.json';

// Asset pointers are root-relative to Lovable hosting. GitHub Pages has no
// /__l5e/assets-v1/ handler, so resolve these logos against their real host.
const hostedLogoUrl = (path: string) => new URL(path, 'https://pack-magic-reimagined.lovable.app').href;

interface Props {
  asset: SimpleAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hidden 1985-scan view: show original Topps scans for base Series 1/2 cards. */
  retro?: boolean;
  /** Called when an account name (opener/bridger) is clicked — opens View Wallet prefilled with it. */
  onViewAccount?: (account: string) => void;
}

const MINT_KEYS = ['edition', 'mint', 'serial', 'num', 'mint_num'];
const IMAGE_LABELS = ['Front', 'Back'];
const SERIES1_CATEGORIES = new Set(['five', 'series1']);

export function SimpleAssetDetailDialog({ asset, open, onOpenChange, retro = false, onViewAccount }: Props) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [mode, setMode] = useState<ViewMode>('tilt');
  const [unifiedColor, setUnifiedColor] = useState(DRAW_COLORS[0].value);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const assetId = asset?.id;
  const nativeTemplateId = asset?.source === 'atomicassets' && !isBridgedAsset(asset)
    ? String(asset.idata?._template_id ?? '') : '';
  const [nativeSupply, setNativeSupply] = useState<{ templateId: string; supply: AtomicTemplateSupply } | null>(null);
  const [nativeSupplyFailed, setNativeSupplyFailed] = useState(false);

  useEffect(() => {
    setNativeSupply(null);
    setNativeSupplyFailed(false);
    if (!open || !nativeTemplateId) return;
    let cancelled = false;
    getAtomicTemplateSupply('gpk.topps', nativeTemplateId).then((supply) => {
      if (!cancelled) setNativeSupply({ templateId: nativeTemplateId, supply });
    }).catch(() => { if (!cancelled) setNativeSupplyFailed(true); });
    return () => { cancelled = true; };
  }, [open, nativeTemplateId]);

  useEffect(() => {
    if (assetId) {
      setShowRawJson(false);
      setMode('tilt');
      setUnifiedColor(DRAW_COLORS[0].value);
      canvasRefs.current = [];
    }
  }, [assetId]);

  // Push color changes into any registered canvases without remounting them
  useEffect(() => {
    canvasRefs.current.forEach((canvas) => {
      if (canvas) (canvas as HTMLCanvasElement & { __setColor?: (color: string) => void }).__setColor?.(unifiedColor);
    });
  }, [unifiedColor]);

  const shouldLookupBridger = !!asset && open && isBridgedAsset(asset);
  // Pack records are keyed by the original SimpleAssets id for bridged copies.
  const provenanceKey = asset && open
    ? (isBridgedAsset(asset) ? String(asset.idata?.sassets_id ?? '') : String(asset.id))
    : '';
  const [provenance, setProvenance] = useState<ProvenanceEntry | null>(null);
  useEffect(() => {
    setProvenance(null);
    if (!provenanceKey) return;
    let cancelled = false;
    getProvenance(provenanceKey)
      .then((entry) => { if (!cancelled) setProvenance(entry); })
      .catch((err) => console.warn('[Provenance] pack record lookup failed:', err));
    return () => { cancelled = true; };
  }, [provenanceKey]);

  const [bridgedBy, setBridgedBy] = useState<string | null>(null);
  useEffect(() => {
    if (!assetId || !shouldLookupBridger) { setBridgedBy(null); return; }
    let cancelled = false;
    setBridgedBy(getCachedBridgeAccount(assetId) ?? null);
    // Saved records first; the live lookup is only a fallback.
    getProvenance(assetId)
      .catch(() => null)
      .then((saved) => {
        if (cancelled) return null;
        if (saved?.b) { setBridgedBy(saved.b); return null; }
        return fetchBridgeAccount(assetId).then((account) => { if (!cancelled) setBridgedBy(account); });
      })
      .catch((err) => console.warn('[BridgeInfo] bridging account lookup failed:', err));
    return () => { cancelled = true; };
  }, [assetId, shouldLookupBridger]);

  const link = useExternalLinkWarning();
  if (!asset) return null;

  const images = asset.images;
  const mintLabel = getMintLabel(asset);
  // Source attribution belongs in the grid tooltip, not in this detail section.
  const resolvedNativeSupply = nativeSupply?.templateId === nativeTemplateId ? nativeSupply.supply : null;
  const supplyLines = getMintSupplyLines(resolvedNativeSupply ? {
    ...asset, mintSurviving: resolvedNativeSupply.circulating, mintBurned: resolvedNativeSupply.burned,
  } : asset).filter((line) => !line.startsWith('Mint number —'));
  const isSeries1 = SERIES1_CATEGORIES.has(asset.category);
  const isBridgedAA = isBridgedAsset(asset);
  const bridgedAt = asset.bridgedAt && Number.isFinite(asset.bridgedAt) && asset.bridgedAt > 0
    ? new Date(asset.bridgedAt) : null;
  const bridgeDate = bridgedAt && !Number.isNaN(bridgedAt.getTime())
    ? bridgedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : null;
  const showBridge = isBridgedAA && !!(asset.idata?.bridge_mint || bridgeDate);
  const openedBy = provenance?.o ?? null;
  const mintedOn = formatProvenanceDate(provenance?.t);
  const packLabel = formatPackLabel(provenance?.p, provenance?.n);
  const hasProvenance = !!(openedBy || mintedOn || packLabel);
  const metaFields = Object.entries({ ...asset.idata, ...asset.mdata }).filter(
    ([key]) => !['img', 'image', 'icon', 'backimg', 'back', 'img2', 'image2', 'backimage', 'name', ...MINT_KEYS, 'maxsupply', 'max_supply', 'supply', 'bridge_mint', 'bridge_total', '_template_id'].includes(key)
  );
  const isAA = asset.source === 'atomicassets';
  const templateId = isAA ? String(asset.idata?._template_id ?? '') : '';
  const issued = isBridgedAA ? Number(asset.idata?.bridge_total) : NaN;
  const schemaName = isAA ? asset.category : normalizeAssetCategory(asset.category);
  const seriesLabel = CATEGORY_LABELS[normalizeAssetCategory(asset.category)] ?? asset.category;
  const collectionExplorerUrl = 'https://atomichub.io/explorer/collection/wax-mainnet/gpk.topps';
  const schemaExplorerUrl = `https://atomichub.io/explorer/schema/wax-mainnet/gpk.topps/${encodeURIComponent(schemaName)}`;
  const templateExplorerUrl = `https://atomichub.io/explorer/template/wax-mainnet/gpk.topps/${encodeURIComponent(templateId)}`;
  const acquiredOn = isAA ? fmtDate(asset.transferredAt) : null;
  // wax.bloks.io now redirects to the XPR Network explorer, so SimpleAssets records
  // go to waxblock.io, which stays on the WAX blockchain.
  const explorerUrl = isAA
    ? `https://atomichub.io/explorer/asset/wax-mainnet/${asset.id}`
    : `https://waxblock.io/account/simpleassets?loadContract=true&tab=Tables&table=sassets&scope=${encodeURIComponent(asset.owner)}&lower_bound=${asset.id}&upper_bound=${asset.id}`;
  const hasContainer = asset.container.length > 0;
  const hasContainerf = asset.containerf.length > 0;

  const retroScans = retro ? [getRetroFront(asset), getRetroBack(asset)] : [null, null];
  const isLandscapeAt = (i: number) => {
    if (i !== 1) return false;
    const scan = retroScans[1];
    return scan ? scan.landscape : isSeries1;
  };

  const clearAllCanvases = () => {
    canvasRefs.current.forEach((canvas) => {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1100px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-cheese">{asset.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1">
              Asset #{asset.id}
              <button
                type="button"
                onClick={() => link.requestNavigation(explorerUrl)}
                className="text-cheese hover:opacity-80"
                title={isAA ? 'View on AtomicHub explorer' : 'View on WAX block explorer'}
                aria-label={isAA ? 'View on AtomicHub explorer' : 'View on WAX block explorer'}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </span>
            <span aria-hidden>·</span>
            <span>by {asset.author}</span>
            <span aria-hidden>·</span>
            <span>{asset.category}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <img
                src={asset.source === 'atomicassets' ? atomicAssetsLogo : simpleAssetsLogo}
                alt=""
                className={`h-4 w-4 rounded-full object-cover ${asset.source === 'atomicassets' ? '' : 'bg-white p-[1px]'}`}
              />
              <span>{asset.source === 'atomicassets' ? 'AtomicAssets' : 'SimpleAssets'}</span>
            </span>
          </DialogDescription>
        </DialogHeader>
        {/* True mint number; supply details are listed separately below. */}
        <div
          className="w-full flex justify-center py-1 bg-muted/30 -mb-2"
          title={mintLabel === '#--' ? 'Mint number not available yet' : `Mint ${mintLabel}`}
        >
          <span className="text-base font-bold px-3 py-1 rounded-full bg-background/80 text-cheese border border-border/40">
            {mintLabel}
          </span>
        </div>
        <div className={`flex flex-col sm:flex-row gap-4 items-start justify-center overflow-hidden ${images.length === 1 ? 'max-w-[400px] mx-auto' : ''}`}>
          {images.map((imgUrl, i) => {
            const label = IMAGE_LABELS[i] || `Image ${i + 1}`;
            const isBack = i === 1;
            const isLandscape = isBack && isLandscapeAt(i);
            const retroScan = retroScans[i] ?? null;

            return (
              <div key={i} className="space-y-1 shrink-0" style={{ width: isLandscape ? '500px' : '400px' }}>
                <div className="flex items-center justify-center gap-1.5">
                  <p className="text-xs font-semibold text-cheese text-center">{label}{retroScan ? ' · 1985 scan' : ''}</p>
                </div>
                <ImageWithModes
                  url={imgUrl}
                  retroScan={retroScan}
                  alt={`${asset.name} - ${label}`}
                  isLandscape={isLandscape}
                  rotated={isLandscape && !retroScan}
                  className={isLandscape && !retroScan ? 'rotate-90 scale-[1.33] origin-center' : ''}
                  mode={mode}
                  canvasRegister={(canvas) => {
                    if (canvas) {
                      if (!canvasRefs.current.includes(canvas)) canvasRefs.current.push(canvas);
                      (canvas as HTMLCanvasElement & { __setColor?: (color: string) => void }).__setColor?.(unifiedColor);
                    } else {
                      canvasRefs.current = canvasRefs.current.filter(Boolean);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
        <ArtworkModeControls mode={mode} onModeChange={setMode} color={unifiedColor} onColorChange={setUnifiedColor} onClear={clearAllCanvases} />
        {/* Headings anchor the spacing: with all three columns each hangs centred at the
            quarter points (25% / 50% / 75%), so the Mint heading always sits directly beneath
            the artwork toggles and the side headings stay equidistant between centre and edge.
            With only two columns (no bridge information) they hang at the third points
            (33.3% / 66.7%) via a 6-track grid. Each heading is flush-left above its own lines. */}
        <div className="bg-muted/30 rounded p-3 sm:p-4 relative">
        {/* Large source badge sits in the empty left gutter of the panel (sm+), absolutely
            positioned so the column layout never shifts whether there are 3 or 2 columns.
            Both badges are centred at 10% of the panel: SimpleAssets keeps the full Powered-by
            seal in a white circle, AtomicAssets is the bare wordmark (no circle) at 128px —
            white letters in dark mode, navy-lettered twin in bright mode. */}
        <span
          title={isAA ? 'AtomicAssets asset' : 'SimpleAssets asset'}
          className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-24 items-center justify-center left-[10%] ${isAA ? 'w-32' : 'w-24 overflow-hidden rounded-full bg-white'}`}
        >
          {isAA ? (
            <>
              <img
                src={hostedLogoUrl(atomicAssetsWordmark.url)}
                alt="AtomicAssets"
                className="hidden dark:block h-auto w-32 max-w-none shrink-0"
              />
              <img
                src={hostedLogoUrl(atomicAssetsWordmarkDark.url)}
                alt="AtomicAssets"
                className="dark:hidden h-auto w-32 max-w-none shrink-0"
              />
            </>
          ) : (
            <img
              src={hostedLogoUrl(poweredBySimpleAssets.url)}
              alt="Powered by Simple Assets"
              className="h-[127%] w-[127%] max-w-none shrink-0 object-cover"
            />
          )}
        </span>
        <div className={`grid grid-cols-1 gap-y-4 sm:gap-y-0 ${showBridge ? 'sm:grid-cols-4' : 'sm:grid-cols-6'}`}>
            <div className={`min-w-0 flex flex-col text-sm text-foreground sm:row-start-1 sm:items-center pointer-events-none [&_button]:pointer-events-auto [&_button]:relative [&_button]:z-10 ${showBridge ? 'sm:col-start-1 sm:col-span-2' : 'sm:col-start-1 sm:col-span-4'}`}>
              <div className="flex flex-col text-left">
                <div className="relative">
                  {/* Small chip variant for stacked mobile layout only (sm+ uses the large gutter badge).
                      Absolutely positioned so the badge never shifts the column layout. */}
                  <span
                    title={isAA ? 'AtomicAssets asset' : 'SimpleAssets asset'}
                    className={`sm:hidden absolute right-full top-1/2 -translate-y-1/2 mr-1.5 flex h-4 w-4 items-center justify-center overflow-hidden rounded-full shrink-0 ${isAA ? 'bg-[#1A1E3E]' : 'bg-white'}`}
                  >
                    <img
                      src={isAA ? hostedLogoUrl(atomicAssetsWordmark.url) : simpleAssetsLogo}
                      alt={isAA ? 'AtomicAssets' : 'SimpleAssets'}
                      className={isAA ? 'h-2.5 w-5 object-contain' : 'h-3 w-3 object-contain'}
                    />
                  </span>
                  <p className="text-sm font-semibold text-cheese mb-1">Information</p>
                </div>
                <div className="space-y-1">
                <p className="break-words">
                  NFT ID: <Button type="button" variant="link" onClick={() => link.requestNavigation(explorerUrl)} className="h-auto p-0 font-mono text-cheese align-baseline">{asset.id}</Button>
                </p>
                {templateId && (
                  <p className="break-words">
                    Template ID: <Button type="button" variant="link" onClick={() => link.requestNavigation(templateExplorerUrl)} className="h-auto p-0 font-mono text-cheese align-baseline">{templateId}</Button>
                  </p>
                )}
                <p className="break-words">
                  Collection: <Button type="button" variant="link" onClick={() => link.requestNavigation(collectionExplorerUrl)} className="h-auto p-0 font-mono text-cheese align-baseline">gpk.topps</Button>
                </p>
                <p className="break-words">
                  Series: <Button type="button" variant="link" onClick={() => link.requestNavigation(schemaExplorerUrl)} className="h-auto p-0 text-cheese align-baseline">{seriesLabel}</Button>
                </p>
              </div>
              </div>
            </div>
              <div className={`min-w-0 flex flex-col text-sm text-foreground sm:row-start-1 sm:items-center ${showBridge ? 'sm:col-start-2 sm:col-span-2' : 'sm:col-start-3 sm:col-span-4'}`}>
                <div className="flex flex-col text-left">
                  <p className="text-sm font-semibold text-cheese mb-1">Mint information</p>
                  <div className="space-y-1">
                  <p>
                    Mint number: <span className="font-semibold font-mono text-cheese">{mintLabel}</span>
                  </p>
                  {supplyLines.map((line) => <p key={line}>{line}</p>)}
                  {nativeTemplateId && !resolvedNativeSupply && asset.mintBurned === undefined && (
                    <p className="text-muted-foreground">{nativeSupplyFailed ? 'Burn information unavailable' : 'Loading burn information…'}</p>
                  )}
                  {openedBy && (
                    <p>
                      Opened by: {onViewAccount ? (
                        <Button type="button" variant="link" onClick={() => onViewAccount(openedBy)} title={`View ${openedBy}'s wallet`} className="h-auto p-0 font-semibold font-mono text-cheese align-baseline">{openedBy}</Button>
                      ) : (
                        <span className="font-semibold font-mono text-cheese">{openedBy}</span>
                      )}
                    </p>
                  )}
                  {mintedOn && <p>Minted on: {mintedOn}</p>}
                  {packLabel && <p>Pack: {packLabel}</p>}
                  {Number.isFinite(issued) && issued > 0 && <p>Total bridged (AtomicAssets): {issued.toLocaleString('en-US')}</p>}
                  </div>
                  </div>
                </div>
              {isBridgedAA && (asset.idata?.bridge_mint || bridgeDate) && (
              <div className="min-w-0 flex flex-col text-sm text-foreground sm:col-start-3 sm:col-span-2 sm:row-start-1 sm:items-center">
                <div className="flex flex-col text-left">
                  <p className="text-sm font-semibold text-cheese mb-1">Bridge Information</p>
                  <div className="space-y-1">
                  {asset.idata?.bridge_mint && (
                    <p className="flex items-center justify-start gap-2 flex-wrap">
                      <span>Bridge Mint:</span>
                      <span
                        className="font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400"
                        title="Order of the AtomicAssets copy created by bridging"
                      >
                        #{String(asset.idata.bridge_mint)}
                        {asset.idata.bridge_total ? ` / ${String(asset.idata.bridge_total)}` : ''}
                      </span>
                    </p>
                  )}
                  {bridgedBy && (
                    <p>
                      Bridged by: {onViewAccount ? (
                        <Button type="button" variant="link" onClick={() => onViewAccount(bridgedBy)} title={`View ${bridgedBy}'s wallet`} className="h-auto p-0 font-semibold font-mono text-cheese align-baseline">{bridgedBy}</Button>
                      ) : (
                        <span className="font-semibold font-mono text-cheese">{bridgedBy}</span>
                      )}
                    </p>
                  )}
                  {bridgeDate && <p>Bridged on: {bridgeDate}</p>}
                </div>
                </div>
              </div>
            )}
        </div>
        {/* WAX watermark in the bottom-right of the panel, exactly where the user drew it.
            Absolutely positioned so the column layout never shifts (3 or 2 columns).
            Black lettering in bright mode, white lettering in dark mode for contrast. */}
        <img
          src={hostedLogoUrl(waxLogo.url)}
          alt="WAX"
          className="hidden sm:block dark:hidden absolute bottom-2 right-4 h-9 w-auto pointer-events-none"
        />
        <img
          src={hostedLogoUrl(waxLogoWhite.url)}
          alt="WAX"
          className="hidden dark:sm:block absolute bottom-2 right-4 h-9 w-auto pointer-events-none"
        />
        </div>
        {metaFields.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-cheese">Metadata</h4>
            <div className="grid grid-cols-3 gap-1.5">
              {metaFields.map(([key, value]) => (
                <div key={key} className="bg-muted/30 rounded px-2 py-1">
                  <span className="text-[10px] text-cheese uppercase">{key}</span>
                  <p className="text-xs text-foreground truncate">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {(hasContainer || hasContainerf) && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-cheese">📎 Contained Assets</h4>
            {hasContainer && (
              <div className="bg-muted/30 rounded p-2">
                <span className="text-[10px] text-muted-foreground uppercase">NFTs ({asset.container.length})</span>
                <p className="text-xs text-foreground break-all">{asset.container.map((c) => (typeof c === 'object' ? JSON.stringify(c) : String(c))).join(', ')}</p>
              </div>
            )}
            {hasContainerf && (
              <div className="bg-muted/30 rounded p-2">
                <span className="text-[10px] text-muted-foreground uppercase">FTs ({asset.containerf.length})</span>
                <p className="text-xs text-foreground break-all">{asset.containerf.map((c) => (typeof c === 'object' ? JSON.stringify(c) : String(c))).join(', ')}</p>
              </div>
            )}
          </div>
        )}
        <TradeHistorySection assetId={String(asset.id)} isAtomic={asset.source === 'atomicassets'} owner={asset.owner} opener={openedBy} />
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Owner: {asset.owner}{acquiredOn ? ` · Acquired on ${acquiredOn}` : ''}</span>
          <Button variant="ghost" size="sm" onClick={() => setShowRawJson(!showRawJson)}>{showRawJson ? 'Hide' : 'Show'} Raw JSON</Button>
        </div>
        {showRawJson && (
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold text-cheese mb-1">idata</p>
              <pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto text-foreground">{JSON.stringify(asset.idata, null, 2)}</pre>
            </div>
            <div>
              <p className="text-xs font-semibold text-cheese mb-1">mdata</p>
              <pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto text-foreground">{JSON.stringify(asset.mdata, null, 2)}</pre>
            </div>
          </div>
        )}
      </DialogContent>
      <ExternalLinkWarningDialog url={link.pendingUrl} onConfirm={link.confirm} onCancel={link.cancel} />
    </Dialog>
  );
}
