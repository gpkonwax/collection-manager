import { PACK_IMAGES, PACK_LABELS } from '@/lib/gpkPackMeta';
import { PACK_DEFAULTS } from '@/hooks/useGpkAtomicPacks';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';

// WinterCon days share one front; show every distinct pack artwork once.
const PACK_FRONTS = [
  ...Object.entries(PACK_IMAGES).map(([symbol, image]) => ({ image, name: PACK_LABELS[symbol] })),
  ...['13778', '48479', '51437', '53187', '59072', '59489'].flatMap((id) => {
    const pack = PACK_DEFAULTS[id];
    return pack ? [{ image: pack.image, name: pack.name }] : [];
  }),
];

export function PackArtworkFan() {
  return (
    <div className="pack-artwork-fan" role="img" aria-label="All GPK pack fronts, overlapping like a fanned hand of cards">
      {PACK_FRONTS.map((pack) => (
        <div key={pack.image} className="pack-artwork-fan-front" aria-hidden="true">
          <IpfsMedia url={pack.image} alt={pack.name} className="h-full w-full" mirrorFirst />
        </div>
      ))}
    </div>
  );
}