import { DC, AC, RECT, PWM, dcWave, acWave, rectWave, rectCurrent, analyze, spectrumLines, summarize } from './switching.js';
import { renderTime, renderPwm, renderCurrent, renderSpectrum, bindSwitchTooltips } from './switchplot.js';
import { markTerms } from './terms.js';

// "Switching, step by step" in Converters in brief: pick DC to lower DC, DC
// to AC or AC to DC (an active rectifier), set the duty cycle (or the sine it
// follows, or the power drawn) and the filter, and see the pulses, what the
// filter makes of them and the spectrum, and behind the pulses, the
// controller's counter that times them.

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
// So is the inductor slider of AC to DC.
const toLPos = (L) => (100 * Math.log(L / RECT.L[0])) / Math.log(RECT.L[1] / RECT.L[0]);
const toL = (pos) => RECT.L[0] * (RECT.L[1] / RECT.L[0]) ** (pos / 100);
// The power slider: 0–100 spans a tenth of full power to full power.
const toP = (pos) => RECT.Pmax * (0.1 + 0.9 * (pos / 100));
const toPPos = (P) => ((P / RECT.Pmax - 0.1) / 0.9) * 100;
const pct = (x) => `${Math.round(x * 100)} %`;
const fmtF = (f) => (f >= 1e3 ? `${+(f / 1e3).toFixed(f >= 1e4 ? 0 : 1)} kHz` : `${Math.round(f)} Hz`);
const fmtV = (v) => (Math.abs(v) < 1 ? v.toFixed(2) : v.toFixed(1));
// Distortion is measured against the sine; with no sine asked for there is none to measure.
const thdText = (sum, m) => (m > 0 && Number.isFinite(sum.thd) ? `${(sum.thd * 100).toFixed(sum.thd < 0.1 ? 1 : 0)} %` : null);

export function initSwitching(root) {
  if (!root) return null;
  const $ = (sel) => root.querySelector(sel);
  const state = { mode: 'dc', D: 0.4, m: 0.85, fout: 50, fc: { dc: 10e3, ac: 200 }, P: RECT.Pdefault, L: RECT.Ldefault };
  let view = null;
  let frame = 0;
  let tips = null;

  function compute() {
    if (state.mode === 'rect') {
      const wave = rectWave({ P: state.P, L: state.L });
      const spec = rectCurrent(wave);
      const fMax = 3.3 * RECT.fsw;
      return {
        mode: 'rect',
        wave,
        spec,
        fMax,
        fsw: RECT.fsw,
        fout: RECT.fgrid,
        Vpk: RECT.Vdc / 2,
        lines: spectrumLines(spec, fMax),
        sum: summarize('rect', wave, spec),
      };
    }
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
    tips?.hide(); // a tooltip left from before would describe the old figure
    const { sum, fc } = view;
    const dc = view.mode === 'dc';
    for (const b of root.querySelectorAll('[data-sw-mode]')) b.setAttribute('aria-pressed', String(b.dataset.swMode === state.mode));
    for (const el of root.querySelectorAll('[data-sw-for]')) el.hidden = !el.dataset.swFor.split(' ').includes(state.mode);
    if (view.mode === 'rect') return renderRect();
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
          ['Distortion left', thdText(sum, state.m) ? `${thdText(sum, state.m)} (switched: ${Math.round(sum.thdBefore * 100)} %)` : '—, no sine asked for'],
          ['Filter corner', corner],
          ['Switching', `${fmtF(AC.fsw)}, slowed down so the pulses show; drives use 4–16 kHz`],
        ];
    $('#sw-readouts').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#sw-explain').innerHTML = dc
      ? `The switch is on ${pct(state.D)} of the time (a duty cycle of ${pct(state.D)}), so the pulses average to ${pct(state.D)} of ${DC.Vin} V. In the spectrum that average is the line at 0 Hz. Everything else sits at the switching frequency (${fmtF(DC.fsw)}) and its multiples, where the filter cuts it down. Move the filter corner up toward ${fmtF(DC.fsw)} and the ripple comes back.`
      : `Now the duty cycle rises and falls with a ${state.fout} Hz sine (pulse-width modulation), so the pulses average to that sine. In the spectrum it is the line at ${state.fout} Hz. The switching puts the rest around ${fmtF(AC.fsw)} and its multiples, where the filter removes it. In a motor drive, the filter is the motor’s own inductance.`;
    markTerms($('#sw-explain'));
    const usPeriod = 1e6 / DC.fsw;
    $('#sw-pwm-text').innerHTML = dc
      ? `<b>Behind the pulses.</b> What switches the switch is a clock in the controller, ticking ${PWM.clock / 1e6} million times a second. A counter counts the ticks up to ${PWM.top} and starts over, once every ${usPeriod} µs: that sets the ${fmtF(DC.fsw)}. The switch is on while the count is below the compare value, here ${Math.round(state.D * PWM.top)}, which the control loop sets for a duty cycle of ${pct(state.D)}. A gate driver then turns each 3.3 V logic pulse into the voltage and the few amperes the gate needs: about 6 V for GaN, 15 to 18 V for SiC.`
      : `<b>Behind the pulses.</b> Here the counter counts up to ${PWM.top} and back down, once every ${1e3 / AC.fsw} ms: that sets the switching frequency of ${fmtF(AC.fsw)}. It is slowed down along with the switching, to ${(2 * PWM.top * AC.fsw) / 1e6} million ticks a second; a drive with a ${PWM.clock / 1e6} MHz clock, switching at 10 kHz, counts up to ${PWM.clock / 2 / 10e3} and back. The upper switch, which ties the output to +${AC.Vdc / 2} V, is on while the count is below the compare value, and the lower switch the rest of the time. The control loop moves the compare value along a ${state.fout} Hz sine. So the fast switching comes from the controller’s clock, and the ${state.fout} Hz only from how the compare value moves.`;
    markTerms($('#sw-pwm-text'));

    draw();
    $('#sw-time').setAttribute(
      'aria-label',
      dc
        ? `Switched voltage and filtered output over time: average ${sum.average.toFixed(1)} V, ripple ±${fmtV(sum.ripple)} V`
        : `Switched voltage and filtered output over one ${state.fout} Hz cycle: ${Math.round(sum.fundamental)} V peak sine${thdText(sum, state.m) ? `, ${thdText(sum, state.m)} distortion` : ''}`,
    );
    $('#sw-pwm').setAttribute(
      'aria-label',
      dc
        ? `The controller’s counter rises from 0 to ${PWM.top} once every ${usPeriod} µs; the switch is on while the count is below the compare value of ${Math.round(state.D * PWM.top)}`
        : `The controller’s counter rises and falls once every ${1e3 / AC.fsw} ms; the compare value follows a ${state.fout} Hz sine, and the upper switch is on while the count is below it`,
    );
    $('#sw-spec').setAttribute('aria-label', 'Spectrum of the switched voltage, before and after the filter');
  }
  // AC to DC: one phase of the car charger's active rectifier.
  function renderRect() {
    const { sum, wave } = view;
    $('#sw-p-out').textContent = `${(state.P / 1e3).toFixed(1)} kW`;
    $('#sw-l-out').textContent = `${(state.L * 1e3).toFixed(state.L < 0.01 ? 1 : 0)} mH`;
    const lag = Math.round(wave.lagDeg);
    // The lag is this large only because the slowed-down switching needs a 50
    // times larger inductor; the real charger's is 50 times smaller, and so is its drop.
    const behind =
      lag >= 1
        ? `${lag}° behind it (in the real charger, with its 50 times smaller inductor, under a degree)`
        : 'just behind it';
    const rows = [
      ['Inductor current', `${sum.fundamental.toFixed(1)} A peak (${(sum.fundamental / Math.SQRT2).toFixed(1)} A rms) at 50 Hz, in step with the grid voltage`],
      ['Ripple left', `±${sum.ripple.toFixed(1)} A, from the switching`],
      ['Into the DC link', `${(sum.power / 1e3).toFixed(1)} kW from this phase: ${sum.Idc.toFixed(1)} A at ${RECT.Vdc} V, on average`],
      ['Switching', `${fmtF(RECT.fsw)}, slowed down so the pulses show; the charger switches at about 100 kHz, with an inductor about 50 times smaller`],
    ];
    $('#sw-readouts').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#sw-explain').innerHTML = `Now the leg runs the other way, as an active rectifier (PFC): one phase of the car charger. The grid’s 230 V is on one side of an inductor, the pulses on the other. The controller makes the pulses average to a sine a little larger than the grid voltage and ${behind}. That small difference across the inductor pushes a current that rises and falls in step with the grid voltage, so at 50 Hz the charger looks like a resistor to the grid (a power factor of 1), and the power flows into the ${RECT.Vdc} V DC link: in pulses, 100 times a second, from one phase, and steadily from all three together. An input filter keeps most of the switching ripple out of the grid. A plain diode rectifier would instead draw its current in short bursts around the voltage peaks. Make the inductor smaller and more of the switching gets into the current.`;
    markTerms($('#sw-explain'));
    $('#sw-pwm-text').innerHTML = `<b>Behind the pulses.</b> The same counter as in DC to AC, up to ${PWM.top} and back down, once every ${1e3 / RECT.fsw} ms, slowed down along with the switching (the charger’s ${PWM.clock / 1e6} MHz clock at 100 kHz counts up to ${PWM.clock / 2 / 100e3} and back). The control loop measures the grid voltage and the current every period and sets the compare value so that the current follows the grid voltage: it comes out as a sine just behind the grid voltage. So the switching frequency comes from the controller’s clock, and the grid only sets the shape.`;
    markTerms($('#sw-pwm-text'));
    draw();
    $('#sw-time').setAttribute('aria-label', `Grid voltage and the leg’s pulses over one 50 Hz cycle; the pulses average to a sine ${lag >= 1 ? `${lag}°` : 'just'} behind the grid voltage`);
    $('#sw-cur').setAttribute(
      'aria-label',
      `Inductor current over one 50 Hz cycle: ${sum.fundamental.toFixed(1)} A peak in step with the grid voltage, with ±${sum.ripple.toFixed(1)} A of switching ripple`,
    );
    $('#sw-spec').setAttribute('aria-label', 'Spectrum of the inductor current: the 50 Hz current and the switching ripple');
    $('#sw-pwm').setAttribute(
      'aria-label',
      `The controller’s counter rises and falls once every ${1e3 / RECT.fsw} ms; the compare value follows a sine just behind the grid voltage, and the upper switch is on while the count is below it`,
    );
  }
  function draw() {
    renderTime($('#sw-time'), view);
    renderPwm($('#sw-pwm'), view);
    if (view.mode === 'rect') renderCurrent($('#sw-cur'), view);
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
  $('#sw-p').addEventListener('input', (e) => {
    state.P = toP(Number(e.target.value));
    schedule();
  });
  $('#sw-l').addEventListener('input', (e) => {
    state.L = toL(Number(e.target.value));
    schedule();
  });
  $('#sw-fc').addEventListener('input', (e) => {
    state.fc[state.mode] = toFc(state.mode, Number(e.target.value));
    schedule();
  });
  $('#sw-f').max = String(AC.fouts.length - 1);
  $('#sw-f').value = String(AC.fouts.indexOf(state.fout));
  $('#sw-p').value = String(toPPos(state.P));
  $('#sw-l').value = String(toLPos(state.L));
  tips = bindSwitchTooltips($('.sw-time'), $('.sw-spec'), () => view, $('.sw-pwm'), $('.sw-cur'));
  render();
  return { state, view: () => view, render };
}
