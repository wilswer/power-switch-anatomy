// The two charts of "Switching, step by step": the switched voltage and the
// filtered output over time, and the spectrum of both. One quantity per chart
// (volts over time; amplitude over frequency), so each has one y-axis; the
// filter's corner is a marked frequency, not a second axis. Series colors
// come from CSS classes; text uses the ink colors.

import { PWM, countAt } from './switching.js';

// Drawn at the figure's own pixel width, so text stays at its real size on a
// wide desktop and on a phone (the page redraws on resize).
const M = { l: 44, r: 12, t: 26, b: 34 };
const widthOf = (svg) => Math.max(280, Math.round(svg.parentElement?.clientWidth || 560));
const f1 = (n) => n.toFixed(1);

function niceStep(range, target) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}
const fmtNum = (x) => +x.toFixed(Math.abs(x) < 10 ? 2 : 0);

// Time axis in µs for DC (switching at 100 kHz), in ms for AC.
export const timeUnit = (mode) => (mode === 'dc' ? { k: 1e6, unit: 'µs' } : { k: 1e3, unit: 'ms' });
export const freqUnit = (mode) => (mode === 'dc' ? { k: 1e-3, unit: 'kHz' } : { k: 1, unit: 'Hz' });

// The key row; each item is [class, label, short label for narrow charts,
// 'band' for a shaded area instead of a line].
const keyWidth = (labels) => labels.reduce((w, l) => w + 18 + l.length * 6.6 + 16, 0);
function key(items, W) {
  const room = W - M.l - M.r;
  const short = keyWidth(items.map((i) => i[1])) > room;
  let s = '';
  let x = M.l;
  for (const [cls, label, brief, swatch] of items) {
    const text = short ? brief ?? label : label;
    s +=
      swatch === 'band'
        ? `<rect class="${cls}" x="${x}" y="4" width="14" height="12"/>`
        : `<line class="${cls}" x1="${x}" x2="${x + 14}" y1="10" y2="10"/>`;
    s += `<text class="wv-key" x="${x + 18}" y="13.5">${text}</text>`;
    x += 18 + text.length * 6.6 + 16;
  }
  return s;
}

function timeScales(view, W) {
  const H = 200;
  const { wave } = view;
  const y0 = view.mode === 'dc' ? -4 : -view.Vpk * 1.12;
  const y1 = view.mode === 'dc' ? view.Vin * 1.1 : view.Vpk * 1.12;
  const X = (t) => M.l + (t / wave.T) * (W - M.l - M.r);
  const Y = (v) => M.t + (1 - (v - y0) / (y1 - y0)) * (H - M.t - M.b);
  return { H, y0, y1, X, Y };
}

export function renderTime(svg, view) {
  const { wave, spec } = view;
  const W = widthOf(svg);
  svg.dataset.w = String(W);
  const sc = timeScales(view, W);
  const { H, y0, y1, X, Y } = sc;
  const tu = timeUnit(view.mode);
  const N = wave.v.length;
  const rect = view.mode === 'rect';
  let s = key(
    rect
      ? [
          ['sw-switched', 'switched'],
          ['sw-grid', 'grid voltage', 'grid'],
          ['sw-target', 'what the controller asks for', 'asked for'],
        ]
      : [
          ['sw-switched', 'switched'],
          ['sw-filtered', 'after the filter', 'filtered'],
          ['sw-target', 'what you asked for', 'asked for'],
        ],
    W,
  );
  const ys = niceStep(y1 - y0, 4);
  for (let v = Math.ceil(y0 / ys) * ys; v <= y1 + 1e-9; v += ys) {
    s += `<line class="${Math.abs(v) < 1e-9 ? 'fp-axis' : 'fp-grid'}" x1="${M.l}" x2="${W - M.r}" y1="${f1(Y(v))}" y2="${f1(Y(v))}"/>`;
    s += `<text class="fp-tick" x="${M.l - 6}" y="${f1(Y(v) + 3.5)}" text-anchor="end">${fmtNum(v)}</text>`;
  }
  const xs = niceStep(wave.T * tu.k, Math.max(3, Math.round(W / 110)));
  for (let t = 0; t <= wave.T * tu.k + 1e-9; t += xs) {
    s += `<text class="fp-tick" x="${f1(X(t / tu.k))}" y="${H - M.b + 14}" text-anchor="middle">${fmtNum(t)}</text>`;
  }
  s += `<text class="fp-axis-label" x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">Time (${tu.unit}) · voltage (V)</text>`;

  // The switched voltage as a step path: only its edges.
  let d = `M${f1(X(0))} ${f1(Y(wave.v[0]))}`;
  for (let i = 1; i < N; i++) {
    if (wave.v[i] === wave.v[i - 1]) continue;
    const x = f1(X(i * wave.dt));
    d += `H${x}V${f1(Y(wave.v[i]))}`;
  }
  d += `H${f1(X(wave.T))}`;
  s += `<path class="wv-line sw-switched" d="${d}"/>`;
  // What the modulator aims at: a constant, or the sine.
  const target = view.mode === 'dc' ? () => wave.target : (i) => wave.ref[i];
  const pts = (fn) => {
    const out = [];
    const step = Math.max(1, Math.floor(N / 700));
    for (let i = 0; i < N; i += step) out.push(`${f1(X(i * wave.dt))},${f1(Y(Math.max(y0, Math.min(y1, fn(i)))))}`);
    return `M${out.join('L')}`;
  };
  if (rect) s += `<path class="wv-line sw-grid" d="${pts((i) => wave.grid[i])}"/>`;
  s += `<path class="wv-line sw-target" d="${pts(target)}"/>`;
  if (!rect) s += `<path class="wv-line sw-filtered" d="${pts((i) => spec.y[i])}"/>`;
  s += `<line class="wv-cross" id="sw-time-cross" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/>`;
  s += `<rect class="hp-hit sw-time-hit" x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

// The stretches of time where the switch (in DC to AC, the upper switch) is
// on, as [start, end] in seconds: the runs where the switched voltage is at
// its high level.
export function onRuns(wave, high) {
  const runs = [];
  let start = null;
  for (let i = 0; i <= wave.v.length; i++) {
    const on = i < wave.v.length && wave.v[i] === high;
    if (on && start === null) start = i;
    if (!on && start !== null) {
      runs.push([start * wave.dt, i * wave.dt]);
      start = null;
    }
  }
  return runs;
}

// Behind the pulses: the controller's counter and its compare value, on the
// same time axis as the pulses, with the stretches where the switch is on.
export function renderPwm(svg, view) {
  const { wave } = view;
  const { pwm } = wave;
  const W = widthOf(svg);
  svg.dataset.w = String(W);
  const H = 160;
  const y0 = 0;
  const y1 = PWM.top * 1.08;
  const X = (t) => M.l + (t / wave.T) * (W - M.l - M.r);
  const Y = (c) => M.t + (1 - (c - y0) / (y1 - y0)) * (H - M.t - M.b);
  const tu = timeUnit(view.mode);
  const dc = view.mode === 'dc';
  let s = key(
    [
      ['sw-on', dc ? 'switch on' : 'upper switch on', 'on', 'band'],
      ['sw-count', 'counter'],
      ['sw-target', view.mode === 'rect' ? 'compare value (what the controller asks for)' : 'compare value (what you asked for)', 'compare value'],
    ],
    W,
  );
  for (const [a, b] of onRuns(wave, dc ? view.Vin : view.Vpk)) {
    s += `<rect class="sw-on sw-run" x="${f1(X(a))}" y="${M.t}" width="${f1(Math.max(0.5, X(b) - X(a)))}" height="${H - M.t - M.b}"/>`;
  }
  for (let c = 0; c <= PWM.top; c += PWM.top / 2) {
    s += `<line class="${c === 0 ? 'fp-axis' : 'fp-grid'}" x1="${M.l}" x2="${W - M.r}" y1="${f1(Y(c))}" y2="${f1(Y(c))}"/>`;
    s += `<text class="fp-tick" x="${M.l - 6}" y="${f1(Y(c) + 3.5)}" text-anchor="end">${c}</text>`;
  }
  const xs = niceStep(wave.T * tu.k, Math.max(3, Math.round(W / 110)));
  for (let t = 0; t <= wave.T * tu.k + 1e-9; t += xs) {
    s += `<text class="fp-tick" x="${f1(X(t / tu.k))}" y="${H - M.b + 14}" text-anchor="middle">${fmtNum(t)}</text>`;
  }
  s += `<text class="fp-axis-label" x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">Time (${tu.unit}) · counter value</text>`;

  // The counter, exactly: a sawtooth that drops back to 0 at the end of each
  // period, or a triangle that peaks in the middle of each period.
  const Tp = wave.T / pwm.periods;
  let d = `M${f1(X(0))} ${f1(Y(0))}`;
  for (let k = 0; k < pwm.periods; k++) {
    if (pwm.shape === 'saw') d += `L${f1(X((k + 1) * Tp))} ${f1(Y(PWM.top))}V${f1(Y(0))}`;
    else d += `L${f1(X((k + 0.5) * Tp))} ${f1(Y(PWM.top))}L${f1(X((k + 1) * Tp))} ${f1(Y(0))}`;
  }
  s += `<path class="wv-line sw-count" d="${d}"/>`;
  const N = pwm.compare.length;
  const step = Math.max(1, Math.floor(N / 700));
  const pts = [];
  for (let i = 0; i < N; i += step) pts.push(`${f1(X(i * wave.dt))},${f1(Y(pwm.compare[i]))}`);
  pts.push(`${f1(X(wave.T))},${f1(Y(pwm.compare[N - 1]))}`);
  s += `<path class="wv-line sw-target" d="M${pts.join('L')}"/>`;
  s += `<line class="wv-cross" id="sw-pwm-cross" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/>`;
  s += `<rect class="hp-hit sw-pwm-hit" x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

// AC to DC: the current drawn from the grid, and the sine it should be.
export function renderCurrent(svg, view) {
  const { wave, spec } = view;
  const W = widthOf(svg);
  svg.dataset.w = String(W);
  const H = 180;
  const N = spec.y.length;
  let top = wave.Ipk;
  for (const y of spec.y) top = Math.max(top, Math.abs(y));
  top *= 1.12;
  const X = (t) => M.l + (t / wave.T) * (W - M.l - M.r);
  const Y = (a) => M.t + (1 - (a + top) / (2 * top)) * (H - M.t - M.b);
  const tu = timeUnit(view.mode);
  let s = key(
    [
      ['sw-current', 'inductor current', 'current'],
      ['sw-target', 'what the controller aims for: in step with the grid voltage', 'aim'],
    ],
    W,
  );
  const ys = niceStep(2 * top, 4);
  for (let a = Math.ceil(-top / ys) * ys; a <= top + 1e-9; a += ys) {
    s += `<line class="${Math.abs(a) < 1e-9 ? 'fp-axis' : 'fp-grid'}" x1="${M.l}" x2="${W - M.r}" y1="${f1(Y(a))}" y2="${f1(Y(a))}"/>`;
    s += `<text class="fp-tick" x="${M.l - 6}" y="${f1(Y(a) + 3.5)}" text-anchor="end">${fmtNum(a)}</text>`;
  }
  const xs = niceStep(wave.T * tu.k, Math.max(3, Math.round(W / 110)));
  for (let t = 0; t <= wave.T * tu.k + 1e-9; t += xs) {
    s += `<text class="fp-tick" x="${f1(X(t / tu.k))}" y="${H - M.b + 14}" text-anchor="middle">${fmtNum(t)}</text>`;
  }
  s += `<text class="fp-axis-label" x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">Time (${tu.unit}) · current (A)</text>`;
  // Enough points to keep every ripple zigzag: a few per switching period.
  const step = Math.max(1, Math.floor(N / Math.max(700, 12 * wave.pwm.periods)));
  const path = (fn) => {
    const out = [];
    for (let i = 0; i < N; i += step) out.push(`${f1(X((i + 0.5) * wave.dt))},${f1(Y(fn(i)))}`);
    return `M${out.join('L')}`;
  };
  s += `<path class="wv-line sw-target" d="${path((i) => wave.want[i])}"/>`;
  s += `<path class="wv-line sw-current" d="${path((i) => spec.y[i])}"/>`;
  s += `<line class="wv-cross" id="sw-cur-cross" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/>`;
  s += `<rect class="hp-hit sw-cur-hit" x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

function specScales(view, W) {
  const H = 180;
  const top = Math.max(0, ...view.lines.map((l) => l.before)) * 1.12 || 1;
  const X = (f) => M.l + (f / view.fMax) * (W - M.l - M.r);
  const Y = (a) => M.t + (1 - a / top) * (H - M.t - M.b);
  return { H, top, X, Y };
}

// What each line in the spectrum is.
export function lineName(view, f) {
  const fu = freqUnit(view.mode);
  const at = `${fmtNum(f * fu.k)} ${fu.unit}`;
  if (f === 0) return `0 Hz: the average`;
  if (view.mode === 'dc') {
    const n = Math.round(f / view.fsw);
    return n === 1 ? `${at}: the switching frequency` : `${at}: ${n} × the switching frequency`;
  }
  if (Math.abs(f - view.fout) < 1e-9) return view.mode === 'rect' ? `${at}: the current in step with the grid` : `${at}: the sine you asked for`;
  const n = Math.round(f / view.fsw);
  if (n < 1) return `${at}: distortion`;
  const which = n === 1 ? 'the switching frequency' : `${n} × the switching frequency`;
  return Math.abs(f - n * view.fsw) < 1e-6 ? `${at}: ${which}` : `${at}: a sideband of ${which}`;
}

export function renderSpectrum(svg, view) {
  const W = widthOf(svg);
  svg.dataset.w = String(W);
  const { H, top, X, Y } = specScales(view, W);
  const fu = freqUnit(view.mode);
  const rect = view.mode === 'rect';
  let s = key(rect ? [['sw-after', 'inductor current', 'current']] : [
      ['sw-before', 'switched'],
      ['sw-after', 'after the filter', 'filtered'],
    ],
    W,
  );
  // Above the filter's corner, everything is cut down: shade it. (AC to DC
  // has no corner: the inductor passes less current the higher the frequency.)
  const xc = rect ? W - M.r : Math.min(W - M.r, X(view.fc));
  if (xc < W - M.r) {
    s += `<rect class="sw-cut" x="${f1(xc)}" y="${M.t}" width="${f1(W - M.r - xc)}" height="${H - M.t - M.b}"/>`;
    s += `<line class="sw-corner" x1="${f1(xc)}" x2="${f1(xc)}" y1="${M.t}" y2="${H - M.b}"/>`;
  }
  const right = xc > (M.l + W - M.r) * 0.62;
  const ys = niceStep(top, 4);
  for (let a = 0; a <= top + 1e-9; a += ys) {
    s += `<line class="${a === 0 ? 'fp-axis' : 'fp-grid'}" x1="${M.l}" x2="${W - M.r}" y1="${f1(Y(a))}" y2="${f1(Y(a))}"/>`;
    s += `<text class="fp-tick" x="${M.l - 6}" y="${f1(Y(a) + 3.5)}" text-anchor="end">${fmtNum(a)}</text>`;
  }
  const xs = niceStep(view.fMax * fu.k, Math.max(3, Math.round(W / 90)));
  for (let f = 0; f <= view.fMax * fu.k + 1e-9; f += xs) {
    s += `<text class="fp-tick" x="${f1(X(f / fu.k))}" y="${H - M.b + 14}" text-anchor="middle">${fmtNum(f)}</text>`;
  }
  s += `<text class="fp-axis-label" x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">Frequency (${fu.unit}) · ${rect ? 'current (A)' : 'amplitude (V)'}</text>`;
  for (const l of view.lines) {
    const x = f1(X(l.f));
    if (!rect) s += `<line class="sw-before sw-line" x1="${x}" x2="${x}" y1="${f1(Y(0))}" y2="${f1(Y(l.before))}"/>`;
    s += `<line class="sw-after sw-line" x1="${x}" x2="${x}" y1="${f1(Y(0))}" y2="${f1(Y(Math.max(l.after, top * 0.004)))}"/>`;
  }
  // The corner's label goes on top of the grid and the lines, with a halo (CSS).
  if (!rect) {
    s += `<text class="sw-corner-label" x="${f1(right ? xc - 4 : xc + 4)}" y="${M.t + 11}" text-anchor="${right ? 'end' : 'start'}">${
      xc < W - M.r ? `filter corner ${fmtNum(view.fc * fu.k)} ${fu.unit}: cut above` : `filter corner above ${fmtNum(view.fMax * fu.k)} ${fu.unit}`
    }</text>`;
  }
  // One hover area; the tooltip picks the nearest line (lines can sit a few pixels apart).
  s += `<line class="wv-cross" id="sw-spec-cross" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/>`;
  s += `<rect class="hp-hit sw-spec-hit" x="${M.l - 6}" y="${M.t}" width="${W - M.l - M.r + 12}" height="${H - M.t - M.b}"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

// Tooltips: a crosshair over time, shared by the pulses and the counter below
// them, and one per spectral line.
export function bindSwitchTooltips(timeFig, specFig, getView, pwmFig, curFig) {
  const tip = (fig) => {
    const el = document.createElement('div');
    el.className = 'hp-tip';
    el.hidden = true;
    fig.append(el);
    return el;
  };
  const place = (fig, el, e) => {
    const box = fig.getBoundingClientRect();
    const left = Math.min(e.clientX - box.left + 12, box.width - el.offsetWidth - 4);
    el.style.transform = `translate(${Math.max(4, left)}px, ${e.clientY - box.top - el.offsetHeight - 10}px)`;
  };
  const charts = [timeFig, pwmFig, curFig].filter(Boolean).map((fig) => ({ fig, svg: fig.querySelector('svg'), tip: tip(fig) }));
  const hideTime = () => {
    for (const c of charts) {
      c.tip.hidden = true;
      c.svg.querySelector('.wv-cross')?.setAttribute('visibility', 'hidden');
    }
  };
  const tipText = (c, view, t, i) => {
    const { wave, spec } = view;
    const tu = timeUnit(view.mode);
    const head = `<b>t = ${(t * tu.k).toFixed(view.mode === 'dc' ? 1 : 2)} ${tu.unit}</b>`;
    if (c.fig === curFig) {
      return `${head}<span>current: ${spec.y[i].toFixed(1)} A</span><span>aim: ${wave.want[i].toFixed(1)} A</span>`;
    }
    if (c.fig !== pwmFig) {
      return view.mode === 'rect'
        ? `${head}<span>switched: ${fmtNum(wave.v[i])} V</span><span>grid voltage: ${wave.grid[i].toFixed(0)} V</span>`
        : `${head}<span>switched: ${fmtNum(wave.v[i])} V</span><span>after the filter: ${spec.y[i].toFixed(1)} V</span>`;
    }
    const { pwm } = wave;
    const count = Math.round(countAt(pwm.shape, pwm.phase(i)));
    const compare = Math.round(pwm.compare[i]);
    const which = view.mode === 'dc' ? 'switch' : 'upper switch';
    const state = wave.v[i] > 0 ? `${which} on: the count is below` : `${which} off: the count is above`;
    return `${head}<span>counter: ${count}</span><span>compare value: ${compare}</span><span>${state}</span>`;
  };
  for (const c of charts) {
    c.svg.addEventListener('pointermove', (e) => {
      const view = getView();
      if (!view || !e.target.closest?.('.hp-hit')) return hideTime();
      const r = c.svg.getBoundingClientRect();
      const W = Number(c.svg.dataset.w);
      const x = (e.clientX - r.left) * (W / r.width);
      const { wave } = view;
      const t = ((x - M.l) / (W - M.l - M.r)) * wave.T;
      const i = Math.max(0, Math.min(wave.v.length - 1, Math.floor(t / wave.dt)));
      // The same moment in every time chart that is showing.
      for (const o of charts.filter((q) => !q.fig.hidden)) {
        const Wo = Number(o.svg.dataset.w);
        const xo = f1(M.l + (t / wave.T) * (Wo - M.l - M.r));
        const cross = o.svg.querySelector('.wv-cross');
        cross?.setAttribute('x1', xo);
        cross?.setAttribute('x2', xo);
        cross?.setAttribute('visibility', 'visible');
        if (o !== c) o.tip.hidden = true;
      }
      c.tip.innerHTML = tipText(c, view, t, i);
      c.tip.hidden = false;
      place(c.fig, c.tip, e);
    });
    c.svg.addEventListener('pointerleave', hideTime);
  }

  const sTip = tip(specFig);
  const sSvg = specFig.querySelector('svg');
  const hideSpec = () => {
    sTip.hidden = true;
    sSvg.querySelector('#sw-spec-cross')?.setAttribute('visibility', 'hidden');
  };
  sSvg.addEventListener('pointermove', (e) => {
    const view = getView();
    if (!view || !view.lines.length || !e.target.closest?.('.sw-spec-hit')) return hideSpec();
    const r = sSvg.getBoundingClientRect();
    const W = Number(sSvg.dataset.w);
    const X = (f) => M.l + (f / view.fMax) * (W - M.l - M.r);
    const x = (e.clientX - r.left) * (W / r.width);
    const l = view.lines.reduce((best, q) => (Math.abs(X(q.f) - x) < Math.abs(X(best.f) - x) ? q : best));
    if (Math.abs(X(l.f) - x) > 14) return hideSpec();
    const cross = sSvg.querySelector('#sw-spec-cross');
    cross.setAttribute('x1', f1(X(l.f)));
    cross.setAttribute('x2', f1(X(l.f)));
    cross.setAttribute('visibility', 'visible');
    const cut = l.before > 0 ? 1 - l.after / l.before : 0;
    sTip.innerHTML =
      view.mode === 'rect'
        ? `<b>${lineName(view, l.f)}</b><span>current: ${l.after.toFixed(l.after < 1 ? 2 : 1)} A</span>`
        : `<b>${lineName(view, l.f)}</b><span>switched: ${fmtNum(l.before)} V</span><span>after the filter: ${l.after.toFixed(l.after < 1 ? 2 : 1)} V${
            l.f > 0 && cut > 0.05 ? ` (${Math.round(cut * 100)} % removed)` : ''
          }</span>`;
    sTip.hidden = false;
    place(specFig, sTip, e);
  });
  sSvg.addEventListener('pointerleave', hideSpec);
  return {
    hide: () => {
      hideTime();
      hideSpec();
    },
  };
}
