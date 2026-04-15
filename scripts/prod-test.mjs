import { chromium } from 'playwright-core';

const BASE = 'https://racefuel-232284124334.us-central1.run.app';
const OUT = '/tmp/prod-screenshots';
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

async function run() {
  const fs = await import('fs');
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith('.png')) fs.unlinkSync(`${OUT}/${f}`);
  }

  const browser = await chromium.launch({ headless: true });

  // Mobile
  const mobile = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mp = await mobile.newPage();
  await mp.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await mp.waitForTimeout(2000);
  await mp.screenshot({ path: `${OUT}/mobile-01-landing.png` });

  // Click Open App / Start Planning
  const mBtn = mp.locator('button', { hasText: /Open App|Start Planning/i }).first();
  if (await mBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await mBtn.click();
    await mp.waitForTimeout(2000);
  }
  await mp.screenshot({ path: `${OUT}/mobile-02-auth-or-app.png` });

  // Check for auth screen
  const googleBtn = mp.locator('button', { hasText: /Google/i }).first();
  if (await googleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await mp.screenshot({ path: `${OUT}/mobile-03-auth-screen.png` });
  }

  await mobile.close();

  // Desktop
  const desktop = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2 });
  const dp = await desktop.newPage();
  await dp.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await dp.waitForTimeout(2000);
  await dp.screenshot({ path: `${OUT}/desktop-01-landing.png` });

  const dBtn = dp.locator('button', { hasText: /Open App|Start Planning/i }).first();
  if (await dBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dBtn.click();
    await dp.waitForTimeout(2000);
  }
  await dp.screenshot({ path: `${OUT}/desktop-02-auth-or-app.png` });

  await desktop.close();
  await browser.close();

  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).sort();
  console.log(`${files.length} screenshots saved to ${OUT}/`);
  files.forEach(f => console.log(`  ${f}`));
}

run().catch(e => { console.error(e); process.exit(1); });
