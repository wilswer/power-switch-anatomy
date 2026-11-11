import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACKAGES } from '../exploded-views/js/packages/index.js';
import { DEVICES } from '../exploded-views/js/devices/index.js';
import { KIND } from '../exploded-views/js/palette.js';
import { thermalStack } from '../exploded-views/js/thermal.js';
import { solidsOfModel, overlaps } from './solids-helpers.js';

// Encapsulants fill around everything else on purpose.
const FILLS = new Set(['mold', 'gel']);

const solidsOf = (model) => solidsOfModel(model, FILLS);

for (const pkg of Object.values(PACKAGES)) {
  test(`${pkg.name}: every part has a material and an explanation, including what to look for`, () => {
    for (const p of pkg.parts) {
      assert.ok(KIND[p.kind], `${p.id}: unknown kind ${p.kind}`);
      assert.ok(p.label && p.solids?.length, `${p.id}: no label or no solids`);
      assert.ok(Number.isInteger(p.group), `${p.id}: group must be an integer`);
      const i = p.info;
      assert.ok(i?.facts?.length && i.role && i.why && i.look, `${p.id} is missing info`);
    }
    assert.equal(new Set(pkg.parts.map((p) => p.id)).size, pkg.parts.length, 'part ids must be unique');
  });

  test(`${pkg.name}: solid parts never overlap`, () => {
    const hit = overlaps(solidsOf(pkg));
    assert.equal(hit, null, hit && `${hit.a} and ${hit.b} overlap at x=${hit.x.toFixed(2)} z=${hit.z.toFixed(2)}`);
  });

  test(`${pkg.name}: every bond wire starts and ends on a metal surface`, () => {
    const metals = solidsOfModel(pkg).filter((s) => ['aluminum', 'copper'].includes(s.kind));
    for (const p of pkg.parts) {
      for (const s of p.solids.filter((x) => x.type === 'tube')) {
        for (const [x, y, z] of [s.pts[0], s.pts.at(-1)]) {
          const on = metals.some((m) => Math.abs(m.y1 - y) < 1e-6 && m.has([x, z]));
          assert.ok(on, `${p.id}: wire end (${x}, ${y}, ${z}) is not on top of any metal`);
        }
      }
    }
  });

  test(`${pkg.name}: heat path, current paths and links point at real things`, () => {
    const ids = new Set(pkg.parts.map((p) => p.id));
    for (const l of pkg.heat.layers) for (const id of l.parts) assert.ok(ids.has(id), `heat layer ${l.id}: no part ${id}`);
    for (const id of pkg.heat.refParts) assert.ok(ids.has(id), `no reference part ${id}`);
    const phases = new Set((pkg.current.phases ?? []).map((ph) => ph.id));
    for (const path of pkg.current.paths) {
      assert.ok(['load', 'gate'].includes(path.kind));
      assert.ok(!path.phase || phases.has(path.phase), `unknown phase ${path.phase}`);
      assert.ok(path.pts.length >= 2 && path.pts.every((pt) => pt.length === 4 && pt.every(Number.isFinite)));
    }
    for (const p of pkg.parts.filter((x) => x.info.link)) {
      const { scale, part } = p.info.link;
      assert.equal(scale, 'cell');
      const cell = DEVICES[pkg.device];
      assert.ok(!part || cell.parts.some((c) => c.id === part && !c.pickAs), `${p.id} links to missing cell part ${part}`);
    }
  });

  test(`${pkg.name}: the heat model lands in datasheet territory`, () => {
    const h = pkg.heat;
    const at = (P) => thermalStack({ source: h.source, layers: h.layers, P, Tref: h.Tref });
    // Typical junction-to-case values for these packages (see the parts' facts).
    const RANGE = { sic: [0.25, 0.7], gan: [0.2, 1.0], igbt: [0.1, 0.3] }[pkg.device];
    const r = at(h.Pdefault);
    assert.ok(r.Rjc > RANGE[0] && r.Rjc < RANGE[1], `R_th(j-c) = ${r.Rjc.toFixed(3)} K/W`);
    // The default load is comfortable; the slider reaches past the limit.
    assert.ok(r.Tj < h.Tmax - 10, `Tj = ${r.Tj.toFixed(0)} °C at the default load`);
    assert.ok(at(h.Pmax).Tj > h.Tmax, 'the power slider should be able to overheat the die');
  });
}

test('cell layers that link to a package point at real package parts', () => {
  for (const d of Object.values(DEVICES)) {
    for (const p of d.parts.filter((x) => x.info?.link)) {
      const { scale, part } = p.info.link;
      assert.equal(scale, 'package');
      assert.ok(PACKAGES[d.id].parts.some((q) => q.id === part), `${d.id}/${p.id} links to missing ${part}`);
    }
  }
});

test('the package texts agree with the heat model', () => {
  const stack = (id) => {
    const h = PACKAGES[id].heat;
    return thermalStack({ source: h.source, layers: h.layers, P: h.Pdefault, Tref: h.Tref });
  };
  const R = (r, id) => r.layers.find((l) => l.id === id).R;
  // TO-247: "The thin pad costs more temperature than everything inside the package together."
  const sic = stack('sic');
  assert.ok(R(sic, 'pad') > sic.Rjc);
  // PQFN: "the package itself costs only a few kelvin" and the board plus gap pad
  // "cost almost all the rest".
  const gan = stack('gan');
  assert.ok(gan.Rjc * PACKAGES.gan.heat.Pdefault < 5);
  assert.ok((R(gan, 'board') + R(gan, 'gap')) / gan.Rtotal > 0.8);
  // Module: "the alumina ceramic costs the most".
  const igbt = stack('igbt');
  const top = igbt.layers.reduce((m, l) => (l.R > m.R ? l : m));
  assert.equal(top.id, 'ceramic');
});
