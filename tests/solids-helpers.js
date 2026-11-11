// Geometry helpers for the package and product tests: footprints, height
// ranges and point tests for the 3D solids, and an overlap search.

// Even-odd point-in-polygon test in the x–z plane.
export function inside([px, pz], poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

// Footprint (x–z bounding box), height range and an exact point test.
// Horizontal cylinders are tested by their bounding box, which is stricter.
export function shape(s) {
  if (s.type === 'box') {
    const [x0, y0, z0] = s.min;
    const [x1, y1, z1] = s.max;
    return { y0, y1, bb: [x0, z0, x1, z1], has: ([x, z]) => x > x0 && x < x1 && z > z0 && z < z1 };
  }
  if (s.type === 'cyl') {
    const [cx, cy, cz] = s.c;
    const h = s.len / 2;
    if (s.axis === 'y') {
      return {
        y0: cy - h,
        y1: cy + h,
        bb: [cx - s.r, cz - s.r, cx + s.r, cz + s.r],
        has: ([x, z]) => Math.hypot(x - cx, z - cz) < s.r,
      };
    }
    const [hx, hz] = s.axis === 'x' ? [h, s.r] : [s.r, h];
    const bb = [cx - hx, cz - hz, cx + hx, cz + hz];
    return { y0: cy - s.r, y1: cy + s.r, bb, has: ([x, z]) => x > bb[0] && x < bb[2] && z > bb[1] && z < bb[3] };
  }
  const xs = s.outline.map((p) => p[0]);
  const zs = s.outline.map((p) => p[1]);
  return {
    y0: s.y0,
    y1: s.y1,
    bb: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)],
    has: (pt) => inside(pt, s.outline) && !(s.holes ?? []).some((h) => inside(pt, h)),
  };
}

// Every non-tube solid of a model, tagged with its part (a pickAs part counts
// as the part it picks as). Parts whose kind is in `skipKinds` are left out.
export const solidsOfModel = (model, skipKinds = new Set()) =>
  model.parts
    .filter((p) => !skipKinds.has(p.kind))
    .flatMap((p) =>
      (p.solids ?? []).filter((s) => s.type !== 'tube').map((s) => ({ id: p.pickAs ?? p.id, kind: p.kind, ...shape(s) })),
    );

// The first place where two solids of different parts share volume, or null.
export function overlaps(solids) {
  for (let a = 0; a < solids.length; a++) {
    for (let b = a + 1; b < solids.length; b++) {
      const A = solids[a];
      const B = solids[b];
      if (A.id === B.id) continue;
      if (Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) <= 1e-9) continue; // stacked, not overlapping
      const x0 = Math.max(A.bb[0], B.bb[0]);
      const z0 = Math.max(A.bb[1], B.bb[1]);
      const x1 = Math.min(A.bb[2], B.bb[2]);
      const z1 = Math.min(A.bb[3], B.bb[3]);
      if (x1 <= x0 || z1 <= z0) continue;
      for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 24; j++) {
          const pt = [x0 + ((x1 - x0) * (i + 0.5)) / 24, z0 + ((z1 - z0) * (j + 0.5)) / 24];
          if (A.has(pt) && B.has(pt)) return { a: A.id, b: B.id, x: pt[0], z: pt[1] };
        }
      }
    }
  }
  return null;
}
