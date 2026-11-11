import { box, slab, rectXZ, circleXZ, cyl, cable } from '../packages/solids.js';
import { transformer, tri } from './shared.js';

// The SiC MOSFET at work: an 11 kW on-board charger, the box in an electric
// car that charges the battery from an AC charge point. Model units: 1 unit =
// 25 mm (the box is 350 × 250 × 90 mm). Ten TO-247-4 parts lie flat on the
// liquid-cooled floor, legs bent up into the power board above: six for the
// three-phase PFC (one half-bridge per phase), four for the DC-DC full bridge.
// Groups run from 0 (cold plate) to 10 (cover, lifted well clear of the parts on
// the board).

const BOX = { x: 7, z: 5, floor: 0.4, top: 3.4, wall: 0.3 };
const PCB = { y0: 1.6, y1: 1.75 };
const ROW = { z0: 2.0, z1: 3.3 }; // TO-247 bodies near the front, legs toward −z
// Centers, in pairs: each pair is one half-bridge (one leg of the bridge).
const PFC_X = [-6.05, -5.15, -4.15, -3.25, -2.25, -1.35];
const DCDC_X = [1.15, 2.05, 3.05, 3.95];
const HALF = 0.4; // half the drawn body width
const IND_X = [-5.4, -3.6, -1.8];
const T = transformer({ cx: 3.3, cz: 1.0, w: 2.6, d: 1.2, y0: PCB.y1, y1: 3.2, bulge: 0.45 });

// One TO-247-4, lying tab-down on the cold plate, legs bent up into the board.
function to247(xc) {
  const body = box(xc - HALF, BOX.floor + 0.12, ROW.z0, xc + HALF, BOX.floor + 0.42, ROW.z1);
  const tab = box(xc - HALF, BOX.floor, ROW.z0, xc + HALF, BOX.floor + 0.12, ROW.z1 + 0.35);
  const legs = [-0.28, -0.095, 0.095, 0.28].flatMap((dx) => [
    box(xc + dx - 0.035, 0.62, ROW.z0 - 0.35, xc + dx + 0.035, 0.68, ROW.z0),
    box(xc + dx - 0.035, 0.62, ROW.z0 - 0.43, xc + dx + 0.035, PCB.y0, ROW.z0 - 0.35),
  ]);
  return { body, tab, legs };
}
const DEVICES = [...PFC_X, ...DCDC_X].map(to247);

// Grid voltage and the current the PFC stage draws from one phase.
const VPK = 325; // 230 V rms
const IPK = 22.6; // 16 A rms per phase: 3 × 230 V × 16 A ≈ 11 kW
const RIPPLE = 2.5; // A, drawn at 1 kHz; the real switching is ≈ 100 kHz
const w = (2 * Math.PI) / 20; // 50 Hz, t in ms
export const PFC = { VPK, IPK, phases: 3, switches: PFC_X.length };
export const DCDC = { switches: DCDC_X.length };

const tube = (pts) => pts.map(([x, y, z, s = 0.15]) => [x, y, z, s]);
// Down a switch's legs into its body and back up to the board.
const dip = (x) => [
  [x, 1.85, 1.6, 0.2],
  [x, 1.2, 1.61, 0.04],
  [x, 0.75, 2.6, 0.3],
  [x, 1.2, 1.61, 0.04],
];
// One power path per grid phase k: inductor, the phase's half-bridge, the DC
// link, two DC-DC switches, the transformer and out to the battery.
const flow = (k) =>
  tube([
    [-7.6, 1.5, 2.0, 0.1],
    [-6.4, 1.85, 2.0, 0.25],
    [IND_X[k], 2.0, 1.9, 0.2],
    [IND_X[k], 2.3, 1.0, 0.5],
    ...dip(PFC_X[2 * k]),
    ...dip(PFC_X[2 * k + 1]),
    [PFC_X[2 * k + 1] + 0.4, 1.85, 1.4, 0.2],
    [0, 2.4, 1.0, 0.45],
    ...dip(DCDC_X[k]),
    ...dip(DCDC_X[k + 1]),
    [3.3, 2.5, 1.0, 0.5],
    [5.8, 2.4, 2.8, 0.35],
    [7.4, 1.5, 0, 0.15],
    [9.0, 1.5, 0, 0.1],
    [9.6, 1.5, -2.0, 0.1],
  ]);

export default {
  id: 'sic-app',
  device: 'sic',
  scale: 'app',
  name: '11 kW on-board charger',
  short: 'EV charger',
  kicker: 'SiC MOSFET · in a product',
  subtitle: 'The box in an electric car that charges the battery from an AC charge point',
  summary: [
    `When an electric car charges from an ordinary AC charge point, the charge point only switches the grid on. The conversion happens in this box in the car: three-phase AC in, DC out to the battery at whatever voltage it needs: around 400 V or 800 V, depending on the car.`,
    `It works in two stages, built from ten of the TO-247-4 SiC MOSFETs from the package view. The first (PFC) has six, a pair (half-bridge) for each grid phase: it draws a clean sine-wave current from each phase and makes about 800 V DC. The second has four: it switches that through a transformer to whatever voltage the battery needs, and keeps the battery insulated from the grid.`,
    `The MOSFETs lie flat on the aluminum floor, which has coolant flowing through it. The orange cable is the high-voltage battery connection: in a car, orange always means high voltage.`,
  ],
  stats: [
    ['Input', '3 × 230 V AC (400 V between phases), 16 A per phase'],
    ['Output', 'The battery voltage: ≈ 400 V or ≈ 800 V class, depending on the car'],
    ['The switches', 'Ten 1200 V SiC MOSFETs in TO-247-4, ≈ 100 kHz'],
    ['Efficiency', '≈ 95–97 %: about 400 W of heat at full power'],
    ['Size', '≈ 350 × 250 × 90 mm, ≈ 8 kg, liquid-cooled'],
  ],
  legendSwitch: 'sicBodies',
  chain: [
    { node: 'Grid', value: '3 × 230 V AC, 50 Hz' },
    { conv: 'Active rectifier (PFC)', how: 'Six SiC MOSFETs (a half-bridge per phase) and three inductors', ours: true },
    { node: 'DC link', value: '≈ 800 V DC, held by the film capacitors' },
    { conv: 'Isolated DC-DC converter', how: 'Four SiC MOSFETs (a full bridge) and a transformer', ours: true },
    { node: 'Battery', value: '≈ 400 or 800 V DC' },
  ],
  gap: 0.75,
  drawing: { code: 'APP-OBC-11KW-SIC', sizeLabel: 'BOX', size: '350 × 250 mm' },
  modeLook: { action: { explode: 0, xray: true } },

  parts: [
    {
      id: 'coldPlate',
      label: 'Cold plate',
      name: 'Liquid-cooled floor (cold plate)',
      kind: 'heatsink',
      group: 0,
      anchor: [-BOX.x, BOX.floor / 2, -4.2],
      solids: [box(-BOX.x, 0, -BOX.z, BOX.x, BOX.floor, BOX.z)],
      info: {
        facts: [
          ['Material', 'Cast aluminum'],
          ['Cooling', 'Water-glycol coolant in a channel inside the floor, shared with the car’s other electronics'],
        ],
        role: `The floor of the box, with coolant flowing through it. Everything that gets hot sits on it: the MOSFETs, the magnetics and the capacitors.`,
        why: `Liquid cooling is why 11 kW fits in a box this size. The same coolant loop often runs through the traction inverter and the DC-DC converter too.`,
        look: `Under the box: the floor with its two coolant hose stubs.`,
      },
    },
    {
      id: 'coolant',
      label: 'Coolant pipes',
      name: 'Coolant inlet and outlet',
      kind: 'steel',
      group: 0,
      anchor: [-7.9, 0.2, -2.2],
      solids: [cyl([-7.5, 0.2, -3.2], 0.17, 1.0, 'x'), cyl([-7.5, 0.2, -2.2], 0.17, 1.0, 'x')],
      info: {
        facts: [['Coolant', '≈ 65 °C at most, a few liters per minute']],
        role: `Connect the floor's cooling channel to the car's coolant loop.`,
        why: `The MOSFETs only stay below their limit because the floor is held near the coolant temperature, as in the package's Heat view.`,
        look: `The two hose stubs on the housing.`,
      },
    },
    {
      id: 'acInlet',
      label: 'AC input',
      name: 'AC input connector and cable',
      kind: 'cable',
      group: 10,
      anchor: [-9.3, 1.5, 3.4],
      solids: [
        box(-7.9, 1.0, 1.0, -BOX.x, 2.0, 3.0),
        cable(
          [
            [-7.9, 1.5, 2.0],
            [-9.0, 1.5, 2.0],
            [-9.6, 1.4, 4.0],
          ],
          0.22,
        ),
      ],
      info: {
        facts: [['Carries', 'Three grid phases and neutral from the car’s charging socket']],
        role: `Brings in the grid power from the charging socket.`,
        why: `On the grid side the charger must draw a clean sine-wave current, which grid rules require and the PFC stage provides.`,
        look: `The connector on the left, with the cable from the charging port.`,
      },
    },
    {
      id: 'sicBodies',
      label: 'SiC MOSFETs',
      name: 'Ten SiC MOSFETs in TO-247-4',
      kind: 'mold',
      group: 1,
      solidInXray: true,
      anchor: [-6.05, BOX.floor + 0.42, 3.3],
      solids: DEVICES.map((d) => d.body),
      info: {
        facts: [
          ['Part', 'The TO-247-4 from the package view, 1200 V, ≈ 40 mΩ'],
          ['Left six', 'The PFC stage: three half-bridges, one per grid phase'],
          ['Right four', 'The isolated DC-DC stage: a full bridge driving the transformer'],
        ],
        role: `Do all the switching. Each loses a few tens of watts, which goes down through its tab into the cold plate.`,
        why: `SiC lets them block the 800 V DC link with 1200 V parts while switching at around 100 kHz with low loss. Silicon IGBTs could not switch that fast, and fast switching is what keeps the magnetics small.`,
        look: `The row of black TO-247s pressed onto the floor, legs bent up into the board.`,
        link: { scale: 'package', part: null },
      },
    },
    {
      id: 'sicTabs',
      kind: 'copper',
      group: 1,
      pickAs: 'sicBodies',
      solids: DEVICES.map((d) => d.tab),
    },
    {
      id: 'sicLegs',
      kind: 'copper',
      group: 1,
      pickAs: 'sicBodies',
      solids: DEVICES.flatMap((d) => d.legs),
    },
    {
      id: 'clamps',
      label: 'Clamp bars',
      name: 'Clamp bars',
      kind: 'heatsink',
      group: 2,
      anchor: [0.65, 0.94, 2.65],
      solids: [box(-6.55, BOX.floor + 0.42, 2.4, -0.85, 0.94, 2.9), box(0.65, BOX.floor + 0.42, 2.4, 4.45, 0.94, 2.9)],
      info: {
        facts: [['Under the tabs', 'A thin insulating pad, since each tab is at its drain voltage']],
        role: `Press each row of MOSFETs flat onto the cold plate with a controlled force.`,
        why: `Clamping instead of one screw per part presses evenly over the whole tab, which keeps the thermal resistance low and the same for all ten.`,
        look: `Metal bars or spring clips across the row of transistors.`,
      },
    },
    {
      id: 'board',
      label: 'Power board',
      name: 'Power board',
      kind: 'fr4',
      group: 3,
      anchor: [-6.6, PCB.y1, -4.2],
      solids: [box(-6.6, PCB.y0, -4.6, 6.6, PCB.y1, 4.6)],
      info: {
        facts: [
          ['Copper', 'Thick, ≈ 70–105 µm per layer, for the high currents'],
          ['Also on it', 'Gate drivers next to each MOSFET, an EMI filter, current sensors'],
        ],
        role: `Connects the two stages. The control electronics usually sit on a second, smaller board.`,
        why: `Each MOSFET's gate driver sits within a few centimeters of it, connected to the Kelvin source leg, to keep the gate loop small.`,
        look: `The large board covering the whole box.`,
      },
    },
    {
      id: 'inductors',
      label: 'PFC inductors',
      name: 'PFC inductors',
      kind: 'copper',
      group: 4,
      solidInXray: true,
      anchor: [-5.4, 2.75, 1.0],
      solids: IND_X.map((x) => slab(circleXZ(x, 1.0, 0.75), PCB.y1, 2.75, [circleXZ(x, 1.0, 0.3)])),
      info: {
        facts: [
          ['One per phase', 'Copper wire on a powder-iron or ferrite ring'],
          ['Current', '16 A rms each'],
        ],
        role: `Sit between each grid phase and its pair of PFC MOSFETs. By switching, the MOSFETs steer the current through them so it follows the grid voltage.`,
        why: `Their size falls as the switching frequency rises, which is one reason SiC is used here.`,
        look: `The large copper-wound rings.`,
      },
    },
    {
      id: 'dcLink',
      label: 'DC-link capacitors',
      name: 'DC-link capacitors',
      kind: 'filmCap',
      group: 4,
      solidInXray: true,
      anchor: [0.55, 3.0, 1.0],
      solids: [-0.3, 1.0, 2.3].map((z) => box(-0.55, PCB.y1, z, 0.55, 3.0, z + 1.0)),
      info: {
        facts: [
          ['Type', 'Polypropylene film, ≈ 900 V'],
          ['Holds', 'About 800 V DC between the two stages'],
        ],
        role: `Store energy between the two stages, so each can switch independently of the other.`,
        why: `Film capacitors survive the heat and ripple current far longer than electrolytics, which matters for a part that has to last as long as the car.`,
        look: `The rectangular yellow or gray blocks in the middle.`,
      },
    },
    {
      id: 'core',
      label: 'Transformer core',
      name: 'Transformer: ferrite core',
      kind: 'ferrite',
      group: 4,
      solidInXray: true,
      anchor: [4.6, 3.0, 1.0],
      solids: T.core,
      info: {
        facts: [['Frequency', '≈ 100–300 kHz']],
        role: `Carries the energy from the grid side to the battery side across an insulation barrier.`,
        why: `It sets the battery apart from the grid, so a fault cannot put grid voltage on the car's body. At 50 Hz a transformer for 11 kW would weigh tens of kilograms; at 100 kHz it fits in your hand.`,
        look: `The dark ferrite block, on the right.`,
      },
    },
    {
      id: 'winding',
      label: 'Transformer windings',
      name: 'Transformer: windings',
      kind: 'copper',
      group: 4,
      solidInXray: true,
      anchor: [3.3, 2.9, 2.1],
      solids: T.winding,
      info: {
        facts: [['Wire', 'Litz wire: many thin insulated strands']],
        role: `The primary is driven by the second set of MOSFETs; the secondary feeds the battery through rectifiers.`,
        why: `At 100 kHz the current crowds to the surface of a solid wire, so the wire is made of many thin strands to keep the resistance down.`,
        look: `The copper windings around the core.`,
      },
    },
    {
      id: 'outCaps',
      label: 'Output capacitors',
      name: 'Output filter capacitors',
      kind: 'filmCap',
      group: 4,
      solidInXray: true,
      anchor: [6.25, 3.05, 2.8],
      solids: [cyl([5.8, 2.4, 2.2], 0.45, 1.3), cyl([5.8, 2.4, 3.4], 0.45, 1.3)],
      info: {
        facts: [['Smooth', 'The rectified output before it reaches the battery']],
        role: `Filter the output so the battery sees a steady DC current.`,
        why: `Batteries age faster with ripple current, so the output is filtered well.`,
        look: `Near the high-voltage output.`,
      },
    },
    {
      id: 'hvOut',
      label: 'High-voltage output',
      name: 'High-voltage output to the battery',
      kind: 'hvCable',
      group: 10,
      solidInXray: true,
      anchor: [9.8, 1.5, -3.0],
      solids: [
        box(BOX.x, 1.0, -1.0, 7.9, 2.0, 1.0),
        cable(
          [
            [7.9, 1.5, 0],
            [9.0, 1.5, 0],
            [9.6, 1.5, -2.0],
            [10.0, 1.4, -4.0],
          ],
          0.24,
        ),
      ],
      info: {
        facts: [
          ['Voltage', '≈ 400 or 800 V DC, depending on the car'],
          ['Color', 'Orange, by convention for every high-voltage cable in a vehicle'],
        ],
        role: `Connects the charger to the traction battery.`,
        why: `The charger adjusts its output to whatever voltage and current the battery management system asks for, moment by moment.`,
        look: `The orange cable and connector. Never touch orange cables in a car.`,
      },
    },
    {
      id: 'cover',
      label: 'Cover',
      name: 'Cover: walls and lid',
      kind: 'heatsink',
      group: 10,
      anchor: [5.0, BOX.top + 0.2, -4.2],
      solids: [
        slab(rectXZ(-BOX.x, -BOX.z, BOX.x, BOX.z), BOX.floor, BOX.top, [
          rectXZ(-BOX.x + BOX.wall, -BOX.z + BOX.wall, BOX.x - BOX.wall, BOX.z - BOX.wall),
        ]),
        box(-BOX.x, BOX.top, -BOX.z, BOX.x, BOX.top + 0.2, BOX.z),
      ],
      info: {
        facts: [
          ['Material', 'Cast aluminum'],
          ['Seal', 'A gasket keeps out water and road salt'],
        ],
        role: `Closes and shields the box, and carries the connectors for the grid and the battery.`,
        why: `The metal box also contains the electromagnetic noise of 100 kHz switching, so it does not disturb the car's radio and sensors.`,
        look: `A flat aluminum box under the car's floor, rear seat or hood, with coolant hoses and an orange cable.`,
      },
    },
  ],

  action: {
    title: 'Grid to battery',
    stages: [
      `Three grid phases come in at 230 V each.`,
      `The six PFC MOSFETs, a pair per phase, switch at about 100 kHz, so the current through each inductor follows the sine shape of its phase voltage. They make about 800 V DC.`,
      `The film capacitors hold the 800 V DC link.`,
      `The other four MOSFETs switch that across the transformer at high frequency.`,
      `Rectified on the other side, it charges the battery through the orange cable.`,
    ],
    note: `The dots show power flowing from the grid to the battery. The MOSFETs flash to show they are switching, slowed down tens of thousands of times.`,
    dot: 0.1,
    paths: [0, 1, 2].map((k) => ({ kind: 'load', pts: flow(k) })),
    counts: { load: 200, gate: 0 },
    pulse: ['sicBodies'],
    spin: {},
    waves: {
      xMax: 20,
      xUnit: 'ms',
      xLabel: 'Time (ms), one grid cycle',
      panels: [
        {
          title: 'Grid voltage, one phase',
          short: 'grid voltage',
          unit: 'V',
          yMin: -400,
          yMax: 400,
          series: [{ label: 'voltage', cls: 'raw', fn: (t) => VPK * Math.sin(w * t) }],
        },
        {
          title: 'Phase current',
          short: 'current',
          unit: 'A',
          yMin: -30,
          yMax: 30,
          decimals: 1,
          series: [
            { label: 'with ripple', cls: 'accent', fn: (t) => IPK * Math.sin(w * t) + RIPPLE * (2 * tri(t, 1) - 1) },
            { label: 'average', cls: 'avg', fn: (t) => IPK * Math.sin(w * t) },
          ],
        },
      ],
      caption: `The current rises and falls exactly in step with the voltage, so the charger looks to the grid like a resistor (a power factor of 1). The small zigzag is the switching ripple, drawn here at 1 kHz; the real one is about a hundred times finer.`,
    },
    text: [
      `Three phases × 230 V × 16 A is 11 kW. Without the PFC stage, a rectifier would draw its current in short, tall spikes near each voltage peak, which overloads the grid's wiring for the same power.`,
    ],
  },
};
