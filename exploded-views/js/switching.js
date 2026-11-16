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

// Behind the pulses: the controller's PWM unit. A counter counts the ticks of
// a clock from 0 up to `top` and starts over, once per switching period (a
// sawtooth), or counts up and back down (a triangle, which centers each pulse
// in its period; inverters use this). The switch is on while the count is
// below the compare value, a number the control loop sets: a fixed share of
// `top` for a duty cycle, or a value that follows a sine for AC. A 100 MHz
// clock counting to 1000 restarts every 10 µs: 100 kHz.
export const PWM = { top: 1000, clock: 100e6 };
const frac = (p) => p - Math.floor(p);
// The count at a phase p, in switching periods since the start.
export const sawCount = (p) => PWM.top * frac(p);
export const triCount = (p) => {
  const c = frac(p);
  return PWM.top * (c < 0.5 ? 2 * c : 2 - 2 * c);
};
export const countAt = (shape, p) => (shape === 'saw' ? sawCount(p) : triCount(p));

// DC to lower DC: the output is tied to Vin for a fraction D of each period, else to 0.
export function dcWave({ D, Vin = DC.Vin, fsw = DC.fsw, periods = DC.periods, N = DC.N }) {
  const T = periods / fsw;
  const dt = T / N;
  const v = new Float64Array(N);
  const compare = new Float64Array(N).fill(D * PWM.top);
  const phase = (i) => ((i + 0.5) / N) * periods;
  for (let i = 0; i < N; i++) v[i] = sawCount(phase(i)) < compare[i] ? Vin : 0;
  return { v, dt, T, f0: fsw, target: D * Vin, pwm: { shape: 'saw', periods, phase, compare } };
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
  const compare = new Float64Array(N);
  const phase = (i) => ((i + 0.5) / N) * ratio;
  for (let i = 0; i < N; i++) {
    ref[i] = m * Math.sin((2 * Math.PI * (i + 0.5)) / N);
    compare[i] = (PWM.top * (1 + ref[i])) / 2;
    v[i] = triCount(phase(i)) < compare[i] ? Vdc / 2 : -Vdc / 2;
  }
  return {
    v,
    dt,
    T,
    f0: fout,
    ref: Array.from(ref, (r) => (r * Vdc) / 2),
    target: (m * Vdc) / 2,
    pwm: { shape: 'tri', periods: ratio, phase, compare },
  };
}

// AC to DC: one phase of the on-board charger's active rectifier (PFC). The
// grid voltage is on one side of an inductor, a half-bridge leg on the other,
// switching between ±Vdc/2 of the 800 V DC link. The phase is modeled as if
// the grid's neutral sat at the DC link's midpoint; in a three-wire charger it
// does not, but with balanced phases each one behaves this way. Slowed down to 2 kHz so the
// pulses show (the charger switches at about 100 kHz, with an inductor about
// 50 times smaller for the same ripple). Full power is the charger's 16 A rms
// from each 230 V phase.
export const RECT = {
  Vg: 325,
  fgrid: 50,
  Vdc: 800,
  fsw: 2000,
  N: 8192,
  Pmax: 3680,
  Pdefault: 3680,
  L: [1.5e-3, 25e-3],
  Ldefault: 15e-3,
};

// The controller makes the leg's average the grid voltage minus the
// inductor's own drop (jωL·I), so the current comes out in phase with the
// grid voltage: a sine a little larger than the grid's, a little behind it.
export function rectWave({ P, L, Vg = RECT.Vg, fgrid = RECT.fgrid, Vdc = RECT.Vdc, fsw = RECT.fsw, N = RECT.N }) {
  const T = 1 / fgrid;
  const dt = T / N;
  const ratio = fsw / fgrid;
  const Ipk = (2 * P) / Vg;
  const drop = 2 * Math.PI * fgrid * L * Ipk;
  const m = Math.hypot(Vg, drop) / (Vdc / 2);
  const lag = Math.atan2(drop, Vg);
  const r = (x) => m * Math.sin(2 * Math.PI * x - lag); // x: fraction of the grid cycle
  const cmp = (x) => (PWM.top * (1 + r(x))) / 2;
  const v = new Float64Array(N);
  const vAvg = new Float64Array(N);
  const grid = new Float64Array(N);
  const ref = new Array(N);
  const want = new Array(N);
  const compare = new Float64Array(N);
  const phase = (i) => ((i + 0.5) / N) * ratio;
  const hi = Vdc / 2;
  for (let i = 0; i < N; i++) {
    const x = (i + 0.5) / N;
    grid[i] = Vg * Math.sin(2 * Math.PI * x);
    want[i] = Ipk * Math.sin(2 * Math.PI * x);
    ref[i] = (r(x) * Vdc) / 2;
    compare[i] = cmp(x);
    v[i] = triCount(phase(i)) < compare[i] ? hi : -hi;
    // For the current: the exact average over the sample, so an edge counts
    // from where it really falls, not from the nearest sample. Left at the
    // sample grid, that error across a small inductor is a large current error.
    const d0 = triCount((i / N) * ratio) - cmp(i / N);
    const d1 = triCount(((i + 1) / N) * ratio) - cmp((i + 1) / N);
    if (d0 < 0 === d1 < 0) vAvg[i] = d0 < 0 ? hi : -hi;
    else {
      const f = d0 / (d0 - d1); // share of the sample before the edge
      vAvg[i] = (d0 < 0 ? hi : -hi) * f + (d0 < 0 ? -hi : hi) * (1 - f);
    }
  }
  return { v, vAvg, dt, T, f0: fgrid, grid, ref, want, Ipk, L, Vdc, lagDeg: (lag * 180) / Math.PI, pwm: { shape: 'tri', periods: ratio, phase, compare } };
}

// The inductor current in steady state: the voltage across the inductor
// (grid minus leg) divided by jωL, line by line. There is no DC current: the
// control loop keeps the average at zero. Amplitudes are one-sided peaks.
export function rectCurrent(wave) {
  const { vAvg, grid, dt, L } = wave;
  const N = vAvg.length;
  const re = Float64Array.from(grid, (g, i) => g - vAvg[i]);
  const im = new Float64Array(N);
  fft(re, im);
  const df = 1 / (N * dt);
  const amp = new Float64Array(N / 2);
  for (let k = 0; k < N; k++) {
    const f = (k <= N / 2 ? k : k - N) * df;
    const c = 2 * Math.PI * f * L;
    const [a, b] = [re[k], im[k]];
    re[k] = k ? b / c : 0;
    im[k] = k ? -a / c : 0;
    if (k < N / 2) amp[k] = (2 * Math.hypot(re[k], im[k])) / N;
  }
  const I1 = [re[1], im[1]];
  fft(re, im, true);
  return { df, before: amp, after: amp, y: Array.from(re), I1 };
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
  // Nothing at all (a switch that never turns on) gives no lines, not all of them.
  const min = Math.max(floor * Math.max(...before), 1e-9);
  const lines = [];
  for (let k = 0; k < before.length && k * df <= fMax + 1e-9; k++) {
    if (before[k] >= min) lines.push({ f: k * df, before: before[k], after: after[k] });
  }
  return lines;
}

// Numbers for the readouts.
export function summarize(mode, wave, spec) {
  const y = spec.y;
  if (mode === 'rect') {
    const N = y.length;
    const [r1, i1] = spec.I1;
    let power = 0;
    let sq = 0;
    let vsq = 0;
    let ripple = 0;
    let gr = 0;
    let gi = 0;
    for (let n = 0; n < N; n++) {
      const a = (2 * Math.PI * n) / N;
      const fund = (2 / N) * (r1 * Math.cos(a) - i1 * Math.sin(a));
      ripple = Math.max(ripple, Math.abs(y[n] - fund));
      power += wave.grid[n] * y[n];
      sq += y[n] ** 2;
      vsq += wave.grid[n] ** 2;
      gr += wave.grid[n] * Math.cos(a);
      gi -= wave.grid[n] * Math.sin(a);
    }
    power /= N;
    const Irms = Math.sqrt(sq / N);
    let phaseDeg = ((Math.atan2(i1, r1) - Math.atan2(gi, gr)) * 180) / Math.PI;
    phaseDeg = ((phaseDeg + 540) % 360) - 180;
    let rest = 0;
    for (let k = 2; k < spec.after.length; k++) rest += spec.after[k] ** 2;
    return {
      fundamental: spec.after[1],
      phaseDeg,
      power,
      pf: power / (Math.sqrt(vsq / N) * Irms),
      ripple,
      thd: Math.sqrt(rest) / spec.after[1],
      Irms,
      Idc: power / wave.Vdc,
    };
  }
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
