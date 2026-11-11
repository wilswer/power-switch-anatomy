import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fft, dcWave, acWave, lcFilter, analyze, spectrumLines, summarize, DC, AC, FILTER_Q } from '../exploded-views/js/switching.js';

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
