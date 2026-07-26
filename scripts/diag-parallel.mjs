import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:8080');

  const urls = [
    'https://bewbzz.github.io/gpkonwaxbackup/mirror/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg',
    'https://bewbzz.github.io/gpkonwaxbackup/mirror/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/prism/2b.gif',
    'https://bewbzz.github.io/gpkonwaxbackup/mirror/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/sketch/3a.gif',
    'https://bewbzz.github.io/gpkonwaxbackup/mirror/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/collector/4b.gif',
    'https://bewbzz.github.io/gpkonwaxbackup/mirror/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/golden/5a.gif',
  ];

  const result = await page.evaluate(async (imageUrls) => {
    const start = performance.now();
    const results = await Promise.all(
      imageUrls.map((url) => new Promise((resolve) => {
        const img = new Image();
        const s = performance.now();
        img.onload = () => resolve({ ok: true, url, ms: Math.round(performance.now() - s) });
        img.onerror = () => resolve({ ok: false, url, ms: Math.round(performance.now() - s) });
        img.src = url;
        setTimeout(() => resolve({ ok: false, url, ms: Math.round(performance.now() - s), reason: 'timeout' }), 10000);
      })),
    );
    return { totalMs: Math.round(performance.now() - start), results };
  }, urls);

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch(console.error);
