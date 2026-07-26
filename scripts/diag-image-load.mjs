import { chromium } from 'playwright';

const url = process.argv[2] || 'https://bewbzz.github.io/gpkonwaxbackup/mirror/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:8080');

  const result = await page.evaluate(async (imageUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      const start = performance.now();
      img.onload = () => resolve({ ok: true, url: imageUrl, ms: Math.round(performance.now() - start), width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ ok: false, url: imageUrl, ms: Math.round(performance.now() - start) });
      img.src = imageUrl;
      setTimeout(() => resolve({ ok: false, url: imageUrl, ms: Math.round(performance.now() - start), reason: 'timeout' }), 10000);
    });
  }, url);

  console.log(result);
  await browser.close();
}

main().catch(console.error);
