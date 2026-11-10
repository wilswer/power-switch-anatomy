// Browser tests for the guided tour, one per bug found in review. They start
// their own server on a free port and drive headless Chromium (software WebGL).
// Run with `npm run test:e2e`; needs `npx playwright install chromium` once.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let server;
let browser;
let base;

before(async () => {
  server = spawn('python3', [path.join(ROOT, 'serve.py'), '--port', '0'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  base = await new Promise((resolve, reject) => {
    let out = '';
    server.stdout.on('data', (chunk) => {
      out += chunk;
      const m = out.match(/http:\/\/[\d.]+:(\d+)\//);
      if (m) resolve(`http://127.0.0.1:${m[1]}/`);
    });
    server.on('exit', (code) => reject(new Error(`test server exited with ${code}`)));
  });
  browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
});

after(async () => {
  await browser?.close();
  server?.kill();
});

async function open({ viewport = { width: 1280, height: 720 }, reducedMotion = 'no-preference', hash = 'sic' } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}#${hash}`);
  await page.waitForFunction(() => window.__pageDebug?.viewer);
  return {
    page,
    errors,
    close: () => ctx.close(),
    state: () => page.evaluate(() => JSON.parse(JSON.stringify(window.__pageDebug.state))),
    step: () => page.evaluate(() => window.__pageDebug.tour.currentStep()),
    active: () => page.evaluate(() => window.__pageDebug.tour.isActive()),
    goTo: (n) => page.click(`#tour-progress [data-step="${n - 1}"]`),
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('a voltage sweep never drives another device', async () => {
  const t = await open();
  await t.page.click('.cta');
  await t.goTo(8); // SiC sweep, 0 → 1200 V
  await wait(600);
  await t.page.click('[data-device="gan"]');
  await wait(1500);
  assert.equal((await t.state()).block.gan.V, 650, 'GaN keeps its own voltage');
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('leaving Blocking mode stops a running sweep', async () => {
  const t = await open();
  await t.page.click('.cta');
  await t.goTo(8);
  await wait(800);
  await t.page.click('[data-mode="explore"]');
  const before = (await t.state()).block.sic.V;
  await wait(1500);
  assert.equal((await t.state()).block.sic.V, before);
  await t.close();
});

test('Replay restarts the whole step, not just the sweep', async () => {
  const t = await open();
  await t.page.click('.cta');
  await t.goTo(8);
  await t.page.click('[data-device="gan"]');
  await t.page.click('#tour-replay');
  await wait(300);
  const s = await t.state();
  assert.equal(s.device, 'sic');
  assert.equal(s.mode, 'block');
  await t.close();
});

test('starting or reopening the tour brings its card into view', async () => {
  const t = await open({ viewport: { width: 1280, height: 720 } });
  const nextInView = () =>
    t.page.waitForFunction(
      () => {
        const r = document.querySelector('#tour-next').getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      },
      null,
      { timeout: 3000 },
    );
  await t.page.click('.cta');
  await nextInView();
  await t.page.evaluate(() => scrollTo(0, 0));
  await t.page.click('.cta'); // the tour is already running
  await nextInView();
  await t.close();
});

test('focus goes somewhere sensible when the tour stops or Back disables itself', async () => {
  const t = await open();
  const focused = () => t.page.evaluate(() => document.activeElement?.id || document.activeElement?.className);
  await t.page.click('.cta');
  await t.page.keyboard.press('Escape');
  assert.match(await focused(), /\bcta\b/, 'Esc returns focus to the start button');

  await t.page.click('.tour-btn');
  await t.page.click('#tour-exit');
  assert.match(await focused(), /\btour-btn\b/, 'Exit returns focus to the start button');

  await t.page.click('.tour-btn');
  await t.page.click('#tour-next');
  await t.page.focus('#tour-back');
  await t.page.keyboard.press('Enter'); // back to step 1, where Back is disabled
  assert.equal(await t.step(), 0);
  assert.equal(await focused(), 'tour-next');
  await t.close();
});

test('arrow keys with a modifier are left to the browser', async () => {
  const t = await open();
  await t.page.click('.cta');
  await t.page.click('#tour-next');
  await t.page.click('#tour-next');
  for (const mod of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    await t.page.evaluate(
      (m) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, [m]: true })),
      mod,
    );
  }
  assert.equal(await t.step(), 2);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('the toolbar Tour button toggles, and the start label follows the tour', async () => {
  const t = await open();
  await t.page.click('.tour-btn');
  assert.equal(await t.active(), true);
  assert.equal(await t.page.getAttribute('.tour-btn', 'aria-pressed'), 'true');
  await t.page.click('.tour-btn');
  assert.equal(await t.active(), false);
  assert.equal(await t.page.isHidden('#tour-card'), true);

  assert.equal(await t.page.getAttribute('.cta', 'aria-pressed'), null, 'the CTA is not a toggle');
  await t.page.click('.cta');
  await t.goTo(5);
  await t.page.keyboard.press('Escape');
  assert.match(await t.page.textContent('.tour-start-label'), /step 5\b/);
  await t.page.click('.cta');
  assert.equal(await t.step(), 4, 'resumes where it was left');
  await t.goTo(12);
  assert.doesNotMatch(await t.page.textContent('.tour-start-label'), /step 5\b/);
  await t.close();
});

test('switching the field plate off removes it from the model', async () => {
  const t = await open({ hash: 'gan' });
  const plateVisible = () => t.page.evaluate(() => window.__pageDebug.viewer.parts.get('fieldplate').group.visible);
  await t.page.click('[data-mode="block"]');
  await t.page.uncheck('#fieldplate');
  assert.equal(await plateVisible(), false);
  await t.page.click('[data-mode="explore"]');
  assert.equal(await plateVisible(), true, 'the real device always has it');
  await t.close();
});

test('with reduced motion the sweep still steps up in visible stages', async () => {
  const t = await open({ reducedMotion: 'reduce' });
  await t.page.click('.cta');
  await t.goTo(8);
  const seen = new Set();
  for (let i = 0; i < 28; i++) {
    seen.add((await t.state()).block.sic.V);
    await wait(250);
  }
  assert.ok(seen.size >= 3, `saw voltages ${[...seen]}`);
  assert.ok(seen.has(1200), 'ends at 1200 V');
  await t.close();
});

test('the Next button describes the step for screen readers', async () => {
  const t = await open();
  const ids = (await t.page.getAttribute('#tour-next', 'aria-describedby')) ?? '';
  assert.ok(ids.split(/\s+/).includes('tour-text'));
  await t.close();
});

test('stepping with the keyboard while dragging the camera does not fight the drag', async () => {
  const t = await open();
  await t.page.click('.cta');
  await wait(1800); // let the first camera move finish
  const box = await t.page.locator('#scene').boundingBox();
  await t.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await t.page.mouse.down();
  await t.page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 });
  await t.page.keyboard.press('ArrowRight');
  const flying = await t.page.evaluate(() => window.__pageDebug.viewer._fly !== null);
  await t.page.mouse.up();
  assert.equal(await t.step(), 1, 'the step still advances');
  assert.equal(flying, false, 'but the camera stays with the drag');
  await t.close();
});

test('Blocking steps show the live numbers in the tour card itself', async () => {
  const t = await open({ viewport: { width: 400, height: 860 } });
  await t.page.click('.cta');
  await t.goTo(8);
  await t.page.waitForFunction(() => window.__pageDebug.state.block.sic.V === 1200, null, { timeout: 10000 });
  const text = await t.page.textContent('#tour-readout');
  assert.match(text, /1200 V/);
  assert.match(text, /76 %/);
  await t.goTo(9);
  assert.equal(await t.page.isHidden('#tour-readout'), true);
  await t.close();
});

test('progress segments are big enough to tap and stay out of the tab order', async () => {
  const t = await open({ viewport: { width: 390, height: 844 } });
  await t.page.click('.cta');
  const info = await t.page.evaluate(() =>
    [...document.querySelectorAll('#tour-progress [data-step]')].map((b) => ({
      tab: b.getAttribute('tabindex'),
      h: b.getBoundingClientRect().height,
    })),
  );
  assert.ok(info.every((b) => b.tab === '-1'));
  assert.ok(info.every((b) => b.h >= 24));
  await t.close();
});
