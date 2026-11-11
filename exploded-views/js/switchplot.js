// The two charts of "Switching, step by step": the switched voltage and the
// filtered output over time, and the spectrum of both. One quantity per chart
// (volts over time; amplitude over frequency), so each has one y-axis; the
// filter's corner is a marked frequency, not a second axis. Series colors
// come from CSS classes; text uses the ink colors.

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

// The key row; each item is [class, label, short label for narrow charts].
const keyWidth = (labels) => labels.reduce((w, l) => w + 18 + l.length * 6.6 + 16, 0);
function key(items, W) {
  const room = W - M.l - M.r;
  const short = keyWidth(items.map((i) => i[1])) > room;
  let s = '';
  let x = M.l;
  for (const [cls, label, brief] of items) {
    const text = short ? brief ?? label : label;
    s += `<line class="${cls}" x1="${x}" x2="${x + 14}" y1="10" y2="10"/>`;
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
  let s = key(
    [
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
  s += `<path class="wv-line sw-target" d="${pts(target)}"/>`;
  s += `<path class="wv-line sw-filtered" d="${pts((i) => spec.y[i])}"/>`;
  s += `<line class="wv-cross" id="sw-time-cross" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/>`;
  s += `<rect class="hp-hit sw-time-hit" x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

function specScales(view, W) {
  const H = 180;
  const top = Math.max(...view.lines.map((l) => l.before)) * 1.12 || 1;
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
  if (Math.abs(f - view.fout) < 1e-9) return `${at}: the sine you asked for`;
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
  let s = key(
    [
      ['sw-before', 'switched'],
      ['sw-after', 'after the filter', 'filtered'],
    ],
    W,
  );
  // Above the filter's corner, everything is cut down: shade it.
  const xc = Math.min(W - M.r, X(view.fc));
  if (xc < W - M.r) {
    s += `<rect class="sw-cut" x="${f1(xc)}" y="${M.t}" width="${f1(W - M.r - xc)}" height="${H - M.t - M.b}"/>`;
    s += `<line class="sw-corner" x1="${f1(xc)}" x2="${f1(xc)}" y1="${M.t}" y2="${H - M.b}"/>`;
  }
  const right = xc > (M.l + W - M.r) * 0.62;
  s += `<text class="sw-corner-label" x="${f1(right ? xc - 4 : xc + 4)}" y="${M.t + 11}" text-anchor="${right ? 'end' : 'start'}">${
    xc < W - M.r ? `filter corner ${fmtNum(view.fc * fu.k)} ${fu.unit}: cut above` : `filter corner above ${fmtNum(view.fMax * fu.k)} ${fu.unit}`
  }</text>`;
  const ys = niceStep(top, 4);
  for (let a = 0; a <= top + 1e-9; a += ys) {
    s += `<line class="${a === 0 ? 'fp-axis' : 'fp-grid'}" x1="${M.l}" x2="${W - M.r}" y1="${f1(Y(a))}" y2="${f1(Y(a))}"/>`;
    s += `<text class="fp-tick" x="${M.l - 6}" y="${f1(Y(a) + 3.5)}" text-anchor="end">${fmtNum(a)}</text>`;
  }
  const xs = niceStep(view.fMax * fu.k, Math.max(3, Math.round(W / 90)));
  for (let f = 0; f <= view.fMax * fu.k + 1e-9; f += xs) {
    s += `<text class="fp-tick" x="${f1(X(f / fu.k))}" y="${H - M.b + 14}" text-anchor="middle">${fmtNum(f)}</text>`;
  }
  s += `<text class="fp-axis-label" x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">Frequency (${fu.unit}) · amplitude (V)</text>`;
  for (const l of view.lines) {
    const x = f1(X(l.f));
    s += `<line class="sw-before" x1="${x}" x2="${x}" y1="${f1(Y(0))}" y2="${f1(Y(l.before))}"/>`;
    s += `<line class="sw-after" x1="${x}" x2="${x}" y1="${f1(Y(0))}" y2="${f1(Y(Math.max(l.after, top * 0.004)))}"/>`;
  }
  // One hover area; the tooltip picks the nearest line (lines can sit a few pixels apart).
  s += `<line class="wv-cross" id="sw-spec-cross" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/>`;
  s += `<rect class="hp-hit sw-spec-hit" x="${M.l - 6}" y="${M.t}" width="${W - M.l - M.r + 12}" height="${H - M.t - M.b}"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

// Tooltips: a crosshair over time, and one per spectral line.
export function bindSwitchTooltips(timeFig, specFig, getView) {
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
  const tTip = tip(timeFig);
  const tSvg = timeFig.querySelector('svg');
  tSvg.addEventListener('pointermove', (e) => {
    const view = getView();
    const cross = tSvg.querySelector('#sw-time-cross');
    const r = tSvg.getBoundingClientRect();
    const W = Number(tSvg.dataset.w);
    const x = (e.clientX - r.left) * (W / r.width);
    if (!view || !e.target.closest?.('.sw-time-hit')) {
      tTip.hidden = true;
      cross?.setAttribute('visibility', 'hidden');
      return;
    }
    const { wave, spec } = view;
    const t = ((x - M.l) / (W - M.l - M.r)) * wave.T;
    const i = Math.max(0, Math.min(wave.v.length - 1, Math.floor(t / wave.dt)));
    const tu = timeUnit(view.mode);
    cross.setAttribute('x1', f1(x));
    cross.setAttribute('x2', f1(x));
    cross.setAttribute('visibility', 'visible');
    tTip.innerHTML = `<b>t = ${(t * tu.k).toFixed(view.mode === 'dc' ? 1 : 2)} ${tu.unit}</b><span>switched: ${fmtNum(wave.v[i])} V</span><span>after the filter: ${spec.y[i].toFixed(1)} V</span>`;
    tTip.hidden = false;
    place(timeFig, tTip, e);
  });
  tSvg.addEventListener('pointerleave', () => {
    tTip.hidden = true;
    tSvg.querySelector('#sw-time-cross')?.setAttribute('visibility', 'hidden');
  });

  const sTip = tip(specFig);
  const sSvg = specFig.querySelector('svg');
  const hideSpec = () => {
    sTip.hidden = true;
    sSvg.querySelector('#sw-spec-cross')?.setAttribute('visibility', 'hidden');
  };
  sSvg.addEventListener('pointermove', (e) => {
    const view = getView();
    if (!view || !e.target.closest?.('.sw-spec-hit')) return hideSpec();
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
    sTip.innerHTML = `<b>${lineName(view, l.f)}</b><span>switched: ${fmtNum(l.before)} V</span><span>after the filter: ${l.after.toFixed(l.after < 1 ? 2 : 1)} V${
      l.f > 0 && cut > 0.05 ? ` (${Math.round(cut * 100)} % removed)` : ''
    }</span>`;
    sTip.hidden = false;
    place(specFig, sTip, e);
  });
  sSvg.addEventListener('pointerleave', hideSpec);
}
