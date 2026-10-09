// TEMPORARY demo route for headless BridgeDialog testing — restore after use.
import { useState } from 'react';
import { BridgeDialog } from '@/components/simpleassets/BridgeDialog';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

const demoAssets: SimpleAsset[] = [
  {
    id: '1467072',
    owner: 'hkka4.wam',
    author: 'gpk.topps',
    category: 'series1',
    name: 'Messie Tessie',
    image: 'QmTest1',
    images: ['QmTest1'],
    idata: { name: 'Messie Tessie', img: 'QmTest1' },
    mdata: {},
    container: [],
    containerf: [],
    source: 'simpleassets',
  },
  {
    id: '1098234554423',
    owner: 'hkka4.wam',
    author: 'gpk.topps',
    category: 'series1',
    name: 'Nasty Nick',
    image: 'QmTest2',
    images: ['QmTest2'],
    idata: { name: 'Nasty Nick', img: 'QmTest2', _template_id: '18171', sassets_id: '1467100' },
    mdata: {},
    container: [],
    containerf: [],
    source: 'atomicassets',
  },
] as unknown as SimpleAsset[];

const NotFound = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <BridgeDialog open={open} onOpenChange={setOpen} selectedAssets={demoAssets} onSuccess={() => {}} />
    </div>
  );
};

export default NotFound;
