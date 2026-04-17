#!/usr/bin/env node
/**
 * Mobile UX audit for FuelCue.
 * Launches headed Chrome with a persistent profile, walks every surface,
 * captures screenshots at 3 mobile viewports, and extracts DOM metrics.
 *
 * First run: you'll sign in to Google manually in the visible window.
 * Subsequent runs: auto-authed via the persisted .playwright-profile dir.
 */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'audit-output');
const PROFILE = resolve(ROOT, '.playwright-profile');

const APP_URL = process.env.APP_URL || 'http://localhost:5174';

const VIEWPORTS = [
  { name: 'iphone-se',  w: 375, h: 667,  ua: 'iphone' },
  { name: 'iphone-14',  w: 390, h: 844,  ua: 'iphone' },
  { name: 'iphone-pm',  w: 428, h: 926,  ua: 'iphone' },
];

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** Measure a bunch of mobile-relevant page metrics via injected JS. */
async function measurePage(page) {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;

    // Horizontal overflow check
    const docOverflow = doc.scrollWidth > doc.clientWidth;
    const bodyOverflow = body.scrollWidth > body.clientWidth;

    // Tap targets: count buttons, links, [role=button] under 44x44 px
    const tappables = [
      ...document.querySelectorAll('button, a, [role="button"], input[type="checkbox"], input[type="radio"], select'),
    ];
    const tooSmall = [];
    for (const el of tappables) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue; // hidden, skip
      if (r.width < 44 || r.height < 44) {
        tooSmall.push({
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40),
          classes: (el.className || '').toString().slice(0, 80),
          w: Math.round(r.width),
          h: Math.round(r.height),
          x: Math.round(r.left),
          y: Math.round(r.top),
        });
      }
    }

    // Elements that overflow the viewport horizontally
    const overflowing = [];
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 2 || r.left < -2) {
        // Only flag if element is actually rendered (has area)
        if (r.width > 10 && r.height > 10) {
          const classStr = (el.className && typeof el.className === 'string') ? el.className : '';
          overflowing.push({
            tag: el.tagName.toLowerCase(),
            classes: classStr.slice(0, 80),
            right: Math.round(r.right),
            w: Math.round(r.width),
          });
        }
      }
      if (overflowing.length > 30) break;
    }

    // Fixed-position elements — relevant for safe-area / overlap
    const fixed = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'sticky') {
        const r = el.getBoundingClientRect();
        if (r.width > 20 && r.height > 20) {
          const classStr = (el.className && typeof el.className === 'string') ? el.className : '';
          fixed.push({
            tag: el.tagName.toLowerCase(),
            classes: classStr.slice(0, 80),
            pos: cs.position,
            top: Math.round(r.top),
            bottom: Math.round(window.innerHeight - r.bottom),
            height: Math.round(r.height),
            zIndex: cs.zIndex,
          });
        }
      }
    }

    // Text readability: flag nodes with computed font-size < 12px that contain actual text
    const tinyText = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const seen = new Set();
    let node;
    while ((node = walker.nextNode())) {
      const txt = node.nodeValue?.trim() || '';
      if (txt.length < 3) continue;
      const el = node.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      const px = parseFloat(cs.fontSize);
      if (px < 11) {
        tinyText.push({
          tag: el.tagName.toLowerCase(),
          text: txt.slice(0, 60),
          px: Math.round(px * 10) / 10,
        });
      }
      if (tinyText.length > 30) break;
    }

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
      docSize: { w: doc.scrollWidth, h: doc.scrollHeight },
      horizontalOverflow: docOverflow || bodyOverflow,
      tooSmallTapTargets: tooSmall,
      overflowingElements: overflowing,
      fixedElements: fixed,
      tinyText,
    };
  });
}

async function capture(page, label, viewport) {
  const fileSafe = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const fileName = `${viewport.name}--${fileSafe}`;
  const ssPath = resolve(OUT, 'screens', `${fileName}.png`);
  await page.screenshot({ path: ssPath, fullPage: true });
  const metrics = await measurePage(page);
  const reportPath = resolve(OUT, 'reports', `${fileName}.json`);
  await writeFile(reportPath, JSON.stringify({ label, viewport, metrics }, null, 2));
  // Summary log
  const flags = [];
  if (metrics.horizontalOverflow) flags.push('H-OVERFLOW');
  if (metrics.tooSmallTapTargets.length) flags.push(`${metrics.tooSmallTapTargets.length} small-tap`);
  if (metrics.overflowingElements.length) flags.push(`${metrics.overflowingElements.length} overflow-el`);
  if (metrics.tinyText.length) flags.push(`${metrics.tinyText.length} tiny-text`);
  console.log(`  [${viewport.name}] ${label} — ${flags.length ? flags.join(', ') : 'clean'}`);
}

async function switchViewport(page, viewport) {
  await page.setViewportSize({ width: viewport.w, height: viewport.h });
}

function log(msg) {
  console.log(`\n▶ ${msg}`);
}

async function waitForSelector(page, selector, opts = {}) {
  try {
    await page.waitForSelector(selector, { timeout: 8000, ...opts });
    return true;
  } catch {
    return false;
  }
}

async function click(page, selector) {
  await page.waitForSelector(selector, { timeout: 8000 });
  await page.click(selector);
}

async function scrollToBottom(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const h = document.documentElement.scrollHeight;
      let y = 0;
      const step = () => {
        y += 400;
        window.scrollTo(0, y);
        if (y < h) setTimeout(step, 80);
        else resolve();
      };
      step();
    });
  });
  await page.waitForTimeout(400);
}

async function main() {
  if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });
  if (!existsSync(resolve(OUT, 'screens'))) await mkdir(resolve(OUT, 'screens'), { recursive: true });
  if (!existsSync(resolve(OUT, 'reports'))) await mkdir(resolve(OUT, 'reports'), { recursive: true });

  log('Launching Chrome with persistent profile');
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless: false,
    viewport: { width: VIEWPORTS[1].w, height: VIEWPORTS[1].h },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    args: [
      '--window-size=420,920',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // Hide the webdriver flag that Google's OAuth page checks for
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // Spoof plugins + languages to look like a real browser
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  const page = ctx.pages()[0] || (await ctx.newPage());

  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[console.error]', msg.text());
  });

  log(`Navigating to ${APP_URL}`);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });

  // ── PUBLIC SURFACES ─────────────────────────────────────────
  log('LANDING PAGE');
  for (const vp of VIEWPORTS) {
    await switchViewport(page, vp);
    await page.waitForTimeout(500);
    await capture(page, 'landing-top', vp);
    await scrollToBottom(page);
    await capture(page, 'landing-bottom', vp);
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  log('ENTERING APP (clearing landing flag and clicking Open App)');
  await page.evaluate(() => localStorage.setItem('fuelcue_seen_landing', 'true'));
  await page.reload({ waitUntil: 'networkidle' });

  // Auth screen OR already signed in
  const hasAuth = await waitForSelector(page, 'text=Continue with Google', { timeout: 3000 });
  if (hasAuth) {
    log('AUTH SCREEN captured — pausing for Google sign-in');
    for (const vp of VIEWPORTS) {
      await switchViewport(page, vp);
      await page.waitForTimeout(400);
      await capture(page, 'auth-screen', vp);
    }

    console.log('\n👉 Please sign in with Google in the visible Chrome window (nicholasflemmer@gmail.com).');
    console.log('   The script will auto-resume when auth completes.\n');

    await page.waitForFunction(
      () => !document.body.innerText.includes('Continue with Google'),
      null,
      { timeout: 360000 }
    );
    log('Auth complete — continuing');
    await page.waitForTimeout(1500);
  }

  // Onboarding modal appears for new users
  const onboarding = await waitForSelector(page, '[data-modal="onboarding"], text=Welcome to fuelcue, text=Welcome', { timeout: 2500 });
  if (onboarding) {
    log('ONBOARDING MODAL');
    for (const vp of VIEWPORTS) {
      await switchViewport(page, vp);
      await page.waitForTimeout(300);
      await capture(page, 'onboarding-modal', vp);
    }
    // Try to skip/finish onboarding
    const skipBtn = await page.$('text=/Skip|Get Started|Continue|Done|Finish/i');
    if (skipBtn) {
      try { await skipBtn.click(); await page.waitForTimeout(500); } catch {}
    }
  }

  // ── MAIN APP IDLE (no route) ────────────────────────────────
  log('MAIN APP IDLE (with GPX drop zone)');
  await page.waitForTimeout(1000);
  for (const vp of VIEWPORTS) {
    await switchViewport(page, vp);
    await page.waitForTimeout(400);
    await capture(page, 'main-app-idle', vp);
  }

  // Mobile sidebar (open via hamburger)
  log('MOBILE SIDEBAR');
  for (const vp of VIEWPORTS) {
    await switchViewport(page, vp);
    await page.waitForTimeout(300);
    const hamburger = await page.$('button:has(svg.lucide-menu), button[aria-label*="menu" i]');
    if (hamburger) {
      try { await hamburger.click(); await page.waitForTimeout(400); } catch {}
      await capture(page, 'sidebar-open', vp);
      // Close
      const close = await page.$('button:has(svg.lucide-x)');
      if (close) { try { await close.click(); await page.waitForTimeout(300); } catch {} }
    }
  }

  // Load demo route so we can see elevation profile, action bar, nutrition panel states
  log('Loading DEMO route (Try Demo button)');
  await switchViewport(page, VIEWPORTS[1]);
  const demoBtn = await page.$('text=Try Demo');
  if (demoBtn) {
    try { await demoBtn.click(); await page.waitForTimeout(2500); } catch {}
  }

  log('MAIN APP with route loaded');
  for (const vp of VIEWPORTS) {
    await switchViewport(page, vp);
    await page.waitForTimeout(500);
    await capture(page, 'main-app-route-loaded', vp);
  }

  // Nutrition panel (switch mobile tab to "Fuel")
  log('NUTRITION PANEL (mobile tab)');
  for (const vp of VIEWPORTS) {
    await switchViewport(page, vp);
    await page.waitForTimeout(300);
    const fuelTab = await page.$('button:has-text("Fuel")');
    if (fuelTab) {
      try { await fuelTab.click(); await page.waitForTimeout(400); } catch {}
      await capture(page, 'nutrition-panel', vp);
      const mapTab = await page.$('button:has-text("Map")');
      if (mapTab) { try { await mapTab.click(); await page.waitForTimeout(300); } catch {} }
    }
  }

  // Try to auto-generate a plan
  log('AUTO-GENERATE plan');
  await switchViewport(page, VIEWPORTS[1]);
  const autoGen = await page.$('button[aria-label*="Auto generate" i]');
  if (autoGen) {
    try { await autoGen.click(); await page.waitForTimeout(1200); } catch {}
  }
  for (const vp of VIEWPORTS) {
    await switchViewport(page, vp);
    await page.waitForTimeout(400);
    await capture(page, 'main-app-with-plan', vp);
  }

  // ── MODAL TOUR ─────────────────────────────────────────────
  // Open sidebar first, then click each feature
  async function openSidebar() {
    const hamburger = await page.$('button:has(svg.lucide-menu)');
    if (hamburger) {
      try { await hamburger.click(); await page.waitForTimeout(400); } catch {}
      return true;
    }
    return false;
  }

  async function closeAnyModal() {
    try {
      // Click the X button if visible
      const x = await page.$('.fixed button:has(svg.lucide-x)');
      if (x) {
        await x.click();
        await page.waitForTimeout(300);
        return;
      }
    } catch {}
    try { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } catch {}
  }

  async function tourModal(triggerText, label) {
    log(`MODAL: ${label}`);
    for (const vp of VIEWPORTS) {
      await switchViewport(page, vp);
      await page.waitForTimeout(300);

      // Open sidebar if on mobile
      if (vp.w < 1024) await openSidebar();

      const btn = await page.$(`button:has-text("${triggerText}"), [role="button"]:has-text("${triggerText}")`);
      if (!btn) {
        console.log(`  [${vp.name}] ${label} — trigger "${triggerText}" not found`);
        continue;
      }
      try { await btn.click(); await page.waitForTimeout(600); } catch (e) {
        console.log(`  [${vp.name}] ${label} — click failed: ${e.message}`);
        continue;
      }
      await capture(page, `modal-${label}`, vp);
      await closeAnyModal();
      // Close sidebar (if it lingered)
      const backdrop = await page.$('.fixed.inset-0.z-30');
      if (backdrop) { try { await backdrop.click(); await page.waitForTimeout(200); } catch {} }
    }
  }

  await tourModal('Saved Plans', 'saved-plans');
  await tourModal('Export', 'export');
  await tourModal('Comparison', 'plan-comparison');
  await tourModal('History', 'history');
  await tourModal('Event', 'event-search');
  await tourModal('Cart', 'cart');
  await tourModal('Checklist', 'race-day-checklist');
  await tourModal('Edit Profile', 'edit-profile');
  await tourModal('Feedback', 'feedback');

  // Route drawing flow
  log('ROUTE DRAWING — toolbar states');
  for (const vp of VIEWPORTS) {
    await switchViewport(page, vp);
    await page.waitForTimeout(300);
    // Reset state by clicking "Clear"
    try {
      const clearBtn = await page.$('button[title="Clear route"]');
      if (clearBtn) { await clearBtn.click(); await page.waitForTimeout(500); }
    } catch {}

    // Click Draw Route from the dropzone
    const drawInDrop = await page.$('button:has-text("Draw Route")');
    if (drawInDrop) {
      try { await drawInDrop.click(); await page.waitForTimeout(500); } catch {}
    }
    await capture(page, 'drawing-toolbar-empty', vp);

    // Simulate two map clicks to build a small route
    try {
      const mapEl = await page.$('.mapboxgl-canvas');
      if (mapEl) {
        const box = await mapEl.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.4);
          await page.waitForTimeout(800);
          await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.6);
          await page.waitForTimeout(1200);
          await capture(page, 'drawing-toolbar-with-route', vp);
        }
      }
    } catch (e) {
      console.log(`  [${vp.name}] drawing simulation failed: ${e.message}`);
    }

    // Cancel drawing
    const cancelBtn = await page.$('button:has-text("Cancel")');
    if (cancelBtn) { try { await cancelBtn.click(); await page.waitForTimeout(400); } catch {} }
  }

  // ── LANDSCAPE / rotated ─────────────────────────────────────
  log('LANDSCAPE (one quick pass)');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  await capture(page, 'landscape-main', { name: 'iphone-14-landscape', w: 844, h: 390, ua: 'iphone' });

  log('AUDIT COMPLETE — screenshots in audit-output/screens/, metrics in audit-output/reports/');
  await page.waitForTimeout(1000);
  await ctx.close();
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
