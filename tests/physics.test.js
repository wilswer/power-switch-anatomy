import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verticalBlocking, lateralBlocking } from '../exploded-views/js/physics.js';

// Device parameters as used by the page (see exploded-views/js/devices/).
const SIC = { Nd: 8e15, tDrift: 11, epsR: 9.7, Ec: 2.5e6, Nstop: 1e18, tStop: 1 };
const SI_IGBT = { Nd: 6e13, tDrift: 115, epsR: 11.7, Ec: 2.0e5, Nstop: 1e15, tStop: 8 };

const close = (actual, expected, rel, what) =>
  assert.ok(
    Math.abs(actual - expected) <= rel * Math.abs(expected),
    `${what}: got ${actual}, expected ${expected} (±${rel * 100} %)`,
  );

// Numerical area under E(x) in V (x in µm, E in V/cm).
function areaUnder(fieldAt, x0, x1, n = 40000) {
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n;
    const b = x0 + ((x1 - x0) * (i + 1)) / n;
    s += ((fieldAt(a) + fieldAt(b)) / 2) * (b - a);
  }
  return s * 1e-4;
}

test('SiC 1200 V: punches through with the hand-calculated peak field', () => {
  const r = verticalBlocking({ V: 1200, ...SIC });
  assert.ok(r.punchThrough);
  close(r.Vpt, 903, 0.005, 'punch-through voltage');
  close(r.Epk, 1.911e6, 0.005, 'peak field');
  close(r.Vbr, 1849, 0.005, 'ideal breakdown');
});

test('Si IGBT 1200 V: same voltage needs a ten times thicker drift', () => {
  const r = verticalBlocking({ V: 1200, ...SI_IGBT });
  assert.ok(r.punchThrough);
  close(r.Vpt, 614, 0.005, 'punch-through voltage');
  close(r.Epk, 1.57e5, 0.005, 'peak field');
  close(r.Vbr, 1715, 0.005, 'ideal breakdown');
  assert.ok(r.dStop < SI_IGBT.tStop, 'field must end inside the field stop');
});

test('below punch-through the field is a triangle ending inside the drift', () => {
  const r = verticalBlocking({ V: 500, ...SIC });
  assert.equal(r.punchThrough, false);
  assert.ok(r.W < SIC.tDrift);
  assert.equal(r.fieldAt(r.W + 0.01), 0);
});

test('vertical: the area under the field equals the applied voltage', () => {
  for (const params of [SIC, SI_IGBT]) {
    for (const V of [50, 500, 1200, 1800]) {
      const r = verticalBlocking({ V, ...params });
      close(areaUnder(r.fieldAt, 0, r.xMax), V, 0.002, `area at ${V} V`);
    }
  }
});

test('vertical: zero volts gives zero field', () => {
  const r = verticalBlocking({ V: 0, ...SIC });
  assert.equal(r.Epk, 0);
  assert.equal(r.fieldAt(1), 0);
});

test('lateral: the area under the field equals the applied voltage', () => {
  for (const fieldPlate of [false, true]) {
    for (const V of [20, 100, 650, 900]) {
      const r = lateralBlocking({ V, fieldPlate });
      close(areaUnder(r.fieldAt, 0, r.xMax), V, 0.003, `area at ${V} V, field plate ${fieldPlate}`);
    }
  }
});

test('lateral: the field plate lowers the peak and lifts breakdown past 650 V', () => {
  const bare = lateralBlocking({ V: 650, fieldPlate: false });
  const plated = lateralBlocking({ V: 650, fieldPlate: true });
  assert.ok(plated.Epk < 0.6 * bare.Epk);
  assert.ok(bare.Vbr < 650, `bare breakdown ${bare.Vbr} V should be below 650 V`);
  assert.ok(plated.Vbr > 900, `plated breakdown ${plated.Vbr} V should exceed 900 V`);
});
