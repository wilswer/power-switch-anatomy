import { thermalStack } from './thermal.js';

// Wear-out of a package, for the "Age it" controls in Heat mode, and a
// simulated power-cycling test. Pure functions, no DOM.
//
// Two mechanisms, each with the indicator a reliability lab measures:
// - the die attach cracks in from its edges, so heat crosses only the middle
//   that is left: the thermal resistance R_th(j-c) rises (end of life +20 %);
// - bond wires on the die lift off one by one, so the rest share the current:
//   the on-state voltage at the load current rises (end of life +5 %).
// Both feed back: the losses grow with the on-state voltage, and the die runs
// hotter, which raises the on-state voltage again.

export const EOL = { Rth: 0.2, Von: 0.05 };

// The joint keeps (1 − crack) of its area, centered, with the same shape.
export function crackedLayers(layers, jointId, crack) {
  const s = Math.sqrt(Math.max(0, 1 - crack));
  return layers.map((l) => (l.id === jointId ? { ...l, size: l.size.map((d) => d * s) } : l));
}

// On-state voltage at the load current: the die's own drop, which rises with
// temperature, plus the wires on the die in parallel.
export function onVoltage(el, Tj, lifted = 0) {
  return el.Vdie25 * (1 + el.tempco * (Tj - 25)) + (el.I * el.Rwire) / (el.wires - lifted);
}

// The package in steady state with `P` watts lost in the healthy die, aged by
// `crack` (fraction of the die attach area) and `lifted` wires. The current is
// unchanged, so the losses scale with the on-state voltage; that and the
// voltage's rise with temperature are solved together.
export function agedHeat(heat, aging, { P, crack = 0, lifted = 0 }) {
  const el = aging.electrical;
  const stack = (layers, p) => thermalStack({ source: heat.source, layers, P: p, Tref: heat.Tref });
  const healthy = stack(heat.layers, P);
  const V0 = onVoltage(el, healthy.Tj);
  const layers = crackedLayers(heat.layers, aging.joint.layer, crack);
  let Peff = P;
  let runaway = false;
  for (let i = 0; i < 200; i++) {
    const next = (P * onVoltage(el, stack(layers, Peff).Tj, lifted)) / V0;
    const done = Math.abs(next - Peff) <= 1e-5 * Math.max(1, P);
    Peff = next;
    if (done) break;
    if (Peff > 20 * Math.max(1, P)) {
      runaway = true; // the losses heat the die faster than it can shed them
      break;
    }
  }
  const result = stack(layers, Peff);
  const V = onVoltage(el, result.Tj, lifted);
  const dR = healthy.Rjc > 0 ? result.Rjc / healthy.Rjc - 1 : 0;
  const dV = V / V0 - 1;
  return {
    healthy,
    result,
    P: Peff,
    V0,
    V,
    dR,
    dV,
    runaway,
    eol: { Rth: dR >= EOL.Rth - 1e-9, Von: dV >= EOL.Von - 1e-9 },
  };
}

// ---------- the simulated power-cycling test ----------

// Illustrative calibration, not a real part's: at an 80 K swing a typical
// bond wire lasts about 60 000 cycles, and the die attach loses about a
// third of its area in as many. Damage grows with the fifth power of the
// swing (Coffin–Manson), wire lives scatter like a Weibull distribution with
// shape 3 (wear-out), and each lifted wire loads the remaining ones more.
export const TEST = {
  dTref: 80,
  exponent: 5,
  wireLife: 60000,
  weibullShape: 3,
  crackPerCycle: 0.35 / 60000,
  crackScatter: 0.35, // spread of the crack rate between devices (log-normal σ)
  maxCrack: 0.9,
  samples: 250,
};

// A small seeded random generator (mulberry32), so a test can be replayed.
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Run one device to end of life: the load switches on and off, so the
// junction swings between the heatsink temperature and its hot steady state
// at `P` watts (the healthy die's losses). The indicators are read hot at the
// load current after each heating, as power-cycling tests do. Returns the
// curves, the cycles at which wires lifted, and when and why it failed.
export function powerCyclingTest(heat, aging, { P, seed = 1, cfg = TEST } = {}) {
  const rnd = random(seed);
  const n0 = aging.electrical.wires;
  // Each wire lifts once the shared damage passes its own Weibull draw.
  const limits = Array.from({ length: n0 }, () => (-Math.log(1 - rnd())) ** (1 / cfg.weibullShape)).sort((a, b) => a - b);
  const gauss = Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const crackRate = cfg.crackPerCycle * Math.exp(cfg.crackScatter * gauss);

  const start = agedHeat(heat, aging, { P });
  const swing0 = start.result.Tj - heat.Tref;
  // Below a kelvin of swing nothing wears out within any test's patience.
  if (!(swing0 >= 1)) {
    return { points: [{ N: 0, dR: 0, dV: 0, lifted: 0, crack: 0, Tj: start.result.Tj }], lifts: [], end: null, swing: swing0, life: Infinity };
  }
  const life = cfg.wireLife * (cfg.dTref / swing0) ** cfg.exponent; // cycles, at the starting swing
  const dN = life / cfg.samples;

  const points = [];
  const lifts = [];
  let crack = 0;
  let lifted = 0;
  let damage = 0;
  let end = null;
  for (let N = 0; N <= 12 * life; N += dN) {
    const s = agedHeat(heat, aging, { P, crack, lifted });
    points.push({ N, dR: s.dR, dV: s.dV, lifted, crack, Tj: s.result.Tj });
    if (s.runaway) end = { N, cause: 'runaway' };
    else if (s.eol.Rth) end = { N, cause: 'Rth' };
    else if (s.eol.Von) end = { N, cause: 'Von' };
    if (end) break;
    const accel = ((s.result.Tj - heat.Tref) / cfg.dTref) ** cfg.exponent;
    crack = Math.min(cfg.maxCrack, crack + crackRate * accel * dN);
    damage += (accel * (n0 / (n0 - lifted)) ** 2 * dN) / cfg.wireLife;
    while (lifted < n0 && damage >= limits[lifted]) {
      lifted += 1;
      lifts.push(N + dN);
    }
    if (lifted >= n0) {
      end = { N: N + dN, cause: 'open' }; // the last wire is gone: the die is cut off
      break;
    }
  }
  return { points, lifts, end, swing: swing0, life };
}

export const CAUSES = {
  Rth: 'R<sub>th</sub> +20 %',
  Von: 'on-state voltage +5 %',
  open: 'all wires lifted',
  runaway: 'thermal runaway',
};
