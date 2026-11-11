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

  // Package materials. Dies keep the color of the layer that makes up most of
  // them in the cell view, so the link between the two scales stays visible.
  dieSic: { label: '4H-SiC die · mostly n<sup>+</sup> substrate', color: '#1f4cb0' },
  dieSi: { label: 'Silicon die · mostly n<sup>−</sup> drift', color: '#a7c6ef' },
  dieGan: { label: 'GaN-on-silicon die', color: '#5a616e' },
  epi: { label: 'GaN epitaxial layers', color: '#d9cf9e' },
  cells: { label: 'Active area · the cells', color: '#3f78d4' },
  termination: { label: 'Edge termination · p-type rings', color: '#e48a97' },
  copper: { label: 'Copper', color: '#c9825a', metalness: 0.6, roughness: 0.38 },
  aluminum: { label: 'Aluminum', color: '#c3c9d1', metalness: 0.55, roughness: 0.32 },
  solder: { label: 'Solder or sintered silver', color: '#a9a398', metalness: 0.35, roughness: 0.5 },
  mold: { label: 'Epoxy mold compound', color: '#2c2f34', roughness: 0.8 },
  ceramic: { label: 'Ceramic insulator', color: '#ebe6da', roughness: 0.75 },
  gel: { label: 'Silicone gel', color: '#efd28f', opacity: 0.22, roughness: 0.3 },
  plastic: { label: 'Glass-filled plastic', color: '#4a5058', roughness: 0.7 },
  fr4: { label: 'Circuit board · glass-fiber epoxy', color: '#4f8a5c', roughness: 0.7 },
  tim: { label: 'Thermal interface material', color: '#c7b2cf', roughness: 0.85 },
  heatsink: { label: 'Aluminum heatsink', color: '#9aa3ad', metalness: 0.35, roughness: 0.55 },

  // Product materials.
  plasticLight: { label: 'Plastic', color: '#e4e6e9', roughness: 0.6 },
  capacitor: { label: 'Electrolytic capacitor', color: '#2d3f5c', roughness: 0.5 },
  filmCap: { label: 'Film capacitor', color: '#d7c27a', roughness: 0.6 },
  ferrite: { label: 'Ferrite', color: '#3a3a3d', roughness: 0.9 },
  cable: { label: 'Cable', color: '#33373d', roughness: 0.7 },
  hvCable: { label: 'High-voltage cable', color: '#ee7d1f', roughness: 0.6 },
  motor: { label: 'Painted cast iron', color: '#4d6a8c', metalness: 0.2, roughness: 0.55 },
  steel: { label: 'Steel', color: '#aeb5bd', metalness: 0.6, roughness: 0.35 },
};

export const ELECTRON = '#1ec0ea';
export const HOLE = '#ff9526';
// Package views show conventional current, so it gets its own colors.
export const CURRENT = '#ffd23f'; // load current
export const GATE_CURRENT = '#4ee08c'; // gate-drive current

// Temperature color ramp for the Heat view, 0 = the reference (heatsink)
// temperature, 1 = the maximum junction temperature. A thermal-camera style
// "semantic heat" ramp whose lightness rises steadily from cool to hot, so it
// still reads in order without color vision. Kept apart from the field ramp
// below: it starts in blue, not purple, and ends in cream, not yellow.
const THERMAL_STOPS = [
  [0, [0x22, 0x30, 0x6e]],
  [0.18, [0x5b, 0x2a, 0x86]],
  [0.38, [0xa8, 0x32, 0x6e]],
  [0.56, [0xdd, 0x5a, 0x3a]],
  [0.74, [0xf3, 0x9a, 0x2c]],
  [0.9, [0xfb, 0xd3, 0x5a]],
  [1, [0xff, 0xf4, 0xc2]],
];

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

function rampRGB(stops, t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    if (x <= t1) {
      const [t0, c0] = stops[i - 1];
      const f = (x - t0) / (t1 - t0);
      return c0.map((v, k) => (v + (c1[k] - v) * f) / 255);
    }
  }
  return stops.at(-1)[1].map((v) => v / 255);
}

// sRGB components in 0..1 for a field fraction t (clamped to 0..1).
export const fieldColorRGB = (t) => rampRGB(FIELD_STOPS, t);

// sRGB components in 0..1 for a temperature fraction t (clamped to 0..1).
export const thermalColorRGB = (t) => rampRGB(THERMAL_STOPS, t);

export const thermalColorCSS = (t) => {
  const [r, g, b] = thermalColorRGB(t).map((v) => Math.round(v * 255));
  return `rgb(${r} ${g} ${b})`;
};

export const THERMAL_GRADIENT_CSS = `linear-gradient(90deg, ${THERMAL_STOPS.map(
  ([t, [r, g, b]]) => `rgb(${r} ${g} ${b}) ${t * 100}%`,
).join(', ')})`;
