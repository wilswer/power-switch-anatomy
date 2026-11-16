// Browser tests for "What switches the switch" and its tour steps (setup in harness.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from './harness.js';
import { TOUR, TOUR_MINUTES } from '../../exploded-views/js/tour.js';

const pressed = (page) => page.$$eval('#ctl [aria-pressed="true"]', (bs) => bs.map((b) => b.dataset.stage));
const detail = (page) => page.textContent('#ctl-detail');

test('the chain runs from the clock to the switch, and a click on a stage explains it', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  const stages = await t.page.$$eval('#ctl .ctl-stage', (bs) => bs.map((b) => b.dataset.stage));
  assert.deepEqual(stages, ['clock', 'pwm', 'driver', 'gate', 'switch', 'loop']);
  assert.deepEqual(await pressed(t.page), ['clock']);
  assert.match(await detail(t.page), /Stage 1 of 5 · Clock.*runs by itself/s);
  // The PWM unit says what PWM is, on the stage and in its details.
  assert.match(await t.page.textContent('.ctl-stage[data-stage="pwm"]'), /pulse-width modulation/i);
  await t.page.click('.ctl-stage[data-stage="pwm"]');
  assert.match(await detail(t.page), /PWM stands for pulse-width modulation.*timer inside the microcontroller/s);
  assert.ok((await t.page.$$eval('#ctl-detail .term', (ts) => ts.map((x) => x.dataset.term))).includes('pwm'));
  await t.page.click('.ctl-stage[data-stage="driver"]');
  assert.deepEqual(await pressed(t.page), ['driver']);
  assert.match(await detail(t.page), /Stage 3 of 5 · Gate driver.*5 µs.*20 ns/s);
  await t.page.click('.ctl-stage[data-stage="loop"]');
  assert.match(await detail(t.page), /Closing the loop · Control loop.*Starting up.*trickle-charges/s);
  // The details mark their terms, and the stage buttons do not.
  await t.page.click('.ctl-stage[data-stage="gate"]');
  const terms = await t.page.$$eval('#ctl-detail .term', (ts) => ts.map((x) => x.dataset.term));
  for (const id of ['threshold-voltage', 'miller-plateau']) assert.ok(terms.includes(id), `${id} in ${terms}`);
  assert.equal(await t.page.locator('#ctl .ctl-stage .term').count(), 0);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('the chain fits a phone and a wide screen, with the stages one under another on the phone', async () => {
  for (const [viewport, row] of [
    [{ width: 1440, height: 900 }, true],
    [{ width: 390, height: 844 }, false],
  ]) {
    const t = await open({ viewport });
    const over = await t.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `${over} px too wide at ${viewport.width}`);
    const tops = await t.page.$$eval('#ctl .ctl-chain .ctl-stage', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size === 1, row, `stage tops ${tops} at ${viewport.width}`);
    const loop = await t.page.$eval('#ctl .ctl-loop', (b) => b.getBoundingClientRect().right);
    const box = await t.page.$eval('#ctl', (b) => b.getBoundingClientRect().right);
    assert.ok(loop <= box, 'the control loop stays inside the figure');
    await t.close();
  }
});

test('the tour shows the chain on the motor drive, and its link opens the matching stage', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  assert.match(await t.page.textContent('.cta-meta'), new RegExp(`${TOUR.length} steps · about ${TOUR_MINUTES} minutes`));
  await t.page.click('.cta');
  await t.goTo(TOUR.findIndex((s) => s.title === 'The gate driver gives the push') + 1);
  const st = await t.state();
  assert.equal(st.device, 'igbt');
  assert.equal(st.scale, 'app');
  const here = await t.page.$$eval('#tour-text .chain-strip .is-here', (ls) => ls.map((l) => l.textContent));
  assert.deepEqual(here, ['Gate driver', 'Gate']);
  // The strip is not marked as terms; the card's own text is.
  assert.equal(await t.page.locator('#tour-text .chain-strip .term').count(), 0);
  assert.ok((await t.page.locator('#tour-text .term[data-term="gate"]').count()) === 1);
  await t.page.click('#tour-text a[data-chain="driver"]');
  await t.page.waitForFunction(() => {
    const r = document.querySelector('#switch-chain').getBoundingClientRect();
    return r.top >= -2 && r.top < innerHeight;
  });
  assert.deepEqual(await pressed(t.page), ['driver']);
  assert.equal(await t.active(), true, 'the tour keeps going');
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('Back after a link from a tour card returns to the step, and the tour keeps going', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  await t.page.click('.cta');
  // A link into the chain, from the gate-driver step.
  const n = TOUR.findIndex((s) => s.title === 'The gate driver gives the push') + 1;
  await t.goTo(n);
  await t.page.click('#tour-text a[data-chain="driver"]');
  await t.page.waitForFunction(() => location.hash === '#switch-chain');
  await t.page.goBack();
  await t.page.waitForFunction(() => location.hash !== '#switch-chain');
  assert.equal(await t.active(), true, 'Back ended the tour');
  assert.equal(await t.step(), n - 1);
  // The first step's link to the switching figure, the same way.
  await t.goTo(1);
  await t.page.click('#tour-text a[href="#switching"]');
  await t.page.waitForFunction(() => location.hash === '#switching');
  await t.page.goBack();
  await t.page.waitForFunction(() => location.hash !== '#switching');
  assert.equal(await t.active(), true);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('a tour link opens its stage even when another one is open, and the strip says where the step is', async () => {
  const t = await open({ viewport: { width: 1440, height: 900 } });
  await t.page.click('.ctl-stage[data-stage="gate"]');
  await t.page.click('.cta');
  await t.goTo(TOUR.findIndex((s) => s.title === 'What times the pulses') + 1);
  const current = await t.page.$$eval('#tour-text .chain-strip [aria-current="step"]', (ls) => ls.map((l) => l.textContent));
  assert.deepEqual(current, ['Clock', 'PWM unit']);
  await t.page.click('#tour-text a[data-chain="clock"]');
  assert.deepEqual(await pressed(t.page), ['clock']);
  assert.equal(await t.page.getAttribute('.ctl-stage[data-stage="clock"]', 'aria-controls'), 'ctl-detail');
  await t.close();
});
