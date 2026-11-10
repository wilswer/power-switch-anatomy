// Electric-field models for the Blocking view. Pure functions, no three.js, so
// they can be unit-tested with `node --test`.
//
// Units: lengths in µm at the interface, fields in V/cm, doping in cm^-3.

export const Q = 1.602e-19; // elementary charge, C
export const EPS0 = 8.854e-14; // vacuum permittivity, F/cm

// One-dimensional abrupt junction: a heavily doped p region on top of a
// lightly doped n- drift layer of thickness tDrift, ending in a more heavily
// doped n stop layer (SiC buffer or IGBT field stop).
//
// Below the punch-through voltage the depletion region ends inside the drift
// and the field is a triangle. Above it, the depletion reaches the stop layer
// and the field becomes a trapezoid that drops steeply to zero in the stop
// layer. In both cases the area under E(x) equals the applied voltage.
export function verticalBlocking({ V, Nd, tDrift, epsR, Ec, Nstop, tStop }) {
  const eps = epsR * EPS0;
  const slope = (Q * Nd) / eps; // field gradient in the drift, V/cm per cm
  const slopeStop = (Q * Nstop) / eps; // gradient in the stop layer
  const t = tDrift * 1e-4; // cm
  const Vpt = (slope * t * t) / 2; // punch-through voltage
  const v = Math.max(0, V);

  let Epk;
  let W; // depletion depth in the drift, cm
  let Eend; // field where the drift meets the stop layer
  if (v <= Vpt) {
    W = Math.sqrt((2 * v) / slope);
    Epk = slope * W;
    Eend = 0;
  } else {
    // V = (Eend + slope*t/2) * t + Eend^2 / (2 * slopeStop), solved for Eend.
    W = t;
    Eend = slopeStop * (Math.sqrt(t * t + (2 * (v - Vpt)) / slopeStop) - t);
    Epk = Eend + slope * t;
  }
  const dStop = Eend / slopeStop; // cm

  // Ideal breakdown: the voltage at which the peak field reaches Ec.
  const EendBr = Ec - slope * t;
  const Vbr =
    EendBr <= 0
      ? (Ec * Ec) / (2 * slope)
      : (EendBr + (slope * t) / 2) * t + (EendBr * EendBr) / (2 * slopeStop);

  const WUm = W * 1e4;
  const dStopUm = dStop * 1e4;
  const fieldAt = (x) => {
    if (x < 0) return 0;
    if (x <= tDrift) return Math.max(0, Epk - slope * x * 1e-4);
    if (dStopUm > 0 && x <= tDrift + dStopUm) return Eend * (1 - (x - tDrift) / dStopUm);
    return 0;
  };

  const xMax = tDrift + tStop;
  const profile =
    v <= Vpt
      ? [
          [0, Epk],
          [WUm, 0],
          [xMax, 0],
        ]
      : [
          [0, Epk],
          [tDrift, Eend],
          [Math.min(tDrift + dStopUm, xMax), Math.max(0, fieldAt(tDrift + dStopUm))],
          [xMax, 0],
        ];

  return {
    kind: 'vertical',
    V: v,
    Epk,
    Ec,
    W: WUm,
    Eend,
    dStop: dStopUm,
    Vpt,
    Vbr,
    punchThrough: v > Vpt,
    fieldAt,
    profile,
    xMax,
  };
}

// Lateral GaN HEMT, gate edge to drain. This is an illustrative model, not a
// solution of the 2D problem: the field has a fixed shape (a sharp peak at the
// drain-side gate edge, a second peak at the field-plate edge if there is one,
// and a small uniform part), scaled so its area equals the voltage. The
// depleted length grows with voltage until the 2DEG is empty all the way to
// the drain at Vfull.
export function lateralBlocking({
  V,
  Lgd = 15,
  xFP = 6,
  Ec = 3.3e6,
  fieldPlate = true,
  lambda = 1.0,
  uniform = 0.07,
  Vfull = 100,
  n = 400,
}) {
  const shape = fieldPlate
    ? (x) => 0.55 * Math.exp(-x / lambda) + 0.5 * Math.exp(-Math.abs(x - xFP) / lambda) + uniform
    : (x) => Math.exp(-x / lambda) + uniform;

  const integrate = (L) => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = (L * i) / n;
      const b = (L * (i + 1)) / n;
      s += ((shape(a) + shape(b)) / 2) * (b - a);
    }
    return s; // µm × shape units
  };
  const peakOf = (L) => {
    let m = 0;
    for (let i = 0; i <= n; i++) m = Math.max(m, shape((L * i) / n));
    return m;
  };
  const depletedLength = (volts) => Lgd * Math.min(1, Math.max(0, volts) / Vfull);
  const peakAt = (volts) => {
    const L = depletedLength(volts);
    return L > 0 ? (volts * peakOf(L)) / (integrate(L) * 1e-4) : 0;
  };

  const v = Math.max(0, V);
  const Ldep = depletedLength(v);
  const k = Ldep > 0 ? v / (integrate(Ldep) * 1e-4) : 0; // V/cm per shape unit
  const fieldAt = (x) => (x < 0 || x > Ldep ? 0 : k * shape(x));

  const profile = [];
  for (let i = 0; i <= n; i++) {
    const x = (Ldep * i) / n;
    profile.push([x, fieldAt(x)]);
  }
  if (Ldep < Lgd) profile.push([Ldep, 0], [Lgd, 0]);
  const Epk = profile.reduce((m, [, e]) => Math.max(m, e), 0);

  // Ideal breakdown at the hottest spot. Once the 2DEG is fully depleted the
  // peak grows linearly with voltage; before that, find it by bisection.
  let Vbr = (Ec * integrate(Lgd) * 1e-4) / peakOf(Lgd);
  if (Vbr < Vfull) {
    let lo = 0;
    let hi = Vfull;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (peakAt(mid) < Ec) lo = mid;
      else hi = mid;
    }
    Vbr = (lo + hi) / 2;
  }

  return {
    kind: 'lateral',
    V: v,
    Epk,
    Ec,
    Ldep,
    Vbr,
    fullyDepleted: Ldep >= Lgd,
    fieldAt,
    profile,
    xMax: Lgd,
  };
}

// Dispatch on a device's blocking configuration and the current UI settings.
export function blockingResult(blocking, settings) {
  if (blocking.kind === 'vertical') {
    return verticalBlocking({ V: settings.V, ...blocking.params });
  }
  return lateralBlocking({ V: settings.V, fieldPlate: settings.fieldPlate, ...blocking.params });
}
