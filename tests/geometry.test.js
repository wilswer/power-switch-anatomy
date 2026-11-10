import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICES } from '../exploded-views/js/devices/index.js';

// Even-odd point-in-polygon test.
function inside([px, py], poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// The layers that make up the assembled cell. Overlays that appear only in one
// mode (inversion channel, plasma, the 2DEG under the gate) sit inside other
// layers on purpose and are left out.
const solidPolygons = (device) =>
  device.parts.filter((p) => !p.onlyIn).flatMap((p) => p.shapes.map((poly) => ({ id: p.id, poly })));

// Sample on a grid offset from round numbers so no point lands on an edge.
function* grid(x0, x1, y0, y1, step = 0.0473) {
  for (let y = y0 + step / 3; y < y1; y += step) {
    for (let x = x0 + step / 3; x < x1; x += step) yield [x, y];
  }
}

const COVERAGE = {
  sic: { y0: -0.35, y1: 8.3 }, // drain metal to top of source metal
  igbt: { y0: -0.35, y1: 9.3 },
  gan: { y0: 0, y1: 5.6 }, // substrate to top of passivation and contacts
};

for (const device of Object.values(DEVICES)) {
  test(`${device.name}: layers never overlap`, () => {
    const polys = solidPolygons(device);
    for (const pt of grid(-5, 5, -0.5, 10)) {
      const owners = polys.filter(({ poly }) => inside(pt, poly)).map(({ id }) => id);
      assert.ok(owners.length <= 1, `point ${pt.map((v) => v.toFixed(2))} is in ${owners.join(' and ')}`);
    }
  });

  test(`${device.name}: layers leave no gaps in the cell`, () => {
    const polys = solidPolygons(device);
    const { y0, y1 } = COVERAGE[device.id];
    for (const pt of grid(-5, 5, y0, y1)) {
      assert.ok(
        polys.some(({ poly }) => inside(pt, poly)),
        `point ${pt.map((v) => v.toFixed(2))} is not covered by any layer`,
      );
    }
  });

  test(`${device.name}: every clickable part has an explanation`, () => {
    for (const p of device.parts.filter((p) => !p.pickAs)) {
      assert.ok(p.label, `${p.id} has no label`);
      assert.ok(p.info?.role && p.info?.why && p.info?.facts?.length, `${p.id} is missing info`);
    }
  });
}
