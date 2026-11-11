import { rect } from './shapes.js';

// 650 V lateral e-mode GaN HEMT with a p-GaN gate, on a silicon substrate.
// Source on the left, drain on the right; the gate sits closer to the source.
const Y2DEG = [4.4, 4.46];
const X_GATE_DRAIN_EDGE = -1.0;
const X_DRAIN = 3.6;
const LGD = 15; // µm, gate-to-drain distance this model stands for
const X_FP_UM = 6; // µm, field-plate overhang past the gate edge
const xFieldPlateEdge = X_GATE_DRAIN_EDGE + (X_FP_UM / LGD) * (X_DRAIN - X_GATE_DRAIN_EDGE);

const passivation = [
  [-3.6, 4.7],
  [-2.0, 4.7],
  [-2.0, 5.05],
  [-1.9, 5.05],
  [-1.9, 5.35],
  [-1.1, 5.35],
  [-1.1, 5.05],
  [-1.0, 5.05],
  [-1.0, 4.7],
  [3.6, 4.7],
  [3.6, 5.6],
  [-3.6, 5.6],
];

const electrons = [
  [-4.3, 5.35, 0.4, 0.15], // source contact
  [-3.9, 4.43, 0.15, 0.015], // into the 2DEG
  [3.9, 4.43, 0.15, 0.015], // along the 2DEG
  [4.3, 5.35, 0.4, 0.15], // up into the drain contact
];

export default {
  id: 'gan',
  name: 'GaN HEMT',
  kicker: 'Gallium nitride · lateral · unipolar',
  subtitle: '650 V enhancement-mode HEMT with a p-GaN gate, on silicon',
  summary: [
    `A HEMT (high-electron-mobility transistor) conducts through a sheet of electrons, the <b>2DEG</b>, that forms by itself at the boundary between AlGaN and GaN. No dopants are needed, so the electrons move very freely.`,
    `It is <b>lateral</b>: source, gate and drain all sit on top, and current flows sideways. The voltage rating is set by the gate-to-drain distance, about 15 µm for 650 V.`,
    `Because the 2DEG conducts so well, a GaN transistor is small for a given resistance. Small means low capacitance, and low capacitance means it can switch in nanoseconds, at MHz frequencies. (<a href="#why-no-gan-igbt">Why there is no GaN IGBT</a>)`,
  ],
  stats: [
    ['Voltage classes', '15–650 V (1200 V emerging)'],
    ['On-resistance', '≈ 25–500 mΩ for 650 V discretes'],
    ['Gate drive', '+5 to +6 V on, 0 V or slightly negative off; max ≈ 6–7 V'],
    ['Switching', '≈ 100 kHz to several MHz'],
    ['Used in', 'USB-C chargers, data-center power supplies, LiDAR, solar microinverters'],
  ],
  legend: 'gan',
  drawing: { code: 'GAN-HEMT-650-PGAN', cell: '≈ 25 µm S–D pitch' },

  parts: [
    {
      id: 'sisub',
      label: 'Silicon substrate',
      kind: 'siSub',
      group: 0,
      shapes: [rect(-5, 0, 5, 1.6)],
      info: {
        link: { scale: 'package', part: 'dieSi' },
        facts: [
          ['Material', 'Si(111) wafer, 150–200 mm'],
          ['Thickness', '≈ 1 mm as grown, thinned in packaging'],
          ['Connection', 'Usually tied to the source'],
        ],
        role: `Mechanical support. The GaN layers are grown on top of an ordinary silicon wafer.`,
        why: `Silicon wafers are cheap, large and fit existing chip factories, which keeps GaN affordable. The catch is that GaN's crystal spacing and thermal expansion differ a lot from silicon's (by about 17 % and 54 %), so the layers in between have to absorb the stress.`,
      },
    },
    {
      id: 'transition',
      label: 'Transition layers',
      kind: 'transition',
      group: 1,
      shapes: [rect(-5, 1.6, 5, 2.2)],
      info: {
        facts: [
          ['Material', 'AlN nucleation layer, then graded AlGaN or an AlN/GaN superlattice'],
          ['Thickness', '≈ 1–2 µm'],
        ],
        role: `Bridges the mismatch between silicon and GaN.`,
        why: `Without them the GaN would crack, or bow the wafer, as it cools after growth. Together with the buffer they must also block the full drain voltage vertically, because the substrate below sits at source potential.`,
      },
    },
    {
      id: 'buffer',
      label: 'C-doped GaN buffer',
      kind: 'ganBuffer',
      group: 2,
      shapes: [rect(-5, 2.2, 5, 3.6)],
      info: {
        facts: [
          ['Material', 'GaN with carbon added to make it insulating'],
          ['Thickness', '≈ 2–4 µm'],
          ['Carbon', '≈ 10<sup>18</sup>–10<sup>19</sup> cm<sup>−3</sup>'],
        ],
        role: `Electrically isolates the channel from the substrate and stops leakage current.`,
        why: `The carbon traps electrons. That is good for insulation, but after the device has blocked a high voltage, some electrons stay trapped for a while and temporarily raise the on-resistance. This <em>dynamic on-resistance</em>, or current collapse, is one of GaN's main reliability topics.`,
      },
    },
    {
      id: 'channel',
      label: 'GaN channel layer',
      kind: 'ganChannel',
      group: 3,
      // Under the gate there is no 2DEG at 0 V, just GaN, so the channel layer
      // fills that slot of the electron sheet.
      shapes: [
        [
          [-5, 3.6],
          [5, 3.6],
          [5, Y2DEG[0]],
          [-1.0, Y2DEG[0]],
          [-1.0, Y2DEG[1]],
          [-2.0, Y2DEG[1]],
          [-2.0, Y2DEG[0]],
          [-5, Y2DEG[0]],
        ],
      ],
      anchor: [2.0, 4.0],
      info: {
        facts: [
          ['Material', 'Undoped, high-purity GaN'],
          ['Thickness', '≈ 100–300 nm'],
        ],
        role: `The crystal the 2DEG lives in, just below its top surface.`,
        why: `It has to be very pure: every impurity atom scatters electrons and lowers their mobility.`,
      },
    },
    {
      id: 'twodeg',
      label: '2DEG electron sheet',
      name: '2DEG (two-dimensional electron gas)',
      kind: 'twodeg',
      group: 4,
      shapes: [rect(-5, Y2DEG[0], -2.0, Y2DEG[1]), rect(-1.0, Y2DEG[0], 5, Y2DEG[1])],
      anchor: [2.0, (Y2DEG[0] + Y2DEG[1]) / 2],
      solidInXray: true,
      info: {
        facts: [
          ['What', 'Free electrons at the AlGaN/GaN boundary'],
          ['Thickness', '≈ 2–5 nm'],
          ['Sheet density', '≈ 0.5–1 × 10<sup>13</sup> electrons/cm²'],
          ['Mobility', '≈ 1500–2000 cm²/V·s'],
        ],
        role: `The conducting channel. AlGaN and GaN have different built-in electric polarization, and the difference pulls a dense sheet of electrons to their boundary without any doping.`,
        why: `No dopant atoms means little scattering, so the electrons move more freely than in silicon. Notice the gap under the gate: the p-GaN empties the 2DEG there until the gate is driven positive. That gap is what makes this device normally off.`,
      },
    },
    {
      id: 'twodeg-gate',
      pickAs: 'twodeg',
      kind: 'twodeg',
      group: 4,
      shapes: [rect(-2.0, Y2DEG[0], -1.0, Y2DEG[1])],
      onlyIn: ['on'],
      depthPad: 0.02,
      solidInXray: true,
    },
    {
      id: 'algan',
      label: 'AlGaN barrier',
      kind: 'algan',
      group: 5,
      shapes: [rect(-5, Y2DEG[1], 5, 4.7)],
      info: {
        facts: [
          ['Material', 'Al<sub>x</sub>Ga<sub>1−x</sub>N with about 15–25 % aluminum, at the low end in normally-off parts'],
          ['Thickness', '≈ 15 nm'],
        ],
        role: `Grows on the GaN stretched to match its crystal. The strain adds piezoelectric polarization, and together the two kinds of polarization create the 2DEG below.`,
        why: `More aluminum or a thicker barrier gives more electrons and lower resistance, but makes a normally-off gate harder to achieve.`,
      },
    },
    {
      id: 'pgan',
      label: 'p-GaN gate layer',
      kind: 'pGan',
      group: 6,
      shapes: [rect(-2.0, 4.7, -1.0, 5.05)],
      info: {
        facts: [
          ['Material', 'GaN doped with magnesium'],
          ['Thickness', '≈ 70–100 nm'],
          ['Doping', 'Mg ≈ 10<sup>19</sup> cm<sup>−3</sup>'],
        ],
        role: `Lifts the energy bands under the gate enough to empty the 2DEG there at 0 V, so the transistor stays off without any gate drive.`,
        why: `Normally-off behavior is essential for safety in power converters. The cost is a low threshold (about 1.5 V) and a narrow gate voltage window (about 6–7 V maximum, depending on the maker), so the gate drive must be clean and free of ringing.`,
      },
    },
    {
      id: 'gatemetal',
      label: 'Gate metal',
      kind: 'metal',
      group: 7,
      shapes: [rect(-1.9, 5.05, -1.1, 5.35)],
      info: {
        facts: [
          ['Material', 'Usually a metal such as TiN forming a Schottky contact on the p-GaN; some designs use an ohmic contact instead and draw a small, steady gate current'],
          ['Thickness', '≈ 0.1–0.3 µm'],
        ],
        role: `Applies the gate voltage. Driving it to about +6 V brings the 2DEG back under the gate. It is wired out at the end of the gate finger, out of this cross-section.`,
        why: `The Schottky contact limits gate current to microamps or milliamps. The whole gate needs only a few nC of charge, one reason GaN switches so fast.`,
      },
    },
    {
      id: 'passivation',
      label: 'SiN passivation',
      kind: 'nitride',
      group: 8,
      shapes: [passivation],
      anchor: [2.2, 5.15],
      info: {
        facts: [
          ['Material', 'Silicon nitride (Si₃N₄)'],
          ['Thickness', '≈ 0.1–0.5 µm'],
        ],
        role: `Seals the surface between the contacts, covers the gate and insulates the field plate.`,
        why: `A bare AlGaN surface traps electrons, which empties the 2DEG below it and causes current collapse. Good passivation is a large part of what made GaN power transistors practical.`,
      },
    },
    {
      id: 'source',
      label: 'Source contact',
      kind: 'metal',
      group: 8,
      shapes: [rect(-5, 4.7, -3.6, 5.6)],
      info: {
        link: { scale: 'package', part: 'sourceMetal' },
        facts: [
          ['Material', 'Ti/Al-based ohmic metal, annealed'],
          ['Anneal', '≈ 850 °C'],
        ],
        role: `Feeds electrons into the 2DEG. The anneal makes the metal react through the thin AlGaN to reach the electron sheet.`,
        why: `The 2DEG itself conducts so well that the contact resistance becomes a noticeable part of the total on-resistance.`,
      },
    },
    {
      id: 'drainc',
      label: 'Drain contact',
      kind: 'metal',
      group: 8,
      shapes: [rect(3.6, 4.7, 5, 5.6)],
      info: {
        link: { scale: 'package', part: 'drainMetal' },
        facts: [
          ['Material', 'Same ohmic metal as the source'],
          ['Gate distance', '≈ 15 µm for 650 V'],
        ],
        role: `Collects electrons from the 2DEG. In a lateral device it sits beside the gate, not below it.`,
        why: `The voltage rating scales with the gate-to-drain distance. A 100 V part needs a much shorter gap, which is why low-voltage GaN transistors are so compact.`,
      },
    },
    {
      id: 'fieldplate',
      label: 'Source field plate',
      kind: 'metal',
      group: 9,
      shapes: [rect(-1.5, 5.6, xFieldPlateEdge, 5.8)],
      info: {
        facts: [
          ['Material', 'Metal, connected to the source'],
          ['Overhang', '≈ 6 µm past the gate edge'],
        ],
        role: `A metal shelf on top of the passivation that reaches past the gate toward the drain.`,
        why: `Without it, the electric field piles up into one sharp spike at the drain-side edge of the gate. The plate splits that spike into two smaller ones, raising the breakdown voltage and reducing trapping. It also shields the gate from the drain, which lowers the Miller capacitance. Compare with and without it in Blocking mode.`,
      },
    },
  ],

  gateOn: {
    title: 'Electrons flow sideways through the 2DEG',
    steps: [
      `The gate is driven to about +6 V, which pulls down the energy barrier that the p-GaN created.`,
      `The 2DEG comes back under the gate, so the electron sheet now runs unbroken from source to drain.`,
      `Electrons flow down from the source contact into the 2DEG, sideways to the drain, and up into the drain contact.`,
      `As in the MOSFET, only electrons carry current. With tiny capacitances and no body diode, there is very little charge to move at each switching event.`,
    ],
    note: `In reverse, the same channel conducts like a diode with no reverse-recovery charge, which is why GaN has no separate body diode.`,
    paths: [{ carrier: 'e', pts: electrons }],
    electrons: 170,
    holes: 0,
  },

  blocking: {
    kind: 'lateral',
    avalanche: false, // no avalanche mechanism: past the critical field it fails
    title: 'Holding off the drain voltage, sideways',
    terminal: 'Drain',
    Vrated: 650,
    Vmax: 900,
    xGate: X_GATE_DRAIN_EDGE,
    xDrain: X_DRAIN,
    y0: 3.75,
    y1: 4.7,
    twodeg: { partId: 'twodeg', meshIndex: 1, y0: Y2DEG[0], y1: Y2DEG[1], xEnd: 5 },
    fieldPlatePart: 'fieldplate', // hidden in the model when the field plate is switched off
    params: { Lgd: LGD, xFP: X_FP_UM, Ec: 3.3e6 },
    axis: 'Distance from the gate edge toward the drain (µm)',
    caption: `Field along the 2DEG, from the gate edge to the drain (illustrative shape). The shaded area equals the voltage.`,
    text: [
      `The gate is at 0 V, so the p-GaN keeps the 2DEG empty under the gate. With the drain positive, electrons are swept out of the 2DEG between gate and drain, starting at the gate edge. In this model it is empty all the way to the drain above about 100 V.`,
      `In a lateral device the field runs sideways, and it crowds at sharp metal edges. Turn the field plate off to see the single spike at the gate edge break down before 650 V.`,
      `This shape is illustrative: real lateral fields need a 2D simulation, and real parts are usually limited by leakage through the buffer to the substrate before this point.`,
    ],
  },
};
