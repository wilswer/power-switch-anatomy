import * as THREE from 'three';
import { CURRENT, GATE_CURRENT, thermalColorRGB } from './palette.js';
import { reducedMotion } from './motion.js';

// Overlays for the package and product models: moving dots for the current
// paths (a package's Current mode, a product's In action mode), temperature
// colors on the layers heat flows through (Heat mode), and in products,
// flashing switches and turning motors and fans. The cell models use
// effects.js instead.

const SPEED = 1.8; // model units per second
const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function preparePath(pts) {
  const seg = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i];
    const [bx, by, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    seg.push({ start: total, len });
    total += len;
  }
  return { pts, seg, total };
}

// [x, y, z, spread] at fraction s of the way along a path.
function samplePath(path, s, out) {
  const d = s * path.total;
  let k = path.seg.length - 1;
  for (let j = 0; j < path.seg.length; j++) {
    if (d < path.seg[j].start + path.seg[j].len) {
      k = j;
      break;
    }
  }
  const sg = path.seg[k];
  const t = sg.len > 0 ? clamp01((d - sg.start) / sg.len) : 0;
  const a = path.pts[k];
  const b = path.pts[k + 1];
  for (let c = 0; c < 4; c++) out[c] = a[c] + (b[c] - a[c]) * t;
  return out;
}

export class PackageEffects {
  constructor(viewer) {
    this.viewer = viewer;
    this.root = new THREE.Group();
    viewer.scene.add(this.root);
    this.model = null;
    this.mode = 'explore';
    this.phase = null;
    this.flows = [];
    this.heat = null; // { result, cfg } while in Heat mode
    this.time = 0;
    this._dummy = new THREE.Object3D();
    this._p = [0, 0, 0, 0];
    this._white = new THREE.Color('#ffffff');
    viewer.frameHooks.push((dt, e) => this.update(dt, e));
  }

  setModel(model) {
    this._aged = null; // the old model's meshes are gone
    this.model = model && model.scale !== 'cell' ? model : null;
    this.flow = this.model ? (this.model.current ?? this.model.action) : null;
    this.flowMode = this.model?.scale === 'app' ? 'action' : 'current';
    this.phase = this.model?.current?.phases?.[0].id ?? null;
    this.heat = null;
    this._buildFlows();
  }

  setMode(mode) {
    this.mode = mode;
    if (mode !== 'heat') {
      this.heat = null;
      this._clearAging(); // wear is shown in Heat mode only
      if (this.model) this.viewer.setTints(null);
    }
  }

  // Show wear in the model (see aging.js): the cracked die attach shrinks to
  // the part still bonded, and lifted wires are gone.
  setAging(cfg, { crack, lifted }) {
    this._clearAging();
    const joint = this.viewer.parts.get(cfg.joint.part);
    const wires = this.viewer.parts.get(cfg.wires.part);
    if (!joint || !wires) return;
    const s = Math.sqrt(1 - crack);
    const center = new THREE.Vector3();
    const shrunk = cfg.joint.meshes.flatMap((i) => [joint.meshes[i], joint.edges[i]]).filter(Boolean);
    for (const o of shrunk) {
      o.geometry.computeBoundingBox();
      o.geometry.boundingBox.getCenter(center);
      o.scale.set(s, 1, s);
      o.position.set(center.x * (1 - s), 0, center.z * (1 - s)); // shrink toward its own center
    }
    const gone = cfg.wires.meshes.slice(0, lifted).map((i) => wires.meshes[i]);
    for (const m of gone) m.visible = false;
    this._aged = { shrunk, gone };
  }

  _clearAging() {
    if (!this._aged) return;
    for (const o of this._aged.shrunk) {
      o.scale.set(1, 1, 1);
      o.position.set(0, 0, 0);
    }
    for (const m of this._aged.gone) m.visible = true;
    this._aged = null;
  }

  // Some packages show more than one switching state (the half-bridge module).
  setPhase(phase) {
    if (phase === this.phase) return;
    this.phase = phase;
    this._buildFlows();
  }

  // Tint every layer of the heat path by its average temperature.
  setHeat(result, cfg) {
    const tints = new Map();
    const color = (T) => {
      const [r, g, b] = thermalColorRGB((T - cfg.Tref) / (cfg.Tmax - cfg.Tref));
      return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
    };
    for (const l of result.layers) {
      for (const id of l.parts) tints.set(id, color((l.Ttop + l.Tbottom) / 2));
    }
    for (const id of cfg.refParts ?? []) tints.set(id, color(cfg.Tref));
    this.heat = { result, cfg, tints, hot: result.Tj >= cfg.Tmax };
    this.viewer.setTints(tints);
  }

  _buildFlows() {
    this.root.traverse((o) => {
      if (o.isInstancedMesh) o.dispose(); // frees its instance buffer
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.root.clear();
    this.flows = [];
    const cfg = this.flow;
    if (!cfg) return;
    for (const kind of ['load', 'gate']) {
      const paths = cfg.paths
        .filter((p) => p.kind === kind && (!p.phase || p.phase === this.phase))
        .map((p) => preparePath(p.pts));
      const count = cfg.counts[kind];
      if (!paths.length || !count) continue;
      const mat = new THREE.MeshBasicMaterial({
        color: kind === 'load' ? CURRENT : GATE_CURRENT,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      });
      const r = cfg.dot * (kind === 'gate' ? 0.8 : 1);
      const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 10, 8), mat, count);
      mesh.frustumCulled = false;
      mesh.renderOrder = 20;
      mesh.visible = false;
      const ps = [];
      for (let i = 0; i < count; i++) ps.push(this._spawn(paths[i % paths.length], Math.random()));
      this.root.add(mesh);
      this.flows.push({ mesh, mat, ps, speed: kind === 'load' ? 1 : 0.7 });
    }
  }

  // Switches flash (on/off, slowed down) and motors and fans turn. With
  // reduced motion the switches glow steadily and nothing turns.
  _animateProduct(dt, still) {
    const on = still || Math.sin(this.time * 2 * Math.PI * 2.5) > 0;
    for (const id of this.flow.pulse ?? []) {
      const m = this.viewer.parts.get(id)?.material;
      if (!m) continue;
      m.emissive.set(on ? CURRENT : '#000000');
      m.emissiveIntensity = on ? (still ? 0.3 : 0.55) : 0;
    }
    for (const [id, rate] of Object.entries(this.flow.spin ?? {})) {
      const part = this.viewer.parts.get(id);
      if (part?.spin) part.spin.angle = (part.spin.angle + dt * 2 * Math.PI * rate) % (2 * Math.PI);
    }
  }

  _spawn(path, s) {
    return { path, s, u: rand(-1, 1), w: rand(-1, 1), k: rand(0.8, 1.2) };
  }

  update(dt, explode) {
    const still = reducedMotion();
    const move = still ? 0 : dt; // with reduced motion the dots stand still
    this.time += move;
    const fade = clamp01(1 - explode * 6);
    const active = Boolean(this.flow) && this.mode === this.flowMode;
    const show = active && fade > 0;
    for (const f of this.flows) {
      f.mesh.visible = show;
      if (!show) continue;
      f.mat.opacity = 0.95 * fade;
      for (let i = 0; i < f.ps.length; i++) {
        let q = f.ps[i];
        q.s += (move * SPEED * f.speed * q.k) / q.path.total;
        if (q.s >= 1) q = f.ps[i] = this._spawn(q.path, q.s % 1);
        const v = samplePath(q.path, q.s, this._p);
        const grow = Math.min(1, q.s / 0.03, (1 - q.s) / 0.03);
        this._dummy.position.set(v[0] + q.u * v[3], v[1], v[2] + q.w * v[3]);
        this._dummy.scale.setScalar(Math.max(0.001, grow));
        this._dummy.updateMatrix();
        f.mesh.setMatrixAt(i, this._dummy.matrix);
      }
      f.mesh.instanceMatrix.needsUpdate = true;
    }

    if (active) this._animateProduct(move, still);

    // Past the temperature limit, the die layers pulse toward white.
    const h = this.heat;
    if (h?.hot && this.mode === 'heat') {
      const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 7);
      for (const id of h.result.layers[0].parts) {
        const part = this.viewer.parts.get(id);
        const base = h.tints.get(id);
        if (part && base) part.material.color.copy(base).lerp(this._white, 0.15 + 0.55 * pulse);
      }
    }
  }
}
