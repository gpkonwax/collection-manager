import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Heart } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { getTransactPlugins, closeWharfkitModals } from '@/lib/wharfKit';
import { toast } from 'sonner';
import type { GpkPack } from '@/hooks/useGpkPacks';
import type { AtomicPack } from '@/hooks/useGpkAtomicPacks';
import gpkSeries1Img from '@/assets/gpk_pack_series_1.png';
import gpkSeries2aImg from '@/assets/gpk_pack_series_2a.png';
import gpkSeries2bImg from '@/assets/gpk_pack_series_2b.png';
import gpkSeries2cImg from '@/assets/gpk_pack_series_2c.png';
import gpkSeries1MegaImg from '@/assets/gpk_pack_series_1_mega.jpg';

const DONATE_ACCOUNT = 'gpkcheesegpk';

const TOKENS = [
  { label: 'WAX', contract: 'eosio.token', symbol: 'WAX', precision: 8 },
  { label: 'CHEESE', contract: 'cheeseburger', symbol: 'CHEESE', precision: 4 },
] as const;

const PACK_IMAGES: Record<string, string> = {
  GPKFIVE: gpkSeries1Img,
  GPKMEGA: gpkSeries1MegaImg,
  GPKTWOA: gpkSeries2aImg,
  GPKTWOB: gpkSeries2bImg,
  GPKTWOC: gpkSeries2cImg,
};

interface DonateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gpkPacks?: GpkPack[];
  atomicPacks?: AtomicPack[];
  onSuccess: (txId: string | null) => void;
}

export function DonateDialog({ open, onOpenChange, gpkPacks = [], atomicPacks = [], onSuccess }: DonateDialogProps) {
  const { session, transferToken } = useWax();

  // Token tab state
  const [selectedToken, setSelectedToken] = useState<string>('WAX');
  const [amount, setAmount] = useState('');
  const [isSendingToken, setIsSendingToken] = useState(false);

  // Pack selection: gpk packs by symbol qty, atomic packs by templateId qty
  const [gpkPackQtys, setGpkPackQtys] = useState<Map<string, number>>(new Map());
  const [atomicPackQtys, setAtomicPackQtys] = useState<Map<string, number>>(new Map());
  const [isSendingPacks, setIsSendingPacks] = useState(false);

  const token = TOKENS.find(t => t.symbol === selectedToken) || TOKENS[0];
  const parsedAmount = parseFloat(amount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;

  const setGpkQty = useCallback((symbol: string, qty: number, max: number) => {
    setGpkPackQtys(prev => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(symbol); else next.set(symbol, Math.min(qty, max));
      return next;
    });
  }, []);

  const setAtomicQty = useCallback((templateId: string, qty: number, max: number) => {
    setAtomicPackQtys(prev => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(templateId); else next.set(templateId, Math.min(qty, max));
      return next;
    });
  }, []);

  const totalPacks = useMemo(() => {
    let total = 0;
    gpkPackQtys.forEach(v => { total += v; });
    atomicPackQtys.forEach(v => { total += v; });
    return total;
  }, [gpkPackQtys, atomicPackQtys]);

  const handleSendToken = async () => {
    if (!session || !isValidAmount) return;
    setIsSendingToken(true);
    try {
      const txId = await transferToken(
        token.contract, token.symbol, token.precision,
        DONATE_ACCOUNT, parsedAmount, 'donation'
      );
      toast.success(`Donated ${parsedAmount} ${token.symbol} to ${DONATE_ACCOUNT}`);
      setAmount('');
      onOpenChange(false);
      onSuccess(txId);
    } catch (error) {
      console.error('Token donation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Donation failed');
    } finally {
      setIsSendingToken(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const handleSendPacks = async () => {
    if (!session || totalPacks === 0) return;
    setIsSendingPacks(true);
    try {
      const actor = session.actor.toString();
      const auth = [session.permissionLevel];
      const actions: any[] = [];

      // GPK token packs
      gpkPackQtys.forEach((qty, symbol) => {
        const pack = gpkPacks.find(p => p.symbol === symbol);
        if (!pack || qty <= 0) return;
        const qtyStr = pack.precision > 0
          ? `${qty.toFixed(pack.precision)} ${pack.symbol}`
          : `${qty} ${pack.symbol}`;
        actions.push({
          account: 'packs.topps', name: 'transfer', authorization: auth,
          data: { from: actor, to: DONATE_ACCOUNT, quantity: qtyStr, memo: 'donation' },
        });
      });

      // Atomic NFT packs
      const allAtomicIds: string[] = [];
      atomicPackQtys.forEach((qty, templateId) => {
        const pack = atomicPacks.find(p => p.templateId === templateId);
        if (!pack || qty <= 0) return;
        allAtomicIds.push(...pack.assetIds.slice(0, qty));
      });
      if (allAtomicIds.length > 0) {
        actions.push({
          account: 'atomicassets', name: 'transfer', authorization: auth,
          data: { from: actor, to: DONATE_ACCOUNT, asset_ids: allAtomicIds, memo: 'donation' },
        });
      }

      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      toast.success(`Donated ${totalPacks} pack(s) to ${DONATE_ACCOUNT}`);
      setGpkPackQtys(new Map());
      setAtomicPackQtys(new Map());
      onOpenChange(false);
      onSuccess(txId);
    } catch (error) {
      console.error('Pack donation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Donation failed');
    } finally {
      setIsSendingPacks(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const hasPacks = gpkPacks.length > 0 || atomicPacks.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-cheese" />
            Donate to $CHEESE Team
          </DialogTitle>
          <DialogDescription>
            Donate WAX, CHEESE, or unopened GPK packs to $CHEESE Team
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Recipient:</span>{' '}
          <span className="font-mono text-cheese">{DONATE_ACCOUNT}</span>
        </div>

        <Tabs defaultValue="tokens" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="tokens" className="flex-1">Tokens</TabsTrigger>
            {hasPacks && <TabsTrigger value="packs" className="flex-1">Packs</TabsTrigger>}
          </TabsList>

          <TabsContent value="tokens" className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-foreground">Token</label>
              <Select value={selectedToken} onValueChange={setSelectedToken}>
                <SelectTrigger className="mt-1 border-cheese/50 text-cheese">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOKENS.map(t => (
                    <SelectItem key={t.symbol} value={t.symbol}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Amount</label>
              <Input
                type="number"
                placeholder={`Enter ${token.symbol} amount`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 border-cheese/50"
                min="0"
                step="any"
              />
            </div>
            <Button
              onClick={handleSendToken}
              disabled={!isValidAmount || isSendingToken}
              className="w-full bg-cheese hover:bg-cheese/90 text-primary-foreground"
            >
              {isSendingToken ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Donate {amount ? `${amount} ${token.symbol}` : token.symbol}</>
              )}
            </Button>
          </TabsContent>

          {hasPacks && (
            <TabsContent value="packs" className="space-y-4 mt-4">
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {gpkPacks.map(pack => {
                    const qty = gpkPackQtys.get(pack.symbol) || 0;
                    const img = PACK_IMAGES[pack.symbol];
                    return (
                      <div key={`gpk-${pack.symbol}`} className="flex items-center gap-3 p-2 rounded-md border border-border">
                        {img ? (
                          <img src={img} alt={pack.label} className="w-12 h-16 object-contain rounded" />
                        ) : (
                          <span className="text-2xl">📦</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{pack.label}</p>
                          <p className="text-xs text-muted-foreground">Available: {pack.amount}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                            onClick={() => setGpkQty(pack.symbol, qty - 1, pack.amount)}
                            disabled={qty <= 0}>−</Button>
                          <span className="w-8 text-center text-sm font-mono text-foreground">{qty}</span>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                            onClick={() => setGpkQty(pack.symbol, qty + 1, pack.amount)}
                            disabled={qty >= pack.amount}>+</Button>
                        </div>
                      </div>
                    );
                  })}

                  {atomicPacks.map(pack => {
                    const qty = atomicPackQtys.get(pack.templateId) || 0;
                    return (
                      <div key={`aa-${pack.templateId}`} className="flex items-center gap-3 p-2 rounded-md border border-border">
                        {pack.image ? (
                          <img src={pack.image} alt={pack.name} className="w-12 h-16 object-contain rounded" />
                        ) : (
                          <span className="text-2xl">📦</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{pack.name}</p>
                          <p className="text-xs text-muted-foreground">Available: {pack.count}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                            onClick={() => setAtomicQty(pack.templateId, qty - 1, pack.count)}
                            disabled={qty <= 0}>−</Button>
                          <span className="w-8 text-center text-sm font-mono text-foreground">{qty}</span>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                            onClick={() => setAtomicQty(pack.templateId, qty + 1, pack.count)}
                            disabled={qty >= pack.count}>+</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <Button
                onClick={handleSendPacks}
                disabled={totalPacks === 0 || isSendingPacks}
                className="w-full bg-cheese hover:bg-cheese/90 text-primary-foreground"
              >
                {isSendingPacks ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Donate {totalPacks} Pack{totalPacks !== 1 ? 's' : ''}</>
                )}
              </Button>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
