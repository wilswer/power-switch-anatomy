// Small SVG chart of electric field versus position for the Blocking panel.
// Colors come from CSS classes, so it follows the page theme.

const W = 340;
const H = 204;
const M = { l: 46, r: 14, t: 18, b: 42 };

function niceStep(range, target) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

const decimals = (step) => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));

export function renderFieldPlot(svg, { profile, xMax, xLabel, Ec, eMax, markers = [], peak }) {
  const X = (x) => M.l + (x / xMax) * (W - M.l - M.r);
  const Y = (e) => H - M.b - (e / eMax) * (H - M.t - M.b);
  const f = (n) => n.toFixed(1);
  let s = '';

  const xs = niceStep(xMax, 5);
  for (let i = 0; i * xs <= xMax + 1e-9; i++) {
    const v = i * xs;
    s += `<line class="fp-grid" x1="${f(X(v))}" x2="${f(X(v))}" y1="${M.t}" y2="${H - M.b}"/>`;
    s += `<text class="fp-tick" x="${f(X(v))}" y="${H - M.b + 14}" text-anchor="middle">${v.toFixed(decimals(xs))}</text>`;
  }
  const ysMV = niceStep(eMax / 1e6, 4);
  for (let i = 0; i * ysMV <= eMax / 1e6 + 1e-9; i++) {
    const v = i * ysMV;
    s += `<line class="fp-grid" x1="${M.l}" x2="${W - M.r}" y1="${f(Y(v * 1e6))}" y2="${f(Y(v * 1e6))}"/>`;
    s += `<text class="fp-tick" x="${M.l - 6}" y="${f(Y(v * 1e6) + 3.5)}" text-anchor="end">${v.toFixed(decimals(ysMV))}</text>`;
  }
  s += `<line class="fp-axis" x1="${M.l}" x2="${W - M.r}" y1="${H - M.b}" y2="${H - M.b}"/>`;
  s += `<line class="fp-axis" x1="${M.l}" x2="${M.l}" y1="${M.t}" y2="${H - M.b}"/>`;

  for (const m of markers) {
    if (m.x <= 0 || m.x > xMax) continue;
    s += `<line class="fp-marker" x1="${f(X(m.x))}" x2="${f(X(m.x))}" y1="${M.t}" y2="${H - M.b}"/>`;
    s += `<text class="fp-marker-label" x="${f(X(m.x) - 4)}" y="${M.t + 9}" text-anchor="end">${m.label}</text>`;
  }

  const pts = profile.map(([x, e]) => `${f(X(x))},${f(Y(Math.min(e, eMax)))}`);
  s += `<path class="fp-area" d="M${f(X(profile[0][0]))},${f(Y(0))}L${pts.join('L')}L${f(X(profile.at(-1)[0]))},${f(Y(0))}Z"/>`;
  s += `<path class="fp-line" d="M${pts.join('L')}"/>`;

  if (Ec <= eMax) {
    s += `<line class="fp-ec" x1="${M.l}" x2="${W - M.r}" y1="${f(Y(Ec))}" y2="${f(Y(Ec))}"/>`;
    s += `<text class="fp-ec-label" x="${W - M.r - 2}" y="${f(Y(Ec) - 5)}" text-anchor="end">critical field ${(Ec / 1e6).toFixed(2)}</text>`;
  }

  if (peak && peak.E > 0) {
    const px = X(peak.x);
    const py = Y(Math.min(peak.E, eMax));
    s += `<circle class="fp-peak" cx="${f(px)}" cy="${f(py)}" r="3.2"/>`;
    s += `<text class="fp-peak-label" x="${f(px + 7)}" y="${f(py + 4)}">${(peak.E / 1e6).toFixed(2)} MV/cm</text>`;
  }

  s += `<text class="fp-axis-label" x="${(M.l + W - M.r) / 2}" y="${H - 8}" text-anchor="middle">${xLabel}</text>`;
  s += `<text class="fp-axis-label" transform="translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)" text-anchor="middle">Field (MV/cm)</text>`;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}
