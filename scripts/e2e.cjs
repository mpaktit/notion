// End-to-end smoke test: drives the real built app in Chromium and captures screenshots.
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const exe = process.env.CHROMIUM || undefined;
require('fs').mkdirSync('shots', { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = (n) => page.screenshot({ path: `shots/${n}.png` });
  await page.goto(URL); await page.waitForTimeout(1200);
  await shot('01-onboarding');
  await page.fill('input[aria-label="Pilot name"]', 'Nova<script>');
  await page.click('text=Launch');
  await page.waitForTimeout(900); await shot('02-core-shaking');
  await page.waitForTimeout(1700); await shot('03-core-reveal');
  await page.click('.opening button:has-text("Done")');
  await page.waitForTimeout(800); await shot('04-home');
  const name = await page.evaluate(() => window.__ns.app.save.profile.name);
  if (name !== 'Novascript') errors.push('name sanitize failed: ' + name);
  for (const tab of ['species', 'locker', 'shop', 'pass', 'quests']) {
    await page.click(`#nav button[data-id="${tab}"]`); await page.waitForTimeout(500); await shot('05-' + tab);
  }
  await page.click('.pilot'); await page.waitForTimeout(400); await shot('06-profile');
  // claim daily login from quests
  await page.click('#nav button[data-id="quests"]'); await page.waitForTimeout(300);
  const claimBtn = await page.$('button:has-text("Claim day")'); if (claimBtn) { await claimBtn.click(); await page.waitForTimeout(600); }
  // play
  await page.click('#nav button[data-id="home"]'); await page.waitForTimeout(300);
  await page.click('.play-btn'); await page.waitForTimeout(600); await shot('07-countdown');
  await page.waitForTimeout(1600);
  await page.evaluate(() => { const g = window.__ns.game; g.spawn('gold'); g.spawn('magnet'); g.spawn('crystal'); g.spawn('dust'); g.effects.double = 6000; });
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400); await shot('09-pause');
  await page.click('button:has-text("Resume")'); await page.waitForTimeout(2000);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
  await page.keyboard.press('Space'); await page.waitForTimeout(500);
  await shot('08-gameplay');
  // force death
  await page.evaluate(() => { const g = window.__ns.game; g.effects = {}; g.dir = { x: 0, y: -1 }; g.queue = []; g.snake[0].y = 0; g.score += 420; });
  await page.waitForTimeout(1500); await shot('10-revive');
  await page.click('button:has-text("No thanks")'); await page.waitForTimeout(1400); await shot('11-results');
  await page.click('.modal button:has-text("Home")'); await page.waitForTimeout(600);
  // sectors: jump to a high level to preview hazards
  await page.evaluate(() => { const a = window.__ns.app; a.save.profile.xp = 60000; a.save.profile.level = 1; });
  await page.reload(); await page.waitForTimeout(1200);
  for (const sec of ['dunes', 'belt', 'nebula', 'horizon']) {
    await page.evaluate((s) => { const a = window.__ns.app; a.save.settings.lastMode = 'endless'; a.save.settings.lastSector = s; a.save.equipped.skin = 'neon'; a.startRun(); }, sec);
    await page.waitForTimeout(2600);
    await page.evaluate(() => { const g = window.__ns.game; for (let i = 0; i < 8; i++) g.levelUp(); g.grow = 10; if (g.hazard === 'rocks') { g.nextStorm = g.time; } });
    await page.waitForTimeout(1500); await shot('12-sector-' + sec);
    await page.evaluate(() => window.__ns.finishRun(true));
    await page.evaluate(() => { document.querySelectorAll('.modal-wrap').forEach((m) => m.remove()); });
  }
  // mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await mp.goto(URL); await mp.waitForTimeout(1000); await mp.screenshot({ path: 'shots/20-m-onboarding.png' });
  await mp.click('text=Launch'); await mp.waitForTimeout(2800); await mp.screenshot({ path: 'shots/21-m-reveal.png' });
  await mp.click('.opening button:has-text("Done")'); await mp.waitForTimeout(700);
  await mp.screenshot({ path: 'shots/22-m-home.png' });
  for (const tab of ['species', 'shop', 'pass']) { await mp.click(`#nav button[data-id="${tab}"]`); await mp.waitForTimeout(500); await mp.screenshot({ path: `shots/23-m-${tab}.png` }); }
  await mp.click('#nav button[data-id="home"]'); await mp.waitForTimeout(300);
  await mp.click('.play-btn'); await mp.waitForTimeout(3200); await mp.screenshot({ path: 'shots/24-m-play.png' });
  console.log(JSON.stringify({ errors }, null, 1));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
