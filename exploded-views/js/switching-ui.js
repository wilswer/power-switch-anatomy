import { DC, AC, dcWave, acWave, analyze, spectrumLines, summarize } from './switching.js';
import { renderTime, renderSpectrum, bindSwitchTooltips } from './switchplot.js';
import { markTerms } from './terms.js';

// "Switching, step by step" in Converters in brief: pick DC to lower DC or
// DC to AC, set the duty cycle (or the sine it follows) and the filter's
// corner, and see the pulses, the filtered output and the spectrum of both.

// The filter corner slider is logarithmic: 0–100 spans these frequencies.
const CORNER = { dc: [1e3, 1e6], ac: [30, 10e3] };
const toPos = (mode, fc) => {
  const [a, b] = CORNER[mode];
  return (100 * Math.log(fc / a)) / Math.log(b / a);
};
const toFc = (mode, pos) => {
  const [a, b] = CORNER[mode];
  return a * (b / a) ** (pos / 100);
};
const pct = (x) => `${Math.round(x * 100)} %`;
const fmtF = (f) => (f >= 1e3 ? `${+(f / 1e3).toFixed(f >= 1e4 ? 0 : 1)} kHz` : `${Math.round(f)} Hz`);
const fmtV = (v) => (Math.abs(v) < 1 ? v.toFixed(2) : v.toFixed(1));

export function initSwitching(root) {
  if (!root) return null;
  const $ = (sel) => root.querySelector(sel);
  const state = { mode: 'dc', D: 0.4, m: 0.85, fout: 50, fc: { dc: 10e3, ac: 200 } };
  let view = null;
  let frame = 0;

  function compute() {
    const dc = state.mode === 'dc';
    const wave = dc ? dcWave({ D: state.D }) : acWave({ m: state.m, fout: state.fout });
    const fc = state.fc[state.mode];
    const spec = analyze(wave, fc);
    const fMax = dc ? 6 * DC.fsw : 3.3 * AC.fsw;
    return {
      mode: state.mode,
      wave,
      spec,
      fc,
      fMax,
      fsw: dc ? DC.fsw : AC.fsw,
      fout: state.fout,
      Vin: DC.Vin,
      Vpk: AC.Vdc / 2,
      lines: spectrumLines(spec, fMax),
      sum: summarize(state.mode, wave, spec),
    };
  }

  function render() {
    frame = 0;
    view = compute();
    const { sum, fc } = view;
    const dc = view.mode === 'dc';
    for (const b of root.querySelectorAll('[data-sw-mode]')) b.setAttribute('aria-pressed', String(b.dataset.swMode === state.mode));
    for (const el of root.querySelectorAll('[data-sw-for]')) el.hidden = el.dataset.swFor !== state.mode;
    $('#sw-d-out').textContent = pct(state.D);
    $('#sw-m-out').textContent = state.m.toFixed(2);
    $('#sw-f-out').textContent = `${state.fout} Hz`;
    $('#sw-fc-out').textContent = fmtF(fc);
    $('#sw-fc').value = String(toPos(state.mode, fc));

    const ratio = view.fsw / fc;
    const corner =
      ratio >= 1.5
        ? `${fmtF(fc)}, ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× below the switching frequency`
        : ratio > 0.67
          ? `${fmtF(fc)}, at the switching frequency: little is removed`
          : `${fmtF(fc)}, above the switching frequency: little is removed`;
    const rows = dc
      ? [
          ['Average out', `${pct(state.D)} of ${DC.Vin} V = ${sum.average.toFixed(1)} V`],
          ['Ripple left', `±${fmtV(sum.ripple)} V`],
          ['Filter corner', corner],
        ]
      : [
          [`Sine out, ${state.fout} Hz`, `${Math.round(sum.fundamental)} V peak (asked for ${state.m.toFixed(2)} × ${AC.Vdc / 2} V = ${Math.round(view.wave.target)} V)`],
          ['Distortion left', `${(sum.thd * 100).toFixed(sum.thd < 0.1 ? 1 : 0)} % (switched: ${Math.round(sum.thdBefore * 100)} %)`],
          ['Filter corner', corner],
          ['Switching', `${fmtF(AC.fsw)}, slowed down so the pulses show; drives use 4–16 kHz`],
        ];
    $('#sw-readouts').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#sw-explain').innerHTML = dc
      ? `The switch is on ${pct(state.D)} of the time (a duty cycle of ${pct(state.D)}), so the pulses average to ${pct(state.D)} of ${DC.Vin} V. In the spectrum that average is the line at 0 Hz. Everything else sits at the switching frequency (${fmtF(DC.fsw)}) and its multiples, where the filter cuts it down. Move the filter corner up toward ${fmtF(DC.fsw)} and the ripple comes back.`
      : `Now the duty cycle rises and falls with a ${state.fout} Hz sine (pulse-width modulation), so the pulses average to that sine. In the spectrum it is the line at ${state.fout} Hz. The switching puts the rest around ${fmtF(AC.fsw)} and its multiples, where the filter removes it. In a motor drive, the filter is the motor’s own inductance.`;
    markTerms($('#sw-explain'));

    draw();
    $('#sw-time').setAttribute(
      'aria-label',
      dc
        ? `Switched voltage and filtered output over time: average ${sum.average.toFixed(1)} V, ripple ±${fmtV(sum.ripple)} V`
        : `Switched voltage and filtered output over one ${state.fout} Hz cycle: ${Math.round(sum.fundamental)} V peak sine, ${(sum.thd * 100).toFixed(1)} % distortion`,
    );
  }
  function draw() {
    renderTime($('#sw-time'), view);
    renderSpectrum($('#sw-spec'), view);
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };
  // Redraw at the new width when the layout changes.
  let lastWidth = 0;
  new ResizeObserver(() => {
    const w = $('.sw-time').clientWidth;
    if (view && w !== lastWidth) {
      lastWidth = w;
      draw();
    }
  }).observe(root);

  for (const b of root.querySelectorAll('[data-sw-mode]')) {
    b.addEventListener('click', () => {
      state.mode = b.dataset.swMode;
      render();
    });
  }
  $('#sw-d').addEventListener('input', (e) => {
    state.D = Number(e.target.value) / 100;
    schedule();
  });
  $('#sw-m').addEventListener('input', (e) => {
    state.m = Number(e.target.value) / 100;
    schedule();
  });
  $('#sw-f').addEventListener('input', (e) => {
    state.fout = AC.fouts[Number(e.target.value)];
    schedule();
  });
  $('#sw-fc').addEventListener('input', (e) => {
    state.fc[state.mode] = toFc(state.mode, Number(e.target.value));
    schedule();
  });
  $('#sw-f').max = String(AC.fouts.length - 1);
  $('#sw-f').value = String(AC.fouts.indexOf(state.fout));
  bindSwitchTooltips($('.sw-time'), $('.sw-spec'), () => view);
  render();
  return { state, view: () => view, render };
}
