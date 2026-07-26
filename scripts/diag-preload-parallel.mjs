import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:8080');

  const urls = [
    'https://gateway.pinata.cloud/ipfs/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg',
    'https://gateway.pinata.cloud/ipfs/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/prism/2b.gif',
    'https://gateway.pinata.cloud/ipfs/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/sketch/3a.gif',
    'https://gateway.pinata.cloud/ipfs/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/collector/4b.gif',
    'https://gateway.pinata.cloud/ipfs/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/golden/5a.gif',
  ];

  const result = await page.evaluate(async (imageUrls) => {
    const revealMod = await import('/src/lib/revealImageSources.ts');
    const manifestRes = await fetch('/gpk-manifest.json', { cache: 'no-store' });
    const manifest = manifestRes.ok ? await manifestRes.json() : null;

    const controller = new AbortController();
    const start = performance.now();
    const results = await Promise.all(
      imageUrls.map((url) => revealMod.preloadRevealImage(url, manifest, controller.signal)),
    );
    return { totalMs: Math.round(performance.now() - start), results };
  }, urls);

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch(console.error);
