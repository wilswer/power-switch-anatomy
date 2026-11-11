// Pulse-width modulation, in time and in frequency, for the "Switching, step
// by step" figure. Pure functions, no DOM.
//
// A converter is a modulator followed by a low-pass filter: the switch chops
// the input into pulses whose average is what you want (a fraction D of the
// input, or a slowly varying sine), and inductors and capacitors (or a
// motor's own inductance) keep that average and remove the rest, which the
// switching has pushed up to the switching frequency and its multiples.
//
// Each waveform is sampled over a window holding a whole number of switching
// periods (and, for AC, exactly one output cycle), so it is periodic in the
// window: every harmonic falls on an FFT bin, and filtering in the frequency
// domain gives the exact steady state.

export const DC = { Vin: 48, fsw: 100e3, periods: 8, N: 4096 };
// Slowed down so the pulses are visible: real motor drives switch at 4-16 kHz.
export const AC = { Vdc: 560, fsw: 1000, N: 8192, fouts: [10, 20, 25, 40, 50, 100] };
export const FILTER_Q = Math.SQRT1_2; // a well-damped LC filter

// In-place iterative radix-2 FFT; `inverse` scales by 1/N.
export function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

// DC to lower DC: the output is tied to Vin for a fraction D of each period, else to 0.
export function dcWave({ D, Vin = DC.Vin, fsw = DC.fsw, periods = DC.periods, N = DC.N }) {
  const T = periods / fsw;
  const dt = T / N;
  const v = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const phase = ((i + 0.5) / N) * periods;
    v[i] = phase - Math.floor(phase) < D ? Vin : 0;
  }
  return { v, dt, T, f0: fsw, target: D * Vin };
}

// DC to AC, one leg of an inverter: the output is tied to +Vdc/2 or −Vdc/2
// (around the DC link's midpoint), comparing a sine of depth m with a
// triangle carrier at the switching frequency (sine-triangle PWM).
export function acWave({ m, fout, Vdc = AC.Vdc, fsw = AC.fsw, N = AC.N }) {
  const T = 1 / fout;
  const dt = T / N;
  const ratio = fsw / fout;
  const v = new Float64Array(N);
  const ref = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const x = (i + 0.5) / N; // fraction of the output cycle
    const c = (x * ratio) % 1;
    const carrier = c < 0.5 ? 4 * c - 1 : 3 - 4 * c; // triangle, −1 … 1
    ref[i] = m * Math.sin(2 * Math.PI * x);
    v[i] = ref[i] > carrier ? Vdc / 2 : -Vdc / 2;
  }
  return { v, dt, T, f0: fout, ref: Array.from(ref, (r) => (r * Vdc) / 2), target: (m * Vdc) / 2 };
}

// Second-order low-pass (an LC filter with damping), as [re, im] at f.
export function lcFilter(f, fc, q = FILTER_Q) {
  const x = f / fc;
  const a = 1 - x * x;
  const b = x / q;
  const d = a * a + b * b;
  return [a / d, -b / d];
}

// The spectrum of a sampled periodic waveform before and after the filter,
// and the filtered waveform. Amplitudes are one-sided: the DC term as is,
// every other line as the peak of its sine.
export function analyze({ v, dt }, fc) {
  const N = v.length;
  const re = Float64Array.from(v);
  const im = new Float64Array(N);
  fft(re, im);
  const df = 1 / (N * dt);
  const before = new Float64Array(N / 2);
  const after = new Float64Array(N / 2);
  for (let k = 0; k < N; k++) {
    const f = (k <= N / 2 ? k : k - N) * df;
    const [hr, hi0] = lcFilter(Math.abs(f), fc);
    const hi = f < 0 ? -hi0 : hi0; // H(−f) is the conjugate of H(f)
    if (k < N / 2) before[k] = (k ? 2 : 1) * Math.hypot(re[k], im[k]) / N;
    const r = re[k] * hr - im[k] * hi;
    const i = re[k] * hi + im[k] * hr;
    re[k] = r;
    im[k] = i;
    if (k < N / 2) after[k] = (k ? 2 : 1) * Math.hypot(r, i) / N;
  }
  fft(re, im, true);
  return { df, before, after, y: Array.from(re) };
}

// The lines worth drawing: each bin with a visible amplitude, up to fMax.
export function spectrumLines({ df, before, after }, fMax, floor = 0.004) {
  const top = Math.max(...before);
  const lines = [];
  for (let k = 0; k < before.length && k * df <= fMax + 1e-9; k++) {
    if (before[k] >= floor * top) lines.push({ f: k * df, before: before[k], after: after[k] });
  }
  return lines;
}

// Numbers for the readouts.
export function summarize(mode, wave, spec) {
  const y = spec.y;
  const mean = y.reduce((s, x) => s + x, 0) / y.length;
  if (mode === 'dc') {
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of y) {
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    return { average: mean, ripple: (hi - lo) / 2 };
  }
  // The fundamental is bin 1: the window is exactly one output cycle.
  const fund = spec.after[1];
  let rest = 0;
  for (let k = 2; k < spec.after.length; k++) rest += spec.after[k] ** 2;
  let restBefore = 0;
  for (let k = 2; k < spec.before.length; k++) restBefore += spec.before[k] ** 2;
  return {
    fundamental: fund,
    fundamentalBefore: spec.before[1],
    thd: Math.sqrt(rest) / fund,
    thdBefore: Math.sqrt(restBefore) / spec.before[1],
  };
}
