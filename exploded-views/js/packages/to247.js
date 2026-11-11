import { box, slab, rectXZ, circleXZ, wire, wirePath, along } from './solids.js';

// The SiC MOSFET of the cell view in a TO-247-4 through-hole package.
// Model units: 1 unit = 2 mm across (x) and along (z, toward the legs). The
// thin layers (die, solder, metal) are drawn several times too thick to see.
// Groups run from −2 (heatsink, below) to 6 (mold compound, lifted well clear).

const X0 = -3.975;
const X1 = 3.975; // body 15.9 mm wide
const Z0 = -5.225;
const Z1 = 5.225; // body 20.9 mm long
const HOLE = circleXZ(0, -2.5, 0.9); // Ø 3.6 mm mounting hole
const TAB_TOP = 1.0; // 2 mm copper
const LEAD_Y = [0.7, 1.0];
const LEAD_END = 9.7; // legs cut short in the drawing
const PIN_X = { drain: -1.905, source: -0.635, kelvin: 0.635, gate: 1.905 }; // 2.54 mm apart
const lead = (x, z0) => box(x - 0.3, LEAD_Y[0], z0, x + 0.3, LEAD_Y[1], LEAD_END);

// The die: 3.6 × 4 mm, soldered to the tab between the hole and the legs.
const DIE = { x0: -0.9, x1: 0.9, z0: -0.4, z1: 1.6 };
const Y = { solder: 1.05, die: 1.21, surface: 1.25, metal: 1.29 };
const INNER = { x0: -0.76, x1: 0.76, z0: -0.26, z1: 1.46 }; // inside the termination ring
const NOTCH = { x: 0.28, z: 1.0 }; // no cells under the gate pad

const activeOutline = [
  [INNER.x0, INNER.z0],
  [INNER.x1, INNER.z0],
  [INNER.x1, NOTCH.z],
  [NOTCH.x, NOTCH.z],
  [NOTCH.x, INNER.z1],
  [INNER.x0, INNER.z1],
];

// The active area drawn as stripes of cells (each stripe stands for about 40
// real ones) to show that the cell repeats across the whole die.
const STRIPES = 14;
const stripeGap = 0.025;
const stripeW = (INNER.x1 - INNER.x0 - (STRIPES - 1) * stripeGap) / STRIPES;
const stripes = Array.from({ length: STRIPES }, (_, i) => {
  const x0 = INNER.x0 + i * (stripeW + stripeGap);
  const z1 = x0 + stripeW > NOTCH.x ? NOTCH.z : INNER.z1;
  return box(x0, Y.die, INNER.z0, x0 + stripeW, Y.surface, z1);
});

const sourcePad = [
  [-0.72, -0.22],
  [0.72, -0.22],
  [0.72, 0.96],
  [0.24, 0.96],
  [0.24, 1.42],
  [-0.72, 1.42],
];

// Bond wires: start on the die (ball end), land on the lead posts.
const W = {
  source: [
    [[-0.45, Y.metal, 0.25], [-0.95, TAB_TOP, 3.75]],
    [[-0.05, Y.metal, 0.35], [-0.5, TAB_TOP, 3.75]],
    [[0.35, Y.metal, 0.25], [-0.05, TAB_TOP, 3.75]],
  ],
  kelvin: [[0.05, Y.metal, 1.2], [PIN_X.kelvin, TAB_TOP, 3.6]],
  gate: [[0.54, Y.metal, 1.24], [PIN_X.gate, TAB_TOP, 3.6]],
};
const LOOP = { source: 0.7, kelvin: 0.55, gate: 0.5 };

// Current paths (conventional current, assembled positions).
const rev = (pts) => pts.slice().reverse();
const loadPaths = W.source.map(([a, b], i) => [
  [PIN_X.drain, 0.85, LEAD_END - 0.1, 0.12],
  [PIN_X.drain, 0.85, 2.9, 0.12],
  [-0.6 + i * 0.3, 0.5, 1.9, 0.35],
  [-0.5 + i * 0.35, 0.6, 0.8, 0.5],
  [a[0], Y.surface, a[2] + 0.3, 0.45],
  ...along(wirePath(a, b, LOOP.source)),
  [b[0], 0.85, 4.1, 0.1],
  [PIN_X.source, 0.85, 5.0, 0.12],
  [PIN_X.source, 0.85, LEAD_END - 0.1, 0.12],
]);
const gatePath = [
  [PIN_X.gate, 0.85, LEAD_END - 0.1, 0.1],
  [PIN_X.gate, 0.85, 3.7, 0.1],
  ...along(rev(wirePath(...W.gate, LOOP.gate))),
  [0.3, Y.surface, 0.9, 0.05],
  [0.05, Y.surface, 1.1, 0.05],
  ...along(wirePath(...W.kelvin, LOOP.kelvin)),
  [PIN_X.kelvin, 0.85, 4.2, 0.08],
  [PIN_X.kelvin, 0.85, LEAD_END - 0.1, 0.08],
];

const toCell = { scale: 'cell', part: null, label: 'Open the cell view' };

export default {
  id: 'sic-package',
  device: 'sic',
  scale: 'package',
  name: 'TO-247-4',
  short: 'TO-247-4',
  kicker: 'SiC MOSFET · through-hole package',
  subtitle: 'The discrete part you can hold: one SiC die in a four-leg plastic package',
  summary: [
    `This is where the cell you explored ends up. Hundreds of thousands of copies of it sit side by side on one die about 3.6 × 4 mm, all wired in parallel under a single aluminum source pad.`,
    `The die is soldered to a thick copper tab, which is the drain. Aluminum wires connect its top to the legs, and black epoxy seals it all. Below it here are an insulating pad and a heatsink, which belong to the circuit, not the package.`,
    `TO-247 is the classic power package: you screw it to a heatsink through the hole. The fourth leg, the Kelvin source, is what makes it a TO-247-4 (see Current).`,
  ],
  stats: [
    ['Body', '15.9 × 20.9 × 5.0 mm, legs ≈ 20 mm'],
    ['Legs', '1 drain · 2 source · 3 Kelvin source · 4 gate; the tab is the drain'],
    ['Typical part', '1200 V, 40 mΩ, ≈ 60 A with the case held at 25 °C'],
    ['Thermal resistance', 'R<sub>th(j-c)</sub> ≈ 0.3–0.6 K/W'],
    ['Look for it in', 'Solar inverters, EV wall chargers, on-board chargers, industrial power supplies'],
  ],
  ladder: [
    ['One cell', '≈ 5 µm wide (the cell view)'],
    ['The die', '3.6 × 4 mm, ≈ 0.2 mm thick · ≈ 600 stripes of cells'],
    ['The package', '15.9 × 20.9 mm body · about 6 g'],
  ],
  legendDie: 'dieSic',
  gap: 1.1,
  drawing: { code: 'PKG-TO247-4-SIC', sizeLabel: 'BODY', size: '15.9 × 20.9 mm' },
  modeLook: {
    current: { explode: 0, xray: true },
    heat: { explode: 'user', xray: false, tintOnly: true },
  },

  parts: [
    {
      id: 'heatsink',
      label: 'Heatsink',
      name: 'Heatsink (part of the circuit)',
      kind: 'heatsink',
      group: -2,
      anchor: [4.9, -1.5, 3.5],
      solids: [
        slab(rectXZ(-5.2, -6.4, 5.2, 6.0), -0.7, -0.1, [HOLE]),
        ...Array.from({ length: 7 }, (_, i) => box(-4.95 + i * 1.6, -2.2, -6.4, -4.65 + i * 1.6, -0.7, 6.0)),
      ],
      info: {
        facts: [
          ['Material', 'Extruded aluminum'],
          ['In this model', 'Held at 60 °C, a warm day inside a converter'],
        ],
        role: `Takes the heat from the package and passes it to the air (or to a liquid cold plate). A screw or spring clip through the hole presses the part flat against it.`,
        why: `The package can only stay as cool as what it is mounted on. A datasheet's current rating assumes the case is held at 25 °C, which no real heatsink manages; that is why real parts carry much less current than the headline number.`,
        look: `Finned aluminum blocks inside inverters and power supplies, often with a row of TO-247s screwed along one edge.`,
      },
    },
    {
      id: 'pad',
      label: 'Insulating pad',
      name: 'Insulating thermal pad (part of the circuit)',
      kind: 'tim',
      group: -1,
      anchor: [4.2, -0.05, -4.6],
      solids: [slab(rectXZ(-4.3, -5.6, 4.3, 5.4), -0.1, 0, [HOLE])],
      info: {
        facts: [
          ['Material', 'Silicone filled with ceramic powder, or a ceramic washer with grease'],
          ['Thickness', '≈ 0.1–0.3 mm'],
          ['Conductivity', '≈ 1–3 W/(m·K), about 200 times worse than copper'],
        ],
        role: `Insulates the tab, which carries the drain voltage, from the grounded heatsink while still letting heat through.`,
        why: `It is the single biggest temperature step in the whole stack (see Heat). Packages with an isolated tab, or modules with a ceramic inside, move this insulator into the part.`,
        look: `A thin gray or pink sheet cut to the TO-247 outline, under the part, with a plastic sleeve around the screw.`,
      },
    },
    {
      id: 'tab',
      label: 'Copper tab (drain)',
      name: 'Copper lead frame and tab',
      kind: 'copper',
      group: 0,
      anchor: [-2.8, TAB_TOP, -4.6],
      solids: [slab(rectXZ(X0, Z0, X1, 2.6), 0, TAB_TOP, [HOLE])],
      info: {
        facts: [
          ['Material', 'Copper, usually nickel- or tin-plated'],
          ['Thickness', '≈ 2 mm under the die, 0.6 mm in the legs'],
          ['Connected to', 'The drain, through the back of the die'],
        ],
        role: `Carries the drain current and spreads the heat from the small die over a much larger area before it crosses the poor conductors below.`,
        why: `Copper conducts heat about as well as SiC and far better than solder or epoxy, so a thick tab lowers the die temperature a lot. Because the tab is the drain, it is live at the full drain voltage when the switch is off.`,
        look: `The metal back of the part and the ring around the hole. On the real part it looks silvery because of the plating.`,
      },
    },
    {
      id: 'drainLead',
      label: 'Leg 1 · drain',
      name: 'Leg 1: drain',
      kind: 'copper',
      group: 0,
      solidInXray: true,
      anchor: [PIN_X.drain, 0.85, 8.6],
      solids: [lead(PIN_X.drain, 2.6)],
      info: {
        facts: [
          ['Connected to', 'The tab, in one piece of copper'],
          ['Carries', 'The full load current'],
        ],
        role: `The drain connection to the circuit board. It is part of the same copper sheet as the tab.`,
        why: `Drain current can also be taken from the tab through the mounting screw, but the leg is the defined connection.`,
        look: `The leftmost leg when you hold the part with the label facing you and the legs pointing down.`,
      },
    },
    {
      id: 'sourceLead',
      label: 'Leg 2 · power source',
      name: 'Leg 2: power source',
      kind: 'copper',
      group: 0,
      solidInXray: true,
      anchor: [PIN_X.source, 0.85, 8.6],
      solids: [box(-1.2, LEAD_Y[0], 3.0, 0.15, LEAD_Y[1], 4.4), lead(PIN_X.source, 4.4)],
      info: {
        facts: [
          ['Inside the package', 'A wide post that the thick source wires land on'],
          ['Carries', 'The full load current'],
        ],
        role: `Returns the load current from the source pad to the circuit.`,
        why: `Together with the source wires it has a few nanohenries of inductance. That is harmless for the load current, but it would disturb the gate if the gate driver used it as its return. That is what leg 3 is for.`,
        look: `The second leg from the left.`,
      },
    },
    {
      id: 'kelvinLead',
      label: 'Leg 3 · Kelvin source',
      name: 'Leg 3: Kelvin (driver) source',
      kind: 'copper',
      group: 0,
      solidInXray: true,
      anchor: [PIN_X.kelvin, 0.85, 8.6],
      solids: [lead(PIN_X.kelvin, 3.0)],
      info: {
        facts: [
          ['Connected to', 'The source pad, through its own thin wire'],
          ['Carries', 'Only the gate-drive current, about an amp for a few nanoseconds'],
        ],
        role: `The return path for the gate driver. It measures the source right at the die, before the load current's voltage drop along the source wires and leg.`,
        why: `Without it, the voltage across the source inductance (V = L·di/dt) would subtract from the gate voltage during every fast switching edge, slowing the switch and adding loss. Fast SiC and GaN parts nearly always have one.`,
        look: `The third leg. A three-leg TO-247 has no Kelvin source; its legs are gate, drain, source.`,
      },
    },
    {
      id: 'gateLead',
      label: 'Leg 4 · gate',
      name: 'Leg 4: gate',
      kind: 'copper',
      group: 0,
      solidInXray: true,
      anchor: [PIN_X.gate, 0.85, 8.6],
      solids: [box(1.4, LEAD_Y[0], 3.0, 2.4, LEAD_Y[1], 4.4), lead(PIN_X.gate, 4.4)],
      info: {
        facts: [
          ['Connected to', 'The gate pad, through a thin wire'],
          ['Drive', '+15 to +18 V on, −3 to −5 V off, relative to leg 3'],
        ],
        role: `Where the gate driver charges and discharges the gate of every cell on the die at once.`,
        why: `The gate pad feeds hundreds of thousands of cell gates through resistive polysilicon, so the die has an internal gate resistance of a few ohms. It limits how fast the far cells switch.`,
        look: `The rightmost leg.`,
      },
    },
    {
      id: 'solder',
      label: 'Die attach',
      name: 'Die attach (solder)',
      kind: 'solder',
      group: 1,
      anchor: [DIE.x1, (TAB_TOP + Y.solder) / 2, -0.2],
      solids: [box(DIE.x0, TAB_TOP, DIE.z0, DIE.x1, Y.solder, DIE.z1)],
      info: {
        facts: [
          ['Material', 'High-lead solder, or sintered silver in newer parts'],
          ['Thickness', '≈ 20–80 µm'],
        ],
        role: `Bonds the back of the die (the drain contact) to the copper tab, electrically and thermally.`,
        why: `Every watt of heat crosses it, so voids or cracks in it make hot spots. It also has to survive years of heating and cooling while SiC and copper expand at different rates; this is a classic wear-out point, and why sintered silver is replacing solder.`,
        look: `Not visible from outside. In X-ray images of a package, voids show up as light spots under the die.`,
      },
    },
    {
      id: 'die',
      label: 'SiC die',
      name: 'The SiC die',
      kind: 'dieSic',
      group: 2,
      anchor: [DIE.x1, (Y.solder + Y.die) / 2, 0.9],
      solids: [box(DIE.x0, Y.solder, DIE.z0, DIE.x1, Y.die, DIE.z1)],
      info: {
        facts: [
          ['Size', '3.6 × 4 mm, ≈ 0.2 mm thick (for 40 mΩ at 1200 V)'],
          ['Back side', 'The drain metal of the cell view'],
          ['Made', 'Hundreds of dies at a time on a 150 or 200 mm wafer, then sawn apart'],
        ],
        role: `The actual transistor. Almost all of its thickness is the n<sup>+</sup> substrate at the bottom of the cell view; the drift layer and cells are a thin skin on top.`,
        why: `The on-resistance falls as the die gets bigger, because more cells share the current. Die area is the main cost of a SiC MOSFET, so a part's R<sub>DS(on)</sub> rating is really a statement about how much SiC is inside.`,
        look: `Hidden under the epoxy. Die photos show a glossy square with a large source pad and a small gate pad.`,
        link: { ...toCell, part: 'substrate' },
      },
    },
    {
      id: 'termination',
      label: 'Edge termination',
      name: 'Edge termination',
      kind: 'termination',
      group: 2,
      anchor: [INNER.x0 - 0.07, Y.surface, 1.2],
      solids: [
        slab(rectXZ(DIE.x0, DIE.z0, DIE.x1, DIE.z1), Y.die, Y.surface, [rectXZ(INNER.x0, INNER.z0, INNER.x1, INNER.z1)]),
      ],
      info: {
        facts: [
          ['Width', '≈ 0.2–0.4 mm around the edge'],
          ['Structure', 'Rings of p-type implant (guard rings or a junction termination extension)'],
        ],
        role: `Lets the blocking voltage taper off gradually toward the sawn edge of the die, where the cells end.`,
        why: `The 1D field picture of Blocking mode holds in the middle of the die. At the edge the junction would curve sharply and the field would crowd, so the die would break down far below 1200 V. The rings spread that field out. They carry no current, so they are area you pay for without getting on-resistance back.`,
        look: `On die photos: the band of fine concentric lines around the edge.`,
        link: { ...toCell, part: 'pwell' },
      },
    },
    {
      id: 'cells',
      label: 'Active area (the cells)',
      name: 'Active area: the cells',
      kind: 'cells',
      group: 2,
      anchor: [-0.3, Y.surface, 0.5],
      solids: stripes,
      info: {
        facts: [
          ['Area', '≈ 10 mm²'],
          ['Cells', '≈ 600 stripes at a 5 µm pitch; each stripe drawn here stands for about 40'],
          ['Depth', 'The top ≈ 12 µm of the die: cells plus drift layer'],
        ],
        role: `Where the cell from the cell view repeats. The stripes run the length of the die, side by side, all switched by one gate and all in parallel.`,
        why: `Current spreads over the whole area, so the on-resistance of the die is the cell's resistance divided by the number of cells. No cells sit under the gate pad, which is one reason the pad is small.`,
        look: `On a die photo, under the metal: a fine, regular texture, too small to see by eye.`,
        link: toCell,
      },
    },
    {
      id: 'sourcePad',
      label: 'Source pad',
      name: 'Source pad (top metal)',
      kind: 'aluminum',
      group: 3,
      solidInXray: true,
      anchor: [-0.4, Y.metal, 1.1],
      solids: [slab(sourcePad, Y.surface, Y.metal)],
      info: {
        facts: [
          ['Material', 'Aluminum, ≈ 4 µm'],
          ['Connected to', 'Every n<sup>+</sup> source and p<sup>+</sup> contact on the die'],
        ],
        role: `The source metal at the top of the cell view, seen from far away: one sheet covering all the cells, big enough to bond several thick wires onto.`,
        why: `It has to spread the full load current evenly over the cells. The wire bonds on it are the part's most common wear-out point: heating and cooling slowly cracks the aluminum at the bond until a wire lifts off.`,
        look: `The large silvery area on a die photo, with the flattened ends of the bond wires on it.`,
        link: { ...toCell, part: 'metal' },
      },
    },
    {
      id: 'gatePad',
      label: 'Gate pad',
      name: 'Gate pad',
      kind: 'aluminum',
      group: 3,
      solidInXray: true,
      anchor: [0.54, Y.metal, 1.24],
      solids: [box(0.36, Y.surface, 1.06, 0.72, Y.metal, 1.42)],
      info: {
        facts: [
          ['Size', '≈ 0.7 mm square'],
          ['Connected to', 'The polysilicon gate of every cell, through metal gate runners'],
        ],
        role: `The landing spot for the gate wire. From here, narrow metal tracks (gate runners) carry the gate signal around and across the die.`,
        why: `Cells far from the pad see the gate signal a little later, through more polysilicon resistance. Large dies need more runners so all cells switch together.`,
        look: `The small separate square at one corner of the die, with one thin wire.`,
        link: { ...toCell, part: 'gate' },
      },
    },
    {
      id: 'sourceWires',
      label: 'Source wires',
      name: 'Source bond wires',
      kind: 'aluminum',
      group: 4,
      solidInXray: true,
      solids: W.source.map(([a, b]) => wire(a, b, { loop: LOOP.source, r: 0.095 })),
      info: {
        facts: [
          ['Material', 'Aluminum, ≈ 380 µm diameter'],
          ['Bonded by', 'Ultrasonic wedge bonding: the wire is rubbed onto the pad until it welds'],
        ],
        role: `Carry the load current from the source pad to leg 2. Several wires share it.`,
        why: `Each wire adds resistance and inductance. Under the repeated heating of each load cycle, the bond to the die's aluminum slowly cracks; wire lift-off is a leading cause of power-device failure. Some newer packages use a copper clip instead.`,
        look: `Visible only in cut-open or X-ray pictures of a package.`,
      },
    },
    {
      id: 'kelvinWire',
      label: 'Kelvin wire',
      name: 'Kelvin source wire',
      kind: 'aluminum',
      group: 4,
      solidInXray: true,
      solids: [wire(...W.kelvin, { loop: LOOP.kelvin, r: 0.05 })],
      info: {
        facts: [
          ['Material', 'Aluminum, ≈ 125–200 µm diameter'],
          ['Carries', 'Gate-drive current only'],
        ],
        role: `Connects the source pad to leg 3, separately from the load-current wires.`,
        why: `Because almost no current flows in it, no L·di/dt voltage builds up along it, so the gate driver sees the true gate-to-source voltage.`,
        look: `In a cut-open package: the thin wire next to the thick ones.`,
      },
    },
    {
      id: 'gateWire',
      label: 'Gate wire',
      name: 'Gate bond wire',
      kind: 'aluminum',
      group: 4,
      solidInXray: true,
      solids: [wire(...W.gate, { loop: LOOP.gate, r: 0.04 })],
      info: {
        facts: [
          ['Material', 'Aluminum or gold, ≈ 125 µm diameter'],
          ['Carries', 'Peaks of about an amp while the gate charges'],
        ],
        role: `Connects the gate pad to leg 4.`,
        why: `Gate current only flows during switching, so a thin wire is enough.`,
        look: `In a cut-open package: the single thin wire to the gate leg.`,
      },
    },
    {
      id: 'mold',
      label: 'Mold compound',
      name: 'Epoxy mold compound',
      kind: 'mold',
      group: 6,
      anchor: [2.6, 2.5, -4.2],
      solids: [slab(rectXZ(X0, Z0, X1, Z1), TAB_TOP, 2.5, [HOLE]), box(X0, 0, 2.6, X1, TAB_TOP, Z1)],
      info: {
        facts: [
          ['Material', 'Epoxy resin with ≈ 80–90 % glass (silica) filler by weight, carbon black'],
          ['Process', 'Transfer molding: hot liquid epoxy is pressed around the lead frame'],
        ],
        role: `Seals the die and wires against moisture and dirt, holds the legs in place, and insulates them from each other.`,
        why: `The filler makes it expand with temperature at nearly the same rate as the copper and die, so heating does not crack the wires or peel the package apart. It conducts heat poorly, so almost no heat leaves through the top.`,
        look: `The black plastic body with the part number laser-marked on it.`,
      },
    },
  ],

  current: {
    title: 'Two current loops',
    steps: [
      `Load current enters through leg 1 and the copper tab, which is the drain.`,
      `It flows up through the die, through all the cells in parallel, and comes out of the source pad on top.`,
      `Three thick wires carry it to leg 2, the power source.`,
      `The gate driver uses its own small loop: in through leg 4 and the gate wire, back out through the Kelvin wire and leg 3.`,
    ],
    note: `Why a fourth leg? The source wires and leg have a few nanohenries of inductance. When the current changes by a few thousand amps per microsecond, that is several volts (V = L·di/dt), which would fight the gate drive at every switching edge. The Kelvin source keeps the gate loop off the shared path. The dots show conventional current, which flows from drain to source: the opposite way to the electrons in the cell view.`,
    dot: 0.07,
    paths: [
      ...loadPaths.map((pts) => ({ kind: 'load', pts })),
      { kind: 'gate', pts: gatePath },
    ],
    counts: { load: 150, gate: 36 },
  },

  heat: {
    title: 'Where the heat goes',
    refName: 'Heatsink',
    Tref: 60,
    Tmax: 175,
    Pmax: 150,
    Pdefault: 40,
    loadNote: '40 W is about what a 40 mΩ part loses carrying 25 A when hot',
    source: [3.0, 3.4],
    refParts: ['heatsink'],
    layers: [
      { id: 'die', name: 'SiC die', short: 'die', t: 0.18, k: 370, size: [3.6, 4.0], inPackage: true, parts: ['die', 'cells', 'termination'] },
      { id: 'solder', name: 'Die attach', short: 'solder', t: 0.05, k: 35, size: [3.6, 4.0], inPackage: true, parts: ['solder'] },
      { id: 'tab', name: 'Copper tab', short: 'Cu tab', t: 2.0, k: 390, size: [15.6, 14], inPackage: true, parts: ['tab'] },
      { id: 'pad', name: 'Insulating pad', short: 'pad', t: 0.2, k: 1.6, size: [16, 20], parts: ['pad'] },
    ],
    text: [
      `Nearly all the heat is made in the top few micrometers of the die. It leaves downward, through the solder, the copper tab and the insulating pad into the heatsink, which this model holds at 60 °C. Very little leaves through the epoxy on top, so the model ignores it.`,
      `The thin pad costs more temperature than everything inside the package together, because the tab is live at the drain voltage and has to be insulated from the heatsink. The datasheet's R<sub>th(j-c)</sub> covers only the layers down to the back of the tab.`,
    ],
  },
};
