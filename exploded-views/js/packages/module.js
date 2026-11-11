import { box, slab, rectXZ, circleXZ, cylinder, wire, wirePath, along } from './solids.js';

// The IGBT of the cell view in a half-bridge power module with a copper
// baseplate, in the style of the common 62 mm industrial module. Model units:
// 1 unit = 8 mm; thin layers drawn far too thick. Two switches: T1 (high side,
// on the DC+ copper) and T2 (low side, on the AC copper), each with its own
// freewheeling diode (D1, D2). Groups run from −2 (heatsink) to 11 (lid).

const BASE = { x: 6.625, z: 3.875 }; // 106 × 62 mm
const HOUSING = { x: 5.8, xi: 5.45, zi: 3.5 };
const Y = {
  base: 0.375,
  sysSolder: 0.415,
  cuBottom: 0.455,
  ceramic: 0.505,
  cuTop: 0.545,
  chipSolder: 0.57,
  die: 0.62,
  dieTop: 0.635,
  housing: 3.35,
  lid: 3.75,
  tab: 3.85,
  pin: 4.3,
};
const MOUNT_HOLES = [-6.2, 6.2].flatMap((x) => [-3.2, 3.2].map((z) => circleXZ(x, z, 0.3, 20)));

const TRACE = {
  dcPlus: rectXZ(-4.85, -2.725, -1.75, 1.6),
  ac: rectXZ(-1.55, -2.725, 1.75, 1.6),
  dcMinus: rectXZ(1.95, -2.725, 4.85, 1.6),
};
const STRIPS = [
  rectXZ(-4.85, 1.85, -2.6, 2.2), // G1
  rectXZ(-4.85, 2.375, -2.6, 2.725), // E1
  rectXZ(-1.55, 1.85, 0.7, 2.2), // G2
  rectXZ(-1.55, 2.375, 0.7, 2.725), // E2
];
const DIES = {
  T1: [-3.95, -2.2, -2.7, -0.95],
  D1: [-3.85, -0.3, -2.8, 0.9],
  T2: [-0.4, -2.2, 0.85, -0.95],
  D2: [-0.3, -0.3, 0.75, 0.9],
};
const dieBox = ([x0, z0, x1, z1], y0, y1) => box(x0, y0, z0, x1, y1, z1);
// Top metal: emitter (IGBT) or anode (diode), inset from the die edge. The
// IGBTs leave a strip along one edge for the gate pad.
const inset = ([x0, z0, x1, z1], zCut) => [x0 + 0.08, z0 + 0.08, x1 - 0.08, zCut ?? z1 - 0.08];
const DIE_METAL = [inset(DIES.T1, -1.25), inset(DIES.D1), inset(DIES.T2, -1.25), inset(DIES.D2)];
const GATE_PADS = [
  [-3.42, -1.17, -3.18, -1.03],
  [-0.02, -1.17, 0.22, -1.03],
];

// Power wires: die top → copper trace.
const rows = (n, z0, dz) => Array.from({ length: n }, (_, i) => z0 + i * dz);
const W = {
  T1: rows(5, -2.05, 0.18).map((z) => [[-3.0, Y.dieTop, z], [-1.2, Y.cuTop, z]]),
  D1: rows(4, -0.15, 0.3).map((z) => [[-3.05, Y.dieTop, z], [-1.25, Y.cuTop, z]]),
  T2: rows(5, -2.05, 0.18).map((z) => [[0.6, Y.dieTop, z], [2.3, Y.cuTop, z]]),
  D2: rows(4, -0.15, 0.3).map((z) => [[0.5, Y.dieTop, z], [2.25, Y.cuTop, z]]),
};
const GW = {
  g1: [[-3.3, Y.dieTop, -1.1], [-3.3, Y.cuTop, 2.0]],
  e1: [[-3.7, Y.dieTop, -1.4], [-3.7, Y.cuTop, 2.55]],
  g2: [[0.1, Y.dieTop, -1.1], [0.1, Y.cuTop, 2.0]],
  e2: [[-0.3, Y.dieTop, -1.4], [-0.3, Y.cuTop, 2.55]],
};
const LOOP = 0.35;
const GLOOP = 0.3;

// Power terminals: a foot on the copper, a riser up through the lid, and a
// flat tab with a screw hole on top.
const RISER_Z = [-0.72, -0.62];
function terminal(x0, x1, tabX0, holeX) {
  return [
    box(x0, Y.cuTop, -0.9, x1, Y.cuTop + 0.06, -0.45),
    box(x0, Y.cuTop + 0.06, RISER_Z[0], x1, Y.lid, RISER_Z[1]),
    slab(rectXZ(tabX0, -1.47, tabX0 + 1.6, 0.13), Y.lid, Y.tab, [circleXZ(holeX, -0.67, 0.35, 20)]),
  ];
}
const TERM = {
  dcPlus: { x: [-4.75, -4.1], tab: -5.2, hole: -4.4 },
  ac: { x: [1.0, 1.65], tab: 0.5, hole: 1.3 },
  dcMinus: { x: [3.9, 4.55], tab: 3.4, hole: 4.2 },
};
const PINS = [
  [-4.4, 2.025],
  [-4.4, 2.55],
  [0.4, 2.025],
  [0.4, 2.55],
];
const lidHoles = [
  ...Object.values(TERM).map(({ x: [x0, x1] }) => rectXZ(x0 - 0.05, RISER_Z[0] - 0.05, x1 + 0.05, RISER_Z[1] + 0.05)),
  ...PINS.map(([x, z]) => circleXZ(x, z, 0.1, 12)),
];

// Current paths (conventional current, assembled positions).
const rev = (pts) => pts.slice().reverse();
const riser = (t, down) => {
  const x = (t.x[0] + t.x[1]) / 2;
  const pts = [
    [t.hole, Y.tab + 0.02, -0.25, 0.15],
    [x, Y.lid, -0.67, 0.12],
    [x, Y.cuTop + 0.1, -0.67, 0.12],
    [x, Y.cuTop - 0.02, -0.67, 0.2],
  ];
  return down ? pts : rev(pts);
};
const highPaths = W.T1.map(([a, b]) => [
  ...riser(TERM.dcPlus, true),
  [-3.6, Y.cuTop - 0.02, -1.6, 0.35],
  [a[0] - 0.2, Y.die - 0.02, a[2], 0.2],
  ...along(wirePath(a, b, LOOP)),
  [-0.2, Y.cuTop - 0.02, -0.67, 0.4],
  ...riser(TERM.ac, false),
]);
const freePaths = W.D2.map(([a, b]) => [
  ...riser(TERM.dcMinus, true),
  [b[0] + 0.3, Y.cuTop - 0.02, b[2], 0.15],
  ...along(rev(wirePath(a, b, LOOP))),
  [0.2, Y.cuTop - 0.02, 0.3, 0.3],
  [0.95, Y.cuTop - 0.02, -0.4, 0.2],
  ...riser(TERM.ac, false),
]);
const gatePath = [
  [-4.4, Y.pin, 2.025, 0.02],
  [-4.4, Y.cuTop, 2.025, 0.04],
  [-3.3, Y.cuTop, 2.0, 0.04],
  ...along(rev(wirePath(...GW.g1, GLOOP))),
  [-3.5, Y.dieTop, -1.3, 0.05],
  ...along(wirePath(...GW.e1, GLOOP)),
  [-4.4, Y.cuTop, 2.55, 0.04],
  [-4.4, Y.pin, 2.55, 0.02],
];

const toCell = { scale: 'cell', part: null };

export default {
  id: 'igbt-package',
  device: 'igbt',
  scale: 'package',
  name: 'Half-bridge IGBT module',
  short: 'Power module',
  kicker: 'Si IGBT · power module with baseplate',
  subtitle: 'Two switches and two diodes on a ceramic tile: one leg of an inverter in one box',
  summary: [
    `At high power, dies are not packaged one by one. A module solders several onto a ceramic tile with copper on both sides, wires them into a circuit and puts them in a plastic housing filled with gel.`,
    `This one is a half-bridge: two IGBTs in series between DC+ and DC−, with the AC output between them. Each IGBT has a diode next to it, because an IGBT, unlike a MOSFET, cannot conduct backward. Three of these make a motor drive.`,
    `The ceramic insulates the circuit from the copper baseplate, so the module bolts straight onto a grounded heatsink with only grease in between. Each IGBT die here stands for the one to three in parallel a real module has per switch.`,
  ],
  stats: [
    ['Footprint', '106 × 62 × 30 mm (the "62 mm" module)'],
    ['Terminals', 'DC+, DC− and AC screw terminals; gate and auxiliary emitter pins'],
    ['Typical part', '1200 V, 150–600 A per switch'],
    ['Thermal resistance', 'R<sub>th(j-c)</sub> ≈ 0.05–0.2 K/W per switch'],
    ['Look for it in', 'Industrial motor drives, elevators, welders, UPS systems, wind and solar inverters'],
  ],
  ladder: [
    ['One cell', '≈ 10–20 µm wide (the cell view)'],
    ['The die', '≈ 10 × 10 mm, 0.12 mm thick · ≈ 600 stripes of cells'],
    ['The module', '106 × 62 mm, four dies here, often 12 or more'],
  ],
  legendDie: 'dieSi',
  gap: 0.6,
  drawing: { code: 'PKG-HB-MODULE-IGBT', sizeLabel: 'BASE', size: '106 × 62 mm' },
  modeLook: {
    current: { explode: 0, xray: true },
    heat: { explode: 'user', xray: false, tintOnly: true },
  },

  parts: [
    {
      id: 'heatsink',
      label: 'Heatsink',
      name: 'Heatsink (part of the drive)',
      kind: 'heatsink',
      group: -2,
      anchor: [7.2, -1.1, 3.5],
      solids: [
        slab(rectXZ(-7.2, -4.4, 7.2, 4.4), -0.5, -0.06, MOUNT_HOLES),
        ...Array.from({ length: 9 }, (_, i) => box(-7.2, -1.7, -4.25 + i * 1.04, 7.2, -0.5, -4.0 + i * 1.04)),
      ],
      info: {
        facts: [
          ['Material', 'Aluminum, air-cooled with fans, or a liquid cold plate'],
          ['In this model', 'Held at 65 °C'],
        ],
        role: `Takes the heat from the baseplate. Four bolts through the baseplate corners clamp the module down.`,
        why: `A drive's heatsink is often its biggest, heaviest part. EV inverters use liquid-cooled plates, and many modern modules have pin fins on the baseplate that sit directly in the coolant, skipping the grease.`,
        look: `The large finned block that the modules are bolted to, inside a drive cabinet.`,
      },
    },
    {
      id: 'grease',
      label: 'Thermal grease',
      name: 'Thermal grease (part of the drive)',
      kind: 'tim',
      group: -1,
      anchor: [-6.6, -0.03, -3.6],
      solids: [slab(rectXZ(-BASE.x, -BASE.z, BASE.x, BASE.z), -0.06, 0, MOUNT_HOLES)],
      info: {
        facts: [
          ['Material', 'Silicone or phase-change paste filled with metal oxide'],
          ['Thickness', '≈ 50–100 µm'],
          ['Conductivity', '≈ 1–3 W/(m·K)'],
        ],
        role: `Fills the microscopic gaps between the baseplate and the heatsink, which would otherwise hold air.`,
        why: `It needs no insulating job here, because the ceramic inside the module already insulates. It is still the second-biggest step in the heat path (see Heat), so it is printed on in a controlled thin layer.`,
        look: `The gray or white paste left on the heatsink when a module is unbolted.`,
      },
    },
    {
      id: 'baseplate',
      label: 'Copper baseplate',
      name: 'Copper baseplate',
      kind: 'copper',
      group: 0,
      anchor: [-6.0, Y.base, 1.8],
      solids: [slab(rectXZ(-BASE.x, -BASE.z, BASE.x, BASE.z), 0, Y.base, MOUNT_HOLES)],
      info: {
        facts: [
          ['Material', 'Nickel-plated copper'],
          ['Thickness', '≈ 3 mm'],
        ],
        role: `The mechanical base of the module. It spreads heat sideways from the ceramic tiles before it crosses the grease.`,
        why: `Copper conducts heat well, so a thick plate makes the poor grease below see a much larger area. It is slightly curved when new, so it flattens against the heatsink as the bolts are tightened.`,
        look: `The metal underside of the module, with a bolt hole in each corner.`,
      },
    },
    {
      id: 'systemSolder',
      label: 'Baseplate solder',
      name: 'System solder (substrate to baseplate)',
      kind: 'solder',
      group: 1,
      anchor: [4.85, (Y.base + Y.sysSolder) / 2, -2.0],
      solids: [box(-4.85, Y.base, -2.725, 4.85, Y.sysSolder, 2.725)],
      info: {
        facts: [
          ['Material', 'Tin-based solder'],
          ['Thickness', '≈ 100–200 µm'],
        ],
        role: `Joins the ceramic substrate's bottom copper to the baseplate.`,
        why: `Copper expands with temperature more than twice as much as the ceramic, so every heating cycle shears this large joint. Cracks grow in from its corners over years; this is one of the classic ways modules wear out.`,
        look: `Not visible.`,
      },
    },
    {
      id: 'bottomCopper',
      label: 'Substrate bottom copper',
      name: 'Substrate: bottom copper',
      kind: 'copper',
      group: 2,
      anchor: [4.85, (Y.sysSolder + Y.cuBottom) / 2, 1.0],
      solids: [box(-4.85, Y.sysSolder, -2.725, 4.85, Y.cuBottom, 2.725)],
      info: {
        facts: [['Thickness', '≈ 0.3 mm']],
        role: `A solid copper layer bonded to the underside of the ceramic, so the tile can be soldered to the baseplate.`,
        why: `Copper on both sides keeps the tile flat: a ceramic with copper on one side only would bend like a bimetal strip when heated.`,
        look: `Not visible.`,
      },
    },
    {
      id: 'ceramic',
      label: 'Ceramic substrate',
      name: 'Ceramic substrate (the insulator)',
      kind: 'ceramic',
      group: 3,
      anchor: [-5.0, (Y.cuBottom + Y.ceramic) / 2, -2.0],
      solids: [box(-5, Y.cuBottom, -2.875, 5, Y.ceramic, 2.875)],
      info: {
        facts: [
          ['Material', 'Alumina (Al<sub>2</sub>O<sub>3</sub>), or aluminum nitride or silicon nitride for better cooling'],
          ['Thickness', '≈ 0.3–0.6 mm'],
          ['Insulates', 'Several kilovolts between the circuit and the baseplate'],
        ],
        role: `The heart of the module: an electrical insulator that still conducts heat reasonably well. With copper bonded on both sides it is called a DBC (direct bonded copper) substrate.`,
        why: `It is the largest single temperature step inside the module. Alumina conducts about 24 W/(m·K); aluminum nitride about 170, silicon nitride about 90 and it is far tougher, which is why SiC modules for cars use it.`,
        look: `The white or light-gray tile you see when the gel is scraped out of a dead module.`,
      },
    },
    {
      id: 'topCopper',
      label: 'Top copper (the circuit)',
      name: 'Substrate: top copper, patterned into the circuit',
      kind: 'copper',
      group: 4,
      solidInXray: true,
      anchor: [-1.5, Y.cuTop, 1.4],
      solids: [
        slab(TRACE.dcPlus, Y.ceramic, Y.cuTop),
        slab(TRACE.ac, Y.ceramic, Y.cuTop),
        slab(TRACE.dcMinus, Y.ceramic, Y.cuTop),
        ...STRIPS.map((r) => slab(r, Y.ceramic, Y.cuTop)),
      ],
      info: {
        facts: [
          ['Thickness', '≈ 0.3 mm, etched into islands'],
          ['Islands', 'DC+ (left), AC (middle), DC− (right), and thin gate and emitter strips'],
        ],
        role: `The module's circuit board. T1 and D1 sit on the DC+ island, T2 and D2 on the AC island; their wires reach over to the next island.`,
        why: `The die's back side is its collector, so the island it is soldered to is its collector connection. The gaps between islands must hold the full DC voltage, and their layout sets the loop inductance of the module.`,
        look: `The copper pattern on the ceramic tile.`,
      },
    },
    {
      id: 'chipSolder',
      label: 'Chip solder',
      name: 'Chip solder',
      kind: 'solder',
      group: 5,
      anchor: [-2.7, (Y.cuTop + Y.chipSolder) / 2, -1.9],
      solids: Object.values(DIES).map((d) => dieBox(d, Y.cuTop, Y.chipSolder)),
      info: {
        facts: [
          ['Material', 'Tin-silver solder, or sintered silver in newer modules'],
          ['Thickness', '≈ 50–100 µm'],
        ],
        role: `Bonds each die's back side, its collector or cathode, to the copper.`,
        why: `Like the die attach in a discrete package, it carries all the heat and slowly fatigues as the module heats and cools.`,
        look: `Not visible.`,
      },
    },
    {
      id: 'igbtDies',
      label: 'IGBT dies',
      name: 'IGBT dies (T1 high side, T2 low side)',
      kind: 'dieSi',
      group: 6,
      anchor: [-2.7, (Y.chipSolder + Y.die) / 2, -1.6],
      solids: [dieBox(DIES.T1, Y.chipSolder, Y.die), dieBox(DIES.T2, Y.chipSolder, Y.die)],
      info: {
        facts: [
          ['Size', '≈ 10 × 10 mm for 150 A at 1200 V'],
          ['Thickness', '≈ 0.12 mm, barely more than the drift layer'],
          ['Top', 'Emitter metal and a small gate pad'],
        ],
        role: `The switches. T1 connects DC+ to the output; T2 connects the output to DC−. A controller turns them on alternately, never both at once.`,
        why: `A field-stop IGBT die is mostly drift layer: there is no thick substrate, only the thin p<sup>+</sup> collector under it. That is why the die is so thin, and why it is fragile to handle.`,
        look: `The larger squares with a small gate pad on one edge, in pictures of opened modules.`,
        link: { ...toCell, part: 'drift' },
      },
    },
    {
      id: 'diodeDies',
      label: 'Diode dies',
      name: 'Freewheeling diode dies (D1, D2)',
      kind: 'dieSi',
      group: 6,
      anchor: [-2.8, (Y.chipSolder + Y.die) / 2, 0.5],
      solids: [dieBox(DIES.D1, Y.chipSolder, Y.die), dieBox(DIES.D2, Y.chipSolder, Y.die)],
      info: {
        facts: [
          ['Type', 'Fast silicon pin diodes, or SiC Schottky diodes in hybrid modules'],
          ['Connected', 'Antiparallel: each across its IGBT, pointing the other way'],
        ],
        role: `Carry the current when the IGBT on the other side turns off. The motor's inductance keeps current flowing, and it needs a path (see Current, Freewheeling).`,
        why: `An IGBT has no body diode, so modules always pair each one with a diode. The diode's reverse recovery, the stored charge it dumps when the other IGBT turns back on, causes much of the switching loss.`,
        look: `The smaller squares next to each IGBT, in pictures of opened modules.`,
      },
    },
    {
      id: 'dieMetal',
      label: 'Die top metal',
      name: 'Die top metal: emitter, anode and gate pads',
      kind: 'aluminum',
      group: 6,
      solidInXray: true,
      anchor: [-3.3, Y.dieTop, -1.7],
      solids: [
        ...DIE_METAL.map((d) => dieBox(d, Y.die, Y.dieTop)),
        ...GATE_PADS.map((d) => dieBox(d, Y.die, Y.dieTop)),
      ],
      info: {
        facts: [
          ['Material', 'Aluminum, ≈ 4 µm'],
          ['On each IGBT', 'One large emitter pad and a small gate pad along one edge'],
        ],
        role: `The same top metal as in the cell view, covering every cell of a die. The power wires are bonded onto it.`,
        why: `It spreads the current of a hundred amps over the whole die. The bonds to it are where most module wear-out starts.`,
        look: `The dull silver tops of the dies in an opened module.`,
        link: { ...toCell, part: 'metal' },
      },
    },
    {
      id: 'powerWires',
      label: 'Power wires',
      name: 'Power bond wires',
      kind: 'aluminum',
      group: 7,
      solidInXray: true,
      solids: [...W.T1, ...W.D1, ...W.T2, ...W.D2].map(([a, b]) => wire(a, b, { loop: LOOP, r: 0.035 })),
      info: {
        facts: [
          ['Material', 'Aluminum, ≈ 300–500 µm diameter'],
          ['Count', 'Often over 100 in a module; each carries ≈ 10–20 A'],
        ],
        role: `Connect each die's top (emitter or anode) to the next copper island.`,
        why: `Wire lift-off is the most common way modules fail in service. Every load cycle heats the wire and the die by different amounts, and cracks slowly grow through the bond. Module makers count lifetime in temperature cycles.`,
        look: `The silvery rows of arched wires in a module with its gel removed.`,
      },
    },
    {
      id: 'gateWires',
      label: 'Gate wires',
      name: 'Gate and auxiliary emitter wires',
      kind: 'aluminum',
      group: 7,
      solidInXray: true,
      solids: Object.values(GW).map(([a, b]) => wire(a, b, { loop: GLOOP, r: 0.018 })),
      info: {
        facts: [['Per switch', 'One gate wire and one auxiliary emitter wire']],
        role: `Connect each IGBT's gate pad and emitter to the thin gate and emitter strips, and from there to the pins.`,
        why: `The auxiliary emitter is the module's Kelvin connection: the gate driver returns through it instead of through the power terminal, for the same reason as on the TO-247-4.`,
        look: `The thin wires running to the strips along one edge of the tile.`,
      },
    },
    {
      id: 'dcPlusTerminal',
      label: 'DC+ terminal',
      name: 'DC+ terminal',
      kind: 'copper',
      group: 8,
      solidInXray: true,
      anchor: [TERM.dcPlus.tab, Y.tab, -1.0],
      solids: terminal(...TERM.dcPlus.x, TERM.dcPlus.tab, TERM.dcPlus.hole),
      info: {
        facts: [
          ['Connected to', 'The DC+ island: the collector of T1 and the cathode of D1'],
          ['Typical bus', '600–800 V DC for 1200 V parts'],
        ],
        role: `Brings in the positive side of the DC supply, from the drive's capacitor bank.`,
        why: `DC+ and DC− are fed by a laminated busbar, two flat copper sheets pressed close together, so the loop through the capacitors and module has little inductance.`,
        look: `One of the three big screw terminals on top.`,
      },
    },
    {
      id: 'acTerminal',
      label: 'AC terminal (output)',
      name: 'AC output terminal',
      kind: 'copper',
      group: 8,
      solidInXray: true,
      anchor: [TERM.ac.tab + 1.6, Y.tab, -1.0],
      solids: terminal(...TERM.ac.x, TERM.ac.tab, TERM.ac.hole),
      info: {
        facts: [
          ['Connected to', 'The AC island, between the two switches'],
          ['Voltage', 'Jumps between DC− and DC+ at every switching edge'],
        ],
        role: `The output of the half-bridge, cabled to one phase of the motor.`,
        why: `By switching it between DC+ and DC− thousands of times a second with varying on-times, the drive makes a sine-wave current in the motor (pulse-width modulation).`,
        look: `The screw terminal the motor cable goes to.`,
      },
    },
    {
      id: 'dcMinusTerminal',
      label: 'DC− terminal',
      name: 'DC− terminal',
      kind: 'copper',
      group: 8,
      solidInXray: true,
      anchor: [TERM.dcMinus.tab + 1.6, Y.tab, -1.0],
      solids: terminal(...TERM.dcMinus.x, TERM.dcMinus.tab, TERM.dcMinus.hole),
      info: {
        facts: [['Connected to', 'The DC− island: T2’s emitter and D2’s anode, through their wires']],
        role: `The negative side of the DC supply.`,
        why: `With DC+ it forms the commutation loop: when T1 turns off, the current jumps from T1 to D2 through this loop within a fraction of a microsecond, and its inductance sets the voltage overshoot.`,
        look: `The third big screw terminal.`,
      },
    },
    {
      id: 'auxPins',
      label: 'Gate and emitter pins',
      name: 'Gate and auxiliary emitter pins',
      kind: 'copper',
      group: 8,
      solidInXray: true,
      anchor: [-4.4, Y.pin, 2.3],
      solids: PINS.map(([x, z]) => cylinder(x, z, 0.06, Y.cuTop, Y.pin)),
      info: {
        facts: [['Pins', 'G1 and E1 for T1, G2 and E2 for T2']],
        role: `Connect the gate driver board, which often plugs straight onto the module.`,
        why: `Each IGBT needs its own isolated gate driver, because T1's emitter, its gate reference, swings by the full DC voltage with every switching edge.`,
        look: `The small push-on tabs or press-fit pins on top, separate from the big screw terminals.`,
      },
    },
    {
      id: 'gel',
      label: 'Silicone gel',
      name: 'Silicone gel',
      kind: 'gel',
      group: 9,
      anchor: [5.45, 1.2, -3.0],
      solids: [box(-HOUSING.xi, Y.base, -HOUSING.zi, HOUSING.xi, 1.5, HOUSING.zi)],
      info: {
        facts: [
          ['Material', 'Soft, clear silicone gel'],
          ['Fills', 'The housing, covering the substrate, dies and wires'],
        ],
        role: `Insulates everything inside, keeps out moisture, and stops arcing between parts at high voltage.`,
        why: `It is soft enough not to pull on the bond wires as things expand. Discrete packages use hard epoxy instead, but at module size epoxy would crack the large ceramic tiles.`,
        look: `The clear, jelly-like filling of an opened module.`,
      },
    },
    {
      id: 'housing',
      label: 'Housing',
      name: 'Plastic housing',
      kind: 'plastic',
      group: 10,
      anchor: [-HOUSING.x, 2.0, 2.5],
      solids: [
        slab(rectXZ(-HOUSING.x, -BASE.z, HOUSING.x, BASE.z), Y.base, Y.housing, [
          rectXZ(-HOUSING.xi, -HOUSING.zi, HOUSING.xi, HOUSING.zi),
        ]),
      ],
      info: {
        facts: [['Material', 'Glass-fiber-filled plastic (PBT or PPS)']],
        role: `The frame that holds the terminals, contains the gel and is glued to the baseplate.`,
        why: `Its ribs and grooves lengthen the surface path between terminals, so high voltage cannot creep across it.`,
        look: `The plastic box, usually black, gray or dark red, with the part number on it.`,
      },
    },
    {
      id: 'lid',
      label: 'Lid',
      name: 'Lid',
      kind: 'plastic',
      group: 11,
      anchor: [3.0, Y.lid, 3.0],
      solids: [slab(rectXZ(-HOUSING.x, -BASE.z, HOUSING.x, BASE.z), Y.housing, Y.lid, lidHoles)],
      info: {
        facts: [['Material', 'The same plastic as the housing']],
        role: `Closes the housing. The terminals come out through it and are folded over nuts molded into it.`,
        why: `The screw terminals let thick busbars and cables bolt straight on, which matters at hundreds of amps.`,
        look: `The top of the module.`,
      },
    },
  ],

  current: {
    title: 'One leg of an inverter',
    phases: [
      {
        id: 'high',
        label: 'T1 on',
        steps: [
          `T1 is on. Current enters at DC+ and runs along the DC+ copper to the back of T1.`,
          `It flows up through T1, then over its wires to the AC copper.`,
          `It leaves through the AC terminal to the motor. The gate loop runs from pin G1 to T1's gate and back through E1.`,
        ],
      },
      {
        id: 'free',
        label: 'Freewheeling',
        steps: [
          `T1 has turned off, but the motor's inductance keeps the current flowing out of AC.`,
          `It now comes in at DC−, over the wires to the top of diode D2, and down through D2 to the AC copper.`,
          `It still leaves through the AC terminal: the motor current never stops, it only changes path, thousands of times a second.`,
        ],
      },
    ],
    note: `Switch between the two states above to see the current move from T1 to D2. The share of time T1 is on sets the average voltage at the AC terminal, which is how the drive shapes the motor current. The dots show conventional current.`,
    dot: 0.06,
    paths: [
      ...highPaths.map((pts) => ({ kind: 'load', phase: 'high', pts })),
      { kind: 'gate', phase: 'high', pts: gatePath },
      ...freePaths.map((pts) => ({ kind: 'load', phase: 'free', pts })),
    ],
    counts: { load: 160, gate: 30 },
  },

  heat: {
    title: 'Down through the ceramic',
    refName: 'Heatsink',
    Tref: 65,
    Tmax: 150,
    Pmax: 400,
    Pstep: 5,
    Pdefault: 200,
    loadNote: 'Losses of one switch; 200 W is typical for a 150 A die at full load',
    source: [9, 9],
    refParts: ['heatsink'],
    layers: [
      { id: 'die', name: 'IGBT die', short: 'die', t: 0.12, k: 148, size: [10, 10], inPackage: true, parts: ['igbtDies'] },
      { id: 'chip', name: 'Chip solder', short: 'solder', t: 0.08, k: 55, size: [10, 10], inPackage: true, parts: ['chipSolder'] },
      { id: 'cuTop', name: 'Top copper', short: 'Cu', t: 0.3, k: 390, size: [24, 34], inPackage: true, parts: ['topCopper'] },
      { id: 'ceramic', name: 'Alumina ceramic', short: 'ceramic', t: 0.38, k: 24, size: [44, 46], inPackage: true, parts: ['ceramic'] },
      { id: 'cuBottom', name: 'Bottom copper', short: 'Cu', t: 0.3, k: 390, size: [42, 44], inPackage: true, parts: ['bottomCopper'] },
      { id: 'sys', name: 'Baseplate solder', short: 'solder', t: 0.15, k: 50, size: [42, 44], inPackage: true, parts: ['systemSolder'] },
      { id: 'base', name: 'Copper baseplate', short: 'base', t: 3, k: 390, size: [53, 62], inPackage: true, parts: ['baseplate'] },
      { id: 'grease', name: 'Thermal grease', short: 'grease', t: 0.05, k: 1, size: [53, 62], parts: ['grease'] },
    ],
    text: [
      `This follows the heat from one IGBT die. It crosses eight layers on the way to the heatsink, and the alumina ceramic costs the most: it is the price of having the insulation inside the module.`,
      `The thick copper baseplate spreads the heat out to a much larger area before the grease, so the grease costs less than its poor conductivity suggests. Swap the alumina for aluminum nitride, which conducts heat about seven times better, and that biggest step shrinks several times over.`,
    ],
  },
};
