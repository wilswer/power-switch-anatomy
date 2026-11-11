import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOUR, CHAPTERS } from '../exploded-views/js/tour.js';
import { DEVICES } from '../exploded-views/js/devices/index.js';
import { PACKAGES } from '../exploded-views/js/packages/index.js';
import { APPS } from '../exploded-views/js/apps/index.js';
import { FLYBACK } from '../exploded-views/js/apps/charger.js';
import { DRIVE } from '../exploded-views/js/apps/drive.js';
import { blockingResult } from '../exploded-views/js/physics.js';
import { thermalStack } from '../exploded-views/js/thermal.js';

const MODES = { cell: ['explore', 'on', 'block'], package: ['explore', 'current', 'heat'], app: ['explore', 'action'] };
const MODELS = { cell: DEVICES, package: PACKAGES, app: APPS };
const heatAt = (id, P) => {
  const h = PACKAGES[id].heat;
  return thermalStack({ source: h.source, layers: h.layers, P, Tref: h.Tref });
};

test('every tour step describes a complete, valid scene', () => {
  TOUR.forEach((st, i) => {
    const where = `step ${i + 1} (${st.title})`;
    assert.ok(MODELS[st.scale], `${where}: unknown scale ${st.scale}`);
    const model = MODELS[st.scale][st.device];
    const device = DEVICES[st.device];
    assert.ok(model, `${where}: nothing to show for ${st.device} at ${st.scale} scale`);
    assert.ok(MODES[st.scale].includes(st.mode), `${where}: unknown mode ${st.mode} at ${st.scale} scale`);
    assert.ok(CHAPTERS[st.chapter], `${where}: unknown chapter ${st.chapter}`);
    assert.ok(st.explode >= 0 && st.explode <= 1, `${where}: explode out of range`);
    assert.ok(st.title && st.body, `${where}: missing text`);
    assert.ok(st.body.replace(/<[^>]+>/g, '').length <= 360, `${where}: card text too long`);
    assert.equal(st.view.length, 3, `${where}: view must be a 3D direction`);
    assert.ok(Math.hypot(...st.view) > 0, `${where}: zero view direction`);
    assert.ok(st.zoom > 0.3 && st.zoom < 3, `${where}: zoom out of range`);

    if (st.focus) {
      const part = model.parts.find((p) => p.id === st.focus);
      assert.ok(part && !part.pickAs, `${where}: no part ${st.focus} on ${st.device}`);
      assert.ok(!part.onlyIn || part.onlyIn.includes(st.mode), `${where}: ${st.focus} is hidden in ${st.mode} mode`);
    }
    if (st.block) {
      assert.ok(st.block.V >= 0 && st.block.V <= device.blocking.Vmax, `${where}: voltage out of slider range`);
    }
    if (st.heat) {
      assert.ok(st.heat.P >= 0 && st.heat.P <= model.heat.Pmax, `${where}: power out of slider range`);
    }
    if (st.phase) {
      assert.ok(model.current.phases?.some((ph) => ph.id === st.phase), `${where}: unknown phase ${st.phase}`);
    }
    if (st.sweep?.what === 'V') {
      assert.equal(st.mode, 'block', `${where}: voltage sweeps only make sense in Blocking mode`);
      for (const v of [st.sweep.from, st.sweep.to]) {
        assert.ok(v >= 0 && v <= device.blocking.Vmax, `${where}: sweep out of slider range`);
      }
    } else if (st.sweep) {
      assert.equal(st.sweep.what, 'P', `${where}: unknown sweep ${st.sweep.what}`);
      assert.equal(st.mode, 'heat', `${where}: power sweeps only make sense in Heat mode`);
      for (const v of [st.sweep.from, st.sweep.to]) {
        assert.ok(v >= 0 && v <= model.heat.Pmax, `${where}: sweep out of slider range`);
      }
    }
  });
});

test('the tour visits every device and every mode, at both scales', () => {
  for (const [scale, models] of Object.entries(MODELS)) {
    for (const id of Object.keys(models)) {
      assert.ok(TOUR.some((s) => s.device === id && s.scale === scale), `never visits ${id} at ${scale} scale`);
    }
    for (const m of MODES[scale]) {
      assert.ok(TOUR.some((s) => s.scale === scale && s.mode === m), `never uses ${m} mode at ${scale} scale`);
    }
  }
});

test('the tour text agrees with the physics it describes', () => {
  // "Without help, that single spike reaches the critical field just below the 650 V rating."
  const gan = DEVICES.gan.blocking;
  const bare = blockingResult(gan, { V: 650, fieldPlate: false });
  assert.ok(bare.Vbr < 650 && bare.Vbr > 550);
  // "At 650 V the peak field drops by more than half, and the device blocks with room to spare."
  const plated = blockingResult(gan, { V: 650, fieldPlate: true });
  assert.ok(plated.Epk < bare.Epk / 2 && plated.Epk < 0.6 * plated.Ec);
  // SiC and IGBT sweeps end at 1200 V without breaking down.
  for (const id of ['sic', 'igbt']) {
    const r = blockingResult(DEVICES[id].blocking, { V: 1200 });
    assert.ok(r.Epk < r.Ec, `${id} should block 1200 V`);
  }
});

test('the package steps agree with the heat model', () => {
  // "Hundreds of thousands of copies of it fill the striped active area of this 3.6 × 4 mm die"
  const die = PACKAGES.sic.heat.layers.find((l) => l.id === 'die');
  assert.deepEqual(die.size, [3.6, 4.0]);
  const cells = (PACKAGES.sic.heat.source[0] * PACKAGES.sic.heat.source[1]) / (5e-3) ** 2; // 5 µm cells
  assert.ok(cells > 1e5 && cells < 1e6, `${cells} cells`);
  // "The thin insulating pad under the tab ... costs more temperature than the whole package."
  const sweep = TOUR.find((s) => s.sweep?.what === 'P');
  const sic = heatAt('sic', sweep.sweep.to);
  assert.ok(sic.layers.find((l) => l.id === 'pad').dT > sic.Tj - sic.Tref - sic.layers.find((l) => l.id === 'pad').dT);
  assert.ok(sic.Tj < PACKAGES.sic.heat.Tmax, 'the 80 W sweep should stay below the limit');
  // "the board and the gap pad under it cost nearly all the temperature rise"
  const ganStep = TOUR.find((s) => s.device === 'gan' && s.scale === 'package');
  const gan = heatAt('gan', ganStep.heat.P);
  const share = gan.layers.filter((l) => ['board', 'gap'].includes(l.id)).reduce((a, l) => a + l.dT, 0) / (gan.Tj - gan.Tref);
  assert.ok(share > 0.8, `board + gap pad: ${(share * 100).toFixed(0)} %`);
  // "That tile is the biggest temperature step in the module."
  const igbt = heatAt('igbt', PACKAGES.igbt.heat.Pdefault);
  assert.equal(igbt.layers.reduce((m, l) => (l.dT > m.dT ? l : m)).id, 'ceramic');
});

test('the product steps agree with the product models', () => {
  // "Each module only ever connects its wire to 0 or 560 V"
  assert.equal(DRIVE.VDC, 560);
  assert.equal(APPS.igbt.parts.find((p) => p.id === 'modules').solids.length, 3);
  // "eight TO-247-4 SiC MOSFETs"
  assert.equal(APPS.sic.parts.find((p) => p.id === 'sicBodies').solids.length, 8);
  // "The switch chops about 325 V at 150 kHz"
  assert.equal(FLYBACK.VIN, 325);
  assert.ok(Math.abs(1000 / FLYBACK.PERIOD - 150) < 1);
});

test('the converter steps agree with the product chains', () => {
  // "this motor drive is a rectifier and then an inverter"
  const convs = APPS.igbt.chain.filter((c) => c.conv).map((c) => c.conv);
  assert.deepEqual(convs, ['Rectifier', 'Inverter']);
  const step = TOUR.find((s) => s.chapter === 'conv' && s.device === 'igbt');
  assert.match(step.body, /rectifier and then an inverter/);
  // The step links to a section that exists on the page.
  const html = readFileSync(new URL('../exploded-views/index.html', import.meta.url), 'utf8');
  for (const [, id] of TOUR.flatMap((s) => [...s.body.matchAll(/href="#([\w-]+)"/g)])) {
    assert.match(html, new RegExp(`id="${id}"`), `the tour links to #${id}, which is missing`);
  }
});
