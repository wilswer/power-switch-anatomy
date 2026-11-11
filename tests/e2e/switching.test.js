// Browser tests for "Switching, step by step" (setup in harness.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open, wait } from './harness.js';

// Move a slider and wait for the figure to redraw (on the next animation
// frame, which the software-rendered 3D view above can make slow).
const slide = async (page, sel, value) => {
  const before = await page.textContent('#sw-readouts');
  await page.$eval(
    sel,
    (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    value,
  );
  await page
    .waitForFunction((b) => document.querySelector('#sw-readouts').textContent !== b, before, { timeout: 5000 })
    .catch(() => {});
  await wait(50);
};
const readouts = (page) => page.textContent('#sw-readouts');

test('the duty cycle sets the average, and a weak filter lets the ripple through', async () => {
  const t = await open();
  assert.match(await readouts(t.page), /40 % of 48 V = 19\.2 V/);
  assert.match(await readouts(t.page), /10× below the switching frequency/);
  await slide(t.page, '#sw-d', 75);
  assert.match(await readouts(t.page), /75 % of 48 V = 36\.0 V/);
  const ripple = async () => Number((await readouts(t.page)).match(/±([\d.]+) V/)[1]);
  const strong = await ripple();
  await slide(t.page, '#sw-fc', 100);
  assert.match(await readouts(t.page), /above the switching frequency/);
  assert.ok((await ripple()) > 20 * strong, 'the pulses come through');
  assert.match(await t.page.textContent('#sw-explain'), /duty cycle of 75 %/);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('DC to AC makes a sine at the chosen frequency, and the spectrum says what each line is', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  await t.page.click('[data-sw-mode="ac"]');
  assert.equal(await t.page.isHidden('#sw-d'), true);
  assert.equal(await t.page.isVisible('#sw-m'), true);
  assert.match(await readouts(t.page), /Sine out, 50 Hz.*238 V/s);
  await slide(t.page, '#sw-f', 0);
  assert.match(await readouts(t.page), /Sine out, 10 Hz/);
  await slide(t.page, '#sw-m', 50);
  assert.match(await readouts(t.page), /asked for 0\.50 × 280 V = 140 V/);
  // Hover at the switching frequency: the nearest line explains itself.
  await t.page.$eval('#sw-lab', (el) => el.scrollIntoView({ block: 'center' }));
  const box = await t.page.locator('#sw-spec').boundingBox();
  const W = Number(await t.page.getAttribute('#sw-spec', 'data-w'));
  const fMax = 3.3 * 1000;
  const x = box.x + ((44 + (1000 / fMax) * (W - 44 - 12)) / W) * box.width;
  await t.page.mouse.move(x, box.y + box.height * 0.5);
  const text = await t.page.textContent('.sw-spec .hp-tip');
  assert.match(text, /^1000 Hz: the switching frequency/);
  assert.match(text, /removed/);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('the charts are drawn at their real width, so their text keeps its size, on a phone too', async () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const t = await open({ viewport });
    const sizes = await t.page.$$eval('#sw-time, #sw-spec', (svgs) =>
      svgs.map((s) => [Number(s.getAttribute('viewBox').split(' ')[2]), s.getBoundingClientRect().width]),
    );
    for (const [vb, w] of sizes) assert.ok(Math.abs(vb - w) <= 2, `viewBox ${vb} vs ${w} px at ${viewport.width}`);
    const over = await t.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `${over} px too wide`);
    await t.close();
  }
});

test('the first tour step links to the figure without ending the tour', async () => {
  const t = await open();
  await t.page.click('.cta');
  await t.page.click('#tour-text a[href="#switching"]');
  await t.page.waitForFunction(() => {
    const r = document.querySelector('#switching').getBoundingClientRect();
    return r.top >= -2 && r.top < innerHeight;
  });
  assert.equal(await t.active(), true);
  await t.close();
});
