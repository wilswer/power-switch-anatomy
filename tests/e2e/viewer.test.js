// Browser tests for the 3D viewer and the page around it, one per bug found
// in review (setup in harness.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open, wait } from './harness.js';
import { DEVICES } from '../../exploded-views/js/devices/index.js';
import { FAILURES } from '../../exploded-views/js/failures.js';
import { TOUR } from '../../exploded-views/js/tour.js';

// Labels that are shown but stick out of the 3D viewport.
const labelsOutside = (page) =>
  page.evaluate(() => {
    const vp = document.querySelector('#viewport').getBoundingClientRect();
    return [...document.querySelectorAll('#labels .callout')]
      .filter((el) => !el.hidden && getComputedStyle(el).visibility === 'visible')
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top < vp.top - 1 || r.bottom > vp.bottom + 1 || r.left < vp.left - 1 || r.right > vp.right + 1;
      })
      .map((el) => el.textContent);
  });
const labelShown = (page, id) =>
  page.evaluate((id) => {
    const el = window.__pageDebug.viewer.parts.get(id)?.labelEl;
    return Boolean(el && !el.hidden && getComputedStyle(el).visibility === 'visible');
  }, id);
const shownLabels = (page) =>
  page.$$eval('#labels .callout', (els) => els.filter((el) => !el.hidden && getComputedStyle(el).visibility === 'visible').length);

test('on a 720p laptop the tour never pushes labels out of the view, and keeps the focus label', async () => {
  const t = await open({ viewport: { width: 1280, height: 720 } });
  await t.page.click('.cta');
  await wait(1000); // the page scrolls to show the card
  for (const n of [1, 19, 21, 24, 25, 28, 34]) {
    await t.goTo(n);
    await wait(1800); // let the camera arrive
    const vp = await t.page.$eval('#viewport', (el) => el.getBoundingClientRect().toJSON());
    assert.ok(vp.bottom > 100 && vp.top < 720, `step ${n}: the 3D view is on screen`);
    assert.deepEqual(await labelsOutside(t.page), [], `step ${n}`);
    const { focus } = TOUR[n - 1];
    if (focus) assert.ok(await labelShown(t.page, focus), `step ${n}: the label of ${focus} is hidden`);
  }
  await t.close();
  const u = await open({ viewport: { width: 1280, height: 720 }, hash: 'igbt/package' });
  await wait(500);
  assert.deepEqual(await labelsOutside(u.page), []);
  await u.close();
});

test('on a phone, a tapped part shows its name in the view, and Labels shows labels', async () => {
  const t = await open({ viewport: { width: 390, height: 844 } });
  await t.page.click('[data-part="drift"]');
  const chip = t.page.locator('#sel-chip');
  assert.ok(await chip.isVisible(), 'the selected part is named in the view');
  assert.match(await chip.textContent(), /drift/i);
  const inView = await t.page.evaluate(() => {
    const vp = document.querySelector('#viewport').getBoundingClientRect();
    const r = document.querySelector('#sel-chip').getBoundingClientRect();
    return r.top >= vp.top && r.bottom <= vp.bottom;
  });
  assert.ok(inView, 'the name sits inside the 3D view');
  await t.page.click('#sel-chip button');
  await t.page.waitForFunction(() => {
    const r = document.querySelector('#part-card').getBoundingClientRect();
    return r.top >= -2 && r.top < innerHeight;
  });
  await t.page.evaluate(() => scrollTo(0, 0));
  await t.page.check('#labels-toggle');
  await wait(300);
  assert.ok((await shownLabels(t.page)) > 0, 'ticking Labels shows some');
  assert.deepEqual(await labelsOutside(t.page), []);
  await t.close();
});

test('on a phone, one finger scrolls the page and two fingers turn and tilt the model', async () => {
  const t = await open({ viewport: { width: 390, height: 844 }, touch: true });
  const cdp = await t.page.context().newCDPSession(t.page);
  const touch = (type, pts) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  // Drag the given fingers 160 px up, over the middle of the model.
  const dragUp = async (dxs) => {
    const r = await t.page.$eval('#scene', (c) => c.getBoundingClientRect().toJSON());
    const x = r.left + r.width / 2;
    const y = Math.min(r.top + r.height / 2, 700);
    await touch('touchStart', dxs.map((dx) => [x + dx, y]));
    for (let i = 1; i <= 8; i++) {
      await touch('touchMove', dxs.map((dx) => [x + dx, y - 20 * i]));
      await wait(16);
    }
    await touch('touchEnd', []);
    await wait(300);
  };
  const camera = () =>
    t.page.evaluate(() => ({ polar: window.__pageDebug.viewer.controls.getPolarAngle(), y: scrollY }));

  const a = await camera();
  await dragUp([0]);
  const b = await camera();
  assert.ok(b.y > a.y + 50, `one finger scrolls the page (${a.y} → ${b.y})`);
  assert.ok(Math.abs(b.polar - a.polar) < 1e-3, 'and leaves the model alone');

  await dragUp([0]);
  assert.match(await t.page.getAttribute('#viewport', 'class'), /is-touch-hint/, 'with a reminder to use two fingers');

  await t.page.evaluate(() => scrollTo(0, 0));
  await wait(300);
  const c = await camera();
  await dragUp([-40, 40]);
  const d = await camera();
  assert.ok(Math.abs(d.polar - c.polar) > 0.05, `two fingers tilt the model (${c.polar} → ${d.polar})`);
  assert.ok(Math.abs(d.y - c.y) < 5, 'without scrolling the page');
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('the page works when the CDN is unreachable', async () => {
  const t = await open({ offline: true });
  assert.ok(await t.page.locator('#parts-list [data-part]').count() > 0);
  assert.equal(await t.page.locator('.fm-card').count(), FAILURES.length);
  assert.notEqual(await t.page.textContent('[data-tour-length]'), '');
  assert.deepEqual(t.errors, []);
  await t.close();
});

// Positions along the paths of the moving dots, and the motor's angle.
const motion = (page) =>
  page.evaluate(() => {
    const { pkgEffects, viewer } = window.__pageDebug;
    return {
      dots: pkgEffects.flows.flatMap((f) => f.ps.slice(0, 5).map((q) => q.s)),
      spin: [...viewer.parts.values()].filter((p) => p.spin).map((p) => p.spin.angle),
      glow: viewer.parts.get('modules').material.emissiveIntensity,
    };
  });

test('the 3D animation follows the reduced-motion setting, also when it changes', async () => {
  const t = await open({ hash: 'igbt/app' });
  await t.page.click('[data-mode="action"]');
  await wait(1200);
  const a = await motion(t.page);
  await wait(300);
  assert.notDeepEqual((await motion(t.page)).dots, a.dots, 'the dots move normally');
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await wait(200);
  const b = await motion(t.page);
  const glows = new Set();
  for (let i = 0; i < 6; i++) {
    await wait(70);
    glows.add((await motion(t.page)).glow);
  }
  const c = await motion(t.page);
  assert.deepEqual(c.dots, b.dots, 'the dots stand still');
  assert.deepEqual(c.spin, b.spin, 'the motor stands still');
  assert.equal(glows.size, 1, 'the switches stop flashing');
  assert.ok(c.glow > 0, 'but stay marked');
  await t.close();
});

test('the 3D view stops drawing while it is scrolled out of sight', async () => {
  const t = await open();
  await t.page.evaluate(() => {
    window.__frames = 0;
    window.__pageDebug.viewer.frameHooks.push(() => window.__frames++);
  });
  await t.page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await wait(400);
  await t.page.evaluate(() => (window.__frames = 0));
  await wait(1000);
  assert.ok((await t.page.evaluate(() => window.__frames)) <= 2, 'no frames off screen');
  await t.page.evaluate(() => scrollTo(0, 0));
  await wait(500);
  assert.ok((await t.page.evaluate(() => window.__frames)) > 5, 'drawing again when back in view');
  await t.close();
});

test('a link restores the mode, and choosing a mode updates the link', async () => {
  const t = await open({ hash: 'igbt/package/heat' });
  let s = await t.state();
  assert.deepEqual([s.device, s.scale, s.mode], ['igbt', 'package', 'heat']);
  await t.page.click('[data-mode="current"]');
  assert.equal(await t.page.evaluate(() => location.hash), '#igbt/package/current');
  await t.page.reload();
  await t.page.waitForFunction(() => window.__pageDebug?.viewer);
  s = await t.state();
  assert.equal(s.mode, 'current');
  await t.page.click('[data-mode="explore"]');
  assert.equal(await t.page.evaluate(() => location.hash), '#igbt/package', 'Explore is the default');
  await t.page.evaluate(() => (location.hash = '#gan/block'));
  await t.page.waitForFunction(() => window.__pageDebug.state.mode === 'block');
  s = await t.state();
  assert.deepEqual([s.device, s.scale], ['gan', 'cell']);
  await t.close();
});

test('switching models frees the moving dots', async () => {
  const t = await open({ hash: 'igbt/package' });
  await t.page.click('[data-mode="current"]');
  await t.page.evaluate(() => {
    window.__disposed = 0;
    window.__meshes = 0;
    for (const fx of [window.__pageDebug.pkgEffects, window.__pageDebug.effects]) {
      fx.root.traverse((o) => {
        if (!o.isInstancedMesh) return;
        window.__meshes++;
        o.addEventListener('dispose', () => window.__disposed++);
      });
    }
  });
  await t.page.click('[data-phase]:not([aria-pressed="true"])');
  const { meshes, disposed } = await t.page.evaluate(() => ({ meshes: window.__meshes, disposed: window.__disposed }));
  assert.ok(meshes > 0);
  assert.equal(disposed, meshes);
  await t.close();
});

test('screen readers are not flooded, and labels tab from top to bottom', async () => {
  const t = await open();
  assert.equal(await t.page.getAttribute('#mode-card', 'aria-live'), null, 'the mode card updates on every slider step');
  assert.equal(
    await t.page.$eval('#tour-readout', (el) => Boolean(el.closest('[aria-live]'))),
    false,
    'the tour readout changes many times a second during a sweep',
  );
  const order = await t.page.$$eval('#labels .callout', (els) => els.map((el) => el.textContent));
  const expected = DEVICES.sic.parts
    .filter((p) => p.label && !p.pickAs)
    .map((p) => p.label.replace(/<[^>]+>/g, ''))
    .reverse();
  assert.deepEqual(order, expected);
  await t.close();
});
