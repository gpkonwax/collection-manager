// Temporary demo route for headless modal verification (restored afterwards).
import { useState } from 'react';
import { BridgeDialog } from '@/components/simpleassets/BridgeDialog';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

const mk = (id: string, mint: number | undefined, name: string): SimpleAsset => ({
  id,
  owner: 'demo',
  author: 'gpk.topps',
  category: 'series1',
  name,
  image: '',
  images: [],
  cardid: id,
  quality: '',
  side: 'a',
  idata: {},
  mdata: {},
  container: [],
  containerf: [],
  source: 'simpleassets',
  mintNumber: mint,
  mintSource: mint !== undefined ? 'backup' : undefined,
});

const NotFound = () => {
  const [open, setOpen] = useState(true);
  const assets = [
    mk('109995123001', 122, 'Nasty Nick'),
    mk('109995123002', undefined, 'Evil Eddie'),
    mk('109995123003', 426, 'Jay Decay'),
  ];
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <button onClick={() => setOpen(true)}>Open demo</button>
      <BridgeDialog open={open} onOpenChange={setOpen} selectedAssets={assets} onSuccess={() => {}} />
    </div>
  );
};

export default NotFound;
