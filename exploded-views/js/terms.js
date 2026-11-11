import { GLOSSARY, findTerm, glossaryEntry } from './glossary.js';

// Glossary terms in the page's text: `markTerms` turns the first use of each
// term inside a container into a dotted-underlined button, and one shared
// popover shows its definition on hover (mouse), focus (keyboard) or tap.
// Tapping or clicking a term pins the popover until the next click or Esc.

// Never mark inside these: controls, headings, labels, live numbers, charts.
const SKIP = 'a, button, input, label, select, textarea, output, h1, h2, h3, h4, dt, figure, svg, .kicker, .status, .readouts, .volt, .tour-readout, .fm-tags, .term';
const CONTEXT = 24; // characters of preceding text the matcher may look at

export function markTerms(root) {
  if (!root) return;
  const done = new Set();
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  let tail = '';
  for (const node of nodes) {
    const text = node.data;
    if (!node.parentElement.closest(SKIP)) {
      let cur = node;
      let prefix = tail;
      for (let hit = findTerm(cur.data, done, prefix); hit; hit = findTerm(cur.data, done, prefix)) {
        const word = cur.splitText(hit.index);
        const rest = word.splitText(hit.length);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'term';
        btn.dataset.term = hit.id;
        btn.textContent = word.data;
        word.replaceWith(btn);
        done.add(hit.id);
        prefix = (prefix + cur.data + btn.textContent).slice(-CONTEXT);
        cur = rest;
      }
    }
    tail = (tail + text).slice(-CONTEXT);
  }
}

// The Glossary section: every term, in alphabetical order.
export function renderGlossary(list) {
  if (!list) return;
  list.innerHTML = [...GLOSSARY]
    .sort((a, b) => a.term.localeCompare(b.term))
    .map((g) => `<div id="g-${g.id}"><dt>${g.term}</dt><dd>${g.def}</dd></div>`)
    .join('');
}

export function bindTerms() {
  const pop = document.createElement('div');
  pop.id = 'term-pop';
  pop.className = 'term-pop';
  pop.setAttribute('role', 'tooltip');
  pop.hidden = true;
  document.body.append(pop);
  let current = null;
  let pinned = false;

  const place = () => {
    if (!current) return;
    const r = current.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const left = Math.max(8, Math.min(r.left, innerWidth - w - 8));
    const below = r.bottom + 6;
    const top = below + h > innerHeight - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : below;
    pop.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };
  const show = (t) => {
    const g = glossaryEntry(t.dataset.term);
    if (!g) return;
    current?.removeAttribute('aria-describedby');
    current = t;
    pop.innerHTML = `<b>${g.term}</b> ${g.def}`;
    pop.hidden = false;
    t.setAttribute('aria-describedby', 'term-pop');
    place();
  };
  const hide = () => {
    pinned = false;
    pop.hidden = true;
    current?.removeAttribute('aria-describedby');
    current = null;
  };
  const termOf = (e) => (e.target instanceof Element ? e.target.closest('.term') : null);

  document.addEventListener('pointerover', (e) => {
    const t = termOf(e);
    if (t && e.pointerType === 'mouse' && !pinned) show(t);
  });
  document.addEventListener('pointerout', (e) => {
    const t = termOf(e);
    if (t && e.pointerType === 'mouse' && !pinned && t === current) hide();
  });
  document.addEventListener('focusin', (e) => {
    const t = termOf(e);
    if (t && !pinned) show(t);
  });
  document.addEventListener('focusout', (e) => {
    if (termOf(e) && !pinned) hide();
  });
  document.addEventListener('click', (e) => {
    const t = termOf(e);
    if (t) {
      if (pinned && t === current) hide();
      else {
        show(t);
        pinned = true;
      }
      return;
    }
    if (pinned && !pop.contains(e.target)) hide();
  });
  // Esc closes the definition first, before it reaches the tour or the selection.
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || pop.hidden) return;
      hide();
      e.stopPropagation();
    },
    true,
  );
  addEventListener('scroll', place, { passive: true });
  addEventListener('resize', place);
}
