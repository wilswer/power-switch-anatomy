import { EOL } from './aging.js';

// The simulated power-cycling test: how R_th(j-c) and the on-state voltage
// drift, in percent of their starting values, cycle by cycle, until one of
// them reaches its end-of-life line. Both are a percent change, so they share
// one axis. Earlier devices stay in the background, faded, to show the
// scatter. Series colors come from CSS classes; text uses the ink colors.
// Hovering shows a crosshair with the values for the latest device.

const W = 340;
const H = 210;
const M = { l: 34, r: 12, t: 26, b: 34 };

const f = (n) => n.toFixed(1);
function niceStep(range, target) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}
export const fmtCycles = (N) =>
  N >= 1e6 ? `${+(N / 1e6).toFixed(N >= 1e7 ? 0 : 1)}M` : N >= 1e3 ? `${Math.round(N / 1e3)}k` : `${Math.round(N)}`;

function scales(runs) {
  const xMax = Math.max(...runs.map((r) => r.end?.N ?? r.points.at(-1).N)) * 1.04 || 1;
  const top = Math.max(...runs.flatMap((r) => r.points.map((p) => Math.max(p.dR, p.dV)))) * 100;
  const yMax = Math.min(40, Math.max(25, Math.ceil(top / 5) * 5));
  const X = (N) => M.l + (N / xMax) * (W - M.l - M.r);
  const Y = (pct) => M.t + (1 - Math.min(yMax, Math.max(0, pct)) / yMax) * (H - M.t - M.b);
  return { xMax, yMax, X, Y };
}

// A run's two curves: R_th grows smoothly; the voltage jumps when a wire lifts.
function paths(run, { X, Y }) {
  let rth = '';
  let von = '';
  run.points.forEach((p, i) => {
    const x = f(X(p.N));
    rth += `${i ? 'L' : 'M'}${x} ${f(Y(p.dR * 100))}`;
    const prev = run.points[i - 1];
    if (prev && prev.lifted !== p.lifted) von += `L${x} ${f(Y(prev.dV * 100))}`;
    von += `${i ? 'L' : 'M'}${x} ${f(Y(p.dV * 100))}`;
  });
  return { rth, von };
}

export function renderCyclePlot(svg, runs, { vLabel }) {
  const sc = scales(runs);
  const { X, Y, xMax, yMax } = sc;
  let s = '';
  // Key.
  const key = [
    ['rth', 'R<tspan baseline-shift="sub" font-size="75%">th(j-c)</tspan>'],
    ['von', `${vLabel.replace(/<sub>(.*?)<\/sub>/, '<tspan baseline-shift="sub" font-size="75%">$1</tspan>')}, hot`],
  ];
  let kx = M.l;
  for (const [cls, label] of key) {
    s += `<line class="cy-${cls}" x1="${kx}" x2="${kx + 14}" y1="10" y2="10"/>`;
    s += `<text class="wv-key" x="${kx + 18}" y="13.5">${label}</text>`;
    kx += 104;
  }
  // Grid and axes.
  const ys = niceStep(yMax, 4);
  for (let v = 0; v <= yMax + 1e-9; v += ys) {
    s += `<line class="${v === 0 ? 'fp-axis' : 'fp-grid'}" x1="${M.l}" x2="${W - M.r}" y1="${f(Y(v))}" y2="${f(Y(v))}"/>`;
    s += `<text class="fp-tick" x="${M.l - 5}" y="${f(Y(v) + 3.5)}" text-anchor="end">+${v}%</text>`;
  }
  const xs = niceStep(xMax, 4);
  for (let N = 0; N <= xMax + 1e-9; N += xs) {
    s += `<text class="fp-tick" x="${f(X(N))}" y="${H - M.b + 14}" text-anchor="middle">${fmtCycles(N)}</text>`;
  }
  s += `<text class="fp-axis-label" x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">Power cycles</text>`;
  // End-of-life lines, in their series' colors.
  for (const [cls, pct, label] of [
    ['rth', EOL.Rth * 100, 'R<tspan baseline-shift="sub" font-size="75%">th</tspan> end of life'],
    ['von', EOL.Von * 100, 'voltage end of life'],
  ]) {
    s += `<line class="cy-eol cy-${cls}" x1="${M.l}" x2="${W - M.r}" y1="${f(Y(pct))}" y2="${f(Y(pct))}"/>`;
    s += `<text class="cy-eol-label" x="${M.l + 4}" y="${f(Y(pct) - 3)}">${label} +${pct}%</text>`;
  }
  // Earlier devices, faded, then the latest one on top.
  runs.forEach((run, i) => {
    const latest = i === runs.length - 1;
    const p = paths(run, sc);
    const past = latest ? '' : ' is-past';
    s += `<path class="cy-line cy-rth${past}" d="${p.rth}"/><path class="cy-line cy-von${past}" d="${p.von}"/>`;
    if (!run.end) return;
    const x = f(X(run.end.N));
    if (!latest) {
      s += `<line class="cy-fail is-past" x1="${x}" x2="${x}" y1="${H - M.b - 5}" y2="${H - M.b}"/>`;
      return;
    }
    // The latest device's end of life: a line in the plot, the count in the key row.
    s += `<line class="cy-fail" x1="${x}" x2="${x}" y1="${M.t}" y2="${H - M.b}"/>`;
    s += `<text class="cy-fail-label" x="${W - M.r}" y="13.5" text-anchor="end">fails at ${fmtCycles(run.end.N)}</text>`;
  });
  s += `<line class="wv-cross" id="cy-cross" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/>`;
  s += `<rect class="hp-hit cy-hit" x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
  return sc;
}

// Crosshair and tooltip for the latest device. `getRuns` returns the runs
// currently drawn, since a rerun replaces them.
export function bindCycleTooltip(figure, svg, getRuns, vLabel) {
  const tip = document.createElement('div');
  tip.className = 'hp-tip';
  tip.hidden = true;
  figure.append(tip);
  const hide = () => {
    tip.hidden = true;
    svg.querySelector('#cy-cross')?.setAttribute('visibility', 'hidden');
  };
  svg.addEventListener('pointermove', (e) => {
    const runs = getRuns();
    const run = runs?.at(-1);
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width);
    if (!run || !e.target.closest?.('.cy-hit')) return hide();
    const { xMax } = scales(runs);
    const N = ((x - M.l) / (W - M.l - M.r)) * xMax;
    const last = run.points.at(-1);
    if (N > last.N) return hide();
    const p = run.points.reduce((best, q) => (Math.abs(q.N - N) < Math.abs(best.N - N) ? q : best));
    const cross = svg.querySelector('#cy-cross');
    cross.setAttribute('x1', f(x));
    cross.setAttribute('x2', f(x));
    cross.setAttribute('visibility', 'visible');
    tip.innerHTML = `<b>${fmtCycles(p.N)} cycles</b><span>R<sub>th(j-c)</sub> +${(p.dR * 100).toFixed(1)} %</span><span>${vLabel}, hot +${(p.dV * 100).toFixed(1)} %</span><span>${p.lifted} wire${p.lifted === 1 ? '' : 's'} lifted · die attach ${Math.round(p.crack * 100)} % cracked</span>`;
    tip.hidden = false;
    const box = figure.getBoundingClientRect();
    const left = Math.min(e.clientX - box.left + 12, box.width - tip.offsetWidth - 4);
    tip.style.transform = `translate(${Math.max(4, left)}px, ${e.clientY - box.top - tip.offsetHeight - 10}px)`;
  });
  svg.addEventListener('pointerleave', hide);
}
