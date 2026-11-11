// Browser tests for "Age it" in the package Heat view (setup in harness.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open, wait } from './harness.js';
import { PACKAGES } from '../../exploded-views/js/packages/index.js';
import { TOUR } from '../../exploded-views/js/tour.js';

const slide = (page, sel, value) =>
  page.$eval(
    sel,
    (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    value,
  );

// What the 3D model shows of the wear: the joint's scale and the hidden wires.
const wear3d = (page) =>
  page.evaluate(() => {
    const { viewer } = window.__pageDebug;
    return {
      jointScale: viewer.parts.get('chipSolder').meshes[0].scale.x,
      hiddenWires: viewer.parts.get('powerWires').meshes.filter((m) => !m.visible).length,
    };
  });

test('aging the module moves the readouts and shows in the 3D model, in Heat mode only', async () => {
  const t = await open({ hash: 'igbt/package/heat' });
  assert.match(await t.page.textContent('#age-status'), /New/);
  await slide(t.page, '#age-crack', 30);
  assert.match(await t.page.textContent('#age-status'), /Past end of life/);
  assert.match(await t.page.textContent('#age-readouts'), /\+27\.\d %/);
  await slide(t.page, '#age-wires', 2);
  let w = await wear3d(t.page);
  assert.ok(Math.abs(w.jointScale - Math.sqrt(0.7)) < 1e-6, `joint scale ${w.jointScale}`);
  assert.equal(w.hiddenWires, 2);
  assert.match(await t.page.textContent('#age-wires-out'), /2 of 5/);

  await t.page.click('[data-mode="explore"]');
  w = await wear3d(t.page);
  assert.deepEqual(w, { jointScale: 1, hiddenWires: 0 }, 'Explore shows the package new');
  await t.page.click('[data-mode="heat"]');
  w = await wear3d(t.page);
  assert.equal(w.hiddenWires, 2, 'and Heat keeps the wear');

  await t.page.click('#age-reset');
  assert.deepEqual(await wear3d(t.page), { jointScale: 1, hiddenWires: 0 });
  assert.match(await t.page.textContent('#age-status'), /New/);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('the power-cycling test draws a device to end of life, and more devices show the scatter', async () => {
  const t = await open({ hash: 'igbt/package/heat' });
  const latest = () => t.page.$$eval('#cycle-plot path.cy-rth:not(.is-past)', (ps) => ps.length);
  const past = () => t.page.$$eval('#cycle-plot path.cy-rth.is-past', (ps) => ps.length);
  assert.equal(await latest(), 1);
  assert.equal(await past(), 0);
  assert.match(await t.page.textContent('#cycle-plot'), /fails at \d+k/);
  assert.match(await t.page.textContent('#cy-summary'), /lasted/);
  await t.page.click('#cy-another');
  await t.page.click('#cy-another');
  assert.equal(await past(), 2);
  assert.match(await t.page.textContent('#cy-summary'), /3 devices: .* median/);
  // A harder load wears them out sooner; the test reruns once the slider rests.
  const before = await t.page.textContent('#cy-swing');
  await slide(t.page, '#power', PACKAGES.igbt.heat.Pmax * 0.8);
  await wait(600);
  assert.notEqual(await t.page.textContent('#cy-swing'), before);
  assert.equal(await past(), 2, 'the same devices, retested');
  // Hovering shows the values for the latest device.
  const box = await t.page.locator('#cycle-plot').boundingBox();
  await t.page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  assert.match(await t.page.textContent('.cycle-plot .hp-tip'), /cycles.*R.*wire/s);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('the aging tour step wears the module, and ending the tour makes it new again', async () => {
  const t = await open();
  await t.page.click('.cta');
  await wait(800);
  await t.goTo(TOUR.findIndex((s) => s.age) + 1);
  const s = await t.state();
  assert.deepEqual(s.age.igbt, { crack: 0.3, lifted: 2 });
  assert.equal(await t.page.inputValue('#age-crack'), '30');
  assert.equal((await wear3d(t.page)).hiddenWires, 2);
  await t.page.click('#tour-back');
  assert.deepEqual((await t.state()).age.igbt, { crack: 0, lifted: 0 }, 'the step before shows it new');
  await t.page.click('#tour-exit');
  assert.deepEqual((await t.state()).age.igbt, { crack: 0, lifted: 0 });
  await t.close();
});

test('at zero load the test reports that nothing wears out', async () => {
  const t = await open({ hash: 'igbt/package/heat' });
  await slide(t.page, '#power', 0);
  await wait(600);
  assert.match(await t.page.textContent('#cy-summary'), /nothing wears out/);
  assert.deepEqual(t.errors, []);
  await t.close();
});
