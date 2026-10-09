import { BridgeDialog } from "@/components/simpleassets/BridgeDialog";
import type { SimpleAsset } from "@/hooks/useSimpleAssets";

const make = (i: number, quality: string, source: "simpleassets" | "atomicassets"): SimpleAsset => ({
  id: String(1000000000 + i),
  owner: "abc12.wam",
  author: "gpk.topps",
  category: "series1",
  name: `Card ${i}`,
  image: "/placeholder.svg",
  images: ["/placeholder.svg"],
  cardid: String(i),
  quality,
  side: "a",
  idata: source === "atomicassets" ? { sassets_id: String(1000000000 + i) } : {},
  mdata: {},
  container: [],
  containerf: [],
  source,
});

const assets: SimpleAsset[] = [
  ...Array.from({ length: 40 }, (_, i) => make(i, i % 3 === 0 ? "Prism" : "Base", "simpleassets")),
  ...Array.from({ length: 12 }, (_, i) => make(100 + i, "Base", "atomicassets")),
];

const NotFound = () => (
  <BridgeDialog open onOpenChange={() => {}} assets={assets} onSuccess={() => {}} />
);

export default NotFound;
