import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fft, dcWave, acWave, rectWave, rectCurrent, lcFilter, analyze, spectrumLines, summarize,
  DC, AC, RECT, FILTER_Q, PWM, sawCount, triCount, countAt,
} from '../exploded-views/js/switching.js';
import { PFC } from '../exploded-views/js/apps/obc.js';

const close = (a, b, rel, what) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${what}: ${a} vs ${b}`);

test('the FFT matches a direct Fourier transform, and the inverse gives the input back', () => {
  const N = 64;
  const x = Array.from({ length: N }, (_, i) => Math.sin(i * 0.7) + 0.3 * Math.cos(i * 2.1) + (i % 5) * 0.1);
  const re = Float64Array.from(x);
  const im = new Float64Array(N);
  fft(re, im);
  for (const k of [0, 1, 5, 17, 32, 63]) {
    let sr = 0;
    let si = 0;
    for (let n = 0; n < N; n++) {
      sr += x[n] * Math.cos((-2 * Math.PI * k * n) / N);
      si += x[n] * Math.sin((-2 * Math.PI * k * n) / N);
    }
    assert.ok(Math.abs(re[k] - sr) < 1e-9 && Math.abs(im[k] - si) < 1e-9, `bin ${k}`);
  }
  fft(re, im, true);
  x.forEach((v, i) => assert.ok(Math.abs(re[i] - v) < 1e-12 && Math.abs(im[i]) < 1e-12));
});

test('a pulse train is its average plus the Fourier series of a square wave', () => {
  for (const D of [0.1, 0.25, 0.4, 0.5, 0.8]) {
    const w = dcWave({ D });
    const s = analyze(w, 1e12); // no filtering
    // The sampled duty cycle, to the nearest sample.
    const spp = DC.N / DC.periods;
    const d = Math.round(D * spp) / spp;
    close(s.before[0], d * DC.Vin, 1e-9, `average at D=${D}`);
    for (let n = 1; n <= 5; n++) {
      const expected = ((2 * DC.Vin) / (n * Math.PI)) * Math.abs(Math.sin(n * Math.PI * d));
      if (expected < 0.5) continue;
      close(s.before[n * DC.periods], expected, 0.01, `harmonic ${n} at D=${D}`);
    }
    // Nothing between the harmonics of the switching frequency.
    assert.ok(s.before[DC.periods + 3] < 1e-6);
  }
});

test('the filter passes DC, is 3 dB down at its corner and falls 40 dB per decade', () => {
  const mag = (f, fc) => Math.hypot(...lcFilter(f, fc));
  close(mag(0, 1000), 1, 1e-12, 'DC');
  close(mag(1000, 1000), FILTER_Q, 1e-9, 'corner');
  // Well above the corner the gain falls as (corner / f)²: 40 dB per decade.
  close(mag(10000, 1000), 1 / 100, 0.01, 'a decade up');
  close(mag(100000, 1000), 1 / 10000, 0.01, 'two decades up');
});

test('filtering keeps the average and removes the ripple, the more so the lower the corner', () => {
  const w = dcWave({ D: 0.4 });
  const at = (fc) => summarize('dc', w, analyze(w, fc));
  const strong = at(10e3);
  const weak = at(1e3 * 100);
  close(strong.average, analyze(w, 1e12).before[0], 1e-9, 'the average survives the filter');
  assert.ok(strong.ripple < 0.5, `ripple ${strong.ripple} V with the corner 10× below`);
  assert.ok(weak.ripple > 10, `ripple ${weak.ripple} V with the corner at the switching frequency`);
  // Ten times lower corner, about a hundred times less ripple (40 dB per decade).
  const ratio = at(30e3).ripple / at(3e3).ripple;
  assert.ok(ratio > 60 && ratio < 140, `ripple ratio ${ratio}`);
});

test('an inverter leg makes the sine it is asked for, plus switching noise near the switching frequency', () => {
  for (const fout of AC.fouts) {
    for (const m of [0.3, 0.6, 0.85, 1]) {
      const w = acWave({ m, fout });
      const s = analyze(w, 1e12);
      close(s.before[1], (m * AC.Vdc) / 2, 0.015, `fundamental at m=${m}, ${fout} Hz`);
    }
    const w = acWave({ m: 0.85, fout });
    const s = analyze(w, 1e12);
    // The biggest line after the fundamental sits at the switching frequency (bin fsw/fout).
    let k = 2;
    for (let i = 2; i < s.before.length; i++) if (s.before[i] > s.before[k]) k = i;
    assert.ok(Math.abs(k * fout - AC.fsw) <= 2 * fout, `${fout} Hz: biggest switching line at ${k * fout} Hz`);
  }
});

test('the filter turns the pulses into a clean sine; too weak a filter leaves them in', () => {
  const w = acWave({ m: 0.85, fout: 50 });
  const good = summarize('ac', w, analyze(w, 200));
  const weak = summarize('ac', w, analyze(w, 5000));
  assert.ok(good.thdBefore > 1, `the raw pulses are mostly distortion (${good.thdBefore})`);
  assert.ok(good.thd < 0.08, `THD ${good.thd} with the corner at 200 Hz`);
  assert.ok(weak.thd > 0.5, `THD ${weak.thd} with the corner above the switching frequency`);
  close(good.fundamental, (0.85 * AC.Vdc) / 2, 0.03, 'the sine keeps its size');
});

test('behind the pulses: the switch is on exactly while the counter is below the compare value', () => {
  const cases = [
    ...[0, 0.1, 0.4, 0.75, 1].map((D) => ['dc', dcWave({ D }), D]),
    ...AC.fouts.flatMap((fout) => [0, 0.5, 1].map((m) => ['ac', acWave({ m, fout }), m])),
  ];
  for (const [mode, w, x] of cases) {
    const { pwm } = w;
    assert.equal(pwm.shape, mode === 'dc' ? 'saw' : 'tri');
    const high = mode === 'dc' ? DC.Vin : AC.Vdc / 2;
    for (let i = 0; i < w.v.length; i++) {
      const count = countAt(pwm.shape, pwm.phase(i));
      assert.ok(count >= 0 && count <= PWM.top, `${mode}: count ${count}`);
      assert.ok(pwm.compare[i] >= 0 && pwm.compare[i] <= PWM.top, `${mode}: compare ${pwm.compare[i]}`);
      assert.equal(w.v[i] === high, count < pwm.compare[i], `${mode} ${x}, sample ${i}`);
    }
  }
});

test('the counter sets the switching frequency, and the compare value is what you ask for', () => {
  // DC: a 100 MHz clock counting 0 to 999 restarts every 10 µs, so 100 kHz.
  assert.equal(PWM.clock / PWM.top, DC.fsw);
  const w = dcWave({ D: 0.4 });
  assert.ok(w.pwm.compare.every((c) => c === 400));
  assert.equal(w.pwm.periods, DC.periods);
  // The phase runs over whole switching periods, so the counter restarts once per period.
  let resets = 0;
  for (let i = 1; i < w.v.length; i++) if (sawCount(w.pwm.phase(i)) < sawCount(w.pwm.phase(i - 1))) resets++;
  assert.equal(resets, DC.periods - 1);
  // AC: the counter goes up and back down once per switching period, the
  // compare value follows the sine around the middle of the count.
  assert.equal(triCount(0), 0);
  assert.equal(triCount(0.5), PWM.top);
  assert.equal(triCount(0.25), PWM.top / 2);
  const a = acWave({ m: 0.5, fout: 50 });
  assert.equal(a.pwm.periods, AC.fsw / 50);
  const n = a.v.length;
  close(a.pwm.compare[Math.round(n / 4)], PWM.top * 0.75, 1e-3, 'compare at the sine’s peak');
  close(a.pwm.compare[Math.round((3 * n) / 4)], PWM.top * 0.25, 1e-3, 'compare at the sine’s trough');
});

test('the drawn lines are the visible ones: the average and the switching harmonics', () => {
  const w = dcWave({ D: 0.4 });
  const lines = spectrumLines(analyze(w, 10e3), 6 * DC.fsw);
  assert.deepEqual(
    lines.map((l) => Math.round(l.f / 1e3)),
    [0, 100, 200, 300, 400, 600],
    'D = 0.4 has no visible 5th harmonic (sin 2π ≈ 0)',
  );
  assert.ok(lines.every((l) => l.after <= l.before + 1e-9), 'a passive filter adds nothing');
});

// AC to DC: one phase of the charger's active rectifier (PFC).
const rect = (o = {}) => {
  const w = rectWave({ P: RECT.Pdefault, L: RECT.Ldefault, ...o });
  const spec = rectCurrent(w);
  return { w, spec, sum: summarize('rect', w, spec) };
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

test('AC to DC is one phase of the charger: its grid voltage, current and DC link', () => {
  assert.equal(RECT.Vg, PFC.VPK);
  assert.equal(RECT.Vdc, 800);
  close((2 * RECT.Pmax) / RECT.Vg, PFC.IPK, 0.01, 'full power is the charger’s 16 A rms per phase');
  assert.ok(RECT.Pdefault <= RECT.Pmax && RECT.Ldefault >= RECT.L[0] && RECT.Ldefault <= RECT.L[1]);
});

test('the active rectifier draws a sine current in step with the grid voltage', () => {
  for (const P of [RECT.Pmax * 0.2, RECT.Pdefault, RECT.Pmax]) {
    for (const L of [RECT.L[0], RECT.Ldefault, RECT.L[1]]) {
      const { w, spec, sum } = rect({ P, L });
      const what = `P=${P.toFixed(0)} W, L=${(L * 1e3).toFixed(1)} mH`;
      close(sum.fundamental, (2 * P) / RECT.Vg, 0.005, `${what}: current amplitude`);
      assert.ok(Math.abs(sum.phaseDeg) < 0.5, `${what}: current ${sum.phaseDeg.toFixed(1)}° off the grid voltage`);
      // Power in from the grid equals power into the leg (the inductor stores, never burns).
      const Pgrid = mean(Array.from(w.grid, (v, i) => v * spec.y[i]));
      const Pleg = mean(Array.from(w.vAvg, (v, i) => v * spec.y[i]));
      close(Pgrid, P, 0.01, `${what}: power from the grid`);
      close(Pleg, Pgrid, 0.01, `${what}: power into the DC link`);
      close(sum.power, Pgrid, 1e-9, `${what}: reported power`);
      close(sum.Idc, P / RECT.Vdc, 0.01, `${what}: DC current`);
    }
  }
  // With the default inductor at full power, the ripple is a small part of the current.
  assert.ok(rect().sum.pf > 0.99);
});

test('the leg’s average sits just behind the grid voltage, and the counter is the same as in DC to AC', () => {
  const { w } = rect();
  assert.equal(w.pwm.shape, 'tri');
  assert.equal(w.pwm.periods, RECT.fsw / RECT.fgrid);
  const high = RECT.Vdc / 2;
  for (let i = 0; i < w.v.length; i++) {
    assert.equal(w.v[i] === high, countAt('tri', w.pwm.phase(i)) < w.pwm.compare[i], `sample ${i}`);
  }
  // The reference peaks a little after the grid voltage (a quarter cycle), never before.
  const peak = (xs) => xs.indexOf(Math.max(...xs)) / xs.length;
  const lag = peak(w.ref) - peak(Array.from(w.grid));
  assert.ok(lag > 0 && lag < 0.1, `reference lags by ${lag} of a cycle`);
  assert.ok(Math.max(...w.ref) > RECT.Vg && Math.max(...w.ref) < RECT.Vdc / 2, 'above the grid peak, within the DC link');
});

test('a smaller inductor lets more switching ripple into the current', () => {
  const at = (L) => rect({ L }).sum.ripple;
  const ratio = at(RECT.Ldefault / 2) / at(RECT.Ldefault);
  assert.ok(ratio > 1.6 && ratio < 2.4, `half the inductor, ${ratio.toFixed(2)}× the ripple`);
  // Peak-to-peak ripple at the zero crossing (duty 50 %): (Vdc/2)(Tsw/2)/L.
  const expected = ((RECT.Vdc / 2) * (0.5 / RECT.fsw)) / RECT.Ldefault / 2;
  close(at(RECT.Ldefault), expected, 0.03, 'ripple at the default inductor');
  // Its lines sit around the switching frequency, and the 50 Hz line dominates.
  const { spec } = rect();
  const lines = spectrumLines(spec, 3.3 * RECT.fsw);
  assert.equal(lines.reduce((a, b) => (b.after > a.after ? b : a)).f, RECT.fgrid);
  assert.ok(lines.some((l) => Math.abs(l.f - RECT.fsw) <= 3 * RECT.fgrid && l.f > RECT.fgrid));
});

test('a switch that never turns on has no spectrum lines, not all of them', () => {
  assert.deepEqual(spectrumLines(analyze(dcWave({ D: 0 }), 10e3), 6 * DC.fsw), []);
  // Always on: only the average.
  assert.deepEqual(spectrumLines(analyze(dcWave({ D: 1 }), 10e3), 6 * DC.fsw).map((l) => l.f), [0]);
});
