// Browser tests for the package views (setup in harness.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open, wait } from './harness.js';
import { TOUR } from '../../exploded-views/js/tour.js';

const modeLabels = (page) => page.$$eval('[data-mode]', (bs) => bs.map((b) => b.textContent.trim()));
const setRange = (page, sel, value) =>
  page.$eval(
    sel,
    (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    value,
  );

test('the package view shows the package, its own modes and a shareable link', async () => {
  const t = await open({ hash: 'sic' });
  await t.page.click('[data-scale="package"]');
  const s = await t.state();
  assert.equal(s.scale, 'package');
  assert.equal(await t.page.evaluate(() => window.__pageDebug.viewer.device.id), 'sic-package');
  assert.deepEqual(await modeLabels(t.page), ['Explore', 'Current', 'Heat']);
  assert.equal(await t.page.evaluate(() => location.hash), '#sic/package');
  assert.match(await t.page.textContent('#parts-list'), /Kelvin source/);
  await t.page.click('[data-scale="cell"]');
  assert.deepEqual(await modeLabels(t.page), ['Explore', 'Gate ON', 'Blocking']);
  assert.deepEqual(t.errors, []);
  await t.close();

  const g = await open({ hash: 'gan/package' });
  assert.equal((await g.state()).device, 'gan');
  assert.equal(await g.page.evaluate(() => window.__pageDebug.viewer.parts.has('drainLand')), true);
  assert.equal(await g.page.getAttribute('[data-scale="package"]', 'aria-pressed'), 'true');
  await g.close();
});

test('switching scale keeps a conducting view and drops the others', async () => {
  const t = await open({ hash: 'igbt' });
  await t.page.click('[data-mode="on"]');
  await t.page.click('[data-scale="package"]');
  assert.equal((await t.state()).mode, 'current');
  await t.page.click('[data-mode="heat"]');
  await t.page.click('[data-scale="cell"]');
  assert.equal((await t.state()).mode, 'explore');
  await t.close();
});

test('the power slider sets the junction temperature and the colors, and leaving Heat clears them', async () => {
  const t = await open({ hash: 'sic/package' });
  await t.page.click('[data-mode="heat"]');
  const Tj = () => t.page.evaluate(() => window.__pageDebug.heat().Tj);
  const cool = await Tj();
  await setRange(t.page, '#power', 150);
  const hot = await Tj();
  assert.ok(hot > cool + 50, `${cool} → ${hot}`);
  assert.match(await t.page.getAttribute('#heat-status', 'class'), /is-danger/);
  const tinted = await t.page.evaluate(() => window.__pageDebug.viewer.tints.has('die'));
  assert.equal(tinted, true);
  await t.page.click('[data-mode="explore"]');
  assert.equal(await t.page.evaluate(() => window.__pageDebug.viewer.tints.size), 0);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('the module shows the current switching from the IGBT to the diode', async () => {
  const t = await open({ hash: 'igbt/package' });
  await t.page.click('[data-mode="current"]');
  await wait(1200); // dots fade in once the stack has closed
  const flows = () =>
    t.page.evaluate(() => {
      const e = window.__pageDebug.pkgEffects;
      return { phase: e.phase, visible: e.flows.some((f) => f.mesh.visible), n: e.flows.length };
    });
  const high = await flows();
  assert.equal(high.phase, 'high');
  assert.equal(high.visible, true);
  assert.equal(high.n, 2, 'load and gate loops');
  await t.page.click('[data-phase="free"]');
  await wait(300);
  const free = await flows();
  assert.equal(free.phase, 'free');
  assert.equal(free.n, 1, 'no gate loop while both IGBTs are off');
  assert.match(await t.page.textContent('#mode-card'), /diode D2/);
  await t.close();
});

test('part cards link the cell and the package both ways', async () => {
  const t = await open({ hash: 'sic' });
  await t.page.click('[data-part="metal"]');
  await t.page.click('[data-jump]');
  let s = await t.state();
  assert.equal(s.scale, 'package');
  assert.equal(s.selected, 'sourcePad');
  assert.match(await t.page.textContent('#part-card'), /Source pad/);
  await t.page.click('[data-jump]');
  s = await t.state();
  assert.equal(s.scale, 'cell');
  assert.equal(s.selected, 'metal');
  await t.close();
});

test('the heat chart explains each column on hover', async () => {
  const t = await open({ hash: 'igbt/package' });
  await t.page.click('[data-mode="heat"]');
  await t.page.hover('.hp-hit[data-layer="3"]');
  assert.equal(await t.page.isVisible('.hp-tip'), true);
  assert.match(await t.page.textContent('.hp-tip'), /Alumina ceramic/);
  await t.close();
});

test('a tour power sweep never drives another package', async () => {
  const t = await open();
  await t.page.click('.cta');
  await t.goTo(TOUR.findIndex((s) => s.sweep?.what === 'P' && s.device === 'sic') + 1); // TO-247 heat sweep
  await wait(800);
  await t.page.click('[data-device="gan"]');
  await wait(1500);
  const s = await t.state();
  assert.equal(s.scale, 'package');
  assert.equal(s.heat.gan.P, 4, 'GaN keeps its own power');
  assert.equal(await t.page.textContent('#power-out'), '4 W');
  await t.close();
});

test('the tour starts at its first scene even from a package view', async () => {
  const t = await open({ hash: 'igbt/package' });
  await t.page.click('.cta');
  const s = await t.state();
  assert.deepEqual([s.device, s.scale, s.mode], [TOUR[0].device, TOUR[0].scale, TOUR[0].mode]);
  await t.goTo(TOUR.findIndex((s) => s.device === 'gan' && s.scale === 'package' && s.mode === 'heat') + 1);
  const g = await t.state();
  assert.deepEqual([g.device, g.scale, g.mode], ['gan', 'package', 'heat']);
  await t.close();
});

test('package panels fit without sideways scrolling, on a desktop and a phone', async () => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    for (const id of ['sic', 'gan', 'igbt']) {
      const t = await open({ viewport, hash: `${id}/package` });
      for (const mode of ['explore', 'current', 'heat']) {
        await t.page.click(`[data-mode="${mode}"]`);
        const over = await t.page.evaluate(() => {
          const p = document.querySelector('.panel');
          return { page: document.documentElement.scrollWidth - innerWidth, panel: p.scrollWidth - p.clientWidth };
        });
        const where = `${id} ${mode} at ${viewport.width} px`;
        assert.ok(over.page <= 0, `${where}: the page is ${over.page} px too wide`);
        assert.ok(over.panel <= 0, `${where}: the panel content is ${over.panel} px too wide`);
      }
      await t.close();
    }
  }
});

test('heat chart labels stay inside the chart and never collide', async () => {
  for (const id of ['sic', 'gan', 'igbt']) {
    const t = await open({ hash: `${id}/package` });
    await t.page.click('[data-mode="heat"]');
    // On-screen boxes in chart units (the y-axis label is rotated).
    const boxes = await t.page.$$eval('#heat-plot text', (ts) => {
      const svg = ts[0].ownerSVGElement.getBoundingClientRect();
      const k = 340 / svg.width;
      return ts.map((el) => {
        const b = el.getBoundingClientRect();
        const x0 = (b.left - svg.left) * k;
        const y0 = (b.top - svg.top) * k;
        return { text: el.textContent, x0, x1: x0 + b.width * k, y0, y1: y0 + b.height * k };
      });
    });
    for (const b of boxes) assert.ok(b.x0 >= 0 && b.x1 <= 340, `${id}: "${b.text}" sticks out of the chart`);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const c = boxes[j];
        const hit = a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1;
        assert.ok(!hit, `${id}: "${a.text}" overlaps "${c.text}"`);
      }
    }
    await t.close();
  }
});
