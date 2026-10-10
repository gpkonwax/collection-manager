import { PACK_IMAGES, PACK_LABELS } from '@/lib/gpkPackMeta';
import { PACK_DEFAULTS } from '@/hooks/useGpkAtomicPacks';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';

// WinterCon days share one front; show every distinct pack artwork once.
// Series 1 pair is swapped with the Tiger King pair so the Series 1 Mega front
// lands on the fan's centre slot (7th of 13 — upright, topmost, most prominent).
const EXOTIC_FRONTS = [
  { image: PACK_IMAGES.EXOFIVE, name: PACK_LABELS.EXOFIVE },
  { image: PACK_IMAGES.EXOMEGA, name: PACK_LABELS.EXOMEGA },
];
const SERIES1_FRONTS = [
  { image: PACK_IMAGES.GPKFIVE, name: PACK_LABELS.GPKFIVE },
  { image: PACK_IMAGES.GPKMEGA, name: PACK_LABELS.GPKMEGA },
];
const REST_FRONTS = Object.entries(PACK_IMAGES)
  .filter(([symbol]) => symbol !== 'GPKFIVE' && symbol !== 'GPKMEGA' && symbol !== 'EXOFIVE' && symbol !== 'EXOMEGA')
  .map(([symbol, image]) => ({ image, name: PACK_LABELS[symbol] }));

const PACK_FRONTS = [
  ...EXOTIC_FRONTS,
  ...REST_FRONTS.slice(0, 3), // Series 2 A, B, C
  ...SERIES1_FRONTS,
  ...REST_FRONTS.slice(3),
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
