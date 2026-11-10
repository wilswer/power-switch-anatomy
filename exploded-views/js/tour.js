// The guided tour: one story through all three devices. Each step describes
// the whole scene (device, mode, explode, focused part, camera, Blocking
// settings) so any step can be jumped to directly. Pure data, no DOM; it is
// played by tour-player.js.
//
// `view` is the camera direction from the model's center, `zoom` the distance
// relative to the default framing (smaller is closer). `sweep` animates the
// blocking voltage. device, mode and explode carry over from the previous step
// when left out; nothing else does.

const VIEW = {
  standard: [0.95, 0.62, 1.45],
  low: [0.85, 0.28, 1.45],
  high: [0.6, 1.05, 1.2],
  front: [0.22, 0.3, 1.5],
  side: [0.75, 0.42, 1.5],
};

export const CHAPTERS = {
  sic: 'SiC MOSFET',
  igbt: 'Si IGBT',
  gan: 'GaN HEMT',
  end: 'Wrap-up',
};

const STEPS = [
  {
    chapter: 'sic',
    device: 'sic',
    mode: 'explore',
    explode: 1,
    view: VIEW.standard,
    zoom: 1,
    title: 'One cell of a power switch',
    body: `This is one cell of a 1200 V silicon carbide MOSFET, pulled apart layer by layer. A real chip repeats it thousands of times side by side. We will build it up from the bottom, then switch it on and off.`,
  },
  {
    focus: 'substrate',
    view: VIEW.low,
    zoom: 0.95,
    title: 'The foundation',
    body: `At the bottom are the drain metal and the heavily doped SiC wafer. In a real chip the wafer is 100–350 µm thick, many times the drift layer above it; the drawing is not to scale. It holds up the active layers and carries the current down, but blocks no voltage, so it is ground as thin as handling allows.`,
  },
  {
    focus: 'drift',
    view: VIEW.standard,
    zoom: 0.95,
    title: 'The drift layer holds the voltage',
    body: `This lightly doped layer is what blocks 1200 V when the switch is off. Its thickness and doping set the central trade-off of every power device: more blocking voltage means more resistance. In SiC it needs to be only about 11 µm thick.`,
  },
  {
    focus: 'pwell',
    view: VIEW.high,
    zoom: 0.8,
    title: 'Wells, sources and a narrow neck',
    body: `Implanted into the top of the drift are two p-wells (red), each holding an n<sup>+</sup> source (deep blue). Between the wells is a narrow n-type neck, the JFET region. The current will have to squeeze through it.`,
  },
  {
    focus: 'oxide',
    view: VIEW.high,
    zoom: 0.75,
    title: 'The gate stack',
    body: `The highlighted gate oxide is only about 50 nm thick. On it sits the polysilicon gate (orange), reaching from one source to the other. The gate and the p-well surface below form a capacitor across this oxide, which is the most delicate part of a SiC MOSFET.`,
  },
  {
    explode: 0,
    view: VIEW.standard,
    zoom: 0.95,
    title: 'Assembled',
    body: `Pushed together, the layers make the finished cell. The source metal on top connects every source and p<sup>+</sup> contact at once, and the interlayer dielectric keeps it insulated from the gate. Now let's turn it on.`,
  },
  {
    mode: 'on',
    focus: 'channel',
    view: VIEW.side,
    zoom: 0.9,
    title: 'Gate ON: a channel appears',
    body: `With +18 V on the gate, electrons gather at the surface of the p-wells and form a thin n-type channel (cyan). Electrons now flow from the source, through the channel and the neck, straight down to the drain.`,
  },
  {
    mode: 'block',
    block: { V: 0 },
    sweep: { from: 0, to: 1200, seconds: 6 },
    view: VIEW.front,
    zoom: 0.95,
    title: 'Gate off: blocking 1200 V',
    body: `Now the gate is off and the drain voltage rises to 1200 V. Watch the depleted region (colored) grow down into the drift. The field is strongest at the junction, and the area under the curve in the panel equals the voltage.`,
  },

  {
    chapter: 'igbt',
    device: 'igbt',
    mode: 'explore',
    explode: 1,
    focus: 'pcollector',
    view: VIEW.standard,
    zoom: 1,
    title: 'Same top, different bottom',
    body: `The silicon IGBT has the same MOS cell on top. The difference is underneath: no thick substrate, and a thin p<sup>+</sup> collector on the back. That one extra layer turns a MOSFET into a bipolar device.`,
  },
  {
    mode: 'block',
    block: { V: 0 },
    sweep: { from: 0, to: 1200, seconds: 6 },
    view: VIEW.front,
    zoom: 0.95,
    title: 'Silicon needs a much thicker drift',
    body: `Silicon breaks down at a field about ten times lower than SiC, so blocking the same 1200 V takes a drift about 115 µm thick instead of 11 µm. Compare the depth axis of the plot with the SiC one.`,
  },
  {
    mode: 'on',
    view: VIEW.low,
    zoom: 0.95,
    title: 'Holes join the electrons',
    body: `Electrons flow down as in the MOSFET. When they reach the p<sup>+</sup> collector, it starts injecting holes (orange) up into the drift. Now both kinds of carrier carry the current.`,
  },
  {
    focus: 'plasma',
    view: VIEW.standard,
    zoom: 0.95,
    title: 'Conductivity modulation',
    body: `Electrons and holes fill the drift about a thousand times more densely than its doping, so even this thick silicon layer conducts well. The catch: at turn-off the plasma takes microseconds to clear, which keeps IGBTs below about 20 kHz.`,
  },

  {
    chapter: 'gan',
    device: 'gan',
    mode: 'explore',
    explode: 1,
    view: VIEW.standard,
    zoom: 1,
    title: 'GaN goes sideways',
    body: `The GaN HEMT is built differently. Source, gate and drain all sit on top, and the current flows sideways between them. Underneath are layers grown on an ordinary silicon wafer.`,
  },
  {
    focus: 'twodeg',
    view: VIEW.high,
    zoom: 0.85,
    title: 'Electrons without doping',
    body: `Where AlGaN meets GaN, built-in polarization pulls a dense sheet of electrons to the boundary: the 2DEG (cyan). It needs no dopants, so the electrons move very freely. The gap under the p-GaN gate is why the transistor is off at 0 V.`,
  },
  {
    mode: 'on',
    view: [0.35, 0.5, 1.5],
    zoom: 0.8,
    title: 'Gate ON closes the gap',
    body: `At +6 V on the gate, the 2DEG comes back under it and electrons stream sideways from source to drain. The channel conducts so well that the transistor can be tiny, and a tiny transistor switches fast: GaN can switch at MHz frequencies.`,
  },
  {
    mode: 'block',
    block: { V: 0, fieldPlate: false },
    sweep: { from: 0, to: 650, seconds: 5 },
    view: VIEW.front,
    zoom: 0.85,
    title: 'Blocking without a field plate',
    body: `Here the field plate has been taken away. In a lateral device the field runs sideways and crowds at the drain-side edge of the gate. Without help, that single spike reaches the critical field just below the 650 V rating.`,
  },
  {
    block: { V: 650, fieldPlate: true },
    focus: 'fieldplate',
    view: VIEW.front,
    zoom: 0.85,
    title: 'The field plate spreads the load',
    body: `A metal plate reaching past the gate toward the drain splits the spike into two smaller peaks. At 650 V the peak field drops by more than half, and the device blocks with room to spare.`,
  },

  {
    chapter: 'end',
    device: 'sic',
    mode: 'explore',
    explode: 0.5,
    view: VIEW.standard,
    zoom: 1,
    title: 'Which switch where',
    body: `IGBTs are rugged and cheap at high voltage but slow: motor drives, trains, wind turbines. SiC MOSFETs are fast and efficient from 650 V to 3.3 kV: EV inverters and chargers. GaN HEMTs are the fastest, up to 650 V: phone chargers and server power. <a href="#compare">The tables below</a> compare them side by side.`,
  },
];

// Fill in the carried-over fields so every step is complete on its own.
export const TOUR = STEPS.reduce((out, step) => {
  const prev = out.at(-1) ?? {};
  out.push({
    chapter: step.chapter ?? prev.chapter,
    device: step.device ?? prev.device,
    mode: step.mode ?? prev.mode,
    explode: step.explode ?? prev.explode ?? 1,
    focus: step.focus ?? null,
    view: step.view ?? VIEW.standard,
    zoom: step.zoom ?? 1,
    block: step.block ?? null,
    sweep: step.sweep ?? null,
    title: step.title,
    body: step.body,
  });
  return out;
}, []);
