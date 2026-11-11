import { thermalColorCSS } from './palette.js';

// "Temperature staircase" for the Heat panel: one floating column per layer of
// the heat path, from the temperature at its top to the one at its bottom, so
// the tallest column is the layer that costs the most temperature. Columns
// carry the same heat colors as the 3D model. Text uses the page's ink colors
// (CSS classes), so it follows the theme. Hovering a column shows its numbers;
// the table under the chart lists them all.

const W = 340;
const H = 214;
const M = { l: 40, r: 10, t: 22, b: 44 };
const BAR = 22;

function niceStep(range, target) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

export const fmtR = (R) => R.toFixed(R >= 0.1 ? 2 : 3);
export const fmtT = (mm) => (mm >= 1 ? `${mm} mm` : `${Math.round(mm * 1000)} µm`);

export function renderHeatPlot(svg, result, cfg) {
  const { layers, Tj, Tref } = result;
  const top = Math.max(cfg.Tmax, Tj) + 8;
  const yMin = Tref - 6;
  const ticks = niceStep(top - yMin, 4);
  const colW = (W - M.l - M.r) / layers.length;
  const X = (i) => M.l + colW * (i + 0.5);
  const Y = (T) => H - M.b - ((T - yMin) / (top - yMin)) * (H - M.t - M.b);
  const f = (n) => n.toFixed(1);
  const span = cfg.Tmax - cfg.Tref;
  const stagger = colW < 46; // crowded: alternate the column labels on two rows
  let s = '';

  for (let v = Math.ceil(yMin / ticks) * ticks; v <= top; v += ticks) {
    s += `<line class="fp-grid" x1="${M.l}" x2="${W - M.r}" y1="${f(Y(v))}" y2="${f(Y(v))}"/>`;
    s += `<text class="fp-tick" x="${M.l - 6}" y="${f(Y(v) + 3.5)}" text-anchor="end">${v}</text>`;
  }
  s += `<line class="fp-axis" x1="${M.l}" x2="${W - M.r}" y1="${H - M.b}" y2="${H - M.b}"/>`;

  // The limit, as a reference line.
  s += `<line class="hp-limit" x1="${M.l}" x2="${W - M.r}" y1="${f(Y(cfg.Tmax))}" y2="${f(Y(cfg.Tmax))}"/>`;
  s += `<text class="hp-limit-label" x="${W - M.r - 2}" y="${f(Y(cfg.Tmax) - 5)}" text-anchor="end">max ${cfg.Tmax} °C</text>`;

  const biggest = layers.reduce((m, l, i) => (l.dT > layers[m].dT ? i : m), 0);
  layers.forEach((l, i) => {
    const x = X(i);
    const y0 = Y(l.Ttop);
    const y1 = Y(l.Tbottom);
    const h = Math.max(1.5, y1 - y0);
    const fill = thermalColorCSS(((l.Ttop + l.Tbottom) / 2 - cfg.Tref) / span);
    // Connector from this column's bottom to the next column's top.
    if (i < layers.length - 1) {
      s += `<line class="hp-step" x1="${f(x + BAR / 2)}" x2="${f(X(i + 1) - BAR / 2)}" y1="${f(y1)}" y2="${f(y1)}"/>`;
    }
    s += `<rect class="hp-bar" x="${f(x - BAR / 2)}" y="${f(y0)}" width="${BAR}" height="${f(h)}" rx="2" style="fill:${fill}"/>`;
    const ly = H - M.b + 14 + (stagger && i % 2 ? 11 : 0);
    s += `<text class="fp-tick" x="${f(x)}" y="${ly}" text-anchor="middle">${l.short}</text>`;
    if (i === biggest && l.dT >= 1) {
      // Beside the column, on whichever side has room.
      const right = x + BAR / 2 + 44 < W - M.r;
      const lx = right ? x + BAR / 2 + 4 : x - BAR / 2 - 4;
      s += `<text class="hp-value" x="${f(lx)}" y="${f((y0 + y1) / 2 + 4)}" text-anchor="${right ? 'start' : 'end'}">−${l.dT.toFixed(0)} K</text>`;
    }
    // Hit target: the whole column, bigger than the mark.
    s += `<rect class="hp-hit" data-layer="${i}" x="${f(x - colW / 2)}" y="${M.t}" width="${f(colW)}" height="${H - M.t - M.b}"/>`;
  });

  // Junction temperature on the first column.
  s += `<circle class="hp-junction" cx="${f(X(0))}" cy="${f(Y(Tj))}" r="4"/>`;
  s += `<text class="fp-peak-label" x="${f(X(0) + 9)}" y="${f(Y(Tj) - 6)}">junction ${Tj.toFixed(0)} °C</text>`;

  s += `<text class="fp-axis-label" x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">Layer, from the die down to the ${cfg.refName.toLowerCase()}</text>`;
  s += `<text class="fp-axis-label" transform="translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)" text-anchor="middle">Temperature (°C)</text>`;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

// Hover tooltip for the columns (one listener; the plot is re-rendered often).
export function bindHeatTooltip(figure, svg, getResult) {
  const tip = document.createElement('div');
  tip.className = 'hp-tip';
  tip.hidden = true;
  figure.append(tip);
  svg.addEventListener('pointermove', (e) => {
    const hit = e.target.closest?.('[data-layer]');
    const r = getResult();
    if (!hit || !r) {
      tip.hidden = true;
      return;
    }
    const l = r.layers[Number(hit.dataset.layer)];
    tip.innerHTML = `<b>${l.name}</b><span>${fmtT(l.t)} · k ${l.k} W/(m·K)</span><span>R ${fmtR(l.R)} K/W · −${l.dT.toFixed(1)} K</span>`;
    tip.hidden = false;
    const box = figure.getBoundingClientRect();
    const x = Math.min(e.clientX - box.left + 12, box.width - tip.offsetWidth - 4);
    tip.style.transform = `translate(${Math.max(4, x)}px, ${e.clientY - box.top - tip.offsetHeight - 10}px)`;
  });
  svg.addEventListener('pointerleave', () => {
    tip.hidden = true;
  });
}
