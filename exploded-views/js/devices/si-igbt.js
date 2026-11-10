import { rect, planarCell, mirrorPath } from './shapes.js';

// 1200 V planar field-stop IGBT in silicon, one cell. The top half is the same
// MOS cell as the SiC MOSFET; the difference is underneath.
const T = 7.4;
const c = planarCell(T);

const electrons = [
  [-3.3, T + 1.25, 0.25, 0.3],
  [-3.0, T - 0.2, 0.2, 0.1],
  [-2.2, T - 0.035, 0, 0.02],
  [-1.6, T - 0.035, 0, 0.02],
  [-0.9, T - 0.5, 0.35, 0.1],
  [-0.9, c.yj - 0.5, 0.7, 0.1],
  [-2.3, 0.75, 2.4, 0.15],
  [-2.3, 0.2, 2.4, 0.1], // recombine in the p+ collector
];

const holes = [
  [-2.3, -0.2, 2.4, 0.06], // collector metal
  [-2.3, 0.2, 2.4, 0.1], // injected from the p+ collector
  [-2.4, 0.8, 2.3, 0.1],
  [-3.0, c.yj - 0.8, 1.4, 0.2], // up through the drift
  [-3.4, c.yj + 0.3, 0.6, 0.1], // collected by the p-body, under the n+ emitter
  [-4.3, T - 0.3, 0.45, 0.1], // p+ contact
  [-4.3, T + 1.2, 0.45, 0.3], // emitter metal
];

export default {
  id: 'igbt',
  name: 'Si IGBT',
  kicker: 'Silicon · vertical · bipolar',
  subtitle: '1200 V planar field-stop IGBT in silicon',
  summary: [
    `An IGBT (insulated-gate bipolar transistor) is driven like a MOSFET but conducts like a bipolar transistor. Its top half is a MOSFET; the difference is the thin <b>p<sup>+</sup> layer on the back</b>.`,
    `When the IGBT is on, that p<sup>+</sup> collector injects holes into the drift. Electrons and holes flood the drift and make it conduct far better than its doping alone would allow. This is called conductivity modulation.`,
    `The price is speed. At turn-off the stored electrons and holes take time to disappear, causing a tail current and switching losses. That keeps most IGBTs below about 20 kHz.`,
  ],
  stats: [
    ['Voltage classes', '600 V – 6.5 kV'],
    ['On-state drop', 'V<sub>CE(sat)</sub> ≈ 1.5–2 V at rated current'],
    ['Gate drive', '+15 V on, 0 to −15 V off'],
    ['Switching', '≈ 2–20 kHz'],
    ['Used in', 'Motor drives, trains, wind turbines, many EV inverters'],
  ],
  legend: 'doping',
  drawing: { code: 'SI-IGBT-1200-FS-PLANAR', cell: '≈ 10–20 µm pitch' },

  parts: [
    {
      id: 'collector',
      label: 'Collector metal',
      kind: 'metal',
      group: 0,
      shapes: [rect(-5, -0.35, 5, 0)],
      info: {
        facts: [
          ['Material', 'Al/Ti/Ni/Ag stack'],
          ['Thickness', '≈ 1–2 µm'],
        ],
        role: `The backside contact, called the collector in an IGBT. It is soldered or sintered to the power module's ceramic substrate.`,
        why: `As in the MOSFET, almost all the heat leaves through this side. IGBT modules can dissipate kilowatts, so the solder layers below it are a classic wear-out point under thermal cycling.`,
      },
    },
    {
      id: 'pcollector',
      label: 'p<sup>+</sup> collector',
      kind: 'pPlus',
      group: 1,
      shapes: [rect(-5, 0, 5, 0.4)],
      info: {
        facts: [
          ['Material', 'Silicon, boron implanted from the back'],
          ['Thickness', '≈ 0.5 µm'],
          ['Doping', '≈ 10<sup>17</sup>–10<sup>18</sup> cm<sup>−3</sup>'],
        ],
        role: `The layer that makes an IGBT an IGBT. When electrons arrive from above, this junction turns on (at about 0.7 V) and injects holes up into the drift.`,
        why: `Its doping tunes the device. More injection lowers the on-state voltage but leaves more charge to clear at turn-off, raising switching losses. The 0.7 V junction drop also means an IGBT conducts nothing below about 0.7 V, and it cannot conduct in reverse, so it needs a separate diode alongside it.`,
      },
    },
    {
      id: 'fieldstop',
      label: 'n field stop',
      kind: 'n',
      group: 2,
      shapes: [rect(-5, 0.4, 5, 1.0)],
      info: {
        facts: [
          ['Material', 'Silicon, phosphorus or proton (hydrogen) implant from the back'],
          ['Thickness', '≈ 5–30 µm'],
          ['Doping', '≈ 10<sup>15</sup>–10<sup>16</sup> cm<sup>−3</sup>'],
        ],
        role: `Stops the electric field just before it reaches the p<sup>+</sup> collector.`,
        why: `With a field stop, the drift can be thinner for the same voltage, which cuts both on-state and switching losses. It gives the field-stop IGBT its name and has been the standard design since the 2000s.`,
      },
    },
    {
      id: 'drift',
      label: 'n<sup>−</sup> drift (the wafer)',
      name: 'n<sup>−</sup> drift layer',
      kind: 'nMinus',
      group: 3,
      shapes: [rect(-5, 1.0, 5, c.yj)],
      info: {
        facts: [
          ['Material', 'Float-zone silicon: the wafer itself'],
          ['Thickness', '≈ 110–120 µm (for 1200 V)'],
          ['Doping', '≈ 6 × 10<sup>13</sup> cm<sup>−3</sup> (very light)'],
        ],
        role: `Blocks the voltage when the device is off. When it is on, it fills with electrons and holes.`,
        why: `Silicon's low critical field forces a thick, very lightly doped drift, which on its own would be very resistive. The injected electron-hole plasma is about a thousand times denser than the doping, so the drift conducts well anyway. There is no separate substrate: the wafer is thinned to the drift thickness and the back layers are implanted into it.`,
      },
    },
    {
      id: 'plasma',
      label: 'Electron-hole plasma',
      kind: 'plasma',
      group: 3,
      shapes: [rect(-4.97, 1.03, 4.97, c.yj - 0.03)],
      onlyIn: ['on'],
      depthPad: 0.04,
      solidInXray: true,
      info: {
        facts: [
          ['What', 'Injected electrons and holes filling the drift'],
          ['Density', '≈ 10<sup>16</sup>–10<sup>17</sup> cm<sup>−3</sup>'],
          ['vs. doping', '≈ 1000× the drift doping'],
        ],
        role: `Holes from the collector and electrons from the channel fill the drift in equal numbers, keeping it electrically neutral.`,
        why: `This is conductivity modulation: the drift behaves as if it were heavily doped, so a 120 µm layer drops only a volt or so at full current. The plasma is also the IGBT's weakness. At turn-off it must recombine or be swept out, which causes the tail current and most of the switching loss.`,
      },
    },
    {
      id: 'pbody',
      label: 'p-body',
      kind: 'p',
      group: 4,
      shapes: [c.wellL, c.wellR],
      info: {
        facts: [
          ['Material', 'Silicon, boron implanted and diffused'],
          ['Depth', '≈ 3 µm'],
          ['Doping', '≈ 10<sup>17</sup> cm<sup>−3</sup>'],
        ],
        role: `The channel forms at its surface. When the IGBT is on, it also collects the holes drifting up from the collector.`,
        why: `Unlike in SiC, dopants diffuse readily in silicon, so the p-body is made by implanting boron and diffusing it in at about 1100 °C, using the gate edge as a self-aligned mask.`,
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
          ['Material', 'Silicon, n-type, sometimes enhanced'],
          ['Width', '≈ 5–10 µm'],
        ],
        role: `The neck between the p-body regions that electrons pass through on their way into the drift.`,
        why: `Modern IGBTs mostly use trench gates instead. That removes this neck, packs the cells more densely and builds up a stronger plasma near the top, lowering the on-state voltage.`,
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
          ['What', 'Electrons drawn to the p-body surface'],
          ['Mobility', '≈ 300–500 cm²/V·s'],
        ],
        role: `Forms exactly as in a MOSFET when the gate is positive, and lets electrons from the emitter into the drift.`,
        why: `In an IGBT the channel's electron current is what triggers hole injection from the collector, so the gate still controls the whole device current.`,
      },
    },
    {
      id: 'nemitter',
      label: 'n<sup>+</sup> emitter',
      kind: 'nPlus',
      group: 5,
      shapes: [c.nL, c.nR],
      info: {
        facts: [
          ['Material', 'Silicon, arsenic or phosphorus'],
          ['Depth', '≈ 0.3–0.5 µm'],
          ['Doping', '≈ 10<sup>20</sup> cm<sup>−3</sup>'],
        ],
        role: `Supplies electrons to the channel, like the n<sup>+</sup> source of a MOSFET.`,
        why: `Together with the p-body, drift and collector it forms a four-layer thyristor hidden inside every IGBT. Keeping this region small and the p-body under it well grounded stops that thyristor from latching on.`,
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
          ['Material', 'Silicon, boron'],
          ['Doping', '≈ 10<sup>19</sup> cm<sup>−3</sup>'],
        ],
        role: `Gives the holes arriving from below a low-resistance exit to the emitter metal.`,
        why: `Holes flowing under the n<sup>+</sup> emitter build up a small voltage. If it reaches about 0.7 V, the hidden thyristor latches on, the gate loses control, and the device usually fails. This contact keeps that voltage low.`,
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
          ['Thickness', '≈ 100 nm'],
        ],
        role: `The insulator under the gate, as in a MOSFET.`,
        why: `On silicon, decades of refinement have made the oxide interface nearly perfect, so the channel is fast and the gate very reliable. Compare the SiC MOSFET, where this interface is the weak spot.`,
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
        role: `The gate electrode. Same job as in the MOSFET: a positive voltage creates the channel.`,
        why: `IGBTs have large gate capacitances. Drivers apply +15 V to turn on, and often a negative voltage to keep the gate firmly off while other switches in the converter change state.`,
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
          ['Material', 'Deposited SiO₂ or borophosphosilicate glass'],
          ['Thickness', '≈ 1 µm'],
        ],
        role: `Insulates the gate from the emitter metal above it.`,
        why: `A crack or pinhole here would short gate to emitter, a common failure after severe overstress.`,
      },
    },
    {
      id: 'metal',
      label: 'Emitter metal',
      kind: 'metal',
      group: 9,
      shapes: [c.metal],
      anchor: [4, T + 1.0],
      info: {
        facts: [
          ['Material', 'Aluminum with a little silicon or copper'],
          ['Thickness', '≈ 3–5 µm'],
        ],
        role: `The top contact, called the emitter. Electrons enter the device here, and holes arriving from below leave through it.`,
        why: `Aluminum bond wires are bonded onto it. In power modules, those bonds lifting off after years of heating and cooling are one of the most common end-of-life failures.`,
      },
    },
  ],

  gateOn: {
    title: 'Electrons go down, holes come up',
    steps: [
      `The gate goes to +15 V and forms a channel, exactly as in a MOSFET.`,
      `Electrons flow through the channel and down the drift toward the p<sup>+</sup> collector.`,
      `They forward-bias the collector junction (≈ 0.7 V), which starts injecting holes (orange) up into the drift.`,
      `Electrons and holes fill the drift as a dense plasma (lavender), so its resistance collapses: conductivity modulation.`,
      `The holes reach the p-body and leave through the p<sup>+</sup> contact to the emitter.`,
    ],
    note: `At turn-off the plasma has to recombine or be swept out before the IGBT can block again. That slow decay is the tail current.`,
    paths: [
      { carrier: 'e', pts: electrons },
      { carrier: 'e', pts: mirrorPath(electrons) },
      { carrier: 'h', pts: holes },
      { carrier: 'h', pts: mirrorPath(holes) },
    ],
    electrons: 170,
    holes: 150,
  },

  blocking: {
    kind: 'vertical',
    title: 'Holding off the collector voltage',
    terminal: 'Collector',
    Vrated: 1200,
    Vmax: 2000,
    yJunction: c.yj,
    yDriftBottom: 1.0,
    yStopBottom: 0.4,
    x0: -5,
    x1: 5,
    stopName: 'field stop',
    params: { Nd: 6e13, tDrift: 115, epsR: 11.7, Ec: 2.0e5, Nstop: 1e15, tStop: 8 },
    axis: 'Depth below the p-body junction (µm)',
    caption: `Electric field below the p-body junction. The shaded area equals the voltage being blocked.`,
    text: [
      `The gate is held at 0 V or below, so there is no channel and nothing is injected. The p-body/drift junction is reverse-biased and its depletion region spreads down into the drift.`,
      `Silicon avalanches at a much lower field than SiC (about 0.2 MV/cm at this very light doping), so the same 1200 V needs a drift about ten times thicker: compare the depth axis with the SiC MOSFET. Above about 600 V the depletion reaches the field stop, which ends the field before it can touch the p<sup>+</sup> collector.`,
      `That thick drift is why a silicon MOSFET at 1200 V would be hopelessly resistive, and why the IGBT's plasma trick is needed.`,
    ],
  },
};
