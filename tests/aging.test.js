import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACKAGES } from '../exploded-views/js/packages/index.js';
import { thermalStack } from '../exploded-views/js/thermal.js';
import { crackedLayers, onVoltage, agedHeat, powerCyclingTest, random, EOL } from '../exploded-views/js/aging.js';

const close = (a, b, rel = 1e-6) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];

for (const [id, p] of Object.entries(PACKAGES)) {
  const { heat: h, aging: a } = p;
  const at = (o) => agedHeat(h, a, { P: h.Pdefault, ...o });

  test(`${p.name}: the wear settings point at real layers, parts and wires`, () => {
    const layer = h.layers.find((l) => l.id === a.joint.layer);
    assert.ok(layer, `no heat layer ${a.joint.layer}`);
    assert.ok(layer.parts.includes(a.joint.part), 'the cracking joint is the part the heat layer tints');
    const joint = p.parts.find((q) => q.id === a.joint.part);
    const wires = p.parts.find((q) => q.id === a.wires.part);
    assert.ok(a.joint.meshes.every((i) => i < joint.solids.length));
    assert.equal(a.electrical.wires, a.wires.meshes.length, 'one drawn wire per wire in the model');
    assert.equal(new Set(a.wires.meshes).size, a.wires.meshes.length);
    assert.ok(a.wires.meshes.every((i) => i < wires.solids.length && wires.solids[i].type === 'tube'));
  });

  test(`${p.name}: a new package is just the heat model`, () => {
    const r = at({});
    const plain = thermalStack({ source: h.source, layers: h.layers, P: h.Pdefault, Tref: h.Tref });
    assert.ok(close(r.result.Tj, plain.Tj) && close(r.result.Rjc, plain.Rjc));
    assert.ok(close(r.P, h.Pdefault) && Math.abs(r.dR) < 1e-9 && Math.abs(r.dV) < 1e-9);
    assert.deepEqual(r.eol, { Rth: false, Von: false });
  });

  test(`${p.name}: cracks raise R_th, lifted wires the on-state voltage, and both heat the die`, () => {
    let prev = at({});
    for (const crack of [0.1, 0.2, 0.3, 0.5, 0.7]) {
      const r = at({ crack });
      assert.ok(r.dR > prev.dR, `R_th should grow at ${crack}`);
      assert.ok(r.result.Tj > prev.result.Tj && r.P >= prev.P);
      prev = r;
    }
    prev = at({});
    for (let lifted = 1; lifted < a.electrical.wires; lifted++) {
      const r = at({ lifted });
      assert.ok(r.dV > prev.dV, `the voltage should step up at ${lifted} lifted`);
      assert.ok(Math.abs(r.dR) < 1e-9, 'wires do not change R_th(j-c)');
      assert.ok(r.P > prev.P && r.result.Tj > prev.result.Tj, 'higher voltage, more loss, hotter die');
      prev = r;
    }
  });
}

test('the cracked joint keeps the uncracked share of its area, centered', () => {
  const layers = PACKAGES.igbt.heat.layers;
  const out = crackedLayers(layers, 'chip', 0.3);
  const area = (l) => l.size[0] * l.size[1];
  const before = layers.find((l) => l.id === 'chip');
  const after = out.find((l) => l.id === 'chip');
  assert.ok(close(area(after), 0.7 * area(before)));
  assert.ok(close(after.size[0] / after.size[1], before.size[0] / before.size[1]));
  for (const l of out.filter((x) => x.id !== 'chip')) assert.deepEqual(l, layers.find((x) => x.id === l.id));
});

test('the end-of-life lines fall where tests usually find them', () => {
  // About a quarter to a third of the die attach gone takes R_th past +20 %.
  for (const id of ['sic', 'igbt']) {
    const { heat: h, aging: a } = PACKAGES[id];
    assert.equal(agedHeat(h, a, { P: h.Pdefault, crack: 0.2 }).eol.Rth, false, id);
    assert.equal(agedHeat(h, a, { P: h.Pdefault, crack: 0.4 }).eol.Rth, true, id);
  }
  // In the module, the third of five wires on the die takes V_CE(on) past +5 %.
  const { heat: h, aging: a } = PACKAGES.igbt;
  assert.equal(agedHeat(h, a, { P: h.Pdefault, lifted: 2 }).eol.Von, false);
  assert.equal(agedHeat(h, a, { P: h.Pdefault, lifted: 3 }).eol.Von, true);
  assert.equal(EOL.Rth, 0.2);
  assert.equal(EOL.Von, 0.05);
});

test('the on-state voltage is the die drop, rising with temperature, plus the wires in parallel', () => {
  const el = { Vdie25: 1.7, tempco: 0.0014, I: 150, Rwire: 0.0025, wires: 5 };
  assert.ok(close(onVoltage(el, 25), 1.7 + (150 * 0.0025) / 5));
  assert.ok(close(onVoltage(el, 125, 1), 1.7 * 1.14 + (150 * 0.0025) / 4));
});

test('the random generator is reproducible and stays in [0, 1)', () => {
  const a = random(7);
  const b = random(7);
  const xs = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(xs.slice(0, 5), Array.from({ length: 5 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  assert.ok(Math.abs(mean - 0.5) < 0.05);
});

for (const [id, p] of Object.entries(PACKAGES)) {
  test(`${p.name}: a power-cycling test runs to end of life the way the signals drift`, () => {
    const { heat: h, aging: a } = p;
    const P = h.Pmax * 0.8;
    const run = powerCyclingTest(h, a, { P, seed: 3 });
    assert.deepEqual(run, powerCyclingTest(h, a, { P, seed: 3 }), 'the same seed replays the same device');
    assert.ok(run.end && ['Rth', 'Von', 'open', 'runaway'].includes(run.end.cause), JSON.stringify(run.end));
    const pts = run.points;
    for (let i = 1; i < pts.length; i++) {
      assert.ok(pts[i].N > pts[i - 1].N);
      assert.ok(pts[i].dR >= pts[i - 1].dR - 1e-9, 'R_th never heals');
      assert.ok(pts[i].lifted >= pts[i - 1].lifted, 'wires never reattach');
    }
    // The voltage jumps where wires lift.
    const jumps = [];
    for (let i = 1; i < pts.length; i++) if (pts[i].lifted > pts[i - 1].lifted) jumps.push(pts[i].dV - pts[i - 1].dV);
    assert.ok(jumps.length > 0 && jumps.length <= run.lifts.length);
    assert.ok(jumps.every((d) => d > 0));
    const last = pts.at(-1);
    if (run.end.cause === 'Rth') assert.ok(last.dR >= EOL.Rth - 1e-9);
    if (run.end.cause === 'Von') assert.ok(last.dV >= EOL.Von - 1e-9);
  });
}

test('devices scatter, and a smaller swing lasts far longer (Coffin–Manson)', () => {
  const { heat: h, aging: a } = PACKAGES.igbt;
  const life = (P) => {
    const runs = Array.from({ length: 15 }, (_, i) => powerCyclingTest(h, a, { P, seed: i + 1 }));
    return { N: median(runs.map((r) => r.end.N)), swing: runs[0].swing, spread: new Set(runs.map((r) => r.end.N)).size, causes: new Set(runs.map((r) => r.end.cause)) };
  };
  const hot = life(320);
  const mild = life(200);
  assert.ok(hot.spread > 10, 'every device fails at its own count');
  assert.ok(hot.causes.has('Rth') && hot.causes.has('Von'), 'sometimes the solder ends it, sometimes the wires');
  const expected = (hot.swing / mild.swing) ** 5;
  const ratio = mild.N / hot.N;
  assert.ok(ratio > expected / 2 && ratio < expected * 2, `life ratio ${ratio.toFixed(1)}, expected about ${expected.toFixed(1)}`);
  // About 50 000 cycles at a swing near 80 K, as the calibration says.
  assert.ok(hot.swing > 65 && hot.swing < 85 && hot.N > 25000 && hot.N < 90000, `${hot.N} cycles at ${hot.swing} K`);
});

test('with no load nothing wears out, and the test says so instead of failing', () => {
  for (const { heat: h, aging: a } of Object.values(PACKAGES)) {
    const run = powerCyclingTest(h, a, { P: 0, seed: 1 });
    assert.equal(run.end, null);
    assert.equal(run.points.length, 1);
    assert.ok(Number.isFinite(run.points[0].N));
  }
});
