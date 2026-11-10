// Material kinds for the device models. One color rule holds across all three
// devices: n-type silicon/SiC is blue, p-type is red, and heavier doping means a
// deeper color. Everything else gets a material color. Model colors are the
// same in light and dark themes; only the page around them changes.

export const KIND = {
  metal: { label: 'Metal', color: '#b9c0c9', metalness: 0.55, roughness: 0.34 },
  poly: { label: 'Doped polysilicon', color: '#c2683b' },
  oxide: { label: 'Silicon dioxide', color: '#8fd3f0', opacity: 0.6 },
  ild: { label: 'Deposited oxide', color: '#c9dfe9', opacity: 0.5 },
  nitride: { label: 'Silicon nitride', color: '#b9e4c8', opacity: 0.5 },
  nPlus: { label: 'n<sup>+</sup> · heavily doped n-type', color: '#1f4cb0' },
  n: { label: 'n · moderately doped n-type', color: '#3f78d4' },
  nJfet: { label: 'n · lightly enhanced n-type', color: '#7aa3e5' },
  nMinus: { label: 'n<sup>−</sup> · lightly doped n-type', color: '#a7c6ef' },
  p: { label: 'p · moderately doped p-type', color: '#e48a97' },
  pPlus: { label: 'p<sup>+</sup> · heavily doped p-type', color: '#b2253d' },
  channel: {
    label: 'Electrons (inversion layer)',
    color: '#2bd0f0',
    emissive: '#18b6dc',
    emissiveIntensity: 0.8,
  },
  plasma: {
    label: 'Electrons and holes',
    color: '#b48cff',
    opacity: 0.32,
    emissive: '#7a4fe0',
    emissiveIntensity: 0.35,
  },
  siSub: { label: 'Silicon', color: '#5a616e' },
  transition: { label: 'AlN / AlGaN', color: '#cdc6b2' },
  ganBuffer: { label: 'GaN, carbon-doped', color: '#8d8676' },
  ganChannel: { label: 'GaN, undoped', color: '#d9cf9e' },
  twodeg: {
    label: 'Electron sheet (2DEG)',
    color: '#2bd0f0',
    emissive: '#18b6dc',
    emissiveIntensity: 0.9,
  },
  algan: { label: 'AlGaN', color: '#e7ae45' },
  pGan: { label: 'p-type GaN', color: '#d8667a' },
};

export const ELECTRON = '#1ec0ea';
export const HOLE = '#ff9526';

// Electric-field color ramp (inferno-like), 0 = no field, 1 = critical field.
const FIELD_STOPS = [
  [0, [0x2d, 0x0b, 0x4e]],
  [0.25, [0x6b, 0x1a, 0x6e]],
  [0.5, [0xb8, 0x35, 0x5a]],
  [0.75, [0xee, 0x6a, 0x24]],
  [1, [0xfb, 0xd1, 0x3a]],
];

export const FIELD_GRADIENT_CSS = `linear-gradient(90deg, ${FIELD_STOPS.map(
  ([t, [r, g, b]]) => `rgb(${r} ${g} ${b}) ${t * 100}%`,
).join(', ')})`;

// sRGB components in 0..1 for a field fraction t (clamped to 0..1).
export function fieldColorRGB(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < FIELD_STOPS.length; i++) {
    const [t1, c1] = FIELD_STOPS[i];
    if (x <= t1) {
      const [t0, c0] = FIELD_STOPS[i - 1];
      const f = (x - t0) / (t1 - t0);
      return c0.map((v, k) => (v + (c1[k] - v) * f) / 255);
    }
  }
  return FIELD_STOPS.at(-1)[1].map((v) => v / 255);
}
