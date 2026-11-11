// Browser tests for the cell views (setup in harness.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from './harness.js';

// Push the Blocking slider to its top and return the status line.
async function blockAtMax(t, { fieldPlate = true } = {}) {
  await t.page.click('[data-mode="block"]');
  if (!fieldPlate) await t.page.uncheck('#fieldplate');
  await t.page.$eval('#volt', (el) => {
    el.value = el.max;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return {
    text: await t.page.textContent('#block-status'),
    cls: await t.page.getAttribute('#block-status', 'class'),
  };
}

test('past the critical field, silicon and SiC avalanche but a GaN HEMT simply breaks', async () => {
  for (const id of ['sic', 'igbt']) {
    const t = await open({ hash: id });
    const s = await blockAtMax(t);
    assert.match(s.cls, /is-danger/);
    assert.match(s.text, /^Avalanche breakdown/, `${id}: ${s.text}`);
    assert.deepEqual(t.errors, []);
    await t.close();
  }
  const t = await open({ hash: 'gan' });
  const s = await blockAtMax(t, { fieldPlate: false });
  assert.match(s.cls, /is-danger/);
  assert.doesNotMatch(s.text.replace('cannot avalanche', ''), /avalanche/i, s.text);
  assert.match(s.text, /cannot avalanche/);
  assert.doesNotMatch(await t.page.textContent('#tour-readout'), /avalanche/i);
  assert.deepEqual(t.errors, []);
  await t.close();
});
