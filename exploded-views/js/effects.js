import * as THREE from 'three';
import { ELECTRON, HOLE, KIND, fieldColorRGB } from './palette.js';
import { DEPTH } from './constants.js';

// Mode overlays drawn in the assembled position: moving carriers for Gate ON,
// and electric-field slices for Blocking. They fade in once the stack has
// collapsed, since the paths only make sense with the layers touching.

const SPEED = 1.5; // model units per second
const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function preparePath(pts) {
  const seg = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    seg.push({ start: total, len });
    total += len;
  }
  return { pts, seg, total };
}

// Interpolate [x, y, spreadX, spreadY] at fraction s of the way along a path.
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

export class Effects {
  constructor(viewer) {
    this.viewer = viewer;
    this.root = new THREE.Group();
    viewer.scene.add(this.root);
    this.mode = 'explore';
    this.time = 0;
    this.flows = [];
    this.slices = [];
    this.remaining2deg = null;
    this.result = null;
    this._dummy = new THREE.Object3D();
    this._p = [0, 0, 0, 0];
    this._white = new THREE.Color('#ffffff');
    viewer.frameHooks.push((dt, e) => this.update(dt, e));
  }

  setDevice(device) {
    this.root.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.root.clear();
    this.flows = [];
    this.slices = [];
    this.remaining2deg = null;
    this.result = null;
    this.device = device;
    this._buildFlows(device.gateOn);
    this._buildSlices(device.blocking);
    this.setMode(this.mode);
  }

  setMode(mode) {
    this.mode = mode;
    const r = this.remaining2deg;
    if (r) {
      // In Blocking, swap the drawn 2DEG for one that shrinks as it depletes.
      const part = this.viewer.parts.get(r.cfg.partId);
      if (part) {
        part.meshes[r.cfg.meshIndex].visible = mode !== 'block';
        part.edges[r.cfg.meshIndex].visible = mode !== 'block';
      }
      r.mesh.visible = mode === 'block';
    }
  }

  // Color the field slices from a physics result (see physics.js).
  setBlocking(result) {
    this.result = result;
    for (const s of this.slices) {
      const E = result.fieldAt(s.pos);
      s.t = E / result.Ec;
      const [r, g, b] = fieldColorRGB(s.t);
      s.base.setRGB(r, g, b, THREE.SRGBColorSpace);
      s.mat.color.copy(s.base);
      s.alpha = s.t > 0.004 ? 0.16 + 0.42 * clamp01(s.t) : 0;
    }
    const r = this.remaining2deg;
    if (r && result.kind === 'lateral') {
      const b = this.device.blocking;
      const xs = b.xGate + (result.Ldep / b.params.Lgd) * (b.xDrain - b.xGate);
      const width = Math.max(0.001, r.cfg.xEnd - xs);
      r.mesh.scale.x = width;
      r.mesh.position.x = xs + width / 2;
    }
  }

  _buildFlows(cfg) {
    for (const carrier of ['e', 'h']) {
      const paths = cfg.paths.filter((p) => p.carrier === carrier).map((p) => preparePath(p.pts));
      const count = carrier === 'e' ? cfg.electrons : cfg.holes;
      if (!paths.length || !count) continue;
      const mat = new THREE.MeshBasicMaterial({
        color: carrier === 'e' ? ELECTRON : HOLE,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.065, 10, 8), mat, count);
      mesh.frustumCulled = false;
      mesh.renderOrder = 20;
      mesh.visible = false;
      const ps = [];
      for (let i = 0; i < count; i++) ps.push(this._spawn(paths[i % paths.length], Math.random()));
      this.root.add(mesh);
      // Holes move more slowly than electrons (lower mobility).
      this.flows.push({ mesh, mat, ps, speed: carrier === 'e' ? 1 : 0.55 });
    }
  }

  _spawn(path, s) {
    return {
      path,
      s,
      u: rand(-1, 1),
      w: rand(-1, 1),
      z: rand(-DEPTH / 2 + 0.3, DEPTH / 2 - 0.3),
      k: rand(0.75, 1.25),
    };
  }

  _buildSlices(b) {
    const add = (x0, x1, y0, y1, pos) => {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, DEPTH + 0.06), mat);
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      mesh.renderOrder = 5;
      mesh.visible = false;
      this.root.add(mesh);
      this.slices.push({ mesh, mat, pos, t: 0, alpha: 0, base: new THREE.Color() });
    };

    if (b.kind === 'vertical') {
      const { yJunction: yj, yDriftBottom: yd, yStopBottom: ys, x0, x1 } = b;
      const { tDrift, tStop } = b.params;
      const nDrift = 30;
      const nStop = 6;
      for (let i = 0; i < nDrift; i++) {
        const top = yj - ((yj - yd) * i) / nDrift;
        const bottom = yj - ((yj - yd) * (i + 1)) / nDrift;
        add(x0 - 0.03, x1 + 0.03, bottom, top, (tDrift * (i + 0.5)) / nDrift);
      }
      for (let i = 0; i < nStop; i++) {
        const top = yd - ((yd - ys) * i) / nStop;
        const bottom = yd - ((yd - ys) * (i + 1)) / nStop;
        add(x0 - 0.03, x1 + 0.03, bottom, top, tDrift + (tStop * (i + 0.5)) / nStop);
      }
    } else {
      const { xGate, xDrain, y0, y1 } = b;
      const n = 36;
      for (let i = 0; i < n; i++) {
        const xa = xGate + ((xDrain - xGate) * i) / n;
        const xb = xGate + ((xDrain - xGate) * (i + 1)) / n;
        add(xa, xb, y0, y1, (b.params.Lgd * (i + 0.5)) / n);
      }
      const t = b.twodeg;
      const kind = KIND.twodeg;
      const mat = new THREE.MeshStandardMaterial({
        color: kind.color,
        emissive: kind.emissive,
        emissiveIntensity: kind.emissiveIntensity,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, t.y1 - t.y0, DEPTH + 0.02), mat);
      mesh.position.y = (t.y0 + t.y1) / 2;
      mesh.visible = false;
      this.root.add(mesh);
      this.remaining2deg = { mesh, cfg: t };
    }
  }

  update(dt, explode) {
    this.time += dt;
    const fade = this.mode === 'explore' ? 0 : clamp01(1 - explode * 6);

    const showOn = this.mode === 'on' && fade > 0;
    for (const f of this.flows) {
      f.mesh.visible = showOn;
      if (!showOn) continue;
      f.mat.opacity = 0.95 * fade;
      for (let i = 0; i < f.ps.length; i++) {
        let q = f.ps[i];
        q.s += (dt * SPEED * f.speed * q.k) / q.path.total;
        if (q.s >= 1) q = f.ps[i] = this._spawn(q.path, q.s % 1);
        const v = samplePath(q.path, q.s, this._p);
        const grow = Math.min(1, q.s / 0.04, (1 - q.s) / 0.04);
        this._dummy.position.set(v[0] + q.u * v[2], v[1] + q.w * v[3], q.z);
        this._dummy.scale.setScalar(Math.max(0.001, grow));
        this._dummy.updateMatrix();
        f.mesh.setMatrixAt(i, this._dummy.matrix);
      }
      f.mesh.instanceMatrix.needsUpdate = true;
    }

    const showBlock = this.mode === 'block' && fade > 0;
    const breakdown = this.result && this.result.Epk >= this.result.Ec;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 9);
    for (const s of this.slices) {
      s.mesh.visible = showBlock && s.alpha > 0;
      if (!s.mesh.visible) continue;
      s.mat.opacity = s.alpha * fade;
      if (breakdown && s.t >= 1) s.mat.color.copy(s.base).lerp(this._white, 0.2 + 0.6 * pulse);
    }
  }
}
