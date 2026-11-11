// Browser tests for the glossary terms and their definitions (setup in harness.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open, wait } from './harness.js';
import { GLOSSARY } from '../../exploded-views/js/glossary.js';

const terms = (page, sel) => page.$$eval(`${sel} .term`, (ts) => ts.map((t) => t.dataset.term));
const pop = (page) => page.evaluate(() => {
  const p = document.querySelector('#term-pop');
  return p.hidden ? null : p.textContent;
});

test('the tour opens with the basics, and its terms explain themselves on hover', async () => {
  const t = await open();
  await t.page.click('.cta');
  await t.goTo(2);
  assert.match(await t.page.textContent('#tour-title'), /three terminals/);
  const marked = await terms(t.page, '#tour-text');
  for (const id of ['gate', 'drain', 'source', 'collector', 'emitter', 'igbt']) assert.ok(marked.includes(id), `${id} in ${marked}`);
  assert.equal(new Set(marked).size, marked.length, 'each term once per card');

  await t.page.hover('#tour-text .term[data-term="gate"]');
  assert.match(await pop(t.page), /^Gate\s+The control terminal/);
  await t.page.mouse.move(5, 5);
  assert.equal(await pop(t.page), null, 'leaving the term hides it');
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('keyboard and touch reach the definitions too, and Esc closes only the definition', async () => {
  const t = await open();
  await t.page.click('.cta');
  await t.goTo(2);
  await t.page.focus('#tour-text .term[data-term="drain"]');
  assert.match(await pop(t.page), /^Drain/);
  assert.equal(await t.page.getAttribute('#tour-text .term[data-term="drain"]', 'aria-describedby'), 'term-pop');
  await t.page.keyboard.press('Escape');
  assert.equal(await pop(t.page), null);
  assert.equal(await t.active(), true, 'the tour keeps going');

  // A click (or tap) pins the definition until the next click elsewhere.
  await t.page.click('#tour-text .term[data-term="emitter"]');
  await t.page.mouse.move(5, 5);
  assert.match(await pop(t.page), /^Emitter/);
  await t.page.click('#tour-title');
  assert.equal(await pop(t.page), null);
  await t.close();
});

test('part cards, panels and failure cards mark their terms; the Glossary lists them all', async () => {
  const t = await open({ hash: 'igbt' });
  await t.page.click('[data-part="drift"]');
  const card = await terms(t.page, '#part-card');
  assert.ok(card.length > 0 && new Set(card).size === card.length, JSON.stringify(card));
  assert.ok((await terms(t.page, '#mode-card')).includes('conductivity-modulation'));
  assert.ok((await terms(t.page, '#fm-bond-wires')).length > 0);
  // Nothing in headings, buttons or labels.
  assert.equal(await t.page.locator('h2 .term, h3 .term, h4 .term, button .term, label .term').count(), 0);
  const listed = await t.page.$$eval('#glossary-list > div', (ds) => ds.map((d) => d.id.slice(2)));
  assert.deepEqual(new Set(listed), new Set(GLOSSARY.map((g) => g.id)));
  assert.deepEqual(t.errors, []);
  await t.close();
});

test('on a phone, a tapped term shows its definition on screen', async () => {
  const t = await open({ viewport: { width: 390, height: 844 }, touch: true });
  await t.page.click('[data-part="drift"]');
  const term = t.page.locator('#part-card .term').first();
  await term.tap();
  await wait(100);
  const box = await t.page.$eval('#term-pop', (p) => (p.hidden ? null : p.getBoundingClientRect().toJSON()));
  assert.ok(box, 'the definition shows');
  assert.ok(box.left >= 0 && box.right <= 390 && box.top >= 0 && box.bottom <= 844, JSON.stringify(box));
  await t.close();
});
