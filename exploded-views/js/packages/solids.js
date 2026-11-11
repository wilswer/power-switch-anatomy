// 3D solid helpers for the package models. Coordinates in model units: x runs
// across the part, y up, z toward the front. The viewer turns each solid into
// a mesh (see solidGeometry in viewer.js).

// An axis-aligned box between two corners.
export const box = (x0, y0, z0, x1, y1, z1) => ({ type: 'box', min: [x0, y0, z0], max: [x1, y1, z1] });

// A rectangle in the x–z plane (top view), as an outline for `slab`.
export const rectXZ = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

// A circle in the x–z plane, as an outline for `slab` or as a hole.
export function circleXZ(cx, cz, r, n = 28) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return pts;
}

// An outline in the x–z plane extruded from y0 up to y1, with optional holes.
export const slab = (outline, y0, y1, holes = []) => ({ type: 'slab', outline, y0, y1, holes });

// A vertical cylinder (a pin, a via). A hole for it is circleXZ(cx, cz, r, 20).
export const cylinder = (cx, cz, r, y0, y1) => slab(circleXZ(cx, cz, r, 20), y0, y1);

// A cylinder along an axis ('x', 'y' or 'z'), centered on c = [x, y, z].
export const cyl = (c, r, len, axis = 'y') => ({ type: 'cyl', c, r, len, axis });

// A flexible cable through a list of points.
export const cable = (pts, r) => ({ type: 'tube', pts, r });

const bezier = (a, b, c, d, t) =>
  a.map((_, i) => (1 - t) ** 3 * a[i] + 3 * (1 - t) ** 2 * t * b[i] + 3 * (1 - t) * t * t * c[i] + t ** 3 * d[i]);

// The centerline of a bond wire from a (on the die) to b (on a lead or trace):
// it rises steeply from the bond on the die, arcs over and lands at a shallow
// angle, like a real wedge-bonded loop. Also used as a path for the moving
// current dots, so dots and wire line up.
export function wirePath(a, b, loop) {
  const top = Math.max(a[1], b[1]) + loop;
  const c1 = [a[0] + (b[0] - a[0]) * 0.08, top + loop * 0.15, a[2] + (b[2] - a[2]) * 0.08];
  const c2 = [a[0] + (b[0] - a[0]) * 0.62, top, a[2] + (b[2] - a[2]) * 0.62];
  return Array.from({ length: 13 }, (_, i) => bezier(a, c1, c2, b, i / 12));
}

// A bond wire as a tube of radius r.
export const wire = (a, b, { loop, r }) => ({ type: 'tube', pts: wirePath(a, b, loop), r });

// Turn a list of [x, y, z] points into a current path with lateral spread s.
export const along = (pts, s = 0) => pts.map(([x, y, z]) => [x, y, z, s]);
