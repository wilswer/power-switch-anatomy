# Power electronics exploration

Interactive learning material for power semiconductor devices.

## Power Switch Anatomy (`exploded-views/`)

Exploded 3D drawings of one transistor cell each of a 1200 V SiC MOSFET, a 650 V GaN HEMT
and a 1200 V silicon IGBT. Rotate and zoom the model, pull the layers apart, and click any
layer to read what it is and why it matters. Three modes:

- **Explore**: the exploded view.
- **Gate ON**: the stack collapses, the channel forms and carriers flow (electrons, plus holes
  and the electron-hole plasma in the IGBT).
- **Blocking**: a voltage slider, the depletion region and the electric-field profile, from a
  1D abrupt-junction model for the vertical devices and an illustrative shape for GaN.

A **guided tour** (masthead button or Tour in the toolbar) walks through all three devices in
18 steps: it sets the device, mode and camera, highlights the part being discussed and sweeps
the blocking voltage. Arrow keys step, Esc exits, and leaving midway lets you resume.

Below the viewer: a short physics primer and Si / SiC / GaN comparison tables.

### Run it

```bash
./serve.sh start      # http://127.0.0.1:8642/, detached; PID and log in .run/
./serve.sh status
./serve.sh stop
```

The server binds to localhost only. To view it from another machine, forward the port:

```bash
ssh -N -L 8642:127.0.0.1:8642 wsoverm@gpuserver   # then open http://localhost:8642/
```

The page loads three.js 0.160.0 and IBM Plex fonts from public CDNs, so the browser needs an
internet connection.

### Layout

| Path | What |
| --- | --- |
| `exploded-views/js/devices/` | Geometry (cross-section polygons), carrier paths and all explanatory text per device |
| `exploded-views/js/physics.js` | Field models for Blocking mode (pure functions) |
| `exploded-views/js/viewer.js` | three.js scene, exploding, picking, callout labels |
| `exploded-views/js/effects.js` | Moving carriers and field slices |
| `exploded-views/js/main.js` | Panel, controls, state |
| `exploded-views/js/tour.js` | The tour's steps (pure data) |
| `exploded-views/js/tour-player.js` | Plays the tour: step card, navigation, voltage sweeps |
| `tests/` | `node --test` suites for the physics, the geometry and the tour data |
| `tests/e2e/` | Browser tests of the tour (Playwright, headless Chromium) |

### Tests

```bash
npm test             # unit tests, a second or two
npm install          # once, for the browser tests
npx playwright install chromium
npm run test:e2e     # browser tests, about a minute (starts its own server)
```

The physics tests check the field models against hand calculations and check that the area
under each field profile equals the applied voltage. The geometry tests check that each
device's layers tile the cell with no overlaps or gaps, and that every part has an
explanation. The tour tests check that every step points at a real device, mode and visible
part, and that the numbers the tour text quotes match the physics model. The browser tests
cover how the tour behaves when the user interrupts it, plus keyboard, focus and reduced
motion.
