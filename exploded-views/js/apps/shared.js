import { box, slab, rectXZ } from '../packages/solids.js';

// Helpers shared by the product models.

export const frac = (x) => x - Math.floor(x);

// A triangle wave between 0 and 1 with the given period, 0 at t = 0.
export const tri = (t, period) => 1 - Math.abs(2 * frac(t / period + 0.5) - 1);

// An E-core transformer seen from above: ferrite plates top and bottom, two
// outer legs and a center post, with the winding wrapped around the post and
// bulging out of the core at the front and back (z).
export function transformer({ cx, cz, w, d, y0, y1, bulge }) {
  const pt = (y1 - y0) * 0.18; // plate thickness
  const lw = w * 0.13; // outer leg width
  const pw = w * 0.2; // center post width
  const [x0, x1, z0, z1] = [cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2];
  const core = [
    box(x0, y0, z0, x1, y0 + pt, z1),
    box(x0, y1 - pt, z0, x1, y1, z1),
    box(x0, y0 + pt, z0, x0 + lw, y1 - pt, z1),
    box(x1 - lw, y0 + pt, z0, x1, y1 - pt, z1),
    box(cx - pw / 2, y0 + pt, z0, cx + pw / 2, y1 - pt, z1),
  ];
  const winding = [
    slab(
      rectXZ(x0 + lw + 0.04, z0 - bulge, x1 - lw - 0.04, z1 + bulge),
      y0 + pt + 0.03,
      y1 - pt - 0.03,
      [rectXZ(cx - pw / 2 - 0.03, z0 - 0.03, cx + pw / 2 + 0.03, z1 + 0.03)],
    ),
  ];
  return { core, winding };
}
