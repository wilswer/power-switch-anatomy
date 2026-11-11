import { box, slab, rectXZ, circleXZ, cyl, cable } from '../packages/solids.js';
import { tri } from './shared.js';

// The IGBT at work: a 30 kW industrial motor drive (a variable-frequency
// drive), drawn lying on its back with the cover lifted off, and the motor it
// drives. Model units: 1 unit = 40 mm (the drive is 240 × 400 mm; the motor
// is drawn smaller than it is). Three half-bridge modules from the package
// view, one per motor phase. Groups run from 0 (heatsink, motor) to 9 (cover,
// lifted well clear).

const D = { x: 3, z: 5 };
const MOD_Z = [-3.2, -1.2, 0.8]; // phases U, V, W
const CAP_Z = [-3.3, -2.0, -0.7, 0.6];
const BUS = { y0: 0.8, y1: 0.92 };
const MOTOR = { x: 7.5, y: 1.65, z: -3, r: 1.4, len: 4.5 };
const FAN = { y: -0.8, z: -5.25 };

// The waveforms: sine-triangle PWM of phase U, and the motor current.
const VDC = 560; // rectified 400 V three-phase grid
const M = 0.85; // modulation depth
const CARRIER = 1; // ms per switching period in the drawing (real: 0.06–0.25 ms)
const IPK = 70; // A peak, ≈ 50 A rms
const PF = 0.85; // motor power factor
const w = (2 * Math.PI) / 20; // 50 Hz output, t in ms
const ref = (t) => 0.5 + 0.5 * M * Math.sin(w * t);
const pwm = (t) => (ref(t) > tri(t, CARRIER) ? VDC : 0);
export const DRIVE = { VDC, M, IPK, PF, VLL: 400, ref, pwm, CARRIER };

const term = (x0, x1) => box(x0, 0, 4.3, x1, 0.5, 4.9);
const motorCable = [
  [1.5, 0.25, 4.9],
  [1.5, 0.25, 6.0],
  [4.0, 0.25, 6.4],
  [9.6, 0.25, 3.0],
  [9.8, 1.5, -1.0],
  [8.8, 3.3, -3.0],
  [8.0, 3.3, -3.0],
];
const flow = (zc) => [
  [-1.5, 0.25, 4.85, 0.15],
  [-1.5, 0.3, 4.2, 0.15],
  [-0.4, 0.35, 3.1, 0.4],
  [0.2, BUS.y0 + 0.06, 1.4, 0.3],
  [0.2, BUS.y0 + 0.06, zc, 0.35],
  [0, 0.45, zc, 0.45],
  [0, 1.2, zc, 0.1],
  [1.0, 1.2, zc, 0.1],
  [1.0, 1.2, 4.0, 0.1],
  [1.5, 0.3, 4.6, 0.1],
  ...motorCable.map(([x, y, z]) => [x, y, z, 0.05]),
  [MOTOR.x, MOTOR.y, MOTOR.z, 0.9],
];

export default {
  id: 'igbt-app',
  device: 'igbt',
  scale: 'app',
  name: '30 kW motor drive',
  short: 'Motor drive',
  kicker: 'Si IGBT · in a product',
  subtitle: 'A variable-frequency drive: it runs a motor at any speed from the fixed-frequency grid',
  summary: [
    `Pumps, fans, conveyors and elevators are driven by electric motors, and most of them now run from a drive like this one. It turns the grid's fixed 50 Hz into whatever frequency and voltage the motor needs, so the motor can run at any speed.`,
    `Inside are three half-bridge modules from the package view, one per motor wire, bolted to a finned heatsink with a fan. Above them a laminated busbar connects them to a bank of capacitors that holds about 560 V DC, and a gate-driver board switches them.`,
    `Running a pump or fan only as fast as needed, instead of throttling it at full speed, often saves a third or more of its energy. Drives like this are one of the biggest energy savers in industry.`,
  ],
  stats: [
    ['Input', '400 V three-phase grid, 50 Hz'],
    ['Output', '0–400 V, 0–100 Hz to the motor, ≈ 50 A per phase'],
    ['The switches', 'Six 1200 V IGBTs with diodes, in three half-bridge modules, ≈ 4–16 kHz'],
    ['Efficiency', '≈ 97–98 %: ≈ 700 W of heat at full load'],
    ['Size', '≈ 240 × 400 × 250 mm, ≈ 15 kg'],
  ],
  legendSwitch: 'modules',
  // How it converts: forms of electricity (node) and the converters between them.
  chain: [
    { node: 'Grid', value: '400 V AC, 50 Hz' },
    { conv: 'Rectifier', how: 'Six diodes in the rectifier module' },
    { node: 'DC link', value: '≈ 560 V DC, held by the capacitors' },
    { conv: 'Inverter', how: 'The three IGBT half-bridge modules', ours: true },
    { node: 'Motor', value: '0–400 V AC at 0–100 Hz' },
  ],
  gap: 0.8,
  drawing: { code: 'APP-VFD-30KW-IGBT', sizeLabel: 'DRIVE', size: '240 × 400 mm' },
  modeLook: { action: { explode: 0, xray: true } },

  parts: [
    {
      id: 'heatsink',
      label: 'Heatsink',
      name: 'Finned heatsink',
      kind: 'heatsink',
      group: 0,
      anchor: [-D.x, -0.9, 3.5],
      solids: [
        box(-D.x, -0.3, -D.z, D.x, 0, D.z),
        ...Array.from({ length: 9 }, (_, i) => box(-2.88 + i * 0.7, -1.6, -D.z, -2.72 + i * 0.7, -0.3, D.z)),
      ],
      info: {
        facts: [
          ['Material', 'Extruded aluminum'],
          ['Removes', 'About 700 W at full load'],
        ],
        role: `Takes the heat of the modules and the rectifier. The fan pushes air along its fins.`,
        why: `It is the part that sets the drive's size and weight. The modules' baseplates are bolted straight onto it with a thin layer of grease, as in the module's Heat view.`,
        look: `The finned aluminum back of the drive, usually facing the cabinet wall.`,
      },
    },
    {
      id: 'fanFrame',
      label: 'Cooling fan',
      name: 'Cooling fan',
      kind: 'plastic',
      group: 0,
      anchor: [1.5, -0.8, -5.5],
      solids: [
        box(-1.5, -1.6, -5.5, -1.3, 0, -5.0),
        box(1.3, -1.6, -5.5, 1.5, 0, -5.0),
        box(-1.3, -1.6, -5.5, 1.3, -1.45, -5.0),
        box(-1.3, -0.15, -5.5, 1.3, 0, -5.0),
      ],
      info: {
        facts: [['Speed', 'Controlled by the drive, from its own temperature sensors']],
        role: `Blows air along the heatsink fins.`,
        why: `Fans are the drive's main wear part. Many drives slow the fan down at light load to make it last longer and run quieter.`,
        look: `The fan at one end of the heatsink, behind a grille.`,
      },
    },
    {
      id: 'fanRotor',
      kind: 'plastic',
      group: 0,
      pickAs: 'fanFrame',
      spin: { pivot: [0, FAN.y, FAN.z], axis: [0, 0, 1] },
      solids: [
        cyl([0, FAN.y, FAN.z], 0.22, 0.3, 'z'),
        box(-1.2, FAN.y - 0.07, FAN.z - 0.05, 1.2, FAN.y + 0.07, FAN.z + 0.05),
        box(-0.07, FAN.y - 0.6, FAN.z - 0.05, 0.07, FAN.y + 0.6, FAN.z + 0.05),
      ],
    },
    {
      id: 'gridTerminals',
      label: 'Grid terminals',
      name: 'Grid terminals L1, L2, L3',
      kind: 'copper',
      group: 0,
      solidInXray: true,
      anchor: [-2.4, 0.5, 4.6],
      solids: [term(-2.4, -0.6)],
      info: {
        facts: [['Connect', 'The three grid phases and protective earth']],
        role: `Where the grid cable is screwed in.`,
        why: `The drive draws its current through a diode rectifier, in short pulses; large drives add an inductor or an active front end to keep that from disturbing the grid.`,
        look: `The left row of screw terminals at the bottom of a drive.`,
      },
    },
    {
      id: 'motorTerminals',
      label: 'Motor terminals',
      name: 'Motor terminals U, V, W',
      kind: 'copper',
      group: 0,
      solidInXray: true,
      anchor: [2.4, 0.5, 4.6],
      solids: [term(0.6, 2.4)],
      info: {
        facts: [['Carry', 'The pulse-width-modulated output, one wire per module']],
        role: `Where the motor cable connects. Each terminal is the AC terminal of one half-bridge module.`,
        why: `The voltage on them is a train of 560 V pulses with very steep edges, so motor cables are shielded and the motor's insulation must be rated for it.`,
        look: `The right row of terminals, marked U, V, W.`,
      },
    },
    {
      id: 'rectifier',
      label: 'Rectifier module',
      name: 'Input rectifier module',
      kind: 'plastic',
      group: 1,
      solidInXray: true,
      anchor: [1.2, 0.6, 3.1],
      solids: [box(-1.2, 0, 2.3, 1.2, 0.6, 3.9)],
      info: {
        facts: [['Inside', 'Six silicon diodes in a three-phase bridge']],
        role: `Turns the three-phase grid into DC for the capacitors.`,
        why: `The diodes only switch at the grid frequency, so plain silicon diodes are enough. All the fast switching happens in the three IGBT modules.`,
        look: `A module like the IGBT ones, usually smaller, next to them on the heatsink.`,
      },
    },
    {
      id: 'modules',
      label: 'IGBT modules',
      name: 'Three half-bridge IGBT modules (U, V, W)',
      kind: 'plastic',
      group: 1,
      solidInXray: true,
      anchor: [1.33, 0.75, -3.2],
      solids: MOD_Z.map((zc) => box(-1.33, 0, zc - 0.78, 1.33, 0.75, zc + 0.78)),
      info: {
        facts: [
          ['Part', 'The half-bridge module from the package view'],
          ['One per', 'Motor wire: U, V and W'],
          ['Switching', '≈ 4–16 kHz'],
        ],
        role: `Together they are a three-phase inverter. Each switches its motor wire between DC+ and DC− with a varying pulse width, so the average voltage on that wire traces a sine wave.`,
        why: `IGBTs are the classic choice here: the switching is slow enough for them, they are rugged against motor faults, and they carry large currents at a low voltage drop. Newer drives start to use SiC to cut losses further.`,
        look: `The plastic modules on the heatsink, under the driver board.`,
        link: { scale: 'package', part: null },
      },
    },
    {
      id: 'moduleTerminals',
      kind: 'copper',
      group: 1,
      pickAs: 'modules',
      solids: MOD_Z.flatMap((zc) => [-0.9, 0, 0.9].map((x) => box(x - 0.25, 0.75, zc - 0.3, x + 0.25, BUS.y0, zc + 0.3))),
    },
    {
      id: 'busbar',
      label: 'Laminated busbar',
      name: 'Laminated busbar',
      kind: 'copper',
      group: 2,
      solidInXray: true,
      anchor: [-1.4, BUS.y1, -2.0],
      solids: [slab(rectXZ(-1.4, -4.0, 2.8, 1.65), BUS.y0, BUS.y1, CAP_Z.map((z) => circleXZ(2.2, z, 0.55)))],
      info: {
        facts: [['Build', 'Two copper sheets, DC+ and DC−, with a thin insulating film between them']],
        role: `Connects the capacitors to the DC terminals of all three modules.`,
        why: `Pressing the two sheets close together makes their magnetic fields cancel, so the loop has very little inductance. Every nanohenry here becomes a voltage spike on the IGBTs when they turn off hundreds of amps.`,
        look: `The flat copper plates screwed to the module terminals.`,
      },
    },
    {
      id: 'caps',
      label: 'DC-link capacitors',
      name: 'DC-link capacitors',
      kind: 'capacitor',
      group: 3,
      solidInXray: true,
      anchor: [2.7, 2.6, 0.6],
      solids: CAP_Z.map((z) => cyl([2.2, 1.3, z], 0.5, 2.6)),
      info: {
        facts: [
          ['Type', 'Aluminum electrolytic, in series pairs for ≈ 900 V'],
          ['Hold', 'About 560 V DC'],
        ],
        role: `Store energy between the rectifier and the inverter, and supply the fast pulses of current that the modules draw at every switching edge.`,
        why: `They age with heat, and they often decide how long a drive lasts. Their charge can be lethal for minutes after switch-off, which is why drives carry a warning to wait before opening.`,
        look: `The row of large cylinders.`,
      },
    },
    {
      id: 'driverBoard',
      label: 'Gate-driver board',
      name: 'Gate-driver board',
      kind: 'fr4',
      group: 4,
      anchor: [-1.4, 1.6, -3.5],
      solids: [box(-1.4, 1.5, -4.0, 1.4, 1.6, 1.6)],
      info: {
        facts: [['Per IGBT', 'One isolated gate driver: +15 V on, −8 V off']],
        role: `Switches the six IGBTs on the controller's command, and protects them: it detects a short circuit and turns the IGBT off within a few microseconds.`,
        why: `Each high-side IGBT's emitter swings by 560 V at every switching edge, so its driver needs its own isolated supply and an isolated signal path.`,
        look: `The board plugged onto the modules' gate pins.`,
      },
    },
    {
      id: 'controlBoard',
      label: 'Control board',
      name: 'Control board',
      kind: 'fr4',
      group: 4,
      anchor: [1.4, 1.6, 3.6],
      solids: [box(-1.4, 1.5, 2.0, 1.4, 1.6, 4.2)],
      info: {
        facts: [['Brain', 'A microcontroller running the motor-control algorithm']],
        role: `Measures the motor currents and computes, thousands of times a second, which pulse widths each module should make.`,
        why: `With a model of the motor, it can control torque directly, not just speed (field-oriented control).`,
        look: `The board behind the keypad.`,
      },
    },
    {
      id: 'cover',
      label: 'Cover',
      name: 'Cover and keypad',
      kind: 'plastic',
      group: 9,
      anchor: [-D.x, 2.2, -4.0],
      solids: [
        slab(rectXZ(-D.x, -D.z, D.x, D.z), 0, 3.0, [rectXZ(-D.x + 0.1, -D.z + 0.1, D.x - 0.1, D.z - 0.1)]),
        box(-D.x, 3.0, -D.z, D.x, 3.15, D.z),
        box(-0.8, 3.15, 3.0, 0.8, 3.3, 4.2),
      ],
      info: {
        facts: [['Keypad', 'Start, stop, speed and settings']],
        role: `Closes the drive and carries the keypad and display.`,
        why: `Its front shows the speed, current and faults; drives are also run remotely over a fieldbus by the plant's controller.`,
        look: `The front of the drive, with the display.`,
      },
    },
    {
      id: 'motorCable',
      label: 'Motor cable',
      name: 'Motor cable',
      kind: 'cable',
      group: 0,
      solidInXray: true,
      anchor: [8.4, 0.25, 4.0],
      solids: [cable(motorCable, 0.13)],
      info: {
        facts: [['Inside', 'Three phase wires, earth and a braided shield']],
        role: `Connects the drive's U, V, W terminals to the motor.`,
        why: `The shield carries back the high-frequency currents that the steep switching edges push through the cable's capacitance, so they do not leak into other equipment.`,
        look: `The thick cable from the drive to the motor's terminal box.`,
      },
    },
    {
      id: 'motor',
      label: 'Motor',
      name: 'Induction motor',
      kind: 'motor',
      group: 0,
      solidInXray: true,
      anchor: [MOTOR.x + MOTOR.r, MOTOR.y, MOTOR.z - 1.0],
      solids: [
        cyl([MOTOR.x, MOTOR.y, MOTOR.z], MOTOR.r, MOTOR.len, 'z'),
        cyl([MOTOR.x, MOTOR.y, MOTOR.z - 2.6], 1.25, 0.7, 'z'),
        box(MOTOR.x - 1.1, 0, MOTOR.z - 1.8, MOTOR.x + 1.1, MOTOR.y - MOTOR.r, MOTOR.z + 1.8),
        box(MOTOR.x - 0.5, MOTOR.y + MOTOR.r, MOTOR.z - 0.6, MOTOR.x + 0.5, 3.6, MOTOR.z + 0.6),
      ],
      info: {
        facts: [
          ['Type', 'Three-phase induction motor, 30 kW'],
          ['Speed', 'Set by the frequency: ≈ 1475 rpm at 50 Hz for a four-pole motor'],
        ],
        role: `Turns the three sine-wave currents into a rotating magnetic field that drags the rotor around.`,
        why: `Its speed follows the frequency of its supply. Straight from the grid it can only run at one speed; from the drive, at any speed.`,
        look: `The motor, with its terminal box on top and the cooling fan under the cover at the back.`,
      },
    },
    {
      id: 'shaft',
      label: 'Shaft',
      name: 'Motor shaft',
      kind: 'steel',
      group: 0,
      solidInXray: true,
      spin: { pivot: [MOTOR.x, MOTOR.y, MOTOR.z], axis: [0, 0, 1] },
      anchor: [MOTOR.x, MOTOR.y + 0.2, MOTOR.z + 3.4],
      solids: [
        cyl([MOTOR.x, MOTOR.y, MOTOR.z + 2.825], 0.2, 1.15, 'z'),
        box(MOTOR.x - 0.08, MOTOR.y + 0.2, MOTOR.z + 3.0, MOTOR.x + 0.08, MOTOR.y + 0.55, MOTOR.z + 3.4),
      ],
      info: {
        facts: [['Turns', 'Whatever the motor drives: a pump, fan or conveyor']],
        role: `Delivers the motor's torque. The key on it locks the coupling to the load.`,
        why: `Watch it turn in In action.`,
        look: `The steel shaft at the front of the motor.`,
      },
    },
  ],

  action: {
    title: 'Fixed 50 Hz in, any speed out',
    stages: [
      `The 400 V three-phase grid comes in at L1, L2, L3.`,
      `The rectifier turns it into DC, and the capacitors hold it at about 560 V.`,
      `Each of the three IGBT modules switches its motor wire between DC+ and DC− thousands of times a second, with pulse widths that rise and fall like a sine wave.`,
      `The motor's windings smooth the pulses into three sine-wave currents, a third of a cycle apart, that turn the rotor. Their frequency sets the speed.`,
    ],
    note: `The dots show power flowing from the grid to the motor. The modules flash to show they are switching, and the motor and fan are slowed down, all for visibility.`,
    dot: 0.09,
    paths: MOD_Z.map((zc) => ({ kind: 'load', pts: flow(zc) })),
    counts: { load: 210, gate: 0 },
    pulse: ['modules'],
    spin: { shaft: 0.8, fanRotor: 2.5 },
    waves: {
      xMax: 20,
      xUnit: 'ms',
      xLabel: 'Time (ms), one 50 Hz cycle',
      panels: [
        {
          title: 'Phase U voltage',
          short: 'phase U',
          unit: 'V',
          yMin: 0,
          yMax: 600,
          series: [
            { label: 'pulses', cls: 'raw', fn: pwm },
            { label: 'average', cls: 'avg', fn: (t) => VDC * ref(t) },
          ],
        },
        {
          title: 'Phase U motor current',
          short: 'current',
          unit: 'A',
          yMin: -80,
          yMax: 80,
          series: [
            {
              label: 'current',
              cls: 'accent',
              fn: (t) => IPK * Math.sin(w * t - Math.acos(PF)) + 3 * (2 * tri(t, CARRIER) - 1) * (pwm(t) ? 1 : -1),
            },
          ],
        },
      ],
      caption: `The module output is only ever 0 or 560 V. The widths of the pulses rise and fall, so their average over each switching period traces a sine wave; the motor's inductance does that averaging, and its current comes out smooth. Drawn with 20 pulses per cycle; a real drive makes 80 to 300.`,
    },
    text: [
      `To run the motor at half speed, the controller makes the pulse pattern repeat 25 times a second instead of 50, with narrower swings. Nothing in the hardware changes: the speed is in the switching.`,
    ],
  },
};
