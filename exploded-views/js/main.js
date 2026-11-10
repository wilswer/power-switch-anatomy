import { DEVICES, DEVICE_ORDER } from './devices/index.js';
import { KIND, ELECTRON, HOLE, FIELD_GRADIENT_CSS } from './palette.js';
import { blockingResult } from './physics.js';
import { renderFieldPlot } from './fieldplot.js';
import { Viewer } from './viewer.js';
import { Effects } from './effects.js';
import { createTourPlayer } from './tour-player.js';

const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  device: 'sic',
  mode: 'explore', // 'explore' | 'on' | 'block'
  explode: 1,
  labels: true,
  selected: null,
  block: Object.fromEntries(
    DEVICE_ORDER.map((id) => [id, { V: DEVICES[id].blocking.Vrated, fieldPlate: true }]),
  ),
};

let viewer = null;
let effects = null;
let tour = null;

const els = {
  tabs: [...document.querySelectorAll('[data-device]')],
  modes: [...document.querySelectorAll('[data-mode]')],
  explode: $('#explode'),
  labels: $('#labels-toggle'),
  reset: $('#reset-view'),
  modeCard: $('#mode-card'),
  partCard: $('#part-card'),
  panel: $('.panel'),
  partsList: $('#parts-list'),
  legend: $('#legend'),
  titleblock: $('#titleblock'),
  loading: $('#loading'),
  tourStarts: [...document.querySelectorAll('[data-tour-start]')],
  tourReadout: $('#tour-readout'),
};

const device = () => DEVICES[state.device];
const partById = (id) => device().parts.find((p) => p.id === id);
const fmtField = (E) => `${(E / 1e6).toFixed(2)} MV/cm`;

// ---------- state changes ----------

function setDevice(id, { fromHash = false } = {}) {
  if (!DEVICES[id]) return;
  tour?.stopSweep();
  state.device = id;
  state.selected = null;
  if (!fromHash) history.replaceState(null, '', `#${id}`);
  for (const t of els.tabs) {
    const on = t.dataset.device === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  }
  if (viewer) {
    viewer.setDevice(device());
    effects.setDevice(device());
    viewer.setMode(state.mode);
    effects.setMode(state.mode);
  }
  renderAll();
}

function setMode(mode) {
  tour?.stopSweep();
  state.mode = mode;
  for (const b of els.modes) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  const sel = state.selected && partById(state.selected);
  if (sel?.onlyIn && !sel.onlyIn.includes(mode)) state.selected = null;
  viewer?.select(state.selected);
  viewer?.setMode(mode);
  effects?.setMode(mode);
  renderAll();
}

function select(id) {
  state.selected = id;
  viewer?.select(id);
  renderPartCard();
  markListSelection();
  revealPartCard();
}

// In the two-column layout the panel scrolls on its own; bring the part card to its top.
function revealPartCard() {
  const p = els.panel;
  if (!state.selected || getComputedStyle(p).overflowY !== 'auto' || p.scrollHeight <= p.clientHeight) return;
  p.scrollTo({ top: els.partCard.offsetTop, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

// ---------- tour ----------

// Put the page into the scene a tour step describes (see tour.js).
function applyTourStep(st) {
  if (st.block) Object.assign(state.block[st.device], st.block);
  state.explode = st.explode;
  els.explode.value = String(st.explode);
  viewer?.setExplode(st.explode);
  if (state.device !== st.device) setDevice(st.device);
  setMode(st.mode); // also re-renders the panel with the step's Blocking settings
  select(st.focus);
  viewer?.flyTo(st.view, st.zoom);
}

// Used by the tour's voltage sweeps; mirrors what dragging the slider does.
// It only touches the display when that device is on screen in Blocking mode.
function setVoltage(V, deviceId) {
  const { Vmax } = DEVICES[deviceId].blocking;
  state.block[deviceId].V = Math.min(Vmax, Math.max(0, V));
  if (state.device !== deviceId || state.mode !== 'block') return;
  const slider = $('#volt');
  if (!slider) return;
  slider.value = String(state.block[deviceId].V);
  updateBlocking();
}

// The toolbar button is an on/off toggle; the masthead button starts, resumes
// or scrolls back to the tour, and its label says which.
function updateTourButtons() {
  const active = tour.isActive();
  const at = active ? tour.currentStep() : tour.resumeStep();
  for (const b of els.tourStarts) {
    if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', String(active));
    const label = b.querySelector('.tour-start-label');
    if (!label) continue;
    label.textContent = active
      ? `Back to the tour (step ${at + 1})`
      : at > 0
        ? `Resume the tour (step ${at + 1})`
        : b.dataset.label;
  }
}

// The field plate is drawn only while the Blocking settings include it.
function syncHiddenParts() {
  const b = device().blocking;
  const hide = Boolean(b.fieldPlatePart) && state.mode === 'block' && !state.block[state.device].fieldPlate;
  viewer?.setHiddenParts(hide ? [b.fieldPlatePart] : []);
  if (hide && state.selected === b.fieldPlatePart) select(null);
}

// ---------- panel ----------

function renderAll() {
  els.panel.scrollTop = 0;
  renderModeCard();
  renderPartCard();
  renderPartsList();
  renderLegend();
  renderTitleblock();
  syncHiddenParts();
  els.tourReadout.hidden = state.mode !== 'block';
}

function renderModeCard() {
  const d = device();
  if (state.mode === 'explore') {
    els.modeCard.innerHTML = `
      <p class="kicker">${d.kicker}</p>
      <h2>${d.name}</h2>
      <p class="sub">${d.subtitle}</p>
      ${d.summary.map((p) => `<p>${p}</p>`).join('')}
      <dl class="stats">${d.stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  } else if (state.mode === 'on') {
    const g = d.gateOn;
    els.modeCard.innerHTML = `
      <p class="kicker">Gate ON · conducting</p>
      <h2>${g.title}</h2>
      <ol class="steps">${g.steps.map((s) => `<li><span>${s}</span></li>`).join('')}</ol>
      <p class="carriers">
        <span><i class="dot" style="--dot:${ELECTRON}"></i>Electrons</span>
        ${g.holes ? `<span><i class="dot" style="--dot:${HOLE}"></i>Holes</span>` : ''}
      </p>
      <p class="note">${g.note}</p>`;
  } else {
    renderBlockCard();
  }
}

function renderBlockCard() {
  const d = device();
  const b = d.blocking;
  const s = state.block[d.id];
  const ratedPct = (b.Vrated / b.Vmax) * 100;
  els.modeCard.innerHTML = `
    <p class="kicker">Blocking · off, holding voltage</p>
    <h2>${b.title}</h2>
    <div class="volt">
      <div class="volt-head"><label for="volt">${b.terminal} voltage</label><output id="volt-out" for="volt"></output></div>
      <input type="range" id="volt" min="0" max="${b.Vmax}" step="10" value="${s.V}">
      <div class="volt-scale"><span>0 V</span><span class="rated" style="left:${ratedPct}%">rated ${b.Vrated} V</span><span>${b.Vmax} V</span></div>
    </div>
    ${
      b.kind === 'lateral'
        ? `<label class="check"><input type="checkbox" id="fieldplate" ${s.fieldPlate ? 'checked' : ''}> Source field plate</label>`
        : ''
    }
    <p class="status" id="block-status"></p>
    <dl class="stats readouts" id="readouts"></dl>
    <figure class="plot">
      <svg id="field-plot" role="img" aria-label="Electric field profile"></svg>
      <figcaption>${b.caption}</figcaption>
    </figure>
    <div class="ramp"><span>0</span><i style="background:${FIELD_GRADIENT_CSS}"></i><span>critical field</span></div>
    ${b.text.map((p) => `<p>${p}</p>`).join('')}`;
  $('#volt').addEventListener('input', (e) => {
    tour?.stopSweep();
    s.V = Number(e.target.value);
    updateBlocking();
  });
  $('#fieldplate')?.addEventListener('change', (e) => {
    s.fieldPlate = e.target.checked;
    updateBlocking();
  });
  updateBlocking();
}

function updateBlocking() {
  const d = device();
  const b = d.blocking;
  const s = state.block[d.id];
  const r = blockingResult(b, s);
  $('#volt-out').textContent = `${s.V} V`;

  const ratio = r.Ec > 0 ? r.Epk / r.Ec : 0;
  const status = $('#block-status');
  status.className = `status ${ratio >= 1 ? 'is-danger' : ratio > 0.8 ? 'is-warn' : 'is-ok'}`;
  status.textContent =
    ratio >= 1
      ? 'Avalanche breakdown: the peak field has reached the critical field'
      : `Blocking · peak field at ${Math.round(ratio * 100)} % of critical`;
  // The same numbers in short, inside the tour card, for layouts where the panel is out of sight.
  els.tourReadout.textContent = `${s.V} V · peak ${fmtField(r.Epk)} · ${
    ratio >= 1 ? 'avalanche breakdown' : `${Math.round(ratio * 100)} % of critical`
  }`;

  const rows = [
    ['Peak field', fmtField(r.Epk)],
    ['Critical field', fmtField(r.Ec)],
  ];
  if (r.kind === 'vertical') {
    rows.push([
      'Depletion depth',
      r.punchThrough
        ? `${b.params.tDrift} µm, the whole drift (reached the ${b.stopName} at ${Math.round(r.Vpt)} V)`
        : `${r.W.toFixed(r.W < 20 ? 1 : 0)} of ${b.params.tDrift} µm`,
    ]);
  } else {
    rows.push(['Depleted 2DEG', `${r.Ldep.toFixed(1)} of ${b.params.Lgd} µm toward the drain`]);
  }
  rows.push(['Ideal breakdown', `≈ ${Math.round(r.Vbr / 10) * 10} V`]);
  $('#readouts').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  const peak = r.profile.reduce((m, [x, E]) => (E > m.E ? { x, E } : m), { x: 0, E: 0 });
  const markers =
    r.kind === 'vertical'
      ? [{ x: b.params.tDrift, label: `${b.stopName} →` }]
      : s.fieldPlate
        ? [{ x: b.params.xFP, label: 'field-plate edge' }]
        : [];
  renderFieldPlot($('#field-plot'), {
    profile: r.profile,
    xMax: r.xMax,
    xLabel: b.axis,
    Ec: r.Ec,
    eMax: Math.max(r.Ec * 1.2, r.Epk * 1.08),
    markers,
    peak,
  });
  effects?.setBlocking(r);
  syncHiddenParts();
}

function renderPartCard() {
  const p = state.selected && partById(state.selected);
  if (!p) {
    els.partCard.innerHTML = `<p class="hint-card">Click any layer in the drawing, or a name in the list below, to see what it is and why it is there.</p>`;
    return;
  }
  const k = KIND[p.kind];
  els.partCard.innerHTML = `
    <div class="part-head">
      <span class="swatch big" style="--sw:${k.color}"></span>
      <div><p class="kicker">${k.label}</p><h3>${p.name ?? p.label}</h3></div>
      <button type="button" class="close" aria-label="Close part details">×</button>
    </div>
    <dl class="stats facts">${p.info.facts.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>
    <h4>What it does</h4>
    <p>${p.info.role}</p>
    <h4>Why it matters</h4>
    <p>${p.info.why}</p>`;
  $('.close', els.partCard).addEventListener('click', () => select(null));
}

function renderPartsList() {
  const items = device()
    .parts.filter((p) => !p.pickAs)
    .slice()
    .reverse();
  els.partsList.innerHTML = `
    <h4 class="list-title">Layers, top to bottom</h4>
    <ul class="parts">${items
      .map((p) => {
        const tag = p.onlyIn ? `<span class="tag">Gate ON</span>` : '';
        return `<li><button type="button" data-part="${p.id}" aria-pressed="${state.selected === p.id}">
          <span class="swatch" style="--sw:${KIND[p.kind].color}"></span><span class="pname">${p.label}</span>${tag}</button></li>`;
      })
      .join('')}</ul>`;
}

function markListSelection() {
  for (const b of els.partsList.querySelectorAll('[data-part]')) {
    b.setAttribute('aria-pressed', String(b.dataset.part === state.selected));
  }
}

function renderLegend() {
  const sw = (kind) => `<span class="sw" style="--sw:${KIND[kind].color}"></span>`;
  const d = device();
  let html =
    d.legend === 'gan'
      ? `<p class="lg-title">Key</p>
         <div class="row">${sw('twodeg')}2DEG electrons</div>
         <div class="row">${sw('pGan')}p-type GaN</div>
         <div class="row">${sw('ganChannel')}${sw('algan')}${sw('ganBuffer')}undoped layers</div>`
      : `<p class="lg-title">Doping</p>
         <div class="row">${sw('nPlus')}<span>n<sup>+</sup></span>${sw('n')}<span>n</span>${sw('nMinus')}<span>n<sup>−</sup></span></div>
         <div class="row">${sw('pPlus')}<span>p<sup>+</sup></span>${sw('p')}<span>p</span></div>
         <p class="lg-note">deeper color = heavier doping</p>`;
  if (state.mode === 'on') {
    html += `<div class="row"><i class="dot" style="--dot:${ELECTRON}"></i>electrons${
      d.gateOn.holes ? `<i class="dot" style="--dot:${HOLE}"></i>holes` : ''
    }</div>`;
  }
  els.legend.innerHTML = html;
}

function renderTitleblock() {
  const d = device();
  const view =
    state.mode !== 'explore'
      ? 'ISO · ASSEMBLED · X-RAY'
      : state.explode > 0.02
        ? 'ISO · EXPLODED'
        : 'ISO · ASSEMBLED';
  els.titleblock.innerHTML = `
    <div><span>DWG</span><b>${d.drawing.code}</b></div>
    <div><span>SCALE</span><b title="Not to scale">NTS</b></div>
    <div><span>VIEW</span><b>${view}</b></div>
    <div><span>CELL</span><b>${d.drawing.cell}</b></div>`;
}

// ---------- wiring ----------

function wireUI() {
  for (const t of els.tabs) t.addEventListener('click', () => setDevice(t.dataset.device));
  $('.device-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = DEVICE_ORDER.indexOf(state.device);
    const next = DEVICE_ORDER[(i + (e.key === 'ArrowRight' ? 1 : DEVICE_ORDER.length - 1)) % DEVICE_ORDER.length];
    setDevice(next);
    els.tabs.find((t) => t.dataset.device === next)?.focus();
  });
  for (const b of els.modes) b.addEventListener('click', () => setMode(b.dataset.mode));

  els.explode.addEventListener('input', () => {
    state.explode = Number(els.explode.value);
    viewer?.setExplode(state.explode);
    if (state.mode !== 'explore') setMode('explore');
    else renderTitleblock();
  });
  els.labels.addEventListener('change', () => {
    state.labels = els.labels.checked;
    viewer?.setLabels(state.labels);
  });
  els.reset.addEventListener('click', () => viewer?.resetView());

  els.partsList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-part]');
    if (!btn) return;
    const p = partById(btn.dataset.part);
    if (p.onlyIn && !p.onlyIn.includes(state.mode)) setMode(p.onlyIn[0]);
    select(p.id);
  });
  els.partsList.addEventListener('pointerover', (e) => {
    viewer?.setHover(e.target.closest('[data-part]')?.dataset.part ?? null);
  });
  els.partsList.addEventListener('pointerleave', () => viewer?.setHover(null));

  window.addEventListener('hashchange', () => setDevice(location.hash.slice(1), { fromHash: true }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (tour?.isActive()) tour.stop();
      else if (state.selected) select(null);
      return;
    }
    if (!tour?.isActive() || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return; // e.g. Alt+← is browser Back
    if (e.target instanceof Element && e.target.closest('input, select, textarea, [contenteditable], .device-tabs')) return;
    e.preventDefault();
    if (e.key === 'ArrowRight') tour.next();
    else tour.back();
  });
  for (const b of els.tourStarts) {
    b.addEventListener('click', () => {
      if (!tour) return;
      if (!tour.isActive()) tour.start({ from: b });
      else if (b.hasAttribute('aria-pressed')) tour.stop();
      else tour.reveal();
    });
  }
}

function boot() {
  tour = createTourPlayer({
    els: {
      card: $('#tour-card'),
      progress: $('#tour-progress'),
      kicker: $('#tour-kicker'),
      title: $('#tour-title'),
      text: $('#tour-text'),
      back: $('#tour-back'),
      next: $('#tour-next'),
      exit: $('#tour-exit'),
      replay: $('#tour-replay'),
    },
    applyStep: applyTourStep,
    setVoltage,
    onChange: updateTourButtons,
  });
  wireUI();
  const fromHash = location.hash.slice(1);
  if (DEVICES[fromHash]) state.device = fromHash;
  if (window.innerWidth < 720) {
    state.labels = false;
    els.labels.checked = false;
  }
  try {
    viewer = new Viewer({
      viewport: $('#viewport'),
      canvas: $('#scene'),
      labelsEl: $('#labels'),
      leadersEl: $('#leaders'),
      onSelect: (id) => {
        state.selected = id;
        renderPartCard();
        markListSelection();
        revealPartCard();
      },
      reservedBottom: () => (els.titleblock.offsetHeight ? els.titleblock.offsetHeight + 16 : 0),
    });
    effects = new Effects(viewer);
    viewer.setLabels(state.labels);
    els.loading.hidden = true;
  } catch (err) {
    console.error(err);
    viewer = null;
    effects = null;
    els.loading.textContent = `The 3D view could not start (${err.message}). It needs WebGL, which may be turned off in this browser. The layer list and explanations still work.`;
    els.loading.classList.add('is-error');
  }
  window.__viewerBooted = true;
  // Read-only handle for the browser tests in tests/e2e/.
  window.__pageDebug = { state, viewer, effects, tour };
  setDevice(state.device, { fromHash: true });
}

boot();
