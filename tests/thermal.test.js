import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thermalStack, frustumR } from '../exploded-views/js/thermal.js';

const close = (a, b, rel = 1e-3) => Math.abs(a - b) <= rel * Math.abs(b);

test('a slab as wide as the heat source is plain t / (k·A)', () => {
  const r = thermalStack({
    source: [10, 10],
    layers: [{ id: 'cu', t: 1, k: 400, size: [10, 10] }],
    P: 100,
    Tref: 25,
  });
  // 1 mm of copper over 1 cm²: 0.001 / (400 · 1e-4) = 0.025 K/W.
  assert.ok(close(r.Rtotal, 0.025));
  assert.ok(close(r.Tj, 25 + 100 * 0.025));
});

test('heat fanning out at 45° matches the closed-form frustum resistance', () => {
  // ∫ dz / (k (a + 2z)(b + 2z)) from 0 to t, in SI units.
  const exact = (a, b, t, k) =>
    a === b ? t / (k * a * (a + 2 * t)) : Math.log(((a + 2 * t) * b) / ((b + 2 * t) * a)) / (2 * k * (b - a));
  for (const [a, b, t, k] of [
    [3, 3, 2, 390],
    [3.6, 4, 2, 390],
    [2, 6, 0.5, 24],
  ]) {
    const R = frustumR([a, b], [1e9, 1e9], t, k);
    assert.ok(close(R, exact(a * 1e-3, b * 1e-3, t * 1e-3, k)), `a=${a} b=${b} t=${t}`);
  }
});

test('the spreading stops at the edge of the layer', () => {
  const capped = frustumR([3, 3], [4, 4], 2, 390);
  const uncapped = frustumR([3, 3], [1e9, 1e9], 2, 390);
  assert.ok(capped > uncapped);
  // Never better than if the whole layer conducted from the start.
  assert.ok(capped > 2e-3 / (390 * 16e-6));
});

test('temperatures chain from the junction down to the reference', () => {
  const r = thermalStack({
    source: [4, 4],
    layers: [
      { id: 'die', t: 0.18, k: 370, size: [4, 4] },
      { id: 'solder', t: 0.05, k: 35, size: [4, 4] },
      { id: 'tab', t: 2, k: 390, size: [15, 14] },
      { id: 'pad', t: 0.2, k: 1.6, size: [16, 18] },
    ],
    P: 40,
    Tref: 60,
  });
  assert.ok(close(r.Tj, 60 + 40 * r.Rtotal));
  assert.equal(r.layers[0].Ttop, r.Tj);
  for (let i = 1; i < r.layers.length; i++) assert.equal(r.layers[i].Ttop, r.layers[i - 1].Tbottom);
  assert.ok(close(r.layers.at(-1).Tbottom, 60, 1e-9));
  const sum = r.layers.reduce((s, l) => s + l.dT, 0);
  assert.ok(close(sum, r.Tj - 60));
});

test('a thick good conductor on a poor one spreads the heat further', () => {
  // Copper tab on an insulating pad: the pad sees a footprint widened by
  // λ = √(k₁·t₁·t₂ / k₂) on each side (capped by the tab), not just by 45°.
  const r = thermalStack({
    source: [4, 4],
    layers: [
      { id: 'tab', t: 2, k: 390, size: [30, 30] },
      { id: 'pad', t: 0.2, k: 1.6, size: [30, 30] },
    ],
    P: 1,
    Tref: 0,
  });
  const lambda = Math.sqrt((390 * 2 * 0.2) / 1.6); // mm
  assert.ok(close(r.layers[1].footTop[0], 4 + 2 * lambda));
  // Without the poor layer underneath, only the 45° growth.
  const alone = thermalStack({
    source: [4, 4],
    layers: [
      { id: 'tab', t: 2, k: 390, size: [30, 30] },
      { id: 'cu2', t: 0.2, k: 390, size: [30, 30] },
    ],
    P: 1,
    Tref: 0,
  });
  assert.ok(close(alone.layers[1].footTop[0], 8));
});

test('the package resistance counts only the layers inside the package', () => {
  const r = thermalStack({
    source: [4, 4],
    layers: [
      { id: 'die', t: 0.2, k: 150, size: [4, 4], inPackage: true },
      { id: 'pad', t: 0.2, k: 1.6, size: [16, 18] },
    ],
    P: 10,
    Tref: 25,
  });
  assert.ok(close(r.Rjc, r.layers[0].R));
  assert.ok(r.Rjc < r.Rtotal);
});
