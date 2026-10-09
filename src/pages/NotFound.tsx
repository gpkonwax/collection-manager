import { BridgeDialog } from "@/components/simpleassets/BridgeDialog";
import type { SimpleAsset } from "@/hooks/useSimpleAssets";

const names = ["Messie Tessie", "Ray Decay", "Food Fight", "Cheese Wiz", "Grape Ape", "Moo Card", "Bull Market", "Cheddar King", "Mint Condition", "Blue Moon", "Puck Star", "Cheese Wheel", "Gold Rush", "Air Mail", "Slam Dunk", "Tnt Box"];

const cards: SimpleAsset[] = names.map((name, i) => ({
  id: String(100000006630365 + i),
  owner: "abc12.wam",
  author: "gpk.topps",
  category: "series1",
  name,
  image: "/placeholder.svg",
  images: ["/placeholder.svg"],
  cardid: String(i + 1),
  quality: "Base",
  side: "a",
  idata: {},
  mdata: {},
  container: [],
  containerf: [],
  source: "simpleassets",
  mintNumber: (i + 1) * 7,
}));

const BridgeDemo = () => <BridgeDialog open onOpenChange={() => {}} selectedAssets={cards} onSuccess={() => {}} />;

export default BridgeDemo;
