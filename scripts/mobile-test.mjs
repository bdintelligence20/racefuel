import { chromium } from 'playwright-core';

const MOBILE = { width: 390, height: 844 };
const TABLET = { width: 820, height: 1180 };
const DESKTOP = { width: 1440, height: 900 };
const BASE = 'http://localhost:5174';
const OUT = '/tmp/mobile-screenshots';

async function captureViewport(browser, label, viewport, isMobile) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: isMobile ? 3 : 2,
    isMobile,
    hasTouch: isMobile,
  });
  const page = await context.newPage();
  const prefix = label;

  // 1. Landing page
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${prefix}-01-landing-hero.png`, fullPage: false });

  // Scroll to features
  await page.evaluate((y) => window.scrollTo(0, y), isMobile ? 800 : 1000);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${prefix}-02-landing-stats-features.png`, fullPage: false });

  // Scroll to races
  await page.evaluate(() => window.scrollTo(0, 2500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${prefix}-03-landing-races.png`, fullPage: false });

  // Full page
  await page.screenshot({ path: `${OUT}/${prefix}-04-landing-full.png`, fullPage: true });

  // 2. Enter the app
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const openBtn = page.locator('button', { hasText: /Open App|Start Planning/i }).first();
  if (await openBtn.isVisible()) {
    await openBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: `${OUT}/${prefix}-05-onboarding-splash.png`, fullPage: false });

  // Get through onboarding
  const getStarted = page.locator('button', { hasText: /Get Started/i });
  if (await getStarted.isVisible({ timeout: 1000 }).catch(() => false)) {
    await getStarted.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${prefix}-06-onboarding-strava.png`, fullPage: false });

    const skip = page.locator('button', { hasText: /Skip/i });
    if (await skip.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `${OUT}/${prefix}-07-onboarding-metrics.png`, fullPage: false });

    for (let i = 0; i < 3; i++) {
      const cont = page.locator('button', { hasText: /Continue|Start Planning/i }).first();
      if (await cont.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cont.click();
        await page.waitForTimeout(500);
      }
    }
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${OUT}/${prefix}-08-app-main.png`, fullPage: false });

  // Sidebar (mobile: hamburger, desktop: already visible)
  if (isMobile) {
    const hamburger = page.locator('button').first();
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${prefix}-09-sidebar.png`, fullPage: false });
      await page.locator('.fixed.inset-0').click({ position: { x: 350, y: 400 } }).catch(() => {});
      await page.waitForTimeout(300);
    }
  } else {
    await page.screenshot({ path: `${OUT}/${prefix}-09-sidebar-and-map.png`, fullPage: false });
  }

  // Nutrition tab (mobile) or panel (desktop already visible)
  if (isMobile) {
    const fuelTab = page.locator('button', { hasText: /Fuel/i }).first();
    if (await fuelTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await fuelTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${prefix}-10-nutrition.png`, fullPage: false });
    }

    const mapTab = page.locator('button', { hasText: /Map/i }).first();
    if (await mapTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await mapTab.click();
      await page.waitForTimeout(500);
    }
  }

  await page.screenshot({ path: `${OUT}/${prefix}-11-final.png`, fullPage: false });

  await context.close();
}

async function run() {
  const fs = await import('fs');
  fs.mkdirSync(OUT, { recursive: true });

  // Clear old screenshots
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith('.png')) fs.unlinkSync(`${OUT}/${f}`);
  }

  const browser = await chromium.launch({ headless: true });

  await captureViewport(browser, 'mobile', MOBILE, true);
  await captureViewport(browser, 'tablet', TABLET, true);
  await captureViewport(browser, 'desktop', DESKTOP, false);

  await browser.close();

  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).sort();
  console.log(`\n${files.length} screenshots saved to ${OUT}/`);
  files.forEach(f => {
    const stats = fs.statSync(`${OUT}/${f}`);
    console.log(`  ${f} (${Math.round(stats.size/1024)}kb)`);
  });
}

run().catch(e => { console.error(e); process.exit(1); });
