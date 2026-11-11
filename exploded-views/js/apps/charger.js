import { box, slab, rectXZ, cyl } from '../packages/solids.js';
import { transformer } from './shared.js';

// The GaN HEMT at work: a 65 W USB-C charger with European pins, opened up.
// Model units: 1 unit = 5 mm (the case is 52 × 52 × 30 mm). Groups run from 0
// (bottom shell) to 7 (top shell, lifted well clear).

const CASE = 5.2;
const WALL = 0.3;
const SEAM = 3.0;
const USB = { x: 0.9, y0: 0.95, y1: 1.65 };
const PCB = { y0: 0.8, y1: 0.95 };
const T = transformer({ cx: 1.1, cz: -0.4, w: 3.0, d: 1.4, y0: PCB.y1, y1: 3.9, bulge: 0.5 });

// Switching waveform of the quasi-resonant flyback (see `action.waves`).
const VIN = 325; // rectified 230 V mains
const VR = 110; // secondary voltage reflected to the primary
const PERIOD = 1000 / 150; // µs, 150 kHz
const TON = 2.0; // µs
const TDEMAG = 3.5; // µs after turn-off until the transformer is empty
const IPK = 1.5; // A, primary current at turn-off
function drainV(t) {
  const tau = t % PERIOD;
  if (tau < TON) return 0;
  if (tau < TON + TDEMAG) return VIN + VR;
  // Empty transformer: the drain rings down toward a valley, where it turns on again.
  const k = (tau - TON - TDEMAG) / (PERIOD - TON - TDEMAG);
  return VIN + VR * Math.cos(Math.PI * k);
}
const primaryI = (t) => {
  const tau = t % PERIOD;
  return tau < TON ? (IPK * tau) / TON : 0;
};

export const FLYBACK = { VIN, VR, PERIOD, TON, IPK };

const primary = (x) => [
  [x, SEAM, -5.3, 0.05],
  [x, 1.1, -4.6, 0.08],
  [-3.6, 1.15, -3.8, 0.3],
  [-2.6, 2.6, -1.2, 0.6],
  [0.3, 2.4, -1.5, 0.3],
  [1.1, 2.4, -1.3, 0.4],
  [3.8, 1.04, -3.0, 0.5],
  [-1.6, 1.0, -2.6, 0.25],
  [-2.6, 1.5, -1.2, 0.5],
];
const secondary = [
  [1.8, 2.4, 0.6, 0.4],
  [3.8, 1.03, 1.9, 0.4],
  [3.85, 1.5, 3.6, 0.45],
  [0, 1.3, 4.5, 0.25],
  [0, 1.3, 5.6, 0.1],
];

export default {
  id: 'gan-app',
  device: 'gan',
  scale: 'app',
  name: '65 W USB-C charger',
  short: 'Phone charger',
  kicker: 'GaN HEMT · in a product',
  subtitle: 'A laptop and phone charger, about the size of a matchbox, opened up',
  summary: [
    `Inside a small GaN charger the switch from the package view sits flat on the circuit board next to the transformer. It chops the rectified mains about 150 000 times a second.`,
    `That speed is the point. The energy the transformer has to hold in each cycle shrinks as the frequency rises, so a fast switch allows a much smaller transformer, and the transformer and the bulk capacitor are what set a charger's size. A silicon charger of the same power is typically much bulkier.`,
    `Everything on the mains side is at a dangerous voltage. The transformer, and a gap kept clear across the board, insulate the USB-C side, which you can touch.`,
  ],
  stats: [
    ['Input', '100–240 V AC, 50 or 60 Hz'],
    ['Output', '5–20 V DC over USB-C, up to 65 W'],
    ['The switch', 'One 650 V GaN HEMT, ≈ 150 mΩ, in a QFN package'],
    ['Efficiency', '≈ 92–94 %: about 5 W of heat at full load'],
    ['Size', '≈ 52 × 52 × 30 mm'],
  ],
  legendSwitch: 'ganSwitch',
  chain: [
    { node: 'Mains', value: '230 V AC, 50 Hz' },
    { conv: 'Rectifier', how: 'The diode bridge and the bulk capacitor' },
    { node: 'DC', value: '≈ 325 V DC' },
    { conv: 'Isolated DC-DC converter (flyback)', how: 'The GaN switch and the transformer', ours: true },
    { node: 'USB-C', value: '5–20 V DC' },
  ],
  gap: 0.9,
  drawing: { code: 'APP-USBC-65W-GAN', sizeLabel: 'CASE', size: '52 × 52 × 30 mm' },
  modeLook: { action: { explode: 0, xray: true } },

  parts: [
    {
      id: 'caseBottom',
      label: 'Case, bottom',
      name: 'Case: bottom shell',
      kind: 'plasticLight',
      group: 0,
      anchor: [-CASE, 1.6, 3.0],
      solids: [
        box(-CASE, 0, -CASE, CASE, 0.2, CASE),
        box(-CASE, 0.2, -CASE, CASE, SEAM, -CASE + WALL),
        box(-CASE, 0.2, -CASE + WALL, -CASE + WALL, SEAM, CASE - WALL),
        box(CASE - WALL, 0.2, -CASE + WALL, CASE, SEAM, CASE - WALL),
        box(-CASE, 0.2, CASE - WALL, -USB.x, SEAM, CASE),
        box(USB.x, 0.2, CASE - WALL, CASE, SEAM, CASE),
        box(-USB.x, 0.2, CASE - WALL, USB.x, USB.y0, CASE),
        box(-USB.x, USB.y1, CASE - WALL, USB.x, SEAM, CASE),
      ],
      info: {
        facts: [
          ['Material', 'Flame-retardant polycarbonate'],
          ['Wall', '≈ 1.5 mm'],
        ],
        role: `Half of the sealed shell. The two halves are usually welded together ultrasonically, which is why chargers are hard to open.`,
        why: `The case is part of the safety insulation: nothing at mains voltage may be reachable from outside. It is also the only way the 5 W of heat gets out, so it runs warm at full load.`,
        look: `The charger itself. The seam around its middle is the weld.`,
      },
    },
    {
      id: 'pins',
      label: 'Mains pins',
      name: 'Mains pins (Europlug)',
      kind: 'steel',
      group: 0,
      solidInXray: true,
      anchor: [1.9, SEAM, -6.4],
      solids: [cyl([-1.9, SEAM, -5.9], 0.4, 1.4, 'z'), cyl([1.9, SEAM, -5.9], 0.4, 1.4, 'z')],
      info: {
        facts: [
          ['Size', '4 mm across, 19 mm apart'],
          ['Carry', '230 V AC at well under an amp'],
        ],
        role: `Bring in the mains. Short wires or springs connect them to the input fuse on the board.`,
        why: `At 230 V a 65 W charger draws well under an amp, so the input side carries little current but high voltage; the USB-C side is the opposite, up to 3.25 A at 20 V.`,
        look: `The two round pins.`,
      },
    },
    {
      id: 'board',
      label: 'Circuit board',
      name: 'Circuit board',
      kind: 'fr4',
      group: 1,
      anchor: [-4.7, PCB.y1, 3.6],
      solids: [box(-4.7, PCB.y0, -4.7, 4.7, PCB.y1, 4.7)],
      info: {
        facts: [
          ['Layers', 'Often four or more, densely packed'],
          ['Also on it', 'A fuse, an EMI filter, an optocoupler for feedback, a blue Y-capacitor'],
        ],
        role: `Carries all the parts. A slot or a wide gap in it separates the mains side from the USB-C side.`,
        why: `It is also the GaN switch's heatsink: the switch's heat spreads into the board's copper and from there to the case.`,
        look: `The green or black board inside, crowded with parts on both sides.`,
      },
    },
    {
      id: 'bridge',
      label: 'Bridge rectifier',
      name: 'Bridge rectifier',
      kind: 'mold',
      group: 2,
      solidInXray: true,
      anchor: [-3.0, 1.35, -3.3],
      solids: [box(-4.2, PCB.y1, -4.3, -3.0, 1.35, -3.3)],
      info: {
        facts: [['Inside', 'Four silicon diodes']],
        role: `Turns the alternating mains into pulsing direct current: it flips the negative half-waves positive.`,
        why: `Simple diodes are enough here because they switch only 100 times a second. Everything after them sees DC.`,
        look: `A small black part with four legs near the input.`,
      },
    },
    {
      id: 'bulkCap',
      label: 'Bulk capacitor',
      name: 'Bulk capacitor',
      kind: 'capacitor',
      group: 2,
      solidInXray: true,
      anchor: [-2.6, 4.95, -1.2],
      solids: [cyl([-2.6, PCB.y1 + 2.0, -1.2], 1.0, 4.0)],
      info: {
        facts: [
          ['Type', 'Aluminum electrolytic, 400 V'],
          ['Size', '≈ 10 mm across, 20 mm tall'],
        ],
        role: `Fills the gaps between the mains half-waves, so the switch always has about 300 V to work with.`,
        why: `It cannot shrink much, because it has to bridge the 10 ms between half-waves, whatever the switching frequency. It is often the tallest part in the charger, and it can stay charged after unplugging.`,
        look: `The largest cylinder, with a printed sleeve and a vent cross on top.`,
      },
    },
    {
      id: 'core',
      label: 'Transformer core',
      name: 'Transformer: ferrite core',
      kind: 'ferrite',
      group: 2,
      solidInXray: true,
      anchor: [2.6, 3.4, -0.4],
      solids: T.core,
      info: {
        facts: [
          ['Material', 'Manganese-zinc ferrite'],
          ['Shape', 'Two E-shaped halves with a small air gap'],
        ],
        role: `Guides the magnetic field that carries the energy from the mains side to the USB-C side. In a flyback the air gap stores the energy between the two halves of each cycle.`,
        why: `Its size scales with the energy it must hold per cycle, which falls as the frequency rises. That is why fast GaN switching makes chargers small.`,
        look: `The dark gray ceramic block, usually wrapped in yellow tape.`,
      },
    },
    {
      id: 'winding',
      label: 'Transformer windings',
      name: 'Transformer: windings',
      kind: 'copper',
      group: 2,
      solidInXray: true,
      anchor: [1.1, 3.2, 0.9],
      solids: T.winding,
      info: {
        facts: [
          ['Primary', 'Mains side, ≈ 40 turns'],
          ['Secondary', 'USB-C side, a few turns of thicker wire'],
        ],
        role: `The primary takes energy in while the GaN switch is on; the secondary gives it out when the switch turns off.`,
        why: `Layers of insulating tape between them carry the safety insulation: they must withstand several kilovolts so a fault on the mains side never reaches the cable you hold.`,
        look: `The copper wire, under the yellow tape that wraps the core.`,
      },
    },
    {
      id: 'ganSwitch',
      label: 'GaN switch',
      name: 'The GaN HEMT (PQFN package)',
      kind: 'mold',
      group: 2,
      solidInXray: true,
      anchor: [4.6, 1.12, -3.0],
      solids: [box(3.0, PCB.y1, -3.8, 4.6, 1.12, -2.2)],
      info: {
        facts: [
          ['Part', 'The package from the package view, 650 V'],
          ['Switches', '≈ 150 000 times per second'],
          ['Loses', 'About a watt'],
        ],
        role: `Connects the transformer's primary across the 300 V from the bulk capacitor, then lets go, over and over. Each pulse moves a small packet of energy to the output.`,
        why: `It switches in a few nanoseconds with almost no gate charge and no reverse recovery, so even at 150 kHz its switching losses stay small. A silicon MOSFET would run hot at this frequency.`,
        look: `A small flat black square next to the transformer, soldered straight onto the board.`,
        link: { scale: 'package', part: null },
      },
    },
    {
      id: 'controller',
      label: 'Controller',
      name: 'Controller chip',
      kind: 'mold',
      group: 2,
      solidInXray: true,
      anchor: [4.2, 1.1, -1.25],
      solids: [box(3.2, PCB.y1, -1.6, 4.2, 1.1, -0.9)],
      info: {
        facts: [['Watches', 'The output voltage, through an optocoupler across the insulation gap']],
        role: `Decides when to turn the GaN switch on and off: it turns it on at the bottom of the drain voltage's ringing (a "valley"), to waste less energy.`,
        why: `It also talks to the phone over USB-C (through a separate chip) to agree on 5, 9, 15 or 20 V.`,
        look: `A small chip with fine legs near the switch.`,
      },
    },
    {
      id: 'sr',
      label: 'Output rectifier',
      name: 'Synchronous rectifier MOSFET',
      kind: 'mold',
      group: 2,
      solidInXray: true,
      anchor: [4.4, 1.1, 1.9],
      solids: [box(3.2, PCB.y1, 1.4, 4.4, 1.1, 2.4)],
      info: {
        facts: [['Type', 'A low-voltage silicon MOSFET, ≈ 100 V']],
        role: `Lets the secondary current through in one direction only, like a diode, but with far less voltage drop.`,
        why: `A diode would drop about 0.5 V at 3 A, which is 1.5 W of heat in a small sealed case. A MOSFET switched at the right moments drops a tenth of that.`,
        look: `Another small flat part, on the USB-C side.`,
      },
    },
    {
      id: 'outCaps',
      label: 'Output capacitors',
      name: 'Output capacitors',
      kind: 'capacitor',
      group: 2,
      solidInXray: true,
      anchor: [4.7, 2.15, 3.6],
      solids: [cyl([3.4, PCB.y1 + 0.6, 3.6], 0.38, 1.2), cyl([4.3, PCB.y1 + 0.6, 3.6], 0.38, 1.2)],
      info: {
        facts: [['Type', 'Solid polymer, 25 V']],
        role: `Smooth the pulses from the secondary into steady DC for the USB-C port.`,
        why: `They see the full ripple current at 150 kHz, so they must have very low internal resistance; polymer capacitors also last longer in heat than liquid electrolytics.`,
        look: `Small cylinders near the USB-C port.`,
      },
    },
    {
      id: 'usb',
      label: 'USB-C port',
      name: 'USB-C port',
      kind: 'steel',
      group: 2,
      solidInXray: true,
      anchor: [USB.x, USB.y1, 4.8],
      solids: [box(-USB.x, USB.y0, 3.9, USB.x, USB.y1, CASE)],
      info: {
        facts: [['Delivers', '5, 9, 15 or 20 V, up to 3.25 A']],
        role: `The output. Two of its pins (CC) let the charger and the device agree on a voltage before power flows.`,
        why: `Higher voltage means less current for the same power, so a laptop asks for 20 V: the cable then carries 3.25 A instead of 13 A at 5 V.`,
        look: `The port you plug the cable into.`,
      },
    },
    {
      id: 'caseTop',
      label: 'Case, top',
      name: 'Case: top shell',
      kind: 'plasticLight',
      group: 7,
      anchor: [CASE, 5.0, -3.0],
      solids: [
        slab(rectXZ(-CASE, -CASE, CASE, CASE), SEAM, 5.8, [rectXZ(-CASE + WALL, -CASE + WALL, CASE - WALL, CASE - WALL)]),
        box(-CASE, 5.8, -CASE, CASE, 6.0, CASE),
      ],
      info: {
        facts: [['Material', 'The same plastic as the bottom shell']],
        role: `Closes the case.`,
        why: `Its inside is often lined with a thin graphite or aluminum sheet that spreads the heat of hot spots, like the GaN switch and the transformer, over the whole surface.`,
        look: `The top of the charger, often with the ratings printed on it.`,
      },
    },
  ],

  action: {
    title: '230 V in, 20 V out',
    stages: [
      `The mains comes in through the pins: 230 V AC, 50 times a second each way.`,
      `The bridge rectifier and the bulk capacitor turn it into about 325 V DC.`,
      `The GaN switch connects the transformer's primary across that voltage, about 150 000 times a second. While it is on, energy builds up in the transformer.`,
      `When it turns off, the energy flows out of the secondary, on the other side of the insulation.`,
      `The output rectifier and capacitors smooth it, and USB-C delivers 5 to 20 V.`,
    ],
    note: `The dots show power flowing. The switches flash to show they are switching, slowed down about a hundred thousand times.`,
    dot: 0.09,
    paths: [
      { kind: 'load', pts: primary(-1.9) },
      { kind: 'load', pts: primary(1.9) },
      { kind: 'load', pts: secondary },
      {
        kind: 'gate',
        pts: [
          [3.7, 1.05, -1.25, 0.12],
          [3.5, 1.05, -2.4, 0.1],
        ],
      },
    ],
    counts: { load: 140, gate: 16 },
    pulse: ['ganSwitch', 'sr'],
    spin: {},
    waves: {
      xMax: 20,
      xUnit: 'µs',
      xLabel: 'Time (µs), three switching cycles',
      panels: [
        {
          title: 'Voltage across the GaN switch',
          short: 'switch voltage',
          unit: 'V',
          yMin: 0,
          yMax: 500,
          series: [{ label: 'voltage', cls: 'raw', fn: drainV }],
        },
        {
          title: 'Current in the transformer primary',
          short: 'primary current',
          unit: 'A',
          yMin: 0,
          yMax: 2,
          decimals: 2,
          series: [{ label: 'current', cls: 'accent', fn: primaryI }],
        },
      ],
      caption: `While the switch is on (0 V across it), the primary current ramps up and stores energy. When it turns off, the voltage jumps to about 435 V while the energy flows to the output, then rings down; the switch turns on again at the bottom of the ring.`,
    },
    text: [
      `Each cycle moves about half a millijoule. At 150 000 cycles a second that is the charger's roughly 70 W of input power. A slower switch would need a bigger transformer to move the same power in fewer, larger packets.`,
    ],
  },
};
