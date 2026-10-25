import type { ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PackArtworkFan } from '@/components/PackArtworkFan';
import brightBannerTitle from '@/assets/bright-banner-title.png';
import darkBannerTitle from '@/assets/dark-banner-title.png';
import viewWalletPreview from '@/assets/view-wallet-preview.png';
import cardTradingPreview from '@/assets/card-trading-preview.png';
import jsonImportPreview from '@/assets/json-import-preview.png';
import packHistoryPreview from '@/assets/pack-history-preview.png';
import packReplayPreview from '@/assets/pack-replay-preview.png';
import classicViewPreview from '@/assets/classic-view-preview.png';
import binderViewPreview from '@/assets/binder-view-preview.png';
import savedCollectionPreview from '@/assets/saved-collection-preview.png';

// Front page shown before a wallet is connected or viewed. Moved out of
// pages/Index.tsx unchanged.
function FeatureCard({ icon, preview, previewAlt, previewClass, title, description }: { icon?: ReactNode; preview?: string; previewAlt?: string; previewClass?: string; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-card bright-landing-panel p-6 space-y-3 hover:border-cheese/40 transition-colors flex flex-col">
      {preview ? (
        <div className={`trade-preview full${previewClass ? ` ${previewClass}` : ''}`}>
          <img src={preview} alt={previewAlt ?? title} loading="lazy" />
        </div>
      ) : (
        <div className="h-12 w-12 rounded-lg bg-cheese/10 flex items-center justify-center">{icon}</div>
      )}
      <h3 className="text-lg font-semibold text-cheese">{title}</h3>
      <p className="text-sm text-foreground leading-relaxed theme-bright-text">{description}</p>
    </div>
  );
}

export function LandingPage({ theme, login }: { theme: string; login: () => void }) {
  return (
    <div className="space-y-16 py-8">
      <div className="flex flex-col items-center text-center space-y-6">
        <h2 className="text-4xl md:text-5xl font-bold text-cheese-gradient theme-bright-gradient bright-page-heading leading-[1.25] pb-2 max-w-3xl">
          <img src={theme === 'bright' ? brightBannerTitle : darkBannerTitle} alt="The Unofficial GPK Collection Manager" className="mx-auto w-full max-w-[600px] h-auto" />
        </h2>
        <p className="text-lg text-foreground max-w-2xl theme-bright-text-muted bright-landing-panel rounded-lg px-5 py-2.5">
          Free to use, open source, built by <span className="text-cheese font-semibold theme-bright-text">$CHEESE</span> for the WAX and GPK communities.
        </p>
        <div className="max-w-2xl rounded-lg border border-cheese/30 bg-cheese/5 bright-content-panel px-4 py-3 text-sm text-foreground">
          <span className="font-semibold text-cheese theme-bright-text">🔒 No new smart contracts.</span>
          <span className="theme-bright-text"> This manager only uses the existing <strong>simpleassets</strong> and <strong>atomicassets</strong> actions and tables — no custom contracts, fully transparent on-chain.</span>
        </div>
        <Button onClick={login} size="lg" className="bg-cheese hover:bg-cheese/90 text-cheese-foreground text-lg px-8 py-6 cheese-glow">
          <Wallet className="h-5 w-5 mr-2" />
          Connect Wallet
        </Button>
      </div>

      {/* Section A — Three Ways to View */}
      <div className="max-w-5xl mx-auto space-y-4">
        <h3 className="text-2xl font-bold text-cheese text-center bright-section-heading">Three Ways to View, Sort and Show Your Collection</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            preview={classicViewPreview}
            previewAlt="Classic view: a grid of four owned GPK cards with their metadata"
            previewClass="tilt-left"
            title="Classic View"
            description="A grid of your cards in natural sort order. Clean, simple, no clutter — just your collection as it is. The Select function works from this view too: pick any cards and transfer, bridge or burn them without leaving the grid."
          />
          <FeatureCard
            preview={binderViewPreview}
            previewAlt="Collector binder: owned cards beside a greyscale placeholder you can buy"
            title="Collector Binder"
            description="Template-based completionist view. Owned cards in full color, missing cards as greyscale placeholders linked directly to AtomicHub. Duplicate cards are stacked into one slot — click the stack to see every copy. Set price alerts on any missing card to get notified when it drops below your target. See exactly what you need."
          />
          <FeatureCard
            preview={savedCollectionPreview}
            previewAlt="Saved collection: a dashed drop slot with a card being dragged into place"
            previewClass="tilt-right"
            title="Saved Collection"
            description="Your personal workspace. Import/export JSON layouts, add and remove rows, drag-and-drop to rearrange, optionally stack your duplicates and build the perfect display of your collection."
          />
        </div>
      </div>
      <p className="max-w-5xl mx-auto text-center text-cheese text-base font-medium bright-landing-panel rounded-lg px-4 py-3">
        All three views persist simultaneously — your Classic filters, Binder progress, and Saved layouts are all maintained at once. Toggle between them instantly using a simple tab interface.
      </p>

      {/* Section B — Pack Openings */}
      <div className="max-w-5xl mx-auto">
        <div className="rounded-xl border border-cheese/20 bg-cheese/5 bright-landing-panel p-6 md:p-8 flex flex-col lg:flex-row items-center gap-6">
          <div className="w-full max-w-[440px] lg:w-[44%] flex-shrink-0">
            <PackArtworkFan />
          </div>
          <div className="min-w-0 text-center lg:text-left">
            <h3 className="text-xl font-bold text-cheese mb-2">Pack Openings</h3>
            <ul className="list-disc pl-5 space-y-1 text-foreground text-sm theme-bright-text">
              <li><strong>Supported now:</strong> Series 1, Series 2, Tiger King (Exotic), all Food Fight packs, Crash Gordon and GameStonk!</li>
              <li>Both <strong>SimpleAssets</strong> and <strong>AtomicAssets</strong> packs open natively.</li>
              <li>Card-by-card reveal animation.</li>
              <li>Immersive sound design.</li>
              <li>Demo openings available to preview the experience without spending any packs.</li>
              <li>View your SimpleAssets packs using the original placeholder artwork.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section C — Feature Highlights (2×2) */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* View Any Wallet */}
        <div className="rounded-xl border border-cheese/20 bg-cheese/5 bright-landing-panel p-6 flex flex-col sm:flex-row items-center gap-5">
          <div className="view-wallet-preview flex-shrink-0">
            <img
              src={viewWalletPreview}
              alt="The View another wallet panel: an account search box above a list of GPK accounts with how long ago each was last active"
              className="block w-full h-auto"
            />
          </div>
          <div className="min-w-0 text-left">
            <h3 className="text-xl font-bold text-cheese mb-2">View Any Wallet</h3>
            <ul className="text-foreground text-sm theme-bright-text list-disc list-outside pl-4 space-y-1">
              <li>Browse any WAX account's collection.</li>
              <li>Full access to their Classic grid, Collector Binder, card details and packs.</li>
              <li>Holders dropdown ranks every GPK holder, largest to smallest.</li>
              <li>One click returns you to your own collection.</li>
            </ul>
          </div>
        </div>

        {/* Card & Pack Trading */}
        <div className="rounded-xl border border-cheese/20 bg-cheese/5 bright-landing-panel p-6 flex flex-col sm:flex-row items-center gap-5">
          <div className="trade-preview compact flex-shrink-0">
            <img
              src={cardTradingPreview}
              alt="Two GPK cards — April Showers and Adam Bomb — each with its own Trade button"
              className="block w-full h-auto"
            />
          </div>
          <div className="min-w-0 text-left">
            <h3 className="text-xl font-bold text-cheese mb-2">Card & Pack Trading (P2P)</h3>
            <ul className="text-foreground text-sm theme-bright-text list-disc list-outside pl-4 space-y-1">
              <li>Propose card-for-card or pack-for-pack swaps — no marketplace, no fees.</li>
              <li>Find a collector via View Any Wallet, then open the trade composer.</li>
              <li>AtomicAssets official offers; SimpleAssets atomic multisig swaps.</li>
              <li>Accept, decline, cancel or counter from the Trades dialog.</li>
              <li>Green badge on the Trades button counts incoming offers and replies.</li>
            </ul>
          </div>
        </div>

        {/* Multi-File JSON Import */}
        <div className="rounded-xl border border-cheese/20 bg-cheese/5 bright-landing-panel p-6 flex flex-col sm:flex-row items-center gap-5">
          <div className="trade-preview compact flex-shrink-0">
            <img
              src={jsonImportPreview}
              alt="The JSON dropdown menu open over the collection grid, with Export favourites highlighted among the import and export options"
              className="block w-full h-auto"
            />
          </div>
          <div className="min-w-0 text-left">
            <h3 className="text-xl font-bold text-cheese mb-2">Multi-File JSON Import</h3>
            <ul className="text-foreground text-sm theme-bright-text list-disc list-outside pl-4 space-y-1">
              <li>Drop multiple JSON files at once — each lands in the right category automatically.</li>
              <li>Restores saved layouts, favourite trading accounts, price alerts, puzzle progress and pack history.</li>
              <li>Recent imports cached for instant re-apply.</li>
            </ul>
          </div>
        </div>

        {/* Pack Opening History & Replay */}
        <div className="rounded-xl border border-cheese/20 bg-cheese/5 bright-landing-panel p-6 flex flex-col sm:flex-row items-center gap-5">
          <div className="flex flex-col items-center gap-3 flex-shrink-0 w-[210px] max-w-full">
            <div className="trade-preview compact">
              <img
                src={packHistoryPreview}
                alt="The pack history grid: one tile per pack type with pack artwork, how many times it was opened and the last opening date"
                className="block w-full h-auto"
              />
            </div>
            <div className="trade-preview tilt-right compact">
              <img
                src={packReplayPreview}
                alt="A single pack's opening list with the date, card count and a yellow Replay button on each entry"
                className="block w-full h-auto"
              />
            </div>
          </div>
          <div className="min-w-0 text-left">
            <h3 className="text-xl font-bold text-cheese mb-2">Pack Opening History & Replay</h3>
            <ul className="text-foreground text-sm theme-bright-text list-disc list-outside pl-4 space-y-1">
              <li>Rebuilds every pack you've ever opened from the WAX chain — type, date and full contents.</li>
              <li>Replay any opening with the full reveal and card-deal animation.</li>
              <li>Reveal order shuffles each time for a fresh experience.</li>
              <li>Download your history as JSON and load it back any time.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section D — More Features */}
      <div className="max-w-5xl mx-auto space-y-4">
        <h3 className="text-2xl font-bold text-cheese text-center bright-section-heading">More Features</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FeatureCard
            icon={<span className="text-2xl">📐</span>}
            title="3D Card Tilt Effect"
            description="Cards respond to your mouse with an interactive 3D tilt effect — realistic depth and perspective that brings your collection to life as you hover over each card."
          />
          <FeatureCard
            icon={<span className="text-2xl">🔍</span>}
            title="Inspect Every Detail"
            description="Click any card to open a full-detail view with front/back both visible. A magnifying lens follows your cursor on hover, zooming in so you can see every line, every detail, every variant difference up close."
          />
          <FeatureCard
            icon={<span className="text-2xl">🧩</span>}
            title="Series 2 Puzzle Builder"
            description="Series 2 cards contain hidden puzzle pieces on their backs. Auto-populate your collected pieces onto a free-form canvas — drag, rotate, and arrange them. Collect all 18 pieces of the Messy Tessie puzzle to unlock the full set of classic GPK puzzles."
          />
          <FeatureCard
            icon={<span className="text-2xl">✏️</span>}
            title="Draw & Write on Cards"
            description="Switch to pen mode on any card to doodle, scribble or write. Reward your friends and family with the 'Spaz Award' — then press erase or close the modal and your cards are as good as new."
          />
          <FeatureCard
            icon={<span className="text-2xl">🔗</span>}
            title="SimpleAssets & AtomicAssets"
            description="Full support for both NFT standards on WAX. Your entire GPK collection in one unified view regardless of which contract holds them."
          />
          <FeatureCard
            icon={<span className="text-2xl">🔥</span>}
            title="Transfer & Burn"
            description="Select multiple NFTs and transfer them to any WAX account or burn them permanently — all in a single transaction. Supports both SimpleAssets and AtomicAssets contracts simultaneously."
          />
          <FeatureCard
            icon={<span className="text-2xl">🎛️</span>}
            title="Filter by Series & Variant"
            description="Filter by Series 1, Series 2, and all other collections. Drill down by variant — Base, Prism, Sketch, VHS, Slime, Tiger Stripe, Gold and more. Available in all 3 view options."
          />
          <FeatureCard
            icon={<span className="text-2xl">🔔</span>}
            title="Price Alerts"
            description="Set up to 5 price alerts across your entire collection on any missing card. Get pinged the moment a listing drops below your target — never miss a deal on that one card you've been hunting."
          />
          <div className="sm:col-span-2 flex justify-center">
            <div className="w-full max-w-lg">
              <FeatureCard
                icon={<span className="text-2xl">🤝</span>}
                title="Free Community Tool"
                description="No fees, no sign-ups. A WAX community asset."
              />
            </div>
          </div>
        </div>
      </div>

      <div className="text-center space-y-4 max-w-md mx-auto rounded-lg bright-landing-panel p-6">
        <p className="text-foreground">Connect your WAX wallet to get started — it only takes a few seconds.</p>
        <Button onClick={login} className="bg-cheese hover:bg-cheese/90 text-cheese-foreground">
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
      </div>
    </div>
  );
}
