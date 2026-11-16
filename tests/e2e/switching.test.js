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

// The shaded runs where the switch is on, and the edges of the switched
// voltage, both in chart pixels.
const runs = (page) =>
  page.$$eval('#sw-pwm .sw-run', (rs) => rs.map((r) => [Number(r.getAttribute('x')), Number(r.getAttribute('x')) + Number(r.getAttribute('width'))]));
const edges = (page) =>
  page.$eval('#sw-time path.sw-switched', (p) => [...p.getAttribute('d').matchAll(/H([\d.]+)V/g)].map((m) => Number(m[1])));
const plotWidth = async (page) => Number(await page.getAttribute('#sw-pwm', 'data-w')) - 44 - 12;

test('behind the pulses: the switch is on while the counter is below the compare value, edge for edge', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  const check = async (D) => {
    const r = await runs(t.page);
    assert.equal(r.length, 8, 'one pulse per counter period');
    const pw = await plotWidth(t.page);
    const period = pw / 8;
    for (const [a, b] of r) assert.ok(Math.abs((b - a) / period - D) < 0.01, `on for ${((b - a) / period).toFixed(3)} of a period`);
    // Every start and end of a shaded run is an edge of the pulses above.
    const e = await edges(t.page);
    for (const x of r.flat().filter((x) => x > 45 && x < 44 + pw - 1)) {
      assert.ok(e.some((y) => Math.abs(x - y) < 0.2), `no pulse edge at ${x}`);
    }
  };
  await check(0.4);
  assert.match(await t.page.textContent('#sw-pwm-text'), /below the compare value, here 400.*duty cycle of 40 %/);
  await slide(t.page, '#sw-d', 75);
  await check(0.75);
  assert.match(await t.page.textContent('#sw-pwm-text'), /here 750/);
  assert.ok((await t.page.locator('#sw-pwm-text .term[data-term="gate-driver"]').count()) === 1, 'the gate driver is explained');
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('behind the pulses: hovering either chart shows the same moment in both', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  await t.page.$eval('#sw-pwm', (el) => el.scrollIntoView({ block: 'center' }));
  const crosses = () =>
    t.page.$$eval('#sw-time .wv-cross, #sw-pwm .wv-cross', (cs) => cs.map((c) => [c.getAttribute('visibility'), Number(c.getAttribute('x1'))]));
  const box = await t.page.locator('#sw-pwm').boundingBox();
  // A quarter into the third period: counter at 250, below 400, so on.
  const W = Number(await t.page.getAttribute('#sw-pwm', 'data-w'));
  const x = 44 + (2.25 / 8) * (W - 56);
  await t.page.mouse.move(box.x + (x / W) * box.width, box.y + box.height * 0.5);
  const [a, b] = await crosses();
  assert.equal(a[0], 'visible');
  assert.equal(b[0], 'visible');
  assert.ok(Math.abs(a[1] - b[1]) < 0.2, `${a[1]} vs ${b[1]}`);
  assert.match(await t.page.textContent('.sw-pwm .hp-tip'), /counter: 2[4-6]\d.*compare value: 400.*switch on: the count is below/s);
  assert.equal(await t.page.isVisible('.sw-time .hp-tip'), false);
  // And from the pulse chart, the counter chart's crosshair follows.
  const top = await t.page.locator('#sw-time').boundingBox();
  await t.page.mouse.move(top.x + (x / W) * top.width + 30, top.y + top.height * 0.5);
  const [c, d] = await crosses();
  assert.ok(c[0] === 'visible' && d[0] === 'visible' && Math.abs(c[1] - d[1]) < 0.2);
  assert.equal(await t.page.isVisible('.sw-pwm .hp-tip'), false);
  assert.equal(await t.page.isVisible('.sw-time .hp-tip'), true);
  await t.page.mouse.move(5, 5);
  assert.deepEqual((await crosses()).map((q) => q[0]), ['hidden', 'hidden']);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('behind the pulses, DC to AC: a triangle counter and a compare value that follows the sine', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  await t.page.click('[data-sw-mode="ac"]');
  assert.match(await t.page.textContent('#sw-pwm'), /upper switch on/);
  assert.match(await t.page.textContent('#sw-pwm-text'), /counts up to 1000 and back down.*along a 50 Hz sine/);
  // The counter peaks in the middle of each of the 20 periods, so the upper
  // switch's on-time is centered on the ends of the periods: 21 runs, the
  // first and last cut in half by the window.
  const r = await runs(t.page);
  assert.equal(r.length, 21);
  // Longest near the sine's peak (5 ms), shortest near its trough (15 ms).
  const W = await plotWidth(t.page);
  const at = (ms) => r.find(([a, b]) => a <= 44 + (ms / 20) * W && b >= 44 + (ms / 20) * W);
  const width = ([a, b]) => b - a;
  assert.ok(width(at(5)) > 4 * width(at(15)), `${width(at(5))} vs ${width(at(15))}`);
  await slide(t.page, '#sw-f', 0);
  assert.equal((await runs(t.page)).length, 101, '100 periods at 10 Hz');
  assert.match(await t.page.textContent('#sw-pwm-text'), /along a 10 Hz sine/);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('the charts are drawn at their real width, so their text keeps its size, on a phone too', async () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const t = await open({ viewport });
    await t.page.click('[data-sw-mode="rect"]');
    const sizes = await t.page.$$eval('#sw-time, #sw-pwm, #sw-cur, #sw-spec', (svgs) =>
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

test('AC to DC: an active rectifier draws a sine current in step with the grid voltage', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  await t.page.click('[data-sw-mode="rect"]');
  assert.equal(await t.page.isVisible('#sw-cur'), true);
  assert.equal(await t.page.isHidden('#sw-fc'), true, 'no filter corner: the inductor is the filter');
  assert.equal(await t.page.isVisible('#sw-l'), true);
  const text = await readouts(t.page);
  assert.match(text, /22\.6 A peak \(16\.0 A rms\) at 50 Hz, in step with the grid voltage/);
  assert.match(text, /3\.7 kW from this phase: 4\.6 A at 800 V, on average/);
  assert.match(await t.page.textContent('#sw-time'), /grid voltage/);
  assert.match(await t.page.textContent('#sw-spec'), /inductor current/);
  assert.match(await t.page.textContent('#sw-pwm-text'), /just behind the grid voltage/);
  // Half the power, half the current; a smaller inductor, more ripple.
  const ripple = async () => Number((await readouts(t.page)).match(/±([\d.]+) A/)[1]);
  const before = await ripple();
  await slide(t.page, '#sw-p', 44); // 10 % + 0.44 × 90 % ≈ half of full power
  const peak = Number((await readouts(t.page)).match(/([\d.]+) A peak/)[1]);
  assert.ok(Math.abs(peak - 22.6 / 2) < 0.3, `${peak} A at half power`);
  await slide(t.page, '#sw-l', 30);
  assert.ok((await ripple()) > 3 * before, 'a small inductor lets the switching into the current');
  // Hover the current chart: its own tooltip, and the same moment in the charts above.
  await t.page.$eval('#sw-cur', (el) => el.scrollIntoView({ block: 'center' }));
  const box = await t.page.locator('#sw-cur').boundingBox();
  await t.page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  assert.match(await t.page.textContent('.sw-cur .hp-tip'), /current: -?[\d.]+ A.*aim: -?[\d.]+ A/s);
  const xs = await t.page.$$eval('#sw-time .wv-cross, #sw-pwm .wv-cross, #sw-cur .wv-cross', (cs) =>
    cs.map((c) => [c.getAttribute('visibility'), Number(c.getAttribute('x1'))]),
  );
  assert.ok(xs.every(([v, x]) => v === 'visible' && Math.abs(x - xs[0][1]) < 0.2), JSON.stringify(xs));
  // Back to DC to lower DC: the current chart goes away again.
  await t.page.click('[data-sw-mode="dc"]');
  assert.equal(await t.page.isHidden('#sw-cur'), true);
  assert.equal(await t.page.isVisible('#sw-fc'), true);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('units keep their case: kHz and mH, not KHZ and MH', async () => {
  const t = await open();
  await t.page.click('[data-sw-mode="rect"]');
  for (const sel of ['#sw-l-out', '#sw-p-out']) {
    assert.equal(await t.page.$eval(sel, (el) => getComputedStyle(el).textTransform), 'none', sel);
  }
  await t.page.click('[data-sw-mode="dc"]');
  assert.equal(await t.page.$eval('#sw-fc-out', (el) => getComputedStyle(el).textTransform), 'none');
  await t.close();
});

test('each mode describes its own spectrum, and a mode change clears a tooltip left by the pointer', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  assert.match(await t.page.getAttribute('#sw-spec', 'aria-label'), /switched voltage/);
  await t.page.click('[data-sw-mode="rect"]');
  assert.match(await t.page.getAttribute('#sw-spec', 'aria-label'), /current/);
  assert.doesNotMatch(await t.page.getAttribute('#sw-spec', 'aria-label'), /switched voltage/);
  // Hover the pulses, then change the mode from the keyboard.
  await t.page.$eval('#sw-time', (el) => el.scrollIntoView({ block: 'center' }));
  const box = await t.page.locator('#sw-time').boundingBox();
  await t.page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  assert.match(await t.page.textContent('.sw-time .hp-tip'), /grid voltage/);
  await t.page.focus('[data-sw-mode="dc"]');
  await t.page.keyboard.press('Enter');
  await t.page.waitForFunction(() => document.querySelector('[data-sw-mode="dc"]').getAttribute('aria-pressed') === 'true');
  assert.equal(await t.page.isVisible('.sw-time .hp-tip'), false, 'the old tooltip is gone');
  const crosses = await t.page.$$eval('.sw-plots .wv-cross', (cs) => cs.map((c) => c.getAttribute('visibility')));
  assert.ok(crosses.every((v) => v === 'hidden'), JSON.stringify(crosses));
  await t.close();
});

test('the extremes read sensibly: no sine asked for, or a switch that never turns on', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  await t.page.click('[data-sw-mode="ac"]');
  await slide(t.page, '#sw-m', 0);
  assert.doesNotMatch(await readouts(t.page), /Infinity|NaN/);
  await t.page.click('[data-sw-mode="dc"]');
  await slide(t.page, '#sw-d', 0);
  assert.equal(await t.page.locator('#sw-spec .sw-line').count(), 0, 'nothing to show at duty 0 %');
  await t.page.$eval('#sw-spec', (el) => el.scrollIntoView({ block: 'center' }));
  const box = await t.page.locator('#sw-spec').boundingBox();
  await t.page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  assert.equal(await t.page.isVisible('.sw-spec .hp-tip'), false);
  assert.doesNotMatch(await t.page.textContent('#sw-spec'), /Infinity|NaN/);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('the filter-corner label sits on top of the grid and the lines, with a halo', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  for (const mode of ['dc', 'ac']) {
    await t.page.click(`[data-sw-mode="${mode}"]`);
    const order = await t.page.$eval('#sw-spec', (svg) => {
      const els = [...svg.children];
      const label = els.findIndex((e) => e.classList.contains('sw-corner-label'));
      const last = Math.max(...els.map((e, i) => (e.matches('.fp-grid, .fp-axis, .sw-line, .sw-cut, .sw-corner') ? i : -1)));
      return { label, last, paint: getComputedStyle(els[label]).paintOrder };
    });
    assert.ok(order.label > order.last, `${mode}: label at ${order.label}, a line drawn after it at ${order.last}`);
    assert.match(order.paint, /^stroke/, `${mode}: no halo (${order.paint})`);
  }
  await t.close();
});
