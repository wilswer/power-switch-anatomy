// Browser tests for the Application (product) views (setup in harness.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open, wait } from './harness.js';

const visibleModes = (page) =>
  page.$$eval('[data-mode]', (bs) => bs.filter((b) => !b.hidden).map((b) => b.textContent.trim()));

test('the Application view shows the product with its own two modes', async () => {
  const t = await open({ hash: 'igbt/package' });
  await t.page.click('[data-scale="app"]');
  const s = await t.state();
  assert.equal(s.scale, 'app');
  assert.equal(await t.page.evaluate(() => window.__pageDebug.viewer.device.id), 'igbt-app');
  assert.deepEqual(await visibleModes(t.page), ['Explore', 'In action']);
  assert.equal(await t.page.evaluate(() => location.hash), '#igbt/app');
  assert.match(await t.page.textContent('[data-scale="app"] .scale-meta'), /Motor drive/);
  await t.page.click('[data-scale="cell"]');
  assert.deepEqual(await visibleModes(t.page), ['Explore', 'Gate ON', 'Blocking']);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('In action makes power flow, the switches flash and the motor turn, and Explore stops it', async () => {
  const t = await open({ hash: 'igbt/app' });
  await t.page.click('[data-mode="action"]');
  await wait(1500); // the stack closes, then the dots fade in
  const look = () =>
    t.page.evaluate(() => {
      const d = window.__pageDebug;
      return {
        dots: d.pkgEffects.flows.some((f) => f.mesh.visible),
        angle: d.viewer.parts.get('shaft').spin.angle,
        glow: d.viewer.parts.get('modules').material.emissiveIntensity,
      };
    });
  const seen = new Set();
  const a = await look();
  for (let i = 0; i < 8; i++) {
    seen.add((await look()).glow > 0);
    await wait(110);
  }
  const b = await look();
  assert.equal(a.dots, true, 'power-flow dots are visible');
  assert.notEqual(a.angle, b.angle, 'the shaft turns');
  assert.deepEqual([...seen].sort(), [false, true], 'the modules flash on and off');

  await t.page.click('[data-mode="explore"]');
  await wait(300);
  const c = await look();
  await wait(300);
  const d = await look();
  assert.equal(d.angle, c.angle, 'the shaft stops');
  assert.equal(d.glow, 0, 'the modules stop flashing');
  await t.close();
});

test('package and product link to each other, and a conducting view stays conducting', async () => {
  const t = await open({ hash: 'sic/package' });
  await t.page.click('[data-scale-jump]');
  assert.equal((await t.state()).scale, 'app');
  await t.page.click('[data-part="sicBodies"]');
  await t.page.click('[data-jump]');
  assert.equal((await t.state()).scale, 'package');

  await t.page.click('[data-mode="current"]');
  await t.page.click('[data-scale="app"]');
  assert.equal((await t.state()).mode, 'action');
  await t.close();
});

test('waveform charts keep their labels apart and explain themselves on hover', async () => {
  for (const id of ['sic', 'gan', 'igbt']) {
    const t = await open({ hash: `${id}/app` });
    await t.page.click('[data-mode="action"]');
    const boxes = await t.page.$$eval('#waves-plot text', (ts) => {
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
    const box = await t.page.locator('#waves-plot').boundingBox();
    await t.page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    assert.equal(await t.page.isVisible('.waves-plot .hp-tip'), true);
    assert.match(await t.page.textContent('.waves-plot .hp-tip'), /t = /);
    await t.close();
  }
});

test('product panels fit without sideways scrolling, on a desktop and a phone', async () => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    for (const id of ['sic', 'gan', 'igbt']) {
      const t = await open({ viewport, hash: `${id}/app` });
      for (const mode of ['explore', 'action']) {
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

test('the tour explains converters, then visits each product at work', async () => {
  const t = await open();
  await t.page.click('.cta');
  const steps = await t.page.evaluate(() => [...document.querySelectorAll('#tour-progress [data-step]')].length);
  const seen = [];
  for (let n = 1; n <= steps; n++) {
    await t.goTo(n);
    const s = await t.state();
    const chapter = (await t.page.textContent('#tour-kicker')).split(' · ')[1];
    if (s.scale === 'app' && ['Converters', 'At work'].includes(chapter)) seen.push(`${chapter}: ${s.device}/${s.mode}`);
  }
  assert.deepEqual(seen, [
    'Converters: gan/explore',
    'Converters: igbt/explore',
    'At work: igbt/explore',
    'At work: igbt/action',
    'At work: sic/action',
    'At work: gan/action',
  ]);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('a product panel shows its conversion chain, with the stage that uses the switch marked', async () => {
  const t = await open({ hash: 'igbt/app' });
  const chain = await t.page.$$eval('.chain li', (ls) => ls.map((l) => [l.className, l.querySelector('b').textContent]));
  assert.deepEqual(chain, [
    ['chain-node', 'Grid'],
    ['chain-conv', 'Rectifier'],
    ['chain-node', 'DC link'],
    ['chain-conv is-ours', 'Inverter'],
    ['chain-node', 'Motor'],
  ]);
  assert.match(await t.page.textContent('.chain .is-ours em'), /uses the power module from the package view/);
  await t.close();
});
