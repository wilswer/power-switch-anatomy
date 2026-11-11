// Heat flow through a package, for the Heat view. Pure functions, no three.js,
// so they can be unit-tested with `node --test`.
//
// The model is one-dimensional: heat enters the top of the stack over the
// die's active area and flows straight down, layer by layer, to a surface held
// at a fixed reference temperature (heatsink, cold plate or housing). In each
// layer the heat fans out at 45°, a common rule of thumb, until it reaches the
// layer's edge. A thick, good conductor sitting on a poor one (a copper tab on
// an insulating pad) spreads the heat further sideways before it crosses, out
// to about λ = √(k₁·t₁·t₂ / k₂) on each side. Conductivities are room-
// temperature values; real ones (SiC, Si) fall as they heat up, so hot devices
// run somewhat hotter than this.
//
// Units: thickness and sizes in mm, conductivity in W/(m·K), power in W,
// temperature in °C, thermal resistance in K/W.

const STEPS = 400;

// Thermal resistance of a layer of thickness t whose heat footprint starts at
// foot = [a, b] and grows by 2 mm per mm of depth (45° on every side), but never
// beyond size = [W, L]. Midpoint integration of ∫ dz / (k · A(z)).
export function frustumR([a, b], [W, L], t, k) {
  const dz = t / STEPS;
  let sum = 0;
  for (let i = 0; i < STEPS; i++) {
    const z = (i + 0.5) * dz;
    const area = Math.min(a + 2 * z, W) * Math.min(b + 2 * z, L); // mm²
    sum += dz / area;
  }
  return (sum * 1e3) / k; // mm/mm² = 1/mm → ×1e3 for 1/m
}

// layers: from the heat source down. Each layer has id, t, k, size and, for the
// readouts, name/short and inPackage (counted in the junction-to-case value).
export function thermalStack({ source, layers, P, Tref }) {
  let foot = [Math.min(source[0], layers[0].size[0]), Math.min(source[1], layers[0].size[1])];
  const out = [];
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    const footTop = [Math.min(foot[0], L.size[0]), Math.min(foot[1], L.size[1])];
    const R = frustumR(footTop, L.size, L.t, L.k);
    let grow = L.t;
    const below = layers[i + 1];
    if (below && L.k >= 20 * below.k) grow = Math.max(grow, Math.sqrt((L.k * L.t * below.t) / below.k));
    foot = [Math.min(footTop[0] + 2 * grow, L.size[0]), Math.min(footTop[1] + 2 * grow, L.size[1])];
    out.push({ ...L, footTop, footBottom: foot, R });
  }

  const Rtotal = out.reduce((s, l) => s + l.R, 0);
  const Rjc = out.filter((l) => l.inPackage).reduce((s, l) => s + l.R, 0);
  const Tj = Tref + P * Rtotal;
  let T = Tj;
  for (const l of out) {
    l.Ttop = T;
    l.dT = P * l.R;
    T -= l.dT;
    l.Tbottom = T;
  }
  out.at(-1).Tbottom = Tref; // exact, despite rounding in the subtraction
  return { layers: out, Rtotal, Rjc, Tj, Tref, P };
}
