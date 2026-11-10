// Polygon helpers for the cell cross-sections. A polygon is a list of [x, y]
// points in model units; x runs across the cell, y runs up. The viewer extrudes
// each polygon into the screen to make a 3D slab.

export const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

// Points along a circular arc from angle a0 to a1 (radians), both ends included.
export function arc(cx, cy, r, a0, a1, n = 8) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// Mirror a polygon across x = 0, keeping its winding direction.
export const mirrorX = (poly) => poly.map(([x, y]) => [-x, y]).reverse();

// Mirror a carrier path ([x, y, spreadX, spreadY] points) across x = 0.
export const mirrorPath = (pts) => pts.map(([x, y, sx, sy]) => [-x, y, sx, sy]);

// The top of a planar vertical MOS cell, shared by the SiC MOSFET and the IGBT:
// two p-wells with n+ sources and p+ contacts, the JFET neck between them, the
// gate stack over the neck, and the top metal. T is the semiconductor surface.
export function planarCell(T, half = 5) {
  const wellDepth = 1.0;
  const wellInner = 1.6; // |x| of the p-well's inner edge (JFET half-width)
  const r = 0.4; // rounding of the p-well's bottom inner corner
  const srcInner = 2.2; // |x| of the n+ source's inner edge (channel starts here)
  const srcOuter = 3.6; // |x| where the n+ source meets the p+ contact
  const srcDepth = 0.4;
  const ppDepth = 0.55;
  const oxHalf = 2.5;
  const oxTop = T + 0.15;
  const gateHalf = 2.4;
  const gateTop = T + 0.75;
  const ildHalf = 2.9;
  const ildTop = T + 1.15;
  const metalTop = T + 1.9;
  const yj = T - wellDepth; // p-well / drift junction depth

  const wellL = [
    [-half, yj],
    ...arc(-(wellInner + r), yj + r, r, -Math.PI / 2, 0),
    [-wellInner, T],
    [-srcInner, T],
    [-srcInner, T - srcDepth],
    [-srcOuter, T - srcDepth],
    [-srcOuter, T - ppDepth],
    [-half, T - ppDepth],
  ];

  const jfet = [
    ...arc(wellInner + r, yj + r, r, -Math.PI / 2, -Math.PI),
    [wellInner, T],
    [-wellInner, T],
    ...arc(-(wellInner + r), yj + r, r, 0, -Math.PI / 2).slice(0, -1),
  ];

  const ild = [
    [-ildHalf, T],
    [-oxHalf, T],
    [-oxHalf, oxTop],
    [-gateHalf, oxTop],
    [-gateHalf, gateTop],
    [gateHalf, gateTop],
    [gateHalf, oxTop],
    [oxHalf, oxTop],
    [oxHalf, T],
    [ildHalf, T],
    [ildHalf, ildTop],
    [-ildHalf, ildTop],
  ];

  const metal = [
    [-half, T],
    [-ildHalf, T],
    [-ildHalf, ildTop],
    [ildHalf, ildTop],
    [ildHalf, T],
    [half, T],
    [half, metalTop],
    [-half, metalTop],
  ];

  const nL = rect(-srcOuter, T - srcDepth, -srcInner, T);
  const pL = rect(-half, T - ppDepth, -srcOuter, T);
  const chL = rect(-srcInner, T - 0.07, -wellInner, T + 0.004);

  return {
    T,
    yj,
    top: metalTop,
    wellL,
    wellR: mirrorX(wellL),
    jfet,
    nL,
    nR: mirrorX(nL),
    pL,
    pR: mirrorX(pL),
    chL,
    chR: mirrorX(chL),
    oxide: rect(-oxHalf, T, oxHalf, oxTop),
    gate: rect(-gateHalf, oxTop, gateHalf, gateTop),
    ild,
    metal,
  };
}
