import { CHAIN, LOOP, STAGES } from './control.js';
import { markTerms } from './terms.js';

// "What switches the switch", after the switching figure: the stages from
// the clock to the power switch's gate, and the control loop back. Click a
// stage to read what it does; a link with data-chain="<stage>" anywhere on
// the page (the tour has some) opens that stage. The details are not a live
// region: a screen reader moves to them from the stage (aria-controls).

const glyph = (st) =>
  `<svg class="ctl-glyph" viewBox="0 0 64 24" aria-hidden="true"><path d="${st.glyph}"/>${
    st.dashed ? `<path class="ctl-dashed" d="${st.dashed}"/>` : ''
  }</svg>`;

export function initChain(root) {
  if (!root) return null;
  root.innerHTML = `
    <ol class="ctl-chain">${CHAIN.map(
      (st, i) => `<li><button type="button" class="ctl-stage" data-stage="${st.id}" aria-pressed="false" aria-controls="ctl-detail">
        <span class="ctl-n">${i + 1}</span><b>${st.name}</b>${glyph(st)}<span class="ctl-sig">${st.signal}</span>
      </button></li>`,
    ).join('')}</ol>
    <button type="button" class="ctl-stage ctl-loop" data-stage="${LOOP.id}" aria-pressed="false" aria-controls="ctl-detail">
      <b>${LOOP.name}</b><span class="ctl-sig">${LOOP.part}: ${LOOP.signal.toLowerCase()}, back to the compare value</span>
    </button>
    <div class="ctl-detail" id="ctl-detail"></div>`;
  const detail = root.querySelector('#ctl-detail');
  let current = null;

  function select(id) {
    const st = STAGES.find((s) => s.id === id);
    if (!st || id === current) return;
    current = id;
    for (const b of root.querySelectorAll('[data-stage]')) b.setAttribute('aria-pressed', String(b.dataset.stage === id));
    const n = CHAIN.indexOf(st);
    detail.innerHTML = `
      <p class="kicker">${n >= 0 ? `Stage ${n + 1} of ${CHAIN.length}` : 'Closing the loop'} · ${st.name}</p>
      <p class="ctl-part">${st.part}</p>
      <div class="ctl-cols">
        <div><p class="kicker">What it does</p><p>${st.role}</p></div>
        <div><p class="kicker">${st.whyLabel ?? 'Why it matters'}</p><p>${st.why}</p></div>
        <div><p class="kicker">What you can measure</p><p>${st.measure}</p></div>
      </div>`;
    markTerms(detail);
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-stage]');
    if (b) select(b.dataset.stage);
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[data-chain]');
    if (a) select(a.dataset.chain);
  });
  select(CHAIN[0].id);
  return { select, current: () => current };
}
