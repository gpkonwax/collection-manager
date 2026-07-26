import { chromium } from 'playwright';

const url = 'https://gateway.pinata.cloud/ipfs/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:8080');

  const result = await page.evaluate(async (imageUrl) => {
    const revealMod = await import('/src/lib/revealImageSources.ts');
    const manifestRes = await fetch('/gpk-manifest.json', { cache: 'no-store' });
    const manifest = manifestRes.ok ? await manifestRes.json() : null;

    const controller = new AbortController();
    const perStarted = performance.now();
    const preload = revealMod.preloadRevealImage(imageUrl, manifest, controller.signal, (s) => console.log('status:', s));

    const direct = new Promise((resolve) => {
      const img = new Image();
      const start = performance.now();
      img.onload = () => resolve({ ok: true, ms: Math.round(performance.now() - start) });
      img.onerror = () => resolve({ ok: false, ms: Math.round(performance.now() - start) });
      img.src = revealMod.buildRevealCandidateUrls(imageUrl, null, manifest)[0];
      setTimeout(() => resolve({ ok: false, ms: Math.round(performance.now() - start), reason: 'timeout' }), 10000);
    });

    const [preloadResult, directResult] = await Promise.all([preload, direct]);
    return {
      candidates: revealMod.buildRevealCandidates(imageUrl, null, manifest),
      preloadResult,
      directResult,
      manifestFilesCount: manifest ? Object.keys(manifest.files || {}).length : 0,
    };
  }, url);

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch(console.error);
