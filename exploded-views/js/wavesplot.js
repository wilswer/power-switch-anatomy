// Waveforms for the In action panel: two stacked panels that share a time
// axis (for example the pulses a switch makes, and the current that results).
// Two panels instead of a second y-axis, since the quantities differ. Series
// colors come from CSS classes, so they follow the theme; text uses the ink
// colors. Hovering shows a crosshair with the values at that moment.

const W = 340;
const M = { l: 44, r: 10 };
const PANEL_H = 84;
const TITLE_H = 22;
const AXIS_H = 34;
const N = 720;

function niceStep(range, target) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

const f = (n) => n.toFixed(1);
const X = (waves, t) => M.l + (t / waves.xMax) * (W - M.l - M.r);

// Layout of each panel: its top and the y mapping.
function layout(waves) {
  return waves.panels.map((p, i) => {
    const top = i * (TITLE_H + PANEL_H) + TITLE_H;
    const Y = (v) => top + PANEL_H - ((v - p.yMin) / (p.yMax - p.yMin)) * PANEL_H;
    return { ...p, top, Y };
  });
}

export function renderWaves(svg, waves) {
  const panels = layout(waves);
  const H = panels.length * (TITLE_H + PANEL_H) + AXIS_H;
  let s = '';
  for (const p of panels) {
    // Title, with a key when the panel has two series.
    let tx = M.l;
    s += `<text class="wv-title" x="${tx}" y="${p.top - 8}">${p.title} (${p.unit})</text>`;
    if (p.series.length > 1) {
      tx = W - M.r;
      for (const ser of p.series.slice().reverse()) {
        const w = ser.label.length * 6.1 + 18;
        tx -= w;
        s += `<line class="wv-${ser.cls}" x1="${f(tx)}" x2="${f(tx + 12)}" y1="${p.top - 11.5}" y2="${p.top - 11.5}"/>`;
        s += `<text class="wv-key" x="${f(tx + 16)}" y="${p.top - 8}">${ser.label}</text>`;
      }
    }
    const step = niceStep(p.yMax - p.yMin, 3);
    for (let v = Math.ceil(p.yMin / step) * step; v <= p.yMax + 1e-9; v += step) {
      const y = p.Y(v);
      s += `<line class="${Math.abs(v) < 1e-9 && p.yMin < 0 ? 'fp-axis' : 'fp-grid'}" x1="${M.l}" x2="${W - M.r}" y1="${f(y)}" y2="${f(y)}"/>`;
      s += `<text class="fp-tick" x="${M.l - 6}" y="${f(y + 3.5)}" text-anchor="end">${v}</text>`;
    }
    for (const ser of p.series) {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * waves.xMax;
        const v = Math.min(p.yMax, Math.max(p.yMin, ser.fn(t)));
        pts.push(`${f(X(waves, t))},${f(p.Y(v))}`);
      }
      s += `<path class="wv-line wv-${ser.cls}" d="M${pts.join('L')}"/>`;
    }
  }
  const base = panels.at(-1).top + PANEL_H;
  s += `<line class="fp-axis" x1="${M.l}" x2="${W - M.r}" y1="${base}" y2="${base}"/>`;
  const xs = niceStep(waves.xMax, 5);
  for (let i = 0; i * xs <= waves.xMax + 1e-9; i++) {
    const x = X(waves, i * xs);
    s += `<text class="fp-tick" x="${f(x)}" y="${base + 14}" text-anchor="middle">${+(i * xs).toFixed(3)}</text>`;
  }
  s += `<text class="fp-axis-label" x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">${waves.xLabel}</text>`;
  // Crosshair (moved on hover) and the hit area over all panels.
  s += `<line class="wv-cross" id="wv-cross" x1="0" x2="0" y1="${TITLE_H}" y2="${base}" visibility="hidden"/>`;
  s += `<rect class="hp-hit wv-hit" x="${M.l}" y="${TITLE_H}" width="${W - M.l - M.r}" height="${base - TITLE_H}"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

export function bindWavesTooltip(figure, svg, waves) {
  const tip = document.createElement('div');
  tip.className = 'hp-tip';
  tip.hidden = true;
  figure.append(tip);
  const panels = layout(waves);
  svg.addEventListener('pointermove', (e) => {
    const cross = svg.querySelector('#wv-cross');
    const r = svg.getBoundingClientRect();
    const k = W / r.width;
    const x = (e.clientX - r.left) * k;
    if (!e.target.closest?.('.wv-hit') || x < M.l || x > W - M.r) {
      tip.hidden = true;
      cross?.setAttribute('visibility', 'hidden');
      return;
    }
    const t = ((x - M.l) / (W - M.l - M.r)) * waves.xMax;
    cross.setAttribute('x1', f(x));
    cross.setAttribute('x2', f(x));
    cross.setAttribute('visibility', 'visible');
    const rows = panels.flatMap((p) =>
      p.series.map((ser) => `<span>${p.short ?? p.title}${p.series.length > 1 ? `, ${ser.label}` : ''}: ${ser.fn(t).toFixed(p.decimals ?? 0)} ${p.unit}</span>`),
    );
    tip.innerHTML = `<b>t = ${t.toFixed(waves.tDecimals ?? 1)} ${waves.xUnit}</b>${rows.join('')}`;
    tip.hidden = false;
    const box = figure.getBoundingClientRect();
    const left = Math.min(e.clientX - box.left + 12, box.width - tip.offsetWidth - 4);
    tip.style.transform = `translate(${Math.max(4, left)}px, ${e.clientY - box.top - tip.offsetHeight - 10}px)`;
  });
  svg.addEventListener('pointerleave', () => {
    tip.hidden = true;
    svg.querySelector('#wv-cross')?.setAttribute('visibility', 'hidden');
  });
}
