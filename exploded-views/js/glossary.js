// The terms the page uses before (or without) explaining them, with short
// definitions. Text on the page is scanned for them (see terms.js), and each
// becomes a dotted-underlined term whose definition shows on hover, focus or
// tap; the Glossary section lists them all. Pure data plus a pure matcher.
//
// `match` lists the spellings to find (whole words, any case). A spelling can
// carry `need`, a pattern the text just before it must match; `skip` is a
// pattern for the text just before a match that means another sense of the
// word ("coolant in a channel" is not a transistor channel).

export const GLOSSARY = [
  {
    id: 'gate',
    term: 'Gate',
    match: ['gate', 'gates'],
    def: 'The control terminal. A voltage between gate and source (or emitter) turns the switch on, and taking it away turns it off. The gate draws current only while it charges or discharges.',
  },
  {
    id: 'source',
    term: 'Source',
    match: ['source'],
    skip: /(heat|light|current|power|voltage)\s+$/i,
    def: 'The terminal where the current leaves an n-channel MOSFET or HEMT when it is on. Gate voltages are measured from it. The IGBT calls it the emitter.',
  },
  {
    id: 'drain',
    term: 'Drain',
    match: ['drain'],
    def: 'The terminal where the current enters a MOSFET or HEMT. When the switch is off, the drain is what holds off the high voltage. The IGBT calls it the collector.',
  },
  {
    id: 'collector',
    term: 'Collector',
    match: ['collector'],
    def: 'The IGBT’s name for the terminal that plays the drain’s part: the current enters here, and it holds off the voltage when the switch is off.',
  },
  {
    id: 'emitter',
    term: 'Emitter',
    match: ['emitter'],
    def: 'The IGBT’s name for the terminal that plays the source’s part: the current leaves here, and the gate voltage is measured from it.',
  },
  {
    id: 'mosfet',
    term: 'MOSFET',
    match: ['MOSFET', 'MOSFETs'],
    def: 'Metal–oxide–semiconductor field-effect transistor. A gate on a thin insulator makes a channel that lets electrons through. It conducts with electrons only, so it switches fast.',
  },
  {
    id: 'igbt',
    term: 'IGBT',
    match: ['IGBT', 'IGBTs'],
    def: 'Insulated-gate bipolar transistor. Driven like a MOSFET, but holes injected from its back make its thick drift layer conduct well: good at high voltage and current, slower to switch.',
  },
  {
    id: 'hemt',
    term: 'HEMT',
    match: ['HEMT', 'HEMTs'],
    def: 'High-electron-mobility transistor: a GaN switch whose current flows sideways along a thin sheet of electrons (the 2DEG) at the boundary between two crystal layers.',
  },
  {
    id: 'doping',
    term: 'Doping',
    match: ['doping', 'doped'],
    def: 'A few impurity atoms that give a semiconductor free electrons (n-type) or holes (p-type). n⁺ and p⁺ mean heavily doped, n⁻ lightly doped.',
  },
  {
    id: 'hole',
    term: 'Hole',
    match: ['hole', 'holes'],
    // Not a screw hole or a via: "mounting holes", "around the hole", "tiny holes".
    skip: /\b(screw|mount\w*|through|bolt|around|plated|tiny|drilled|via)(\s+the)?\s+$/i,
    def: 'A missing electron in the crystal. It moves like a positive charge and carries the current in p-type material.',
  },
  {
    id: 'junction-temperature',
    term: 'Junction temperature',
    match: ['junction temperature'],
    def: 'The temperature at the active top of the die, where the heat is made. Its swings drive most wear-out. It is usually read indirectly, from a temperature-sensitive electrical parameter.',
  },
  {
    id: 'junction',
    term: 'Junction',
    match: ['junction', 'pn junction'],
    def: 'The boundary between p-type and n-type material. Reverse-biased, it holds off voltage across a depletion region; forward-biased, it conducts.',
  },
  {
    id: 'depletion',
    term: 'Depletion region',
    match: ['depletion region', 'depleted region', 'depletion'],
    def: 'A zone emptied of free carriers, which acts as an insulator. It widens as the voltage it holds off rises.',
  },
  {
    id: 'drift',
    term: 'Drift layer',
    // "the drift" is the layer; "threshold drift" or "signals drift" are not.
    match: ['drift layer', 'drift region', { m: 'drift', need: /\b(the|its|this|thick|thin|n[−⁻-]?)\s+$/i }],
    def: 'The thick, lightly doped layer that holds off the voltage when the switch is off and adds resistance when it is on. Its thickness and doping set the voltage rating.',
  },
  {
    id: 'channel',
    term: 'Channel',
    match: ['channel'],
    skip: /(cool\w*|water|coolant|flow|in a|one|each)\s+$/i,
    def: 'A thin conducting layer that the gate creates under itself, connecting source and drain. No gate voltage, no channel.',
  },
  {
    id: 'bandgap',
    term: 'Bandgap',
    match: ['bandgap', 'bandgaps'],
    def: 'The energy it takes to free an electron from its atom: 1.1 eV in silicon, about 3.3 eV in SiC and 3.4 eV in GaN. A wider bandgap allows a stronger field before breakdown.',
  },
  {
    id: 'critical-field',
    term: 'Critical field',
    match: ['critical field'],
    def: 'The electric field at which freed electrons knock others loose and the material breaks down. About ten times higher in SiC and GaN than in silicon.',
  },
  {
    id: 'avalanche',
    term: 'Avalanche',
    match: ['avalanche'],
    def: 'Breakdown in which electrons sped up by a strong field free more electrons, multiplying the current. Silicon and SiC devices survive a limited amount; GaN HEMTs cannot avalanche and fail.',
  },
  {
    id: '2deg',
    term: '2DEG',
    match: ['2DEG'],
    def: 'Two-dimensional electron gas: a sheet of free electrons a few nanometers thick, formed at the AlGaN/GaN boundary by the crystals’ built-in polarization. It is the HEMT’s channel.',
  },
  {
    id: 'conductivity-modulation',
    term: 'Conductivity modulation',
    match: ['conductivity modulation', 'plasma'],
    def: 'In an IGBT, holes from the back and electrons from the channel flood the drift layer, which then conducts far better than its doping allows. The price is stored charge to clear at turn-off.',
  },
  {
    id: 'body-diode',
    term: 'Body diode',
    match: ['body diode'],
    def: 'A diode built into every vertical MOSFET by its own p-well and drift layer. It conducts backward, so a MOSFET needs no separate freewheeling diode. SiC’s has a high drop of about 3 V.',
  },
  {
    id: 'freewheeling',
    term: 'Freewheeling diode',
    match: ['freewheeling diode', 'freewheeling'],
    def: 'The diode that carries an inductive load’s current while the switch next to it is off. IGBTs need a separate one, since they cannot conduct backward.',
  },
  {
    id: 'half-bridge',
    term: 'Half-bridge',
    match: ['half-bridge', 'half-bridges'],
    def: 'Two switches in series between the plus and minus of a DC supply, with the output between them. Turning one or the other on ties the output to plus or minus: the building block of most converters.',
  },
  {
    id: 'gate-driver',
    term: 'Gate driver',
    match: ['gate driver', 'gate drivers', 'gate drive'],
    def: 'The small circuit that charges and discharges the gate to switch the transistor, quickly and at the right voltages. It usually sits right next to the switch.',
  },
  {
    id: 'kelvin',
    term: 'Kelvin source',
    match: ['Kelvin source'],
    def: 'A separate source connection for the gate driver only, so the voltage the load current makes across the source wires does not fight the gate drive.',
  },
  {
    id: 'on-resistance',
    term: 'On-resistance',
    match: ['on-resistance'],
    def: 'The resistance of a switch that is on. It sets the conduction loss (current squared times resistance) and rises with temperature.',
  },
  {
    id: 'thermal-resistance',
    term: 'Thermal resistance',
    match: ['thermal resistance'],
    def: 'How many kelvin hotter the junction runs per watt of heat flowing out: R_th = ΔT / P. Junction-to-case (R_th(j-c)) is the package’s own share, the one datasheets give.',
  },
  {
    id: 'switching-loss',
    term: 'Switching loss',
    match: ['switching losses', 'switching loss'],
    def: 'Energy lost in each transition between on and off, while voltage and current overlap. It grows with the switching frequency.',
  },
  {
    id: 'field-plate',
    term: 'Field plate',
    match: ['field plate', 'field plates'],
    def: 'A metal extension over the surface that spreads the electric field at an edge, so it does not crowd there and break down early.',
  },
  {
    id: 'pfc',
    term: 'PFC',
    match: ['PFC', 'power factor correction'],
    def: 'Power factor correction: a converter stage that draws a sine-wave current in step with the grid voltage, so the device looks to the grid like a resistor.',
  },
  {
    id: 'duty-cycle',
    term: 'Duty cycle',
    match: ['duty cycle', 'duty cycles'],
    def: 'The fraction of each switching period that a switch is on. Filtered, a switch that chops an input at duty cycle D gives an average of D times the input.',
  },
  {
    id: 'pwm',
    term: 'Pulse-width modulation (PWM)',
    match: ['pulse-width modulation', 'PWM'],
    def: 'Switching at a fixed frequency while varying the duty cycle, so the filtered average follows whatever is wanted: a constant voltage, or a sine.',
  },
  {
    id: 'dc-link',
    term: 'DC link',
    match: ['DC link', 'DC-link'],
    def: 'The capacitor bank that holds a steady DC voltage between two converter stages, so each stage can switch independently of the other.',
  },
  {
    id: 'power-cycling',
    term: 'Power cycling',
    match: ['power cycling', 'power-cycling'],
    def: 'A test that heats a device with its own load current and lets it cool, over and over, until it wears out. The swing of junction temperature sets how long that takes.',
  },
];

const BY_ID = new Map(GLOSSARY.map((g) => [g.id, g]));
export const glossaryEntry = (id) => BY_ID.get(id);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Spellings of all terms, longest first, so "gate driver" wins over "gate".
const SPELLINGS = GLOSSARY.flatMap((g) =>
  g.match.map((x) => {
    const { m, need } = typeof x === 'string' ? { m: x } : x;
    return { id: g.id, m, need, re: new RegExp(`(?<![\\w-])${escapeRe(m)}(?![\\w-])`, 'gi') };
  }),
).sort((a, b) => b.m.length - a.m.length);

// The first glossary term in `text` whose id is not in `done`: { index,
// length, id }, or null. Whole words only. `prefix` is the text that comes
// just before `text` on the page, for the `need` and `skip` patterns.
export function findTerm(text, done = new Set(), prefix = '') {
  let best = null;
  for (const { id, m, need, re } of SPELLINGS) {
    if (done.has(id)) continue;
    re.lastIndex = 0;
    for (let hit = re.exec(text); hit; hit = re.exec(text)) {
      if (best && hit.index >= best.index) break;
      const before = (prefix + text.slice(0, hit.index)).slice(-24);
      if (BY_ID.get(id).skip?.test(before) || (need && !need.test(before))) continue;
      best = { index: hit.index, length: m.length, id };
      break;
    }
  }
  return best;
}
