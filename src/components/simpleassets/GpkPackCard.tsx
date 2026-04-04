import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Play } from 'lucide-react';
import { Session } from '@wharfkit/session';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { PackRevealDialog } from './PackRevealDialog';
import type { RevealCard } from './PackRevealDialog';
import { PackBrowserDialog } from './PackBrowserDialog';
import type { GpkPack } from '@/hooks/useGpkPacks';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import gpkSeries1Img from '@/assets/gpk_pack_series_1.png';
import gpkSeries2aImg from '@/assets/gpk_pack_series_2a.png';
import gpkSeries2bImg from '@/assets/gpk_pack_series_2b.png';
import gpkSeries2cImg from '@/assets/gpk_pack_series_2c.png';
import gpkSeries1MegaImg from '@/assets/gpk_pack_series_1_mega.jpg';

const SERIES_2_IMAGES: Record<string, string> = {
  GPKFIVE: gpkSeries1Img, GPKMEGA: gpkSeries1MegaImg,
  GPKTWOA: gpkSeries2aImg, GPKTWOB: gpkSeries2bImg, GPKTWOC: gpkSeries2cImg,
};

const UNBOX_TYPE_MAP: Record<string, string> = {
  GPKFIVE: 'five', GPKTWOA: 'gpktwoeight', GPKTWOB: 'gpktwo25', GPKTWOC: 'gpktwo55',
};

const EXPECTED_CARDS: Record<string, number> = {
  GPKFIVE: 5, GPKTWOA: 8, GPKTWOB: 25, GPKTWOC: 55,
};

interface GpkPackCardProps {
  pack: GpkPack;
  session: Session | null;
  accountName: string;
  onSuccess?: () => void;
  collectionAssets?: SimpleAsset[];
}

async function snapshotUnboxingIds(owner: string): Promise<Set<number>> {
  const ids = new Set<number>();
  try {
    const result = await fetchTableRows<{ unboxingid: number }>({
      code: 'gpk.topps', scope: owner, table: 'pendingnft.a', limit: 500,
    });
    for (const r of result.rows) ids.add(r.unboxingid);
  } catch { /* ignore */ }
  return ids;
}

export function GpkPackCard({ pack, session, accountName, onSuccess, collectionAssets = [] }: GpkPackCardProps) {
  const series2Img = SERIES_2_IMAGES[pack.symbol];
  const [isOpening, setIsOpening] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [preOpenIds, setPreOpenIds] = useState<Set<number>>(new Set());
  const [browserOpen, setBrowserOpen] = useState(false);
  const [demoRevealOpen, setDemoRevealOpen] = useState(false);
  const { executeTransaction } = useWaxTransaction(session);

  const unboxType = UNBOX_TYPE_MAP[pack.symbol];
  const hasMultiple = pack.amount > 1;
  const expectedCount = EXPECTED_CARDS[pack.symbol] ?? 5;

  const demoCards = useMemo((): RevealCard[] => {
    if (collectionAssets.length === 0) return [];
    const shuffled = [...collectionAssets].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, expectedCount).map((a) => ({
      asset_id: `demo-${a.id}`, name: a.name, image: a.image || null, rarity: a.quality || '',
    }));
  }, [collectionAssets, expectedCount]);

  const handleOpen = useCallback(async () => {
    if (!session || !unboxType) return;
    setIsOpening(true);
    const actor = String(session.actor);
    const auth = [{ actor, permission: String(session.permission) }];
    const qty = pack.precision > 0 ? `${(1).toFixed(pack.precision)} ${pack.symbol}` : `1 ${pack.symbol}`;
    try {
      const snapshot = await snapshotUnboxingIds(accountName);
      setPreOpenIds(snapshot);
      const result = await executeTransaction([
        { account: 'packs.topps', name: 'transfer', authorization: auth, data: { from: actor, to: 'gpk.topps', quantity: qty, memo: '' } },
        { account: 'gpk.topps', name: 'unbox', authorization: auth, data: { from: actor, type: unboxType } },
      ], { successTitle: 'Pack Opened!', successDescription: `Your ${pack.label} has been opened. Revealing cards...` });
      if (result.success) setRevealOpen(true);
    } finally { setIsOpening(false); }
  }, [session, unboxType, pack, accountName, executeTransaction]);

  const handleRevealComplete = useCallback(() => { onSuccess?.(); }, [onSuccess]);

  return (
    <>
      <Card className="bg-card border-border hover:border-primary/40 transition-colors">
        <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
          {series2Img ? <img src={series2Img} alt={pack.label} className="w-3/4 h-auto rounded mx-auto" /> : <span className="text-3xl">📦</span>}
          <p className="font-bold text-foreground text-sm">{pack.label}</p>
          <p className="text-xs text-muted-foreground">{pack.symbol}</p>
          <p className="text-lg font-mono text-primary">{pack.amount}</p>
          {pack.amount > 0 ? (
            <Button size="sm" variant="outline" className="w-full text-xs" disabled={!session || isOpening || !unboxType}
              onClick={hasMultiple ? () => setBrowserOpen(true) : handleOpen}>
              {isOpening ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Opening...</> : hasMultiple ? 'Open Packs' : 'Open Pack'}
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="w-full text-xs" disabled>No Packs</Button>
          )}
          {demoCards.length > 0 && (
            <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setDemoRevealOpen(true)}>
              <Play className="h-3 w-3 mr-1" /> Demo Open
            </Button>
          )}
        </CardContent>
      </Card>
      <PackRevealDialog open={revealOpen} onOpenChange={setRevealOpen} packSymbol={pack.symbol} packLabel={pack.label}
        packImage={series2Img} accountName={accountName} preOpenUnboxingIds={preOpenIds} onComplete={handleRevealComplete} session={session} />
      <PackRevealDialog open={demoRevealOpen} onOpenChange={setDemoRevealOpen} packSymbol={pack.symbol} packLabel={pack.label}
        packImage={series2Img} accountName={accountName} preOpenUnboxingIds={new Set()} onComplete={() => {}} demoCards={demoCards} />
      <PackBrowserDialog open={browserOpen} onOpenChange={setBrowserOpen} pack={pack} packImage={series2Img}
        session={session} accountName={accountName} snapshotUnboxingIds={snapshotUnboxingIds} onSuccess={onSuccess} />
    </>
  );
}
