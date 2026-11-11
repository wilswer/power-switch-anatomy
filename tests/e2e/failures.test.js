// Browser tests for the Failure modes section (setup in harness.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open, wait } from './harness.js';
import { FAILURES } from '../../exploded-views/js/failures.js';

const inView = (page, sel) =>
  page.waitForFunction(
    (s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return r.top >= -2 && r.top < innerHeight * 0.5;
    },
    sel,
    { timeout: 4000 },
  );

test('the section lists every failure mode, and the filter narrows it to one device', async () => {
  const t = await open();
  assert.equal(await t.page.locator('.fm-card').count(), FAILURES.length);
  await t.page.click('[data-fm-filter="gan"]');
  const shown = await t.page.$$eval('.fm-card:not([hidden])', (cs) => cs.map((c) => c.dataset.devices));
  assert.ok(shown.length > 0 && shown.every((d) => d.split(' ').includes('gan')), JSON.stringify(shown));
  assert.ok(shown.length < FAILURES.length);
  // A group with no card left for the device is hidden too.
  const emptyGroupsShown = await t.page.$$eval('.fm-group:not([hidden])', (gs) =>
    gs.filter((g) => !g.querySelector('.fm-card:not([hidden])')).length,
  );
  assert.equal(emptyGroupsShown, 0);
  await t.page.click('[data-fm-filter="all"]');
  assert.equal(await t.page.locator('.fm-card:not([hidden])').count(), FAILURES.length);
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('"See where in 3D" opens the right view with the part selected', async () => {
  const t = await open();
  await t.page.click('#fm-solder [data-fm-show]');
  const s = await t.state();
  assert.deepEqual([s.device, s.scale, s.mode, s.selected], ['igbt', 'package', 'heat', 'systemSolder']);
  await inView(t.page, '.stage');
  assert.match(await t.page.textContent('#part-card'), /System solder/);
  await t.close();
});

test('a part card lists how it can fail and jumps to that card, keeping the URL', async () => {
  const t = await open({ hash: 'igbt/package' });
  await t.page.click('[data-part="powerWires"]');
  assert.match(await t.page.textContent('#part-card'), /How it can fail/);
  await t.page.click('#part-card [data-fm="bond-wires"]');
  await inView(t.page, '#fm-bond-wires');
  assert.match(await t.page.getAttribute('#fm-bond-wires', 'class'), /is-flash/);
  assert.equal(await t.page.evaluate(() => location.hash), '#igbt/package');
  await t.close();
});

test('the failure modes section fits a phone screen', async () => {
  const t = await open({ viewport: { width: 390, height: 844 } });
  await t.page.evaluate(() => document.querySelector('#failures').scrollIntoView());
  await wait(200);
  const over = await t.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(over <= 0, `the page is ${over} px too wide`);
  await t.close();
});
