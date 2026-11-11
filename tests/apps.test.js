import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APPS } from '../exploded-views/js/apps/index.js';
import { PACKAGES } from '../exploded-views/js/packages/index.js';
import { KIND } from '../exploded-views/js/palette.js';
import { solidsOfModel, overlaps } from './solids-helpers.js';
import { FLYBACK } from '../exploded-views/js/apps/charger.js';
import { PFC, DCDC } from '../exploded-views/js/apps/obc.js';
import { DRIVE } from '../exploded-views/js/apps/drive.js';

for (const app of Object.values(APPS)) {
  test(`${app.name}: every part has a material and an explanation`, () => {
    const ids = new Set(app.parts.map((p) => p.id));
    assert.equal(ids.size, app.parts.length, 'part ids must be unique');
    for (const p of app.parts) {
      assert.ok(KIND[p.kind], `${p.id}: unknown kind ${p.kind}`);
      assert.ok(p.solids?.length && Number.isInteger(p.group), `${p.id}: no solids or no group`);
      if (p.pickAs) {
        assert.ok(ids.has(p.pickAs), `${p.id} picks as missing part ${p.pickAs}`);
        continue;
      }
      const i = p.info;
      assert.ok(p.label && i?.facts?.length && i.role && i.why && i.look, `${p.id} is missing info`);
    }
  });

  test(`${app.name}: solid parts never overlap`, () => {
    const hit = overlaps(solidsOfModel(app));
    assert.equal(hit, null, hit && `${hit.a} and ${hit.b} overlap at x=${hit.x.toFixed(2)} z=${hit.z.toFixed(2)}`);
  });

  test(`${app.name}: power paths, switches, spinning parts and links point at real things`, () => {
    const byId = new Map(app.parts.map((p) => [p.id, p]));
    const a = app.action;
    for (const path of a.paths) {
      assert.ok(['load', 'gate'].includes(path.kind));
      assert.ok(path.pts.length >= 2 && path.pts.every((pt) => pt.length === 4 && pt.every(Number.isFinite)));
    }
    assert.ok(a.pulse.length && a.pulse.every((id) => byId.has(id)), 'the switches to flash must exist');
    assert.ok(byId.has(app.legendSwitch), 'the legend must name a real switch part');
    for (const id of Object.keys(a.spin)) assert.ok(byId.get(id)?.spin, `${id} has no spin axis`);
    for (const p of app.parts.filter((q) => q.info?.link)) {
      assert.equal(p.info.link.scale, 'package', `${p.id} should link to the package`);
    }
    assert.ok(app.parts.some((p) => p.info?.link), 'the switch should link to its package');
  });

  test(`${app.name}: the conversion chain runs from a source to a load through converters`, () => {
    const c = app.chain;
    assert.ok(c.length >= 3 && c.length % 2 === 1, 'nodes and converters alternate, starting and ending with a node');
    c.forEach((step, i) => {
      if (i % 2 === 0) assert.ok(step.node && step.value, `step ${i} should be a form of electricity`);
      else assert.ok(step.conv && step.how, `step ${i} should be a converter`);
    });
    assert.ok(c.some((step) => step.ours), 'one converter should use the switch from the package view');
  });

  test(`${app.name}: the waveforms are finite and stay on their panels`, () => {
    for (const panel of app.action.waves.panels) {
      for (const s of panel.series) {
        for (let i = 0; i <= 400; i++) {
          const v = s.fn((i / 400) * app.action.waves.xMax);
          assert.ok(Number.isFinite(v) && v >= panel.yMin && v <= panel.yMax, `${panel.title}: ${v}`);
        }
      }
    }
  });
}

test('the overlap check catches cylinders and boxes sharing space', () => {
  const model = {
    parts: [
      { id: 'cap', solids: [{ type: 'cyl', c: [0, 1, 0], r: 0.5, len: 2, axis: 'y' }] },
      { id: 'motor', solids: [{ type: 'cyl', c: [3, 1, 0], r: 0.5, len: 2, axis: 'z' }] },
      { id: 'block', solids: [{ type: 'box', min: [0.3, 0, -0.1], max: [0.6, 0.5, 0.1] }] },
      { id: 'plate', solids: [{ type: 'box', min: [2.8, 0.4, 0.5], max: [3.2, 0.8, 1.5] }] },
    ],
  };
  assert.equal(overlaps(solidsOfModel(model))?.a, 'cap');
  model.parts.splice(2, 1);
  assert.equal(overlaps(solidsOfModel(model))?.a, 'motor');
  model.parts.pop();
  assert.equal(overlaps(solidsOfModel(model)), null);
});

test('every package has a product it works in', () => {
  for (const id of Object.keys(PACKAGES)) assert.ok(APPS[id], `no product for ${id}`);
});

test('the charger text agrees with its waveform', () => {
  // "Each cycle moves about half a millijoule ... roughly 70 W of input power."
  const { VIN, TON, IPK, PERIOD, VR } = FLYBACK;
  const energy = 0.5 * VIN * TON * 1e-6 * IPK; // ½·L·I² with L = V·t_on / I
  assert.ok(energy > 0.4e-3 && energy < 0.6e-3, `${energy} J`);
  const P = energy / (PERIOD * 1e-6);
  assert.ok(P > 65 && P < 80, `${P} W`);
  // "the voltage jumps to about 435 V"
  assert.equal(VIN + VR, 435);
});

test('the flyback transformer resets fully every cycle', () => {
  // Volt-second balance: over one period the primary winding (VIN minus the
  // switch voltage) averages to zero, or the core's flux would ratchet up.
  const drain = APPS.gan.action.waves.panels.find((p) => /Voltage across/.test(p.title)).series[0].fn;
  const { VIN, VR, TON, TDEMAG, PERIOD } = FLYBACK;
  const n = 20000;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += VIN - drain(((i + 0.5) / n) * PERIOD);
  const avg = sum / n;
  assert.ok(Math.abs(avg) < 0.02 * VIN, `the winding averages ${avg.toFixed(1)} V, not 0`);
  assert.ok(Math.abs(VIN * TON - VR * TDEMAG) < 0.02 * VIN * TON, `${VIN * TON} V·µs in, ${VR * TDEMAG} V·µs out`);
  assert.ok(TON + TDEMAG < PERIOD, 'the transformer empties before the next cycle');
});

test('the on-board charger has a half-bridge per grid phase, and its texts count the same switches', () => {
  // A three-phase active rectifier needs one half-bridge (two switches) per phase.
  assert.equal(PFC.switches, 2 * PFC.phases);
  const obc = APPS.sic;
  const bodies = obc.parts.find((p) => p.id === 'sicBodies');
  assert.equal(bodies.solids.length, PFC.switches + DCDC.switches, 'the 3D model draws every switch');
  const NUM = { four: 4, six: 6, eight: 8, ten: 10, twelve: 12 };
  const count = (text) => NUM[text.match(/^(\w+) /)[1].toLowerCase()];
  const [pfc, dcdc] = obc.chain.filter((c) => c.conv);
  assert.equal(count(pfc.how), PFC.switches, pfc.how);
  assert.equal(count(dcdc.how), DCDC.switches, dcdc.how);
  assert.equal(count(bodies.name), bodies.solids.length, bodies.name);
  assert.equal(count(obc.stats.find(([k]) => k === 'The switches')[1]), bodies.solids.length);
});

test('the on-board charger text agrees with its waveform', () => {
  // "Three phases × 230 V × 16 A is 11 kW."
  const P = PFC.phases * (PFC.VPK / Math.SQRT2) * (PFC.IPK / Math.SQRT2);
  assert.ok(Math.abs(P - 11000) < 300, `${P} W`);
});

test('the drive pulses average to a sine wave, and its numbers add up', () => {
  // Over each switching period the PWM averages to the reference.
  for (let k = 0; k < 20; k++) {
    let sum = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) sum += DRIVE.pwm(k * DRIVE.CARRIER + ((i + 0.5) / n) * DRIVE.CARRIER);
    const avg = sum / n;
    const target = DRIVE.VDC * DRIVE.ref((k + 0.5) * DRIVE.CARRIER);
    assert.ok(Math.abs(avg - target) < 0.04 * DRIVE.VDC, `period ${k}: ${avg} vs ${target}`);
  }
  // "≈ 50 A per phase" at 400 V for a 30 kW drive.
  const P = Math.sqrt(3) * DRIVE.VLL * (DRIVE.IPK / Math.SQRT2) * DRIVE.PF;
  assert.ok(P > 27000 && P < 33000, `${P} W`);
  // "560 V DC" from the 400 V grid.
  assert.ok(Math.abs(DRIVE.VLL * Math.SQRT2 - DRIVE.VDC) < 10);
});
