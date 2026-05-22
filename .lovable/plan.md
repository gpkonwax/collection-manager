# Add Disclaimer to Footer

Add a small fine-print disclaimer block inside the existing footer in `src/pages/Index.tsx`, between the social/links grid (closes line 2156) and the `ExternalLinkWarningDialog` (line 2157).

## Final disclaimer copy

> **Disclaimer.** The GPK Collection Manager is a free, open-source community tool built by the $CHEESE community on the WAX blockchain. It is **not affiliated with, endorsed by, sponsored by, or associated with The Topps Company, Inc., Garbage Pail Kids, WWE, Netflix, Tiger King, GameStop / GameStonk, or any other rights holder**. All trademarks, character names, artwork, and brand assets shown are the property of their respective owners and are displayed solely as on-chain metadata of NFTs that users already own on WAX. No Topps, WWE, Netflix, Tiger King, or GameStop branding, logos, or imagery are used to promote, market, or advertise this tool.
>
> This manager does **not mint, sell, or distribute any NFTs or packs**. It deploys **no new smart contracts** — all on-chain actions (pack opening, transfers, burns, claims) are executed against pre-existing public WAX contracts (`gpk.topps`, AtomicAssets, etc.) using the user's own wallet and signatures. It was built to preserve community access to SimpleAssets pack opening and contract actions.
>
> No fees are charged by this tool. Use at your own risk — blockchain transactions are irreversible. Nothing here constitutes financial, legal, or investment advice. Rights holders with concerns or takedown requests may contact us at **gpkonwax@protonmail.com** or via Telegram: **https://t.me/cheeseonwaxofficial**.

## Technical details

- File: `src/pages/Index.tsx`
- Insert directly after line 2156 (`</div>` closing the grid), before line 2157 (`ExternalLinkWarningDialog`).
- Markup (semantic tokens only; no raw colors):
  ```tsx
  <div className="mt-6 pt-4 border-t border-cheese/10 text-[10px] leading-relaxed text-muted-foreground max-w-4xl mx-auto space-y-2">
    <p><strong className="text-cheese/80">Disclaimer.</strong> ...</p>
    <p>...</p>
    <p>
      ... contact us at{' '}
      <button onClick={() => window.location.href = 'mailto:gpkonwax@protonmail.com'} className="text-cheese hover:underline">gpkonwax@protonmail.com</button>
      {' '}or via Telegram:{' '}
      <button onClick={() => footerRequestNav('https://t.me/cheeseonwaxofficial')} className="text-cheese hover:underline">@cheeseonwaxofficial</button>.
    </p>
  </div>
  ```
- Telegram link routes through the existing `footerRequestNav` so it uses the `ExternalLinkWarningDialog` like the other outbound links.
- Email uses `mailto:` directly (no external-link warning needed).
- No new imports, no logic changes, no other files touched.

Ready to switch to build mode and apply.
