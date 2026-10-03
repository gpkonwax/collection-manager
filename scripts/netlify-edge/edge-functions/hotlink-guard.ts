// Netlify Edge Function: hotlink guard for the GPK image backup mirror.
//
// Blocks requests that arrive with a Referer from a foreign website (i.e. another
// site embedding our mirrored images and burning our bandwidth). Requests with
// NO Referer header are allowed through — that covers direct browser loads, the
// offline app bundle, privacy tools that strip referers, and the collection
// manager's own fetches when the browser omits a referer.
//
// Allowed referer origins:
//   - any *.lovable.app page (preview + published app)
//   - localhost / 127.0.0.1 (development + offline bundle)
//
// Deploy: place this file at netlify/edge-functions/hotlink-guard.ts in the
// Netlify site folder (or keep this scripts/netlify-edge/ structure and point
// netlify.toml's edge_functions dir at it). See netlify.toml next to this file.

const ALLOWED_REFERER_HOSTS: RegExp[] = [
  /(^|\.)lovable\.app$/i,
  /^localhost(:\d+)?$/i,
  /^127\.0\.0\.1(:\d+)?$/i,
];

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const referer = request.headers.get('referer');

  if (referer) {
    let host: string | null = null;
    try {
      host = new URL(referer).hostname;
    } catch {
      host = null;
    }
    const allowed = host !== null && ALLOWED_REFERER_HOSTS.some((re) => re.test(host));
    if (!allowed) {
      return new Response('Hotlinking is not permitted from this site.', {
        status: 403,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  return context.next();
};

export const config = {
  // Guard everything the mirror serves (images at the site root paths).
  path: '/*',
};
