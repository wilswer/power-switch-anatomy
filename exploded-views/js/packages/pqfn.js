import { box, slab, rectXZ, circleXZ, cylinder, wire, wirePath, along } from './solids.js';

// The GaN HEMT of the cell view in a PQFN 8 × 8 surface-mount package, as
// soldered onto a circuit board. Model units: 1 unit = 1 mm across; all
// thicknesses are drawn several times too thick. Drain lands run along the
// back edge (+z), the source pad fills the middle and front, and the gate and
// Kelvin source lands sit at the front right corner. Groups run from −5 (the
// charger case, below) to 6 (mold compound).

const Y = { frame: 0.25, attach: 0.31, si: 0.56, epi: 0.62, metal: 0.66, mold: 1.25 };

const padOutline = [
  [-3.6, -4.0],
  [0.5, -4.0],
  [0.5, -2.9],
  [3.6, -2.9],
  [3.6, 1.6],
  [-3.6, 1.6],
];
const LAND = {
  drain: rectXZ(-3.6, 2.6, 3.6, 4.0),
  kelvin: rectXZ(1.0, -4.0, 2.1, -3.2),
  gate: rectXZ(2.5, -4.0, 3.6, -3.2),
};

const DIE = { x0: -2.2, x1: 2.2, z0: -1.5, z1: 1.1 }; // 4.4 × 2.6 mm
const dieBox = (y0, y1) => box(DIE.x0, y0, DIE.z0, DIE.x1, y1, DIE.z1);
const FW = 0.08; // half-width of a finger
const drainMetal = [
  box(-2.0, Y.epi, 0.6, 2.0, Y.metal, 0.95),
  ...[-1.6, -0.8, 0, 0.8, 1.6].map((x) => box(x - FW, Y.epi, -0.75, x + FW, Y.metal, 0.6)),
];
const sourceMetal = [
  box(-2.0, Y.epi, -1.35, 1.35, Y.metal, -1.0),
  ...[-1.2, -0.4, 0.4, 1.2].map((x) => box(x - FW, Y.epi, -1.0, x + FW, Y.metal, 0.45)),
];

// Bond wires, die end first.
const DX = [-1.5, -0.5, 0.5, 1.5];
const SX = [-1.8, -1.1, -0.4, 0.3];
const drainW = DX.map((x) => [[x, Y.metal, 0.78], [x, Y.frame, 3.0]]);
const sourceW = SX.map((x) => [[x, Y.metal, -1.18], [x, Y.frame, -3.45]]);
const kelvinW = [[1.0, Y.metal, -1.18], [1.55, Y.frame, -3.6]];
const gateW = [[1.75, Y.metal, -1.15], [3.05, Y.frame, -3.6]];
const LOOP = 0.5;

// Thermal vias under the pad.
const VIA_X = [-2.4, -1.2, 0, 1.2, 2.4];
const VIA_Z = [-2.3, -1.2, -0.1, 1.0];
const VIAS = VIA_X.flatMap((x) => VIA_Z.map((z) => [x, z]));
const BOARD = rectXZ(-6, -6.5, 6, 6.5);
const PCB_Y = { cu: -0.06, top: -0.14, bottom: -1.3 };

const rev = (pts) => pts.slice().reverse();
const loadPaths = DX.map((dx, i) => {
  const sx = SX[i];
  return [
    [dx, 0.12, 3.9, 0.12],
    [dx, 0.15, 3.0, 0.1],
    ...along(rev(wirePath(...drainW[i], LOOP))),
    [dx, Y.epi, 0.3, 0.3],
    [(dx + sx) / 2, Y.epi - 0.02, -0.4, 0.35],
    ...along(wirePath(...sourceW[i], LOOP)),
    [sx, 0.12, -3.5, 0.1],
    [sx, 0.12, -3.95, 0.1],
  ];
});
const gatePath = [
  [3.05, 0.12, -3.95, 0.08],
  [3.05, 0.15, -3.6, 0.05],
  ...along(rev(wirePath(...gateW, LOOP))),
  [1.4, Y.metal, -0.4, 0.15],
  [1.0, Y.metal, -1.18, 0.05],
  ...along(wirePath(...kelvinW, LOOP)),
  [1.55, 0.12, -3.95, 0.08],
];

const toCell = { scale: 'cell', part: null };

export default {
  id: 'gan-package',
  device: 'gan',
  scale: 'package',
  name: 'PQFN 8 × 8',
  short: 'PQFN 8 × 8',
  kicker: 'GaN HEMT · surface-mount package',
  subtitle: 'A flat, legless package soldered straight onto the circuit board',
  summary: [
    `Because the GaN HEMT is lateral, its source, gate and drain all come out on the top of the die, as long interleaved metal fingers. Each finger pair is one cell of the cell view, repeated a hundred or more times across the die.`,
    `The die sits on a copper pad that is soldered flat onto the circuit board. There are no legs, only metal lands on the underside, which keeps the inductance of the current loop very low, as fast switching needs.`,
    `The heat goes down through the pad into the board, so the board's copper and the thermal vias under the part are the heatsink. Below the part here are the solder, the board, a gap pad and the charger's metal case.`,
  ],
  stats: [
    ['Body', '8 × 8 × 0.85 mm'],
    ['Connections', 'Drain lands on one edge; the large pad is the source; small gate and Kelvin source lands'],
    ['Typical part', '650 V, 50 mΩ, ≈ 30 A with the case held at 25 °C'],
    ['Thermal resistance', 'R<sub>th(j-c)</sub> ≈ 0.3–1 K/W, to the bottom pad'],
    ['Look for it in', 'USB-C laptop and phone chargers, server power supplies, solar microinverters'],
  ],
  ladder: [
    ['One cell', '≈ 25 µm from source to source (the cell view)'],
    ['The die', '4.4 × 2.6 mm: ≈ 5 µm of GaN on ≈ 0.2 mm of silicon · ≈ 150 finger pairs'],
    ['The package', '8 × 8 × 0.85 mm, flat on the board'],
  ],
  legendDie: 'dieGan',
  gap: 0.75,
  drawing: { code: 'PKG-PQFN88-GAN', sizeLabel: 'BODY', size: '8 × 8 mm' },
  modeLook: {
    current: { explode: 0, xray: true },
    heat: { explode: 'user', xray: false, tintOnly: true },
  },

  parts: [
    {
      id: 'case',
      label: 'Charger case',
      name: 'Charger case or heat spreader (part of the product)',
      kind: 'heatsink',
      group: -5,
      anchor: [6.6, -2.05, 4.5],
      solids: [box(-7, -2.3, -7, 7, -1.8, 7)],
      info: {
        facts: [
          ['Material', 'Aluminum, or a copper or graphite spreader inside a plastic case'],
          ['In this model', 'Held at 60 °C'],
        ],
        role: `Spreads the heat from the board and passes it to the air around the product.`,
        why: `A charger has no fan and no finned heatsink, so the whole product surface does the cooling. That is a big reason chargers use GaN: it wastes so little power that a small, sealed case can carry the heat away.`,
        look: `The metal plate or foil you find under the board when a charger is taken apart.`,
      },
    },
    {
      id: 'gapPad',
      label: 'Gap pad',
      name: 'Gap pad (part of the product)',
      kind: 'tim',
      group: -4,
      anchor: [5.0, -1.55, -3],
      solids: [box(-5, -1.8, -5, 5, PCB_Y.bottom, 5)],
      info: {
        facts: [
          ['Material', 'Soft silicone filled with ceramic powder'],
          ['Thickness', '≈ 0.5–2 mm'],
          ['Conductivity', '≈ 1–5 W/(m·K)'],
        ],
        role: `Fills the uneven gap between the back of the board and the case, and insulates them.`,
        why: `It is soft so it can squash around components and absorb tolerances, which makes it a poor conductor. In this stack it and the board account for almost all the temperature rise.`,
        look: `A gray, blue or pink rubbery sheet stuck to the board or the case.`,
      },
    },
    {
      id: 'fr4',
      label: 'Circuit board',
      name: 'Circuit board',
      kind: 'fr4',
      group: -3,
      anchor: [-6, -0.7, 3.5],
      solids: [slab(BOARD, PCB_Y.bottom, PCB_Y.top, VIAS.map(([x, z]) => circleXZ(x, z, 0.2, 20)))],
      info: {
        facts: [
          ['Material', 'FR-4: glass-fiber cloth in epoxy, with copper layers'],
          ['Thickness', '≈ 1.6 mm'],
          ['Conductivity', '≈ 0.3 W/(m·K) through the board, almost an insulator'],
        ],
        role: `Carries the copper traces that connect the transistor to the rest of the circuit, and here also the heat path down to the case.`,
        why: `FR-4 itself barely conducts heat. Without vias under the part, the GaN die would overheat at a few watts.`,
        look: `The green board itself.`,
      },
    },
    {
      id: 'vias',
      label: 'Thermal vias',
      name: 'Thermal vias',
      kind: 'copper',
      group: -3,
      anchor: [2.4, PCB_Y.top, 1.0],
      solids: VIAS.map(([x, z]) => cylinder(x, z, 0.2, PCB_Y.bottom, PCB_Y.top)),
      info: {
        facts: [
          ['What', 'Copper-plated holes, ≈ 0.3 mm across, often filled'],
          ['Board with vias', '≈ 10 W/(m·K) through the board under the pad, about 30 times bare FR-4'],
        ],
        role: `Copper chimneys through the board that carry heat from the pad on top to the copper and gap pad underneath.`,
        why: `Their number and size set the board's thermal resistance, so they are as much part of the cooling design as the package itself.`,
        look: `A grid of tiny holes in the copper under where a flat chip sits, or dots on the back of the board.`,
      },
    },
    {
      id: 'pcbCopper',
      label: 'Board copper',
      name: 'Board copper (traces and pads)',
      kind: 'copper',
      group: -2,
      solidInXray: true,
      anchor: [-5.5, PCB_Y.cu, -5.0],
      solids: [
        slab(
          [
            [-5.5, -6],
            [0.6, -6],
            [0.6, -2.75],
            [5.5, -2.75],
            [5.5, 1.9],
            [-5.5, 1.9],
          ],
          PCB_Y.top,
          PCB_Y.cu,
          VIAS.map(([x, z]) => circleXZ(x, z, 0.2, 20)),
        ),
        box(0.95, PCB_Y.top, -6, 2.15, PCB_Y.cu, -3.15),
        box(2.45, PCB_Y.top, -6, 3.65, PCB_Y.cu, -3.15),
        box(-5.5, PCB_Y.top, 2.2, 5.5, PCB_Y.cu, 6.0),
      ],
      info: {
        facts: [
          ['Thickness', '35–70 µm (1–2 oz per square foot)'],
          ['Areas', 'A source pour under the pad, a drain pour, thin gate and Kelvin traces'],
        ],
        role: `Connects the transistor to the circuit and spreads heat sideways before it goes down through the board.`,
        why: `In a GaN design the shape of this copper matters a lot: the loop from drain through the transistor and back via the input capacitor must be tiny, because every nanohenry rings at the fast switching edges.`,
        look: `The copper areas around a chip, under the green solder mask.`,
      },
    },
    {
      id: 'boardSolder',
      label: 'Board solder',
      name: 'Solder to the board',
      kind: 'solder',
      group: -1,
      anchor: [-3.6, -0.03, -1],
      solids: [slab(padOutline, -0.06, 0), slab(LAND.drain, -0.06, 0), slab(LAND.kelvin, -0.06, 0), slab(LAND.gate, -0.06, 0)],
      info: {
        facts: [
          ['Material', 'Tin-silver-copper (SAC) solder paste, reflowed'],
          ['Thickness', '≈ 50–100 µm'],
        ],
        role: `Holds the package to the board and connects every land, including the large pad underneath.`,
        why: `Voids under the big pad block heat. Board makers print the paste in a window pattern and check the joint by X-ray, because it cannot be seen once the part is down.`,
        look: `Only the thin shiny fillets at the package edge are visible.`,
      },
    },
    {
      id: 'pad',
      label: 'Source pad (thermal pad)',
      name: 'Exposed pad: source and heat path',
      kind: 'copper',
      group: 0,
      solidInXray: true,
      anchor: [-3.6, Y.frame, -3.5],
      solids: [slab(padOutline, 0, Y.frame)],
      info: {
        facts: [
          ['Material', 'Copper lead frame, ≈ 0.2 mm, plated'],
          ['Connected to', 'Source, and the silicon substrate of the die'],
        ],
        role: `The die sits on it. It carries the source current and almost all the heat down into the board.`,
        why: `Tying the substrate to the source keeps the silicon under the GaN at a fixed voltage, which steadies the device's behavior. It also means the big pad is at source potential, which makes it easy to connect to a ground plane for cooling in a low-side switch.`,
        look: `The large square of metal on the underside of the chip.`,
      },
    },
    {
      id: 'drainLand',
      label: 'Drain lands',
      name: 'Drain lands',
      kind: 'copper',
      group: 0,
      solidInXray: true,
      anchor: [3.6, Y.frame, 3.2],
      solids: [slab(LAND.drain, 0, Y.frame)],
      info: {
        facts: [
          ['Connected to', 'The drain fingers, through the drain wires'],
          ['Spacing', 'Set well back from the source pad, as safety rules for 650 V require'],
        ],
        role: `The drain connection: a strip of copper along one edge of the underside.`,
        why: `The wide gap to the source pad is set by safety rules for how far a high voltage can creep along a surface. It is one reason high-voltage packages cannot shrink as far as the die.`,
        look: `The long land along one edge on the bottom of the chip.`,
      },
    },
    {
      id: 'kelvinLand',
      label: 'Kelvin source land',
      name: 'Kelvin source land',
      kind: 'copper',
      group: 0,
      solidInXray: true,
      anchor: [1.55, Y.frame, -3.9],
      solids: [slab(LAND.kelvin, 0, Y.frame)],
      info: {
        facts: [['Carries', 'Only the gate-drive return current']],
        role: `A separate source connection for the gate driver, as on the TO-247-4.`,
        why: `GaN switches in a few nanoseconds, so even the tiny inductance of the source wires would disturb a gate that is only rated for about 7 V. A Kelvin source is essential here.`,
        look: `One of the two small lands at a corner.`,
      },
    },
    {
      id: 'gateLand',
      label: 'Gate land',
      name: 'Gate land',
      kind: 'copper',
      group: 0,
      solidInXray: true,
      anchor: [3.05, Y.frame, -3.9],
      solids: [slab(LAND.gate, 0, Y.frame)],
      info: {
        facts: [['Drive', '+5 to +6 V on, 0 V off; ≈ 7 V absolute maximum']],
        role: `The gate connection.`,
        why: `The gate driver sits as close as possible to it, often on the opposite side of the board, or inside the same package in GaN parts with an integrated driver.`,
        look: `The other small corner land, marked in the datasheet's footprint drawing.`,
      },
    },
    {
      id: 'attach',
      label: 'Die attach',
      name: 'Die attach',
      kind: 'solder',
      group: 1,
      anchor: [DIE.x1, (Y.frame + Y.attach) / 2, -1.2],
      solids: [dieBox(Y.frame, Y.attach)],
      info: {
        facts: [
          ['Material', 'Solder, sintered silver, or silver-filled epoxy'],
          ['Thickness', '≈ 20–50 µm'],
        ],
        role: `Bonds the silicon back of the die to the pad.`,
        why: `It sits under the whole die, so its quality matters for heat; but the silicon above it already spreads the heat, so it costs less here than in the TO-247.`,
        look: `Not visible.`,
      },
    },
    {
      id: 'dieSi',
      label: 'Silicon substrate',
      name: 'Die: silicon substrate',
      kind: 'dieGan',
      group: 2,
      anchor: [DIE.x1, (Y.attach + Y.si) / 2, 0.6],
      solids: [dieBox(Y.attach, Y.si)],
      info: {
        facts: [
          ['Material', 'Silicon, ≈ 0.2 mm after thinning'],
          ['Share of the die', 'All but the top ≈ 5 µm'],
        ],
        role: `The silicon wafer the GaN layers were grown on, seen at the bottom of the cell view. It holds the die together and conducts heat to the pad.`,
        why: `Growing GaN on cheap, large silicon wafers is what makes GaN transistors affordable. Silicon conducts heat about as well as GaN, so it does not hold the heat back.`,
        look: `The sides of the die, in cut-open pictures.`,
        link: { ...toCell, part: 'sisub' },
      },
    },
    {
      id: 'epi',
      label: 'GaN layers',
      name: 'Die: GaN epitaxial layers',
      kind: 'epi',
      group: 2,
      anchor: [DIE.x0, (Y.si + Y.epi) / 2, 0.4],
      solids: [dieBox(Y.si, Y.epi)],
      info: {
        facts: [
          ['Thickness', '≈ 5 µm in total, drawn here far too thick'],
          ['Contains', 'Transition layers, buffer, channel, 2DEG, barrier'],
        ],
        role: `The whole cell view except the silicon. The current flows sideways in the 2DEG near its top, between the fingers.`,
        why: `The heat is made in a thin strip next to each gate, just under the surface, so it has to cross the whole die to reach the pad.`,
        look: `Not visible: a few micrometers on top of the silicon.`,
        link: { ...toCell, part: 'twodeg' },
      },
    },
    {
      id: 'drainMetal',
      label: 'Drain fingers',
      name: 'Drain metal: bus and fingers',
      kind: 'aluminum',
      group: 3,
      solidInXray: true,
      anchor: [-1.6, Y.metal, 0.0],
      solids: drainMetal,
      info: {
        facts: [
          ['Material', 'Aluminum or copper, several µm thick, in two or more layers'],
          ['Drawn', '5 fingers; a real die has about 150, each ≈ 1–2 mm long'],
        ],
        role: `Combs of metal that reach the drain contact of every cell, joined by a bus along one edge where the drain wires land.`,
        why: `Fingers interleave with the source fingers so every cell sits between a drain and a source line. Their resistance adds directly to the on-resistance, so they are made as thick as the process allows.`,
        look: `On a die photo: the fine comb pattern covering the die.`,
        link: { ...toCell, part: 'drainc' },
      },
    },
    {
      id: 'sourceMetal',
      label: 'Source fingers',
      name: 'Source metal: bus and fingers',
      kind: 'aluminum',
      group: 3,
      solidInXray: true,
      anchor: [-1.2, Y.metal, -0.6],
      solids: sourceMetal,
      info: {
        facts: [
          ['Drawn', '4 fingers interleaved with the drain fingers'],
          ['Includes', 'The source field plate over each gate, in the real die'],
        ],
        role: `The source side of the comb, with its bus along the opposite edge.`,
        why: `The gate runs in the narrow slot between each source and drain finger, closer to the source. The field plate you met in Blocking mode is part of this metal.`,
        look: `The other half of the comb.`,
        link: { ...toCell, part: 'source' },
      },
    },
    {
      id: 'gatePad',
      label: 'Gate pad',
      name: 'Gate pad',
      kind: 'aluminum',
      group: 3,
      solidInXray: true,
      anchor: [1.75, Y.metal, -1.15],
      solids: [box(1.5, Y.epi, -1.35, 2.0, Y.metal, -0.95)],
      info: {
        facts: [['Connected to', 'Every gate finger, through a gate bus']],
        role: `Where the gate wire lands. A gate bus from it feeds the thin gate lines between the fingers.`,
        why: `GaN gates have very little charge, which is why they switch fast, but they also tolerate only a few volts of overshoot.`,
        look: `The small pad in one corner of a die photo.`,
        link: { ...toCell, part: 'gatemetal' },
      },
    },
    {
      id: 'wires',
      label: 'Drain and source wires',
      name: 'Drain and source bond wires',
      kind: 'aluminum',
      group: 4,
      solidInXray: true,
      solids: [...drainW, ...sourceW].map(([a, b]) => wire(a, b, { loop: LOOP, r: 0.08 })),
      info: {
        facts: [
          ['Material', 'Aluminum, copper or gold, ≈ 50–200 µm'],
          ['Length', '≈ 2–3 mm'],
        ],
        role: `Short wires from the drain and source buses down to the lead frame.`,
        why: `Keeping them short and many keeps their inductance to a fraction of a nanohenry. Some GaN packages replace them with a copper clip or embed the die in the board itself.`,
        look: `Only in cut-open or X-ray pictures.`,
      },
    },
    {
      id: 'gateWires',
      label: 'Gate and Kelvin wires',
      name: 'Gate and Kelvin source wires',
      kind: 'aluminum',
      group: 4,
      solidInXray: true,
      solids: [wire(...kelvinW, { loop: LOOP, r: 0.04 }), wire(...gateW, { loop: LOOP, r: 0.04 })],
      info: {
        facts: [['Carry', 'Gate-drive current only']],
        role: `Connect the gate pad and the source bus to their own corner lands.`,
        why: `Together they form the gate loop, kept separate from the load current's path.`,
        look: `Only in cut-open pictures.`,
      },
    },
    {
      id: 'mold',
      label: 'Mold compound',
      name: 'Epoxy mold compound',
      kind: 'mold',
      group: 6,
      anchor: [3.0, Y.mold, -3.0],
      solids: [box(-4, Y.frame, -4, 4, Y.mold, 4)],
      info: {
        facts: [
          ['Material', 'Silica-filled epoxy'],
          ['Thickness', '≈ 0.6 mm over the die'],
        ],
        role: `Seals the die and wires and holds the lead frame together.`,
        why: `In a bottom-cooled package almost no heat leaves through the top. Top-cooled versions flip this around: their pad faces up and presses against a heatsink, so the heat skips the board.`,
        look: `The small black square on the board, with the part marking on top.`,
      },
    },
  ],

  current: {
    title: 'In at the back, out at the front',
    steps: [
      `Load current comes up from the board's drain copper into the drain lands at the back.`,
      `The drain wires carry it up onto the die, where the drain fingers spread it over the whole die.`,
      `It crosses sideways through the 2DEG, from every drain finger to the source fingers next to it.`,
      `The source wires take it down to the big pad and out into the board's source copper. The gate loop runs through the two small corner lands.`,
    ],
    note: `The whole loop is only a few millimeters across. GaN switches so fast that the current changes by several amps per nanosecond, so each nanohenry of loop inductance means volts of ringing (V = L·di/dt). That is why GaN comes in flat, legless packages placed right next to their capacitors. The dots show conventional current.`,
    dot: 0.06,
    paths: [...loadPaths.map((pts) => ({ kind: 'load', pts })), { kind: 'gate', pts: gatePath }],
    counts: { load: 150, gate: 30 },
  },

  heat: {
    title: 'The board is the heatsink',
    refName: 'Charger case',
    Tref: 60,
    Tmax: 150,
    Pmax: 25,
    Pstep: 0.5,
    Pdefault: 4,
    loadNote: 'A 65 W charger loses a watt or two in its GaN switch; server power supplies several watts per switch',
    source: [4.0, 1.6],
    refParts: ['case'],
    layers: [
      { id: 'epi', name: 'GaN layers', short: 'GaN', t: 0.005, k: 30, size: [4.4, 2.6], inPackage: true, parts: ['epi', 'drainMetal', 'sourceMetal', 'gatePad'] },
      { id: 'si', name: 'Silicon substrate', short: 'Si', t: 0.2, k: 148, size: [4.4, 2.6], inPackage: true, parts: ['dieSi'] },
      { id: 'attach', name: 'Die attach', short: 'attach', t: 0.03, k: 40, size: [4.4, 2.6], inPackage: true, parts: ['attach'] },
      { id: 'pad', name: 'Copper pad', short: 'pad', t: 0.2, k: 390, size: [7.2, 4.5], inPackage: true, parts: ['pad'] },
      { id: 'solder', name: 'Board solder', short: 'solder', t: 0.05, k: 50, size: [7.2, 4.5], parts: ['boardSolder'] },
      { id: 'cu', name: 'Board copper', short: 'Cu', t: 0.07, k: 390, size: [11, 8], parts: ['pcbCopper'] },
      { id: 'board', name: 'Board with vias', short: 'board', t: 1.6, k: 10, size: [12, 13], parts: ['fr4', 'vias'] },
      { id: 'gap', name: 'Gap pad', short: 'gap', t: 1.0, k: 3, size: [10, 10], parts: ['gapPad'] },
    ],
    text: [
      `The heat is made just under the top of the die. It crosses the thin die and the copper pad easily; the package itself costs only a few kelvin.`,
      `The board and the gap pad under it cost almost all the rest. That is the price of a surface-mount part: the circuit board, with its copper and vias, is the heatsink, and designing it is half of the thermal design.`,
    ],
  },
  // "Age it" in Heat mode (see aging.js): the die attach cracks, and the
  // source wires lift. Typical values for a 50 mΩ part at 8 A; GaN's
  // R_DS(on) roughly doubles from 25 to 150 °C.
  aging: {
    joint: { layer: 'attach', part: 'attach', meshes: [0] },
    wires: { part: 'wires', meshes: [5, 6, 4, 7], name: 'source wires' },
    electrical: { label: 'V<sub>DS(on)</sub>', I: 8, Vdie25: 0.4, tempco: 0.008, wires: 4, Rwire: 0.004 },
  },
};
