import { rect, planarCell, mirrorPath } from './shapes.js';

// 1200 V planar SiC MOSFET, one cell. Layer groups (explode order) run from 0
// at the bottom to 9 at the top; parts sharing a group sit side by side.
const T = 6.4;
const c = planarCell(T);

const electrons = [
  [-3.3, T + 1.25, 0.25, 0.3], // source metal
  [-3.0, T - 0.2, 0.2, 0.1], // n+ source
  [-2.2, T - 0.035, 0, 0.02], // channel start
  [-1.6, T - 0.035, 0, 0.02], // channel end
  [-0.9, T - 0.5, 0.35, 0.1], // JFET neck
  [-0.9, c.yj - 0.4, 0.7, 0.1], // top of drift
  [-2.3, 1.0, 2.4, 0.2], // substrate, spread out
  [-2.3, -0.18, 2.4, 0.06], // drain metal
];

export default {
  id: 'sic',
  name: 'SiC MOSFET',
  kicker: 'Silicon carbide · vertical · unipolar',
  subtitle: '1200 V planar power MOSFET in 4H silicon carbide',
  summary: [
    `A power MOSFET is a voltage-controlled switch. Its gate sits on a thin insulator, so holding it on takes almost no current; only charging and discharging the gate costs energy.`,
    `This one is <b>vertical</b>: source and gate are on top, the drain is the whole back of the die, and current flows straight down. A real die repeats this cell thousands of times side by side.`,
    `Silicon carbide's wide bandgap lets a layer only about 11 µm thick block 1200 V. A silicon device needs roughly ten times that thickness, with far higher resistance.`,
  ],
  stats: [
    ['Voltage classes', '650 V – 3.3 kV'],
    ['On-resistance', '≈ 10–160 mΩ for 1200 V discretes'],
    ['Gate drive', '+15 to +18 V on, −3 to −5 V off'],
    ['Switching', '≈ 20–200 kHz'],
    ['Used in', 'EV traction inverters, fast chargers, solar inverters'],
  ],
  legend: 'doping',
  drawing: { code: 'SIC-MOSFET-1200-PLANAR', cell: '≈ 5 µm pitch' },

  parts: [
    {
      id: 'drain',
      label: 'Drain metal',
      kind: 'metal',
      group: 0,
      shapes: [rect(-5, -0.35, 5, 0)],
      info: {
        facts: [
          ['Material', 'Nickel silicide, then Ti/Ni/Ag or Au'],
          ['Thickness', '≈ 1–2 µm'],
        ],
        role: `The backside contact. It is soldered or silver-sintered to the package's copper lead frame or substrate.`,
        why: `Nearly all the heat made in the channel and drift leaves through this side, so a void-free, low-resistance attach is essential for cooling.`,
      },
    },
    {
      id: 'substrate',
      label: 'n<sup>+</sup> SiC substrate',
      kind: 'nPlus',
      group: 1,
      shapes: [rect(-5, 0, 5, 1.7)],
      info: {
        facts: [
          ['Material', '4H-SiC wafer (150 or 200 mm), nitrogen-doped'],
          ['Thickness', '≈ 100–350 µm after thinning'],
          ['Doping', '≈ 10<sup>19</sup> cm<sup>−3</sup> (heavy)'],
        ],
        role: `Mechanical support for the thin active layers on top, and the path the current takes down to the drain.`,
        why: `It adds resistance without blocking any voltage, so finished wafers are ground thin. SiC crystals grow slowly at over 2000 °C, which makes the wafers expensive. That is the main reason SiC devices cost more than silicon ones.`,
      },
    },
    {
      id: 'buffer',
      label: 'n buffer layer',
      kind: 'n',
      group: 2,
      shapes: [rect(-5, 1.7, 5, 2.0)],
      info: {
        facts: [
          ['Material', '4H-SiC epitaxial layer'],
          ['Thickness', '≈ 1 µm'],
          ['Doping', '≈ 10<sup>18</sup> cm<sup>−3</sup>'],
        ],
        role: `A transition layer between the substrate and the drift. It also stops the electric field, which ends abruptly here.`,
        why: `Substrates contain crystal defects called basal-plane dislocations. If they reach the drift, current through the body diode can make them grow into stacking faults that raise on-resistance over time (bipolar degradation). The buffer converts most of them into harmless forms.`,
      },
    },
    {
      id: 'drift',
      label: 'n<sup>−</sup> drift layer',
      kind: 'nMinus',
      group: 3,
      shapes: [rect(-5, 2.0, 5, c.yj)],
      info: {
        facts: [
          ['Material', '4H-SiC epitaxial layer, nitrogen-doped'],
          ['Thickness', '≈ 11 µm (for 1200 V)'],
          ['Doping', '≈ 8 × 10<sup>15</sup> cm<sup>−3</sup> (light)'],
        ],
        role: `Holds off the high voltage when the device is off, and carries the current down to the substrate when it is on.`,
        why: `This is the central trade-off of every power device: a thicker, more lightly doped drift blocks more voltage but has more resistance. SiC's critical field is about ten times silicon's, so its drift can be ten times thinner and about a hundred times more heavily doped. Its resistance ends up hundreds of times lower. See it in Blocking mode.`,
      },
    },
    {
      id: 'pwell',
      label: 'p-well',
      name: 'p-well (body)',
      kind: 'p',
      group: 4,
      shapes: [c.wellL, c.wellR],
      info: {
        facts: [
          ['Material', '4H-SiC, implanted with aluminum'],
          ['Depth', '≈ 1 µm'],
          ['Doping', '≈ 10<sup>17</sup>–10<sup>18</sup> cm<sup>−3</sup>'],
        ],
        role: `The p-type region the channel forms in. Its junction with the n<sup>−</sup> drift is what blocks voltage when the device is off.`,
        why: `Dopants barely move in SiC even when hot, so wells are made by high-energy ion implantation and then activated at about 1700 °C. The p-well/drift junction also forms the MOSFET's built-in body diode, with a forward drop of about 3 V because of SiC's wide bandgap.`,
      },
    },
    {
      id: 'jfet',
      label: 'JFET region',
      kind: 'nJfet',
      group: 4,
      shapes: [c.jfet],
      info: {
        facts: [
          ['Material', '4H-SiC, n-type, often extra doped'],
          ['Width', '≈ 1–3 µm'],
          ['Doping', '≈ 10<sup>16</sup>–10<sup>17</sup> cm<sup>−3</sup>'],
        ],
        role: `The narrow neck of n-type material between two p-wells. Electrons leaving the channel squeeze through it on their way down.`,
        why: `Its width is a trade-off. A narrow neck lets the p-wells shield the gate oxide from high fields when blocking; a wide one adds less resistance when conducting. Trench MOSFETs avoid the neck entirely by cutting the gate down into the silicon carbide.`,
      },
    },
    {
      id: 'channel',
      label: 'Inversion channel',
      kind: 'channel',
      group: 4,
      shapes: [c.chL, c.chR],
      onlyIn: ['on'],
      depthPad: 0.04,
      solidInXray: true,
      info: {
        facts: [
          ['What', 'Electrons drawn to the p-well surface'],
          ['Size', 'a few nm thick, ≈ 0.5 µm long'],
          ['Mobility', '≈ 20–50 cm²/V·s (bulk SiC: ≈ 950)'],
        ],
        role: `Appears only with a positive gate voltage. The top few nanometers of the p-well flip to n-type and connect the n<sup>+</sup> source to the JFET region.`,
        why: `In a 1200 V SiC MOSFET the channel is a large share of the total on-resistance, because defects at the SiC/SiO₂ interface slow the electrons down. In silicon MOSFETs the drift layer dominates instead.`,
      },
    },
    {
      id: 'nsource',
      label: 'n<sup>+</sup> source',
      kind: 'nPlus',
      group: 5,
      shapes: [c.nL, c.nR],
      info: {
        facts: [
          ['Material', '4H-SiC, implanted with nitrogen or phosphorus'],
          ['Depth', '≈ 0.3 µm'],
          ['Doping', '≈ 10<sup>19</sup>–10<sup>20</sup> cm<sup>−3</sup> (heavy)'],
        ],
        role: `A reservoir of free electrons. When the channel opens, electrons flow from here into it.`,
        why: `It must be heavily doped to make a low-resistance contact to the metal. Its edge under the gate sets where the channel begins, so the channel length (about 0.5 µm) is the gap between this edge and the edge of the p-well.`,
      },
    },
    {
      id: 'pplus',
      label: 'p<sup>+</sup> body contact',
      kind: 'pPlus',
      group: 5,
      shapes: [c.pL, c.pR],
      info: {
        facts: [
          ['Material', '4H-SiC, implanted with aluminum'],
          ['Depth', '≈ 0.5 µm'],
          ['Doping', '≈ 10<sup>19</sup>–10<sup>20</sup> cm<sup>−3</sup> (heavy)'],
        ],
        role: `Connects the p-well to the source metal with low resistance.`,
        why: `The n<sup>+</sup> source, p-well and n<sup>−</sup> drift form an NPN bipolar transistor. If the p-well were left floating, that hidden transistor could switch on by itself; shorting the p-well to the source keeps it off. The same connection makes the body diode usable.`,
      },
    },
    {
      id: 'oxide',
      label: 'Gate oxide',
      kind: 'oxide',
      group: 6,
      shapes: [c.oxide],
      anchor: [2.1, T + 0.075],
      info: {
        facts: [
          ['Material', 'Thermally grown SiO₂'],
          ['Thickness', '≈ 50 nm'],
        ],
        role: `The thin insulator between the gate and the semiconductor. The channel forms right beneath it.`,
        why: `This is the most delicate part of a SiC MOSFET. The SiC/SiO₂ interface has many defects (traps) that slow electrons in the channel and can shift the threshold voltage over time. When the device blocks, the oxide above the JFET region also sees a high field, so its long-term reliability is a major design concern.`,
      },
    },
    {
      id: 'gate',
      label: 'Polysilicon gate',
      kind: 'poly',
      group: 7,
      shapes: [c.gate],
      anchor: [1.8, T + 0.45],
      info: {
        facts: [
          ['Material', 'Heavily doped polycrystalline silicon'],
          ['Thickness', '≈ 0.5 µm'],
        ],
        role: `The gate electrode. Together with the p-well surface it forms a capacitor across the gate oxide. A positive gate voltage pulls electrons into that surface and turns the channel on.`,
        why: `The gate driver must charge and discharge this capacitor on every switching cycle. That gate charge (Q<sub>G</sub>, tens to hundreds of nC) sets how strong the driver must be and how fast the device can switch.`,
      },
    },
    {
      id: 'ild',
      label: 'Interlayer dielectric',
      kind: 'ild',
      group: 8,
      shapes: [c.ild],
      anchor: [2.7, T + 0.7],
      info: {
        facts: [
          ['Material', 'Deposited SiO₂, often phosphorus-doped glass'],
          ['Thickness', '≈ 1 µm'],
        ],
        role: `Insulates the gate from the source metal that runs over it.`,
        why: `Gate and source differ by about 20 V during switching, so this layer must not leak or crack. The gate is wired out separately, through gate runners at the edge of the die to the gate pad.`,
      },
    },
    {
      id: 'metal',
      label: 'Source metal',
      kind: 'metal',
      group: 9,
      shapes: [c.metal],
      anchor: [4, T + 1.0],
      info: {
        facts: [
          ['Material', 'Aluminum, on a nickel-silicide contact'],
          ['Thickness', '≈ 4 µm'],
        ],
        role: `Connects every n<sup>+</sup> source and p<sup>+</sup> body contact on the die in parallel. Bond wires or copper clips land on it.`,
        why: `It carries the full device current, often hundreds of amps per square centimeter. Tying the p<sup>+</sup> body contacts to the source here also disables the hidden NPN transistor in the structure.`,
      },
    },
  ],

  gateOn: {
    title: 'Electrons flow straight down',
    steps: [
      `The gate is driven to +18 V. Like a capacitor plate, it pulls electrons to the top of the p-well, just under the gate oxide.`,
      `That thin surface layer flips from p-type to n-type: the inversion channel (glowing cyan).`,
      `With a few volts on the drain, electrons flow from the source, through the channel and the JFET neck, spread out through the drift and substrate, and leave through the drain.`,
      `Only electrons carry the current, so there is no stored charge to clear at turn-off. The device acts like a resistor: V<sub>DS</sub> = I<sub>D</sub> × R<sub>DS(on)</sub>.`,
    ],
    note: `Conventional current flows the opposite way to the electrons: into the drain and out of the source.`,
    paths: [
      { carrier: 'e', pts: electrons },
      { carrier: 'e', pts: mirrorPath(electrons) },
    ],
    electrons: 220,
    holes: 0,
  },

  blocking: {
    kind: 'vertical',
    title: 'Holding off the drain voltage',
    terminal: 'Drain',
    Vrated: 1200,
    Vmax: 2000,
    yJunction: c.yj,
    yDriftBottom: 2.0,
    yStopBottom: 1.7,
    x0: -5,
    x1: 5,
    stopName: 'buffer',
    params: { Nd: 8e15, tDrift: 11, epsR: 9.7, Ec: 2.5e6, Nstop: 1e18, tStop: 1 },
    axis: 'Depth below the p-well junction (µm)',
    caption: `Electric field below the p-well junction. The shaded area equals the voltage being blocked.`,
    text: [
      `The gate is held at 0 V or below, so there is no channel. The drain is positive, which reverse-biases the junction between the p-well and the n<sup>−</sup> drift.`,
      `Free electrons are pushed out of the drift, leaving a depletion region that acts as an insulator. The field is strongest at the junction and falls off with depth. Above about 900 V the depletion reaches the buffer, and the field profile turns from a triangle into a trapezoid.`,
      `When the peak reaches the critical field, avalanche breakdown sets in. Switch to the Si IGBT at the same voltage and compare the depth axis.`,
    ],
  },
};
