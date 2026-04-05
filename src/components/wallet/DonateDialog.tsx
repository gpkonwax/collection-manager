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
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Loader2, Heart } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { getTransactPlugins, closeWharfkitModals } from '@/lib/wharfKit';
import { toast } from 'sonner';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import type { GpkPack } from '@/hooks/useGpkPacks';
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
  assets: SimpleAsset[];
  gpkPacks?: GpkPack[];
  onSuccess: (txId: string | null) => void;
}

export function DonateDialog({ open, onOpenChange, assets, gpkPacks = [], onSuccess }: DonateDialogProps) {
  const { session, transferToken } = useWax();

  // Token tab state
  const [selectedToken, setSelectedToken] = useState<string>('WAX');
  const [amount, setAmount] = useState('');
  const [isSendingToken, setIsSendingToken] = useState(false);

  // NFT tab state
  const [selectedNftIds, setSelectedNftIds] = useState<Set<string>>(new Set());
  const [isSendingNfts, setIsSendingNfts] = useState(false);

  // Pack tab state
  const [selectedPackSymbols, setSelectedPackSymbols] = useState<Map<string, number>>(new Map());
  const [isSendingPacks, setIsSendingPacks] = useState(false);

  const token = TOKENS.find(t => t.symbol === selectedToken) || TOKENS[0];
  const parsedAmount = parseFloat(amount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;

  const selectedNfts = useMemo(
    () => assets.filter(a => selectedNftIds.has(a.id)),
    [assets, selectedNftIds]
  );

  const toggleNft = useCallback((id: string) => {
    setSelectedNftIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const setPackQty = useCallback((symbol: string, qty: number, max: number) => {
    setSelectedPackSymbols(prev => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(symbol);
      else next.set(symbol, Math.min(qty, max));
      return next;
    });
  }, []);

  const totalPacks = useMemo(() => {
    let total = 0;
    selectedPackSymbols.forEach(v => { total += v; });
    return total;
  }, [selectedPackSymbols]);

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

  const handleSendNfts = async () => {
    if (!session || selectedNfts.length === 0) return;
    setIsSendingNfts(true);
    try {
      const actor = session.actor.toString();
      const auth = [session.permissionLevel];
      const actions: any[] = [];

      const saAssets = selectedNfts.filter(a => a.source === 'simpleassets');
      const aaAssets = selectedNfts.filter(a => a.source === 'atomicassets');

      if (saAssets.length > 0) {
        actions.push({
          account: 'simpleassets', name: 'transfer', authorization: auth,
          data: { from: actor, to: DONATE_ACCOUNT, assetids: saAssets.map(a => a.id), memo: 'donation' },
        });
      }
      if (aaAssets.length > 0) {
        actions.push({
          account: 'atomicassets', name: 'transfer', authorization: auth,
          data: { from: actor, to: DONATE_ACCOUNT, asset_ids: aaAssets.map(a => a.id), memo: 'donation' },
        });
      }

      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      toast.success(`Donated ${selectedNfts.length} NFT(s) to ${DONATE_ACCOUNT}`);
      setSelectedNftIds(new Set());
      onOpenChange(false);
      onSuccess(txId);
    } catch (error) {
      console.error('NFT donation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Donation failed');
    } finally {
      setIsSendingNfts(false);
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

      selectedPackSymbols.forEach((qty, symbol) => {
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

      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      toast.success(`Donated ${totalPacks} pack(s) to ${DONATE_ACCOUNT}`);
      setSelectedPackSymbols(new Map());
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

  const hasNfts = assets.length > 0;
  const hasGpkPacks = gpkPacks.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-cheese" />
            Donate to $CHEESE Team
          </DialogTitle>
          <DialogDescription>
            Donate WAX, unopened GPK packs, or NFTs to $CHEESE Team
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Recipient:</span>{' '}
          <span className="font-mono text-cheese">{DONATE_ACCOUNT}</span>
        </div>

        <Tabs defaultValue="tokens" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="tokens" className="flex-1">Tokens</TabsTrigger>
            {hasGpkPacks && <TabsTrigger value="packs" className="flex-1">Packs</TabsTrigger>}
            {hasNfts && <TabsTrigger value="nfts" className="flex-1">NFTs</TabsTrigger>}
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

          {hasGpkPacks && (
            <TabsContent value="packs" className="space-y-4 mt-4">
              <ScrollArea className="max-h-60">
                <div className="space-y-3">
                  {gpkPacks.map(pack => {
                    const qty = selectedPackSymbols.get(pack.symbol) || 0;
                    const img = PACK_IMAGES[pack.symbol];
                    return (
                      <div key={pack.symbol} className="flex items-center gap-3 p-2 rounded-md border border-border">
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
                            onClick={() => setPackQty(pack.symbol, qty - 1, pack.amount)}
                            disabled={qty <= 0}>−</Button>
                          <span className="w-8 text-center text-sm font-mono text-foreground">{qty}</span>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                            onClick={() => setPackQty(pack.symbol, qty + 1, pack.amount)}
                            disabled={qty >= pack.amount}>+</Button>
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

          {hasNfts && (
            <TabsContent value="nfts" className="space-y-4 mt-4">
              <ScrollArea className="h-60 border border-border rounded-md p-2">
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {assets.map(asset => {
                    const isSelected = selectedNftIds.has(asset.id);
                    return (
                      <button
                        key={asset.id}
                        onClick={() => toggleNft(asset.id)}
                        className={`relative rounded-md overflow-hidden border-2 transition-all ${
                          isSelected
                            ? 'border-cheese ring-2 ring-cheese/50'
                            : 'border-transparent hover:border-cheese/30'
                        }`}
                      >
                        <img
                          src={asset.image}
                          alt={asset.name}
                          className="w-full aspect-square object-contain bg-muted/20"
                        />
                        <div className="absolute top-1 right-1">
                          <Checkbox
                            checked={isSelected}
                            className="border-cheese data-[state=checked]:bg-cheese data-[state=checked]:text-primary-foreground"
                            tabIndex={-1}
                          />
                        </div>
                        <p className="text-[10px] text-center truncate px-0.5 py-0.5 text-foreground">{asset.name}</p>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
              <Button
                onClick={handleSendNfts}
                disabled={selectedNfts.length === 0 || isSendingNfts}
                className="w-full bg-cheese hover:bg-cheese/90 text-primary-foreground"
              >
                {isSendingNfts ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Donate {selectedNfts.length} NFT{selectedNfts.length !== 1 ? 's' : ''}</>
                )}
              </Button>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
