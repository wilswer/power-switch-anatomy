import { DEVICES, DEVICE_ORDER } from './devices/index.js';
import { PACKAGES } from './packages/index.js';
import { APPS } from './apps/index.js';
import {
  KIND,
  ELECTRON,
  HOLE,
  CURRENT,
  GATE_CURRENT,
  FIELD_GRADIENT_CSS,
  THERMAL_GRADIENT_CSS,
} from './palette.js';
import { blockingResult, blockingStatus } from './physics.js';
import { thermalStack } from './thermal.js';
import { renderFieldPlot } from './fieldplot.js';
import { renderHeatPlot, bindHeatTooltip, fmtR, fmtT } from './heatplot.js';
import { renderWaves, bindWavesTooltip } from './wavesplot.js';
import { Viewer } from './viewer.js';
import { Effects } from './effects.js';
import { PackageEffects } from './package-effects.js';
import { createTourPlayer } from './tour-player.js';
import { FAILURES, FAILURE_GROUPS } from './failures.js';

const $ = (sel, root = document) => root.querySelector(sel);

// Each device is shown at three scales: one cell (devices/), the package it
// comes in (packages/), and a product it works in (apps/). Each scale has its
// own modes.
const MODELS = { cell: DEVICES, package: PACKAGES, app: APPS };
const MODES = {
  cell: [
    ['explore', 'Explore'],
    ['on', 'Gate ON'],
    ['block', 'Blocking'],
  ],
  package: [
    ['explore', 'Explore'],
    ['current', 'Current'],
    ['heat', 'Heat'],
  ],
  app: [
    ['explore', 'Explore'],
    ['action', 'In action'],
  ],
};
// Switching scale keeps a conducting view conducting; any other mode becomes Explore.
const CONDUCTING = { cell: 'on', package: 'current', app: 'action' };

const state = {
  device: 'sic',
  scale: 'cell', // 'cell' | 'package' | 'app'
  mode: 'explore', // cell: 'explore' | 'on' | 'block'; package: 'explore' | 'current' | 'heat'
  explode: 1,
  labels: true,
  selected: null,
  block: Object.fromEntries(
    DEVICE_ORDER.map((id) => [id, { V: DEVICES[id].blocking.Vrated, fieldPlate: true }]),
  ),
  heat: Object.fromEntries(Object.entries(PACKAGES).map(([id, p]) => [id, { P: p.heat.Pdefault }])),
  phase: Object.fromEntries(Object.entries(PACKAGES).map(([id, p]) => [id, p.current.phases?.[0].id ?? null])),
};

let viewer = null;
let effects = null;
let pkgEffects = null;
let tour = null;
let heatResult = null;

const els = {
  tabs: [...document.querySelectorAll('[data-device]')],
  scales: [...document.querySelectorAll('[data-scale]')],
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
const pkg = () => PACKAGES[state.device];
const app = () => APPS[state.device];
const model = () => MODELS[state.scale][state.device];
const partById = (id) => model().parts.find((p) => p.id === id);
const modeName = (mode) => Object.values(MODES).flat().find(([m]) => m === mode)?.[1] ?? mode;
const fmtField = (E) => `${(E / 1e6).toFixed(2)} MV/cm`;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- state changes ----------

function writeHash() {
  history.replaceState(null, '', `#${state.device}${state.scale === 'cell' ? '' : `/${state.scale}`}`);
}

function parseHash() {
  const [id, scale] = location.hash.slice(1).split('/');
  return { id, scale: MODELS[scale]?.[id] ? scale : 'cell' };
}

// Build the model for the current device and scale.
function loadModel() {
  tour?.stopSweep();
  state.selected = null;
  for (const t of els.tabs) {
    const on = t.dataset.device === state.device;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  }
  renderScaleSwitch();
  renderModeButtons();
  if (viewer) {
    const m = model();
    viewer.setDevice(m);
    effects.setDevice(state.scale === 'cell' ? m : null);
    pkgEffects.setModel(state.scale === 'cell' ? null : m);
    if (state.scale === 'package') pkgEffects.setPhase(state.phase[state.device]);
    viewer.setMode(state.mode);
    effects.setMode(state.mode);
    pkgEffects.setMode(state.mode);
  }
  renderAll();
}

function setDevice(id, { fromHash = false, scale = state.scale } = {}) {
  if (!DEVICES[id]) return;
  state.device = id;
  if (!MODELS[scale]?.[id]) scale = 'cell';
  if (scale !== state.scale) {
    state.mode = state.mode === CONDUCTING[state.scale] ? CONDUCTING[scale] : 'explore';
    state.scale = scale;
  }
  if (!fromHash) writeHash();
  loadModel();
}

function setScale(scale) {
  if (scale === state.scale || !MODELS[scale]?.[state.device]) return;
  setDevice(state.device, { scale });
}

function setMode(mode) {
  if (!MODES[state.scale].some(([m]) => m === mode)) mode = 'explore';
  tour?.stopSweep();
  state.mode = mode;
  renderModeButtons();
  const sel = state.selected && partById(state.selected);
  if (sel?.onlyIn && !sel.onlyIn.includes(mode)) state.selected = null;
  viewer?.select(state.selected);
  viewer?.setMode(mode);
  effects?.setMode(mode);
  pkgEffects?.setMode(mode);
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
  p.scrollTo({ top: els.partCard.offsetTop, behavior: reduceMotion() ? 'auto' : 'smooth' });
}

// ---------- tour ----------

// Put the page into the scene a tour step describes (see tour.js).
function applyTourStep(st) {
  if (st.block) Object.assign(state.block[st.device], st.block);
  if (st.heat) Object.assign(state.heat[st.device], st.heat);
  if (st.phase) state.phase[st.device] = st.phase;
  state.explode = st.explode;
  els.explode.value = String(st.explode);
  viewer?.setExplode(st.explode);
  if (state.device !== st.device || state.scale !== st.scale) setDevice(st.device, { scale: st.scale });
  else pkgEffects?.setPhase(state.phase[st.device]);
  setMode(st.mode); // also re-renders the panel with the step's settings
  select(st.focus);
  viewer?.flyTo(st.view, st.zoom);
}

// Used by the tour's sweeps; mirrors what dragging the slider does. It only
// touches the display when that step's view is still on screen.
function setSweepLevel(st, value) {
  if (st.sweep.what === 'P') {
    const { Pmax } = PACKAGES[st.device].heat;
    state.heat[st.device].P = Math.min(Pmax, Math.max(0, value));
    if (state.device !== st.device || state.scale !== 'package' || state.mode !== 'heat') return;
    const slider = $('#power');
    if (!slider) return;
    slider.value = String(state.heat[st.device].P);
    updateHeat();
    return;
  }
  const { Vmax } = DEVICES[st.device].blocking;
  state.block[st.device].V = Math.min(Vmax, Math.max(0, value));
  if (state.device !== st.device || state.scale !== 'cell' || state.mode !== 'block') return;
  const slider = $('#volt');
  if (!slider) return;
  slider.value = String(state.block[st.device].V);
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
  if (state.scale !== 'cell') {
    viewer?.setHiddenParts([]);
    return;
  }
  const b = device().blocking;
  const hide = Boolean(b.fieldPlatePart) && state.mode === 'block' && !state.block[state.device].fieldPlate;
  viewer?.setHiddenParts(hide ? [b.fieldPlatePart] : []);
  if (hide && state.selected === b.fieldPlatePart) select(null);
}

// ---------- controls ----------

function renderScaleSwitch() {
  for (const b of els.scales) {
    const { scale } = b.dataset;
    const m = MODELS[scale][state.device];
    b.setAttribute('aria-pressed', String(scale === state.scale));
    b.disabled = !m;
    b.querySelector('.scale-meta').textContent = !m ? 'not drawn' : scale === 'cell' ? m.drawing.cell : m.short;
  }
}

function renderModeButtons() {
  const modes = MODES[state.scale];
  els.modes.forEach((b, i) => {
    b.hidden = i >= modes.length;
    if (b.hidden) return;
    const [mode, label] = modes[i];
    b.dataset.mode = mode;
    b.textContent = label;
    b.setAttribute('aria-pressed', String(mode === state.mode));
  });
}

// ---------- panel ----------

function renderAll() {
  els.panel.scrollTop = 0;
  heatResult = null;
  renderModeCard();
  renderPartCard();
  renderPartsList();
  renderLegend();
  renderTitleblock();
  syncHiddenParts();
  els.tourReadout.hidden = state.mode !== 'block' && state.mode !== 'heat';
}

function renderModeCard() {
  if (state.scale === 'app') {
    if (state.mode === 'action') renderActionCard();
    else renderAppCard();
    return;
  }
  if (state.scale === 'package') {
    if (state.mode === 'current') renderCurrentCard();
    else if (state.mode === 'heat') renderHeatCard();
    else renderPackageCard();
    return;
  }
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

function renderPackageCard() {
  const p = pkg();
  els.modeCard.innerHTML = `
    <p class="kicker">${p.kicker}</p>
    <h2>${p.name}</h2>
    <p class="sub">${p.subtitle}</p>
    <ol class="ladder" aria-label="From cell to package">${p.ladder
      .map(([k, v], i) => `<li><span class="rung">${i + 1}</span><b>${k}</b><span>${v}</span></li>`)
      .join('')}</ol>
    ${p.summary.map((t) => `<p>${t}</p>`).join('')}
    <dl class="stats">${p.stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <p><button type="button" class="ghost jump" data-scale-jump="app">See it at work: ${app().name} →</button></p>`;
  $('[data-scale-jump]', els.modeCard).addEventListener('click', () => setScale('app'));
}

// The product's conversion chain: forms of electricity and the converters
// between them, with the stages that use this device's switch marked.
function renderChain(chain) {
  const short = pkg().short; // "TO-247-4" stays as is, "Power module" reads "power module"
  const name = /^[A-Z][a-z]/.test(short) ? short[0].toLowerCase() + short.slice(1) : short;
  return `<h4>How it converts</h4>
    <ol class="chain">${chain
      .map((c) =>
        c.node
          ? `<li class="chain-node"><b>${c.node}</b><span>${c.value}</span></li>`
          : `<li class="chain-conv${c.ours ? ' is-ours' : ''}"><b>${c.conv}</b><span>${c.how}</span>${
              c.ours ? `<em>uses the ${name} from the package view</em>` : ''
            }</li>`,
      )
      .join('')}</ol>`;
}

function renderAppCard() {
  const a = app();
  els.modeCard.innerHTML = `
    <p class="kicker">${a.kicker}</p>
    <h2>${a.name}</h2>
    <p class="sub">${a.subtitle}</p>
    ${renderChain(a.chain)}
    ${a.summary.map((t) => `<p>${t}</p>`).join('')}
    <dl class="stats">${a.stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <p><button type="button" class="ghost jump" data-mode-jump>Switch it on: In action →</button></p>`;
  $('[data-mode-jump]', els.modeCard).addEventListener('click', () => setMode('action'));
}

function renderActionCard() {
  const a = app().action;
  els.modeCard.innerHTML = `
    <p class="kicker">In action · power flowing</p>
    <h2>${a.title}</h2>
    <ol class="steps">${a.stages.map((s) => `<li><span>${s}</span></li>`).join('')}</ol>
    <p class="carriers">
      <span><i class="dot" style="--dot:${CURRENT}"></i>Power flow</span>
      <span><i class="flash"></i>Switching</span>
    </p>
    <figure class="plot waves-plot">
      <svg id="waves-plot" role="img" aria-label="${a.waves.panels.map((p) => p.title).join(' and ')} over time"></svg>
      <figcaption>${a.waves.caption}</figcaption>
    </figure>
    ${a.text.map((t) => `<p>${t}</p>`).join('')}
    <p class="note">${a.note}</p>`;
  renderWaves($('#waves-plot'), a.waves);
  bindWavesTooltip($('.waves-plot'), $('#waves-plot'), a.waves);
}

function renderCurrentCard() {
  const p = pkg();
  const c = p.current;
  const phase = state.phase[state.device];
  const phaseSwitch = c.phases
    ? `<div class="seg small phases" role="group" aria-label="Switching state">${c.phases
        .map((ph) => `<button type="button" data-phase="${ph.id}" aria-pressed="${ph.id === phase}">${ph.label}</button>`)
        .join('')}</div>`
    : '';
  const steps = c.phases ? c.phases.find((ph) => ph.id === phase).steps : c.steps;
  els.modeCard.innerHTML = `
    <p class="kicker">Current · switched on</p>
    <h2>${c.title}</h2>
    ${phaseSwitch}
    <ol class="steps">${steps.map((s) => `<li><span>${s}</span></li>`).join('')}</ol>
    <p class="carriers">
      <span><i class="dot" style="--dot:${CURRENT}"></i>Load current</span>
      <span><i class="dot" style="--dot:${GATE_CURRENT}"></i>Gate-drive current</span>
    </p>
    <p class="note">${c.note}</p>`;
  for (const b of els.modeCard.querySelectorAll('[data-phase]')) {
    b.addEventListener('click', () => {
      state.phase[state.device] = b.dataset.phase;
      pkgEffects?.setPhase(b.dataset.phase);
      renderCurrentCard();
    });
  }
}

function renderHeatCard() {
  const h = pkg().heat;
  const s = state.heat[state.device];
  els.modeCard.innerHTML = `
    <p class="kicker">Heat · steady state</p>
    <h2>${h.title}</h2>
    <div class="volt">
      <div class="volt-head"><label for="power">Power lost in the die</label><output id="power-out" for="power"></output></div>
      <input type="range" id="power" min="0" max="${h.Pmax}" step="${h.Pstep ?? 1}" value="${s.P}">
      <div class="volt-scale"><span>0 W</span><span>${h.Pmax} W</span></div>
      <p class="volt-note">${h.loadNote}</p>
    </div>
    <p class="status" id="heat-status"></p>
    <dl class="stats readouts" id="heat-readouts"></dl>
    <figure class="plot heat-plot">
      <svg id="heat-plot" role="img" aria-label="Temperature drop across each layer of the heat path"></svg>
      <figcaption>Each column is one layer, from its top to its bottom temperature. The tallest column is the layer that costs the most.</figcaption>
    </figure>
    <div class="ramp"><span>${h.Tref} °C</span><i style="background:${THERMAL_GRADIENT_CSS}"></i><span>${h.Tmax} °C</span></div>
    <table class="layer-table" id="heat-table"></table>
    ${h.text.map((t) => `<p>${t}</p>`).join('')}
    <p class="note">A one-dimensional model: heat fans out at 45° through each layer, conductivities are room-temperature values, and the ${h.refName.toLowerCase()} is held at ${h.Tref} °C. Real hot devices run somewhat hotter.</p>`;
  $('#power').addEventListener('input', (e) => {
    tour?.stopSweep();
    s.P = Number(e.target.value);
    updateHeat();
  });
  bindHeatTooltip($('.heat-plot'), $('#heat-plot'), () => heatResult);
  updateHeat();
}

function updateHeat() {
  const h = pkg().heat;
  const s = state.heat[state.device];
  const r = thermalStack({ source: h.source, layers: h.layers, P: s.P, Tref: h.Tref });
  heatResult = r;
  $('#power-out').textContent = `${s.P} W`;

  const over = r.Tj >= h.Tmax;
  const near = r.Tj >= h.Tmax - 0.15 * (h.Tmax - h.Tref);
  const status = $('#heat-status');
  status.className = `status ${over ? 'is-danger' : near ? 'is-warn' : 'is-ok'}`;
  status.textContent = over
    ? `Too hot: the junction is past its ${h.Tmax} °C limit`
    : `Junction at ${Math.round(r.Tj)} °C, ${Math.round(h.Tmax - r.Tj)} K below the ${h.Tmax} °C limit`;
  els.tourReadout.textContent = `${s.P} W · junction ${Math.round(r.Tj)} °C · limit ${h.Tmax} °C`;

  const biggest = r.layers.reduce((m, l) => (l.dT > m.dT ? l : m));
  const rows = [
    ['Junction temperature', `${Math.round(r.Tj)} °C`],
    ['R<sub>th</sub> junction to case', `${fmtR(r.Rjc)} K/W (the datasheet value)`],
    [`R<sub>th</sub> junction to ${h.refName.toLowerCase()}`, `${fmtR(r.Rtotal)} K/W`],
    ['Biggest step', `${biggest.name}, ${Math.round((biggest.R / r.Rtotal) * 100)} % of the rise`],
  ];
  $('#heat-readouts').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const row = (l) =>
    `<tr><th scope="row">${l.name}</th><td>${fmtT(l.t)}</td><td>${l.k}</td><td>${l.dT.toFixed(1)} K</td></tr>`;
  const group = (title, ls) =>
    ls.length ? `<tbody><tr class="group"><th scope="rowgroup" colspan="4">${title}</th></tr>${ls.map(row).join('')}</tbody>` : '';
  $('#heat-table').innerHTML = `
    <thead><tr><th scope="col">Layer</th><th scope="col">Thickness</th><th scope="col">k, W/(m·K)</th><th scope="col">ΔT</th></tr></thead>
    ${group('Inside the package', r.layers.filter((l) => l.inPackage))}
    ${group('Mounting', r.layers.filter((l) => !l.inPackage))}`;
  renderHeatPlot($('#heat-plot'), r, h);
  pkgEffects?.setHeat(r, h);
  renderLegend();
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

  const st = blockingStatus(b, r);
  const status = $('#block-status');
  status.className = `status is-${st.level}`;
  status.textContent = st.text;
  // The same numbers in short, inside the tour card, for layouts where the panel is out of sight.
  els.tourReadout.textContent = `${s.V} V · peak ${fmtField(r.Epk)} · ${st.short}`;

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
    const what = state.scale === 'cell' ? 'layer' : 'part';
    els.partCard.innerHTML = `<p class="hint-card">Click any ${what} in the drawing, or a name in the list below, to see what it is and why it is there.</p>`;
    return;
  }
  const k = KIND[p.kind];
  const link = p.info.link;
  const LINK_LABELS = { cell: 'Open the cell view', package: 'See it in the package', app: 'See it at work' };
  const linkLabel = link && (link.label ?? LINK_LABELS[link.scale]);
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
    <p>${p.info.why}</p>
    ${p.info.look ? `<h4>Look for it</h4><p>${p.info.look}</p>` : ''}
    ${renderPartFailures(p.id)}
    ${link ? `<p><button type="button" class="ghost jump" data-jump>${linkLabel} →</button></p>` : ''}`;
  $('.close', els.partCard).addEventListener('click', () => select(null));
  $('[data-jump]', els.partCard)?.addEventListener('click', () => {
    setScale(link.scale);
    setMode('explore');
    if (link.part) select(link.part);
  });
}

function renderPartsList() {
  const items = model()
    .parts.filter((p) => !p.pickAs)
    .slice()
    .reverse();
  const title = state.scale === 'cell' ? 'Layers, top to bottom' : 'Parts, top to bottom';
  els.partsList.innerHTML = `
    <h4 class="list-title">${title}</h4>
    <ul class="parts">${items
      .map((p) => {
        const tag = p.onlyIn ? `<span class="tag">${modeName(p.onlyIn[0])}</span>` : p.group < 0 ? `<span class="tag">mounting</span>` : '';
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
  const dot = (color) => `<i class="dot" style="--dot:${color}"></i>`;
  let html;
  if (state.scale === 'app') {
    const a = app();
    const switchKind = a.parts.find((q) => q.id === a.legendSwitch).kind;
    html = `<p class="lg-title">Key</p>
      <div class="row">${sw(switchKind)}<span>the power switches</span></div>`;
    if (state.mode === 'action') {
      html += `<div class="row">${dot(CURRENT)}power flow</div><div class="row"><i class="flash"></i>switching (slowed)</div>`;
    }
    els.legend.innerHTML = html;
    return;
  }
  if (state.scale === 'package') {
    const p = pkg();
    if (state.mode === 'heat') {
      const h = p.heat;
      html = `<p class="lg-title">Temperature</p>
        <div class="lg-ramp"><i style="background:${THERMAL_GRADIENT_CSS}"></i></div>
        <div class="row lg-ends"><span>${h.Tref} °C</span><span>${h.Tmax} °C</span></div>`;
    } else {
      html = `<p class="lg-title">Key</p>
        <div class="row">${sw('copper')}<span>copper</span>${sw('aluminum')}<span>aluminum</span></div>
        <div class="row">${sw('solder')}<span>solder</span>${sw(p.legendDie)}<span>die</span></div>`;
      if (state.mode === 'current') {
        html += `<div class="row">${dot(CURRENT)}load${dot(GATE_CURRENT)}gate</div>`;
      }
    }
    els.legend.innerHTML = html;
    return;
  }
  const d = device();
  html =
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
    html += `<div class="row">${dot(ELECTRON)}electrons${d.gateOn.holes ? `${dot(HOLE)}holes` : ''}</div>`;
  }
  els.legend.innerHTML = html;
}

function renderTitleblock() {
  const d = model();
  const look = viewer?.look() ?? { explode: state.mode === 'explore' ? 'user' : 0, xray: state.mode !== 'explore' };
  const exploded = look.explode === 'user' ? state.explode > 0.02 : look.explode > 0.02;
  const view = [
    'ISO',
    exploded ? 'EXPLODED' : 'ASSEMBLED',
    look.xray ? 'X-RAY' : null,
    state.mode === 'heat' ? 'HEAT' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  els.titleblock.innerHTML = `
    <div><span>DWG</span><b>${d.drawing.code}</b></div>
    <div><span>SCALE</span><b title="Not to scale">NTS</b></div>
    <div><span>VIEW</span><b>${view}</b></div>
    <div><span>${d.drawing.sizeLabel ?? 'CELL'}</span><b>${d.drawing.size ?? d.drawing.cell}</b></div>`;
}

// ---------- failure modes ----------

const failuresOf = (partId) =>
  FAILURES.filter((f) => f.parts.some(([d, sc, id]) => d === state.device && sc === state.scale && id === partId));

function renderPartFailures(partId) {
  const fs = failuresOf(partId);
  if (!fs.length) return '';
  return `<h4>How it can fail</h4>
    <ul class="fails">${fs.map((f) => `<li><a href="#fm-${f.id}" data-fm="${f.id}">${f.title}</a></li>`).join('')}</ul>`;
}

function renderFailures() {
  const list = $('#fm-list');
  if (!list) return;
  const tag = (id) => `<span class="tag">${DEVICES[id].name}</span>`;
  const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  list.innerHTML = FAILURE_GROUPS.map(
    (g) => `<section class="fm-group" data-group="${g.id}">
      <h3 class="fm-group-title">${g.title}</h3>
      <p class="fm-group-intro">${g.intro}</p>
      <div class="fm-cards">${FAILURES.filter((f) => f.group === g.id)
        .map(
          (f) => `<article class="fm-card" id="fm-${f.id}" data-devices="${f.devices.join(' ')}">
            <p class="fm-where">${f.where}</p>
            <h4>${f.title}</h4>
            <p class="fm-tags">${f.devices.map(tag).join('')}</p>
            <dl class="fm-facts">
              ${row('What happens', f.what)}
              ${row('What drives it', f.driven)}
              ${row('What you can measure', f.measure)}
              ${row('How it is prevented', f.prevent)}
              ${row('How it is tested', f.test)}
            </dl>
            <button type="button" class="ghost jump" data-fm-show="${f.id}">See where in 3D →</button>
          </article>`,
        )
        .join('')}</div>
    </section>`,
  ).join('');
}

function filterFailures(device) {
  for (const b of document.querySelectorAll('[data-fm-filter]')) {
    b.setAttribute('aria-pressed', String(b.dataset.fmFilter === device));
  }
  for (const c of document.querySelectorAll('.fm-card')) {
    c.hidden = device !== 'all' && !c.dataset.devices.split(' ').includes(device);
  }
  for (const g of document.querySelectorAll('.fm-group')) g.hidden = !g.querySelector('.fm-card:not([hidden])');
}

// Jump from a failure card to the 3D view that shows it.
function showFailure(id) {
  const { show } = FAILURES.find((f) => f.id === id);
  if (tour?.isActive()) tour.stop();
  setDevice(show.device, { scale: show.scale });
  setMode(show.mode);
  select(show.part);
  $('.stage').scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
}

// Jump from a part card to a failure card, without touching the URL (its hash holds the view).
function revealFailure(id) {
  filterFailures('all');
  const card = $(`#fm-${id}`);
  card.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
  card.classList.add('is-flash');
  setTimeout(() => card.classList.remove('is-flash'), 2000);
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
  for (const b of els.scales) b.addEventListener('click', () => setScale(b.dataset.scale));
  for (const b of els.modes) b.addEventListener('click', () => setMode(b.dataset.mode));

  els.explode.addEventListener('input', () => {
    state.explode = Number(els.explode.value);
    viewer?.setExplode(state.explode);
    if (viewer && viewer.look().explode !== 'user') setMode('explore');
    else renderTitleblock();
  });
  els.labels.addEventListener('change', () => {
    state.labels = els.labels.checked;
    viewer?.setLabels(state.labels);
  });
  els.reset.addEventListener('click', () => viewer?.resetView());

  for (const b of document.querySelectorAll('[data-fm-filter]')) {
    b.addEventListener('click', () => filterFailures(b.dataset.fmFilter));
  }
  $('#fm-list')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fm-show]');
    if (b) showFailure(b.dataset.fmShow);
  });
  els.partCard.addEventListener('click', (e) => {
    const a = e.target.closest('[data-fm]');
    if (!a) return;
    e.preventDefault();
    revealFailure(a.dataset.fm);
  });

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

  window.addEventListener('hashchange', () => {
    const { id, scale } = parseHash();
    setDevice(id, { fromHash: true, scale });
  });
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
      sizer: $('#tour-sizer'),
    },
    applyStep: applyTourStep,
    setLevel: setSweepLevel,
    onChange: updateTourButtons,
  });
  renderFailures();
  wireUI();
  const fromHash = parseHash();
  if (DEVICES[fromHash.id]) {
    state.device = fromHash.id;
    state.scale = fromHash.scale;
  }
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
    pkgEffects = new PackageEffects(viewer);
    viewer.setLabels(state.labels);
    els.loading.hidden = true;
  } catch (err) {
    console.error(err);
    viewer = null;
    effects = null;
    pkgEffects = null;
    els.loading.textContent = `The 3D view could not start (${err.message}). It needs WebGL, which may be turned off in this browser. The part list and explanations still work.`;
    els.loading.classList.add('is-error');
  }
  window.__viewerBooted = true;
  // Read-only handle for the browser tests in tests/e2e/.
  window.__pageDebug = { state, viewer, effects, pkgEffects, tour, heat: () => heatResult };
  setDevice(state.device, { fromHash: true, scale: state.scale });
}

boot();
