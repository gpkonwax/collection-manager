# Hide mirror links from public view + add hotlink protection

Two parts, as agreed. The primary mirror stays on GitHub Pages — no change there.

---

## Part 1 — Stop showing raw mirror URLs in the app

Right now the Offline Backup panel prints the full mirror addresses in plain text that anyone can copy:

- Step 1 shows the primary mirror URL (`bewbzz.github.io/gpkonwaxbackup/`)
- Step 2 shows both backup mirror URLs (Netlify + Cloudflare)
- The data mirror section shows the Cloudflare data URL

**What changes in `src/components/BackupPanel.tsx`:**

- Replace each raw URL line with a clean label that says *what* it is, not *where* it is:
  - Step 1: "Primary mirror — GitHub Pages" (provider badge already exists, we reuse it)
  - Step 2 backups: keep the existing "Backup mirror A — Netlify" / "Backup mirror B — Cloudflare Pages" labels and provider badges, just remove the URL text line underneath
  - Data mirror: "Data mirror — Cloudflare Pages"
- The health badges (Reachable / Unreachable / file counts) and the "Use mirror" buttons stay exactly as they are — only the copyable address text goes away.

**Honest limitation (unchanged from our discussion):** this stops casual copy-pasting. Anyone technical can still see the addresses in their browser's network tools, because the app runs entirely in the browser. That's why Part 2 matters.

## Part 2 — Hotlink protection on the mirrors (server-side)

The goal: other sites can't embed our mirror images on *their* pages and burn our bandwidth. Two mirror hosts, two different mechanisms:

### 2a. Cloudflare Pages (backup B + data mirror) — WAF rule, done by you in the Cloudflare dashboard

Cloudflare Pages doesn't support referer rules in config files, but every Cloudflare zone gets free WAF custom rules. I'll give you exact click-by-click steps (like the token walkthrough) to add one rule:

- **Block** requests to `gpkonwaxbackup.pages.dev` and `gpk-data.pages.dev` where the `Referer` header is present **and** does not contain our app domains (`lovable.app`, `pack-magic-reimagined.lovable.app`, `localhost`).
- Empty referer is allowed (direct browser loads, the offline app, and privacy tools that strip referers) — blocking empty referers would break legitimate users.
- Cost: free. WAF custom rules are included on the free plan.

### 2b. Netlify (backup A) — Edge Function, done in code

Netlify's free tier has no built-in referer blocking, but it has free Edge Functions. I'll add a small edge function to the Netlify mirror deploy that applies the same rule: block requests whose referer is a foreign site, allow empty referers and our app domains.

- The edge function file + `netlify.toml` live in the backup repo's deploy folder; I'll prepare them and give you the exact files to drop in before your next Netlify drag-and-drop deploy.
- Netlify free tier includes 1M edge function invocations/month — image traffic is well under that.

### GitHub Pages (primary) — not possible

GitHub Pages has no referer blocking at all. Its 100 GB/month limit is a soft cap and GitHub is tolerant, so we accept this risk for now — which is also why keeping the option of promoting Cloudflare to primary later stays on the table.

---

## What you do after I finish

1. I make the Part 1 UI changes and write the Part 2 files (WAF rule steps + Netlify edge function).
2. You follow the Cloudflare WAF walkthrough (about 5 minutes, no code).
3. You copy the two Netlify files into your next backup-A deploy whenever you next update it — no rush, it can wait until the next mirror refresh.

## Technical notes

- Only `src/components/BackupPanel.tsx` changes in the app. No mirror URLs, constants, or fallback logic are touched — the app keeps using the mirrors exactly as before; we just stop displaying the addresses.
- New files: `scripts/netlify-edge/edge-functions/hotlink-guard.ts` + `netlify.toml` snippet, and a step-by-step WAF guide in the plan follow-up message.
- The `Access-Control-Allow-Origin: *` CORS header on the data mirror stays — CORS and hotlinking are separate concerns, and the app itself fetches cross-origin.
