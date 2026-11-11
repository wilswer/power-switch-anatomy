import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAILURES, FAILURE_GROUPS } from '../exploded-views/js/failures.js';
import { DEVICES } from '../exploded-views/js/devices/index.js';
import { PACKAGES } from '../exploded-views/js/packages/index.js';
import { APPS } from '../exploded-views/js/apps/index.js';

const MODELS = { cell: DEVICES, package: PACKAGES, app: APPS };
const MODES = { cell: ['explore', 'on', 'block'], package: ['explore', 'current', 'heat'], app: ['explore', 'action'] };
const listed = (device, scale, id) => MODELS[scale]?.[device]?.parts.some((p) => p.id === id && !p.pickAs);

test('every failure mode is complete and points at parts that exist', () => {
  const ids = new Set();
  for (const f of FAILURES) {
    assert.ok(!ids.has(f.id), `duplicate id ${f.id}`);
    ids.add(f.id);
    assert.ok(FAILURE_GROUPS.some((g) => g.id === f.group), `${f.id}: unknown group ${f.group}`);
    for (const k of ['title', 'where', 'what', 'driven', 'measure', 'prevent', 'test']) {
      assert.ok(f[k], `${f.id} is missing ${k}`);
    }
    assert.ok(f.devices.length && f.devices.every((d) => DEVICES[d]), `${f.id}: bad devices`);
    const { device, scale, mode, part } = f.show;
    assert.ok(listed(device, scale, part), `${f.id}: no part ${part} in ${device} ${scale}`);
    assert.ok(MODES[scale].includes(mode), `${f.id}: no ${mode} mode at ${scale} scale`);
    assert.ok(f.parts.length, `${f.id} lists no parts`);
    for (const [d, sc, id] of f.parts) {
      assert.ok(listed(d, sc, id), `${f.id}: no part ${id} in ${d} ${sc}`);
      assert.ok(f.devices.includes(d), `${f.id}: part ${id} belongs to ${d}, which the card does not tag`);
    }
    assert.ok(
      f.parts.some(([d, sc, id]) => d === device && sc === scale && id === part),
      `${f.id}: the part it shows should also be in its parts list`,
    );
  }
});

test('every group has failure modes, and every device has some of its own', () => {
  for (const g of FAILURE_GROUPS) assert.ok(FAILURES.some((f) => f.group === g.id), `group ${g.id} is empty`);
  for (const d of Object.keys(DEVICES)) {
    assert.ok(FAILURES.some((f) => f.group === 'device' && f.devices.join() === d), `nothing specific to ${d}`);
    assert.ok(FAILURES.filter((f) => f.devices.includes(d)).length >= 6, `too few failure modes for ${d}`);
  }
});
