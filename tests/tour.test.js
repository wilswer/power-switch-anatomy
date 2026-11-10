import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOUR, CHAPTERS } from '../exploded-views/js/tour.js';
import { DEVICES } from '../exploded-views/js/devices/index.js';
import { blockingResult } from '../exploded-views/js/physics.js';

const MODES = ['explore', 'on', 'block'];

test('every tour step describes a complete, valid scene', () => {
  TOUR.forEach((st, i) => {
    const where = `step ${i + 1} (${st.title})`;
    const device = DEVICES[st.device];
    assert.ok(device, `${where}: unknown device ${st.device}`);
    assert.ok(MODES.includes(st.mode), `${where}: unknown mode ${st.mode}`);
    assert.ok(CHAPTERS[st.chapter], `${where}: unknown chapter ${st.chapter}`);
    assert.ok(st.explode >= 0 && st.explode <= 1, `${where}: explode out of range`);
    assert.ok(st.title && st.body, `${where}: missing text`);
    assert.ok(st.body.replace(/<[^>]+>/g, '').length <= 360, `${where}: card text too long`);
    assert.equal(st.view.length, 3, `${where}: view must be a 3D direction`);
    assert.ok(Math.hypot(...st.view) > 0, `${where}: zero view direction`);
    assert.ok(st.zoom > 0.3 && st.zoom < 3, `${where}: zoom out of range`);

    if (st.focus) {
      const part = device.parts.find((p) => p.id === st.focus);
      assert.ok(part && !part.pickAs, `${where}: no part ${st.focus} on ${st.device}`);
      assert.ok(!part.onlyIn || part.onlyIn.includes(st.mode), `${where}: ${st.focus} is hidden in ${st.mode} mode`);
    }
    if (st.block) {
      assert.ok(st.block.V >= 0 && st.block.V <= device.blocking.Vmax, `${where}: voltage out of slider range`);
    }
    if (st.sweep) {
      assert.equal(st.mode, 'block', `${where}: voltage sweeps only make sense in Blocking mode`);
      for (const v of [st.sweep.from, st.sweep.to]) {
        assert.ok(v >= 0 && v <= device.blocking.Vmax, `${where}: sweep out of slider range`);
      }
    }
  });
});

test('the tour visits every device and every mode', () => {
  for (const id of Object.keys(DEVICES)) assert.ok(TOUR.some((s) => s.device === id), `never visits ${id}`);
  for (const m of MODES) assert.ok(TOUR.some((s) => s.mode === m), `never uses ${m} mode`);
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
