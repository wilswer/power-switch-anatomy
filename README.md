# Power electronics exploration

Interactive learning material for power semiconductor devices.

## Power Switch Anatomy (`exploded-views/`)

Exploded 3D drawings of one transistor cell each of a 1200 V SiC MOSFET, a 650 V GaN HEMT
and a 1200 V silicon IGBT, and of the package each one comes in. Rotate and zoom the model,
pull the layers apart, and click any part to read what it is and why it matters. On a phone,
one finger scrolls the page and taps a part, and two fingers turn, tilt and zoom the model.
Cell modes:

- **Explore**: the exploded view.
- **Gate ON**: the stack collapses, the channel forms and carriers flow (electrons, plus holes
  and the electron-hole plasma in the IGBT).
- **Blocking**: a voltage slider, the depletion region and the electric-field profile, from a
  1D abrupt-junction model for the vertical devices and an illustrative shape for GaN.

A **guided tour** (masthead button or Tour in the toolbar) opens with the basics (why power
electronics switches at all, and the three terminals of a power transistor), then walks
through all three devices in 48 steps, with chapters on their packages, on what converters do, on the products they work
in, on how they fail (highlighting the parts that wear out), and an outlook on where power
electronics is heading and its open questions: it sets the
device, scale, mode and camera,
highlights the part being discussed and sweeps the blocking voltage or the power loss. Arrow
keys step, Esc exits, and leaving midway lets you resume.

**Glossary terms** are underlined with dots wherever they appear in the tour, the panels and
the failure cards: hover, tap or focus one to see its definition. The Glossary section lists
them all.

**The package** (the Zoom switch under the device tabs) shows what each cell ends up in, as
an exploded 3D drawing of a real part with click-to-learn parts and a "look for it" note on
what you can see on the real thing:

- **SiC MOSFET → TO-247-4**, the through-hole part with a heatsink tab and a Kelvin source leg.
- **GaN HEMT → PQFN 8 × 8**, a flat surface-mount part, drawn soldered onto a circuit board.
- **Si IGBT → half-bridge module** (62 mm style): baseplate, ceramic substrate, two IGBT and
  two diode dies, terminals, gel and housing.

Package modes:

- **Explore**: the exploded part, including what it is mounted on (heatsink, board, grease).
- **Current**: animated conventional current along the load and gate-drive loops; the
  module switches between "T1 on" and freewheeling through the diode.
- **Heat**: a power-loss slider, each layer colored by temperature, a chart of where the
  temperature drops, and the junction-to-case resistance. It uses a 1D heat-flow model with
  45° spreading (`thermal.js`).
- **Age it** (in Heat): crack the die attach and lift bond wires, and see R<sub>th(j-c)</sub>, the
  on-state voltage, the junction temperature and the losses move against the usual
  end-of-life lines (+20 % and +5 %); the 3D model shows the shrunken joint and the missing
  wires. Below that, a simulated power-cycling test draws both signals cycle by cycle until
  the part wears out, and "Test another device" adds more to show the scatter
  (`aging.js`, with illustrative, not measured, numbers).

**Application** (the third Zoom option) shows each package at work in a product that the
tour's wrap-up names:

- **Si IGBT → 30 kW motor drive**: three half-bridge modules on a finned heatsink with a fan,
  busbar, capacitor bank and gate-driver board, cabled to an induction motor.
- **SiC MOSFET → 11 kW EV on-board charger**: ten TO-247-4s on a liquid-cooled floor, a
  three-phase PFC stage (a half-bridge per phase) and an isolated DC-DC stage.
- **GaN HEMT → 65 W USB-C charger**: the PQFN part on the board next to the transformer.

Each product's panel shows its conversion chain (for the drive: grid AC → rectifier → DC
link → inverter → motor), marking the stages that use the switch from the package view.

Product modes: **Explore** (the product taken apart) and **In action**: power flows through
it as dots, the switches flash, the motor and fan turn, and a chart shows what the switching
does (pulses averaging into a sine wave, the PFC current following the grid voltage, the
flyback's switching cycle).

Part cards link the scales ("See it in the package", "Open the cell view", "See it at work").

Below the viewer: a short physics primer, "Converters in brief" (rectifiers, inverters, DC-DC
and AC-AC converters, and why switching wastes so little), Si / SiC / GaN comparison tables,
a field guide (the scales from cell to product, which products use which switch and
package, how to read a datasheet, and safety notes for opening equipment), and, last,
**Failure modes**: when devices fail (the bathtub curve), how lifetime is estimated from a
mission profile, condition monitoring, qualification standards, and cards for 14 failure
mechanisms. Each card gives what happens, what drives it, what you can measure, how it is
prevented and how it is tested, filters by device, and jumps to the part in 3D; part cards
in the 3D views list the failure modes of that part.

### Run it

Online: **https://wilswer.github.io/power-switch-anatomy/**, published from `main` by GitHub
Actions (`.github/workflows/pages.yml`, which runs the unit tests first).

Locally, it is a static site; any web server works. The included one:

```bash
./serve.sh start      # http://127.0.0.1:8642/, detached; PID and log in .run/
./serve.sh status
./serve.sh stop
```

The server binds to localhost only. To view it from another machine, forward the port over
SSH, for example `ssh -N -L 8642:127.0.0.1:8642 you@your-server`, then open
http://localhost:8642/.

three.js 0.160.0 (MIT license) is included in `exploded-views/vendor/three/`, so the page works
offline. Only the IBM Plex fonts come from Google Fonts; without a connection the browser uses
its own fonts.

### Layout

| Path | What |
| --- | --- |
| `exploded-views/js/devices/` | Geometry (cross-section polygons), carrier paths and all explanatory text per device |
| `exploded-views/js/packages/` | The three packages: 3D solids, current paths, heat stacks and their text |
| `exploded-views/js/apps/` | The three products: 3D solids, power-flow paths, waveforms and their text |
| `exploded-views/js/physics.js` | Field models for Blocking mode (pure functions) |
| `exploded-views/js/thermal.js` | Heat-flow model for the package Heat mode (pure functions) |
| `exploded-views/js/glossary.js` | The glossary terms, their definitions and the matcher that finds them in text (pure) |
| `exploded-views/js/terms.js` | Marks glossary terms in rendered text and shows their definitions |
| `exploded-views/js/aging.js` | Wear (cracked die attach, lifted wires) and the simulated power-cycling test (pure functions) |
| `exploded-views/js/cycleplot.js` | The power-cycling chart in Age it |
| `exploded-views/js/viewer.js` | three.js scene, exploding, picking, callout labels |
| `exploded-views/js/effects.js` | Moving carriers and field slices (cells) |
| `exploded-views/js/package-effects.js` | Current dots and temperature colors (packages) |
| `exploded-views/js/heatplot.js` | The temperature chart in the Heat panel |
| `exploded-views/js/wavesplot.js` | The waveform chart in the In action panel |
| `exploded-views/js/failures.js` | The failure modes (pure data), with the 3D parts each concerns |
| `exploded-views/js/main.js` | Panel, controls, state |
| `exploded-views/js/tour.js` | The tour's steps (pure data) |
| `exploded-views/js/tour-player.js` | Plays the tour: step card, navigation, voltage sweeps |
| `exploded-views/js/motion.js` | The live reduced-motion setting every animation follows |
| `exploded-views/vendor/three/` | three.js 0.160.0 and its OrbitControls, unchanged, with their license |
| `tests/` | `node --test` suites for the physics, heat model, geometry, packages, products and tour data |
| `tests/e2e/` | Browser tests of the cell, package and product views, the viewer and the tour (Playwright, headless Chromium) |

### Tests

```bash
npm test             # unit tests, a second or two
npm install          # once, for the browser tests
npx playwright install chromium
npm run test:e2e     # browser tests, a few minutes (starts its own server)
```

The physics tests check the field models against hand calculations and check that the area
under each field profile equals the applied voltage. The heat-model tests check it against
closed-form slab and frustum resistances. The geometry tests check that each device's layers
tile the cell with no overlaps or gaps, and that every part has an explanation. The package
tests check that no two solid parts overlap, that every bond wire lands on metal, that the
heat, current and cross-scale links point at real parts, and that each package's
junction-to-case resistance lands in the range datasheets quote. The product tests check
the same geometry rules, and that the numbers their texts quote (power, voltages, the PWM
averaging to a sine wave) match their waveforms. The aging tests check that wear raises the
right signal, that the end-of-life lines fall at plausible crack areas and wire counts, and
that a simulated test replays from its seed, scatters between devices and follows the
fifth-power law of the swing. The glossary tests check that every term is used on the page, that terms match whole words,
longest first, and that other senses of a word (a screw hole, threshold drift, a coolant
channel) are left alone. The failure-mode tests check that every
card is complete and that every part it points at exists. The tour tests check that
every step points at a real device, scale, mode and visible part, and that the numbers the
tour and package texts quote match the models. The browser tests cover how the tour behaves
when the user interrupts it, keyboard, focus and reduced motion, and the package views:
scale switching, links, the heat slider and chart, the module's switching states, and
layouts with no sideways scrolling, and the products: power flow, flashing switches, the
turning motor, the waveform chart, and a tour card that keeps its size on every step. They
also check that labels stay inside the 3D view, that a phone names the tapped part and
scrolls with one finger but turns the model with two, that the page works offline, that
links restore the mode, and that animations stop with reduced motion and drawing stops off
screen. CI runs both suites before every deploy.

## License

MIT, see [LICENSE](LICENSE).
