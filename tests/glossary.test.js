import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLOSSARY, findTerm } from '../exploded-views/js/glossary.js';
import { TOUR } from '../exploded-views/js/tour.js';
import { DEVICES } from '../exploded-views/js/devices/index.js';
import { PACKAGES } from '../exploded-views/js/packages/index.js';
import { APPS } from '../exploded-views/js/apps/index.js';
import { FAILURES } from '../exploded-views/js/failures.js';

const hit = (text, prefix = '') => {
  const r = findTerm(text, new Set(), prefix);
  return r && `${text.slice(r.index, r.index + r.length)}:${r.id}`;
};

// All the prose the page shows, without markup.
function strings(x, out = []) {
  if (typeof x === 'string') out.push(x.replace(/<[^>]+>/g, ''));
  else if (Array.isArray(x)) x.forEach((y) => strings(y, out));
  else if (x && typeof x === 'object') Object.values(x).forEach((y) => strings(y, out));
  return out;
}
// The static page text too, without its markup, scripts and styles.
const HTML = readFileSync(new URL('../exploded-views/index.html', import.meta.url), 'utf8')
  .replace(/<(script|style)[\s\S]*?<\/\1>/g, '')
  .replace(/<[^>]+>/g, ' ');
const PAGE_TEXT = [
  HTML,
  ...TOUR.map((s) => s.body),
  ...strings([Object.values(DEVICES), Object.values(PACKAGES), Object.values(APPS), FAILURES]),
];

test('every glossary entry is complete, and no spelling belongs to two terms', () => {
  const ids = new Set();
  const spellings = new Map();
  for (const g of GLOSSARY) {
    assert.ok(!ids.has(g.id), `duplicate id ${g.id}`);
    ids.add(g.id);
    assert.ok(g.term && g.match.length, `${g.id} needs a term and spellings`);
    assert.ok(g.def.length >= 60 && g.def.length <= 240, `${g.id}: definition is ${g.def.length} characters`);
    assert.match(g.def, /\.$/, `${g.id}: a definition is a sentence`);
    for (const m of g.match) {
      const s = (typeof m === 'string' ? m : m.m).toLowerCase();
      assert.ok(!spellings.has(s), `"${s}" is in both ${spellings.get(s)} and ${g.id}`);
      spellings.set(s, g.id);
    }
  }
  assert.ok(GLOSSARY.length >= 25);
});

test('every term in the glossary is used somewhere on the page', () => {
  const all = GLOSSARY.map((g) => g.id);
  for (const g of GLOSSARY) {
    const others = new Set(all.filter((id) => id !== g.id));
    const used = PAGE_TEXT.some((t) => findTerm(t, others)?.id === g.id);
    assert.ok(used, `${g.term} is never used`);
  }
});

test('terms match whole words in any case, the longest spelling first', () => {
  assert.equal(hit('The gate driver sits next to the gate'), 'gate driver:gate-driver');
  assert.equal(hit('Gates and drains'), 'Gates:gate');
  assert.equal(hit('the IGBTs here'), 'IGBTs:igbt');
  assert.equal(hit('a gateway and drainage'), null);
  assert.equal(hit('R junction-to-case'), null, 'part of a compound');
  assert.equal(hit('the junction temperature rises'), 'junction temperature:junction-temperature');
});

test('other senses of a word are left alone', () => {
  assert.equal(hit('coolant in a channel inside the floor'), null);
  assert.equal(hit('threshold drift shows'), null);
  assert.equal(hit('the signals drift apart'), null);
  assert.equal(hit('Mounting holes'), null);
  assert.equal(hit('screw it to a heatsink through the hole'), null);
  assert.equal(hit('the ring around the hole'), null);
  assert.equal(hit('Copper-plated holes, 0.3 mm across'), null);
  assert.equal(hit('A grid of tiny holes in the copper'), null);
  assert.equal(hit('injects holes into the drift'), 'holes:hole');
  assert.equal(hit('the heat source'), null);
  assert.equal(hit('heat source and the source wires'), 'source:source', 'the second one is the terminal');
  // The words before can come from the text before the node, e.g. across a <sub>.
  assert.equal(hit('drift layer', ''), 'drift layer:drift');
  assert.equal(hit('drift.', 'holes into the '), 'drift:drift');
  assert.equal(hit(' drift', 'V th'), null);
});

test('each term is found once per container: what is done is skipped', () => {
  const text = 'the gate and the gate again';
  const first = findTerm(text);
  assert.equal(first.index, 4);
  assert.equal(findTerm(text, new Set(['gate'])), null);
});
