import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { KIND } from './palette.js';
import { DEPTH, GAP } from './constants.js';
import { reducedMotion, onMotionChange } from './motion.js';

// The 3D view of one model: a device cell or a package. Builds the parts,
// explodes their groups apart, handles hover/click picking, and draws callout
// labels with leader lines like an exploded assembly drawing.
//
// A part is drawn from `shapes` (cell cross-sections: [x, y] polygons extruded
// DEPTH into the screen) or from `solids` (packages: boxes, slabs and bond
// wires in full 3D, see packages/solids.js).

// On a phone, a vertical swipe over the model scrolls the page instead of
// turning the model (OrbitControls would otherwise claim every touch).
const narrowScreen = window.matchMedia('(max-width: 720px)');
const VIEW_DIR = new THREE.Vector3(0.95, 0.62, 1.45).normalize();
const SVG_NS = 'http://www.w3.org/2000/svg';
const lerp = (a, b, t) => a + (b - a) * t;

// How each mode shows the model: `explode` is 'user' (follow the slider) or a
// fixed value; `xray` makes parts see-through; `tintOnly` fades every part the
// mode has not tinted (the Heat view colors only the layers heat flows through).
const LOOKS = {
  explore: { explode: 'user', xray: false },
  default: { explode: 0, xray: true },
};

// Three.js geometries for one entry of a part's `solids`.
function solidGeometry(s) {
  if (s.type === 'box') {
    const [x0, y0, z0] = s.min;
    const [x1, y1, z1] = s.max;
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return g;
  }
  if (s.type === 'slab') {
    // Outline in the x–z plane (top view), extruded up from y0 to y1. The shape
    // is drawn as (x, −z) and turned so its extrusion axis points up.
    const toShape = (pts, S) => new S(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const shape = toShape(s.outline, THREE.Shape);
    for (const h of s.holes ?? []) shape.holes.push(toShape(h, THREE.Path));
    const g = new THREE.ExtrudeGeometry(shape, { depth: s.y1 - s.y0, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, s.y0, 0);
    return g;
  }
  if (s.type === 'cyl') {
    // A cylinder of radius r and length len centered on c, along the x, y or z axis.
    const g = new THREE.CylinderGeometry(s.r, s.r, s.len, 28);
    if (s.axis === 'x') g.rotateZ(Math.PI / 2);
    if (s.axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(...s.c);
    return g;
  }
  if (s.type === 'tube') {
    const curve = new THREE.CatmullRomCurve3(s.pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    return new THREE.TubeGeometry(curve, 36, s.r, 8, false);
  }
  throw new Error(`unknown solid type ${s.type}`);
}

function cssColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export class Viewer {
  constructor({ viewport, canvas, labelsEl, leadersEl, onSelect, reservedTop, reservedBottom }) {
    this.viewport = viewport;
    this.reservedTop = reservedTop ?? (() => 0);
    this.reservedBottom = reservedBottom ?? (() => 0);
    this.canvas = canvas;
    this.labelsEl = labelsEl;
    this.onSelect = onSelect;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = !reducedMotion();
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.8;
    // A user drag or zoom always wins over a scripted camera move.
    this.controls.addEventListener('start', () => {
      this._fly = null;
      this._dragging = true;
    });
    this.controls.addEventListener('end', () => {
      this._dragging = false;
    });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7785, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(6, 14, 9);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(-9, 5, -7);
    this.scene.add(key, rim);

    this.model = new THREE.Group();
    this.scene.add(this.model);
    this._buildGuides();

    // Leader lines: one path for normal leaders, one for the highlighted one, one for dots.
    this.leaderPath = document.createElementNS(SVG_NS, 'path');
    this.leaderPath.setAttribute('class', 'leader');
    this.leaderHi = document.createElementNS(SVG_NS, 'path');
    this.leaderHi.setAttribute('class', 'leader-hi');
    this.leaderDots = document.createElementNS(SVG_NS, 'path');
    this.leaderDots.setAttribute('class', 'leader-dot');
    leadersEl.append(this.leaderPath, this.leaderHi, this.leaderDots);

    this.parts = new Map();
    this.mode = 'explore';
    this.userExplode = 1;
    this.explode = 1;
    this.explodeTarget = 1;
    this.selected = null;
    this.hovered = null;
    this.showLabels = true;
    this.hiddenParts = new Set();
    this.frameHooks = [];

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clock = new THREE.Clock();
    this._v = new THREE.Vector3();

    this._readTheme();
    this._bindPointer();
    new ResizeObserver(() => this._resize()).observe(viewport);
    this._resize();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      this._readTheme();
      this.applyLook();
    });
    document.fonts?.ready.then(() => {
      for (const p of this.parts.values()) p.lw = 0; // re-measure labels once fonts load
    });
    onMotionChange(() => {
      this.controls.enableDamping = !reducedMotion();
      if (reducedMotion()) this.explode = this.explodeTarget;
    });
    const setTouch = () => (canvas.style.touchAction = narrowScreen.matches ? 'pan-y' : 'none');
    setTouch();
    narrowScreen.addEventListener('change', setTouch);

    // Draw only while the view is on screen; scrolled away, the page idles.
    this._running = false;
    this._run(true);
    // Several changes can arrive in one batch; the last entry is the current one.
    new IntersectionObserver((entries) => this._run(entries.at(-1).isIntersecting)).observe(viewport);
  }

  _run(on) {
    if (on === this._running) return;
    this._running = on;
    if (on) this.clock.getDelta(); // don't count the time spent off screen
    this.renderer.setAnimationLoop(on ? () => this._frame() : null);
  }

  // ---------- device ----------

  setDevice(device) {
    for (const p of this.parts.values()) {
      p.group.traverse((o) => o.geometry?.dispose());
      p.material.dispose();
      p.edgeMat.dispose();
      p.labelEl?.remove();
    }
    this.model.clear();
    this.parts.clear();
    this.selected = null;
    this.hovered = null;
    this.hiddenParts = new Set();
    this.tints = new Map();
    this.device = device;
    this.gap = device.gap ?? GAP;

    for (const def of device.parts) {
      const kind = KIND[def.kind];
      const baseOpacity = kind.opacity ?? 1;
      const material = new THREE.MeshStandardMaterial({
        color: kind.color,
        roughness: kind.roughness ?? 0.62,
        metalness: kind.metalness ?? 0.04,
        emissive: kind.emissive ?? '#000000',
        emissiveIntensity: kind.emissiveIntensity ?? 0,
        transparent: baseOpacity < 1,
        opacity: baseOpacity,
        depthWrite: baseOpacity >= 1,
        side: THREE.DoubleSide,
        polygonOffset: true, // keep the edge lines crisp on top of the faces
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      const edgeMat = new THREE.LineBasicMaterial({ color: this.edgeColor, transparent: true, opacity: 0.55 });

      const group = new THREE.Group();
      const depth = DEPTH + (def.depthPad ?? 0);
      const meshes = [];
      const edges = [];
      const geoms = (def.shapes ?? []).map((poly) => {
        const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
        const geom = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
        geom.translate(0, 0, -depth / 2);
        return { geom, edges: true };
      });
      for (const s of def.solids ?? []) geoms.push({ geom: solidGeometry(s), edges: s.type !== 'tube' });
      const bounds = new THREE.Box3();
      for (const { geom, edges: withEdges } of geoms) {
        geom.computeBoundingBox();
        bounds.union(geom.boundingBox);
        const mesh = new THREE.Mesh(geom, material);
        mesh.userData.partId = def.pickAs ?? def.id;
        group.add(mesh);
        meshes.push(mesh);
        // Bond wires get no outline: a tube's facets would draw as stripes.
        const line = withEdges ? new THREE.LineSegments(new THREE.EdgesGeometry(geom, 30), edgeMat) : null;
        if (line) group.add(line);
        edges.push(line);
      }

      // Leaders point at `anchor`: [x, y] on the cross-section face for cells,
      // [x, y, z] for packages. By default, the center of the part.
      let anchor;
      if (def.anchor?.length === 3) anchor = new THREE.Vector3(...def.anchor);
      else if (def.solids) anchor = bounds.getCenter(new THREE.Vector3());
      else {
        const last = meshes.at(-1).geometry.boundingBox;
        const [ax, ay] = def.anchor ?? [(last.min.x + last.max.x) / 2, (last.min.y + last.max.y) / 2];
        anchor = new THREE.Vector2(ax, ay);
      }

      let labelEl = null;
      if (def.label && !def.pickAs) {
        labelEl = document.createElement('button');
        labelEl.type = 'button';
        labelEl.className = 'callout';
        labelEl.innerHTML = def.label;
        labelEl.addEventListener('click', () => {
          this.select(def.id);
          this.onSelect?.(def.id);
        });
        labelEl.addEventListener('pointerenter', () => this.setHover(def.id));
        labelEl.addEventListener('pointerleave', () => this.setHover(null));
        this.labelsEl.prepend(labelEl); // parts run bottom to top: tab order follows the drawing
      }

      this.model.add(group);
      this.parts.set(def.id, {
        def,
        kind,
        group,
        meshes,
        edges,
        material,
        edgeMat,
        baseOpacity,
        anchor,
        labelEl,
        lw: 0,
        lh: 0,
        // Parts that turn (a motor shaft, a fan) rotate about def.spin.pivot.
        spin: def.spin
          ? { pivot: new THREE.Vector3(...def.spin.pivot), axis: new THREE.Vector3(...def.spin.axis).normalize(), angle: 0 }
          : null,
      });
    }

    this._computeFit();
    this.resetView();
    this.applyLook();
    this._frame(); // draw right away rather than on the next animation frame
  }

  // ---------- public controls ----------

  // The look of the current mode (see LOOKS); a model can override it per mode.
  look(mode = this.mode) {
    return this.device?.modeLook?.[mode] ?? LOOKS[mode] ?? LOOKS.default;
  }

  setMode(mode) {
    this.mode = mode;
    const { explode } = this.look();
    this.explodeTarget = explode === 'user' ? this.userExplode : explode;
    if (reducedMotion()) this.explode = this.explodeTarget;
    this._updateGuides();
    this.applyLook();
  }

  setExplode(value) {
    this.userExplode = value;
    if (this.look().explode === 'user') this.explodeTarget = value;
    if (reducedMotion()) this.explode = this.explodeTarget;
  }

  // Override part colors, e.g. by temperature: a Map of part id → THREE.Color.
  setTints(tints) {
    this.tints = tints ?? new Map();
    this.applyLook();
  }

  select(id) {
    this.selected = id;
    this.applyLook();
  }

  setHover(id) {
    if (this.hovered === id) return;
    this.hovered = id;
    this.canvas.style.cursor = id ? 'pointer' : '';
    this.applyLook();
  }

  // Parts to leave out of the model regardless of mode (e.g. a field plate switched off).
  setHiddenParts(ids) {
    this.hiddenParts = new Set(ids);
    this.applyLook();
  }

  setLabels(on) {
    this.showLabels = on;
    this._applyViewOffset();
    this.applyLook();
  }

  resetView() {
    if (!this.fit) return;
    this._fly = null;
    const c = this._center(this.explode);
    this.controls.target.copy(c);
    this.camera.position.copy(c).addScaledVector(VIEW_DIR, this._fitDistance(this.explode));
    this.controls.minDistance = this._fitDistance(0) * 0.35;
    this.controls.maxDistance = this._fitDistance(1) * 2.5;
    this.controls.update();
  }

  // Glide the camera to look from direction `dir` (from the model's center) at
  // `zoom` times the default framing distance.
  flyTo(dir, zoom = 1, seconds = 1.3) {
    if (!this.fit || this._dragging) return;
    const from = new THREE.Spherical().setFromVector3(this._v.copy(this.camera.position).sub(this.controls.target));
    const to = new THREE.Spherical().setFromVector3(this._v.set(...dir));
    if (to.theta - from.theta > Math.PI) to.theta -= 2 * Math.PI;
    if (from.theta - to.theta > Math.PI) to.theta += 2 * Math.PI;
    this._fly = {
      from,
      to,
      zoomFrom: from.radius / this._fitDistance(this.explode),
      zoomTo: zoom,
      t: 0,
      seconds: reducedMotion() ? 0 : seconds,
    };
  }

  // Opacity, highlight and visibility for every part, from the current state.
  applyLook() {
    const { xray, tintOnly } = this.look();
    for (const p of this.parts.values()) {
      const { def } = p;
      const visible = (!def.onlyIn || def.onlyIn.includes(this.mode)) && !this.hiddenParts.has(def.id);
      p.group.visible = visible;
      if (p.labelEl) p.labelEl.hidden = !visible || !this.showLabels;

      const id = def.pickAs ?? def.id;
      const isSel = this.selected === id;
      const isHov = this.hovered === id;

      const tint = this.tints.get(def.id);
      let op = p.baseOpacity;
      if (xray && !def.solidInXray) op = Math.min(op, (p.kind.metalness ?? 0) > 0.3 ? 0.14 : 0.26);
      if (tintOnly && !tint) op = Math.min(op, 0.12);
      if (this.selected && !isSel) op = Math.min(op, xray || tintOnly ? 0.1 : 0.16);

      const m = p.material;
      m.color.set(tint ?? p.kind.color);
      const transparent = op < 0.999;
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = op;
      m.depthWrite = !transparent;
      if (isSel || isHov) {
        m.emissive.copy(this.highlight);
        m.emissiveIntensity = isSel ? 0.32 : 0.18;
      } else {
        m.emissive.set(p.kind.emissive ?? '#000000');
        m.emissiveIntensity = p.kind.emissiveIntensity ?? 0;
      }
      p.edgeMat.color.copy(isSel || isHov ? this.edgeStrong : this.edgeColor);
      p.edgeMat.opacity = isSel || isHov ? 0.95 : transparent ? (op < 0.13 ? 0.14 : 0.28) : 0.55;

      p.labelEl?.classList.toggle('is-selected', isSel);
      p.labelEl?.classList.toggle('is-hover', isHov && !isSel);
    }
  }

  // ---------- internals ----------

  _readTheme() {
    this.edgeColor = new THREE.Color(cssColor('--edge', '#1a2027'));
    this.edgeStrong = new THREE.Color(cssColor('--edge-strong', '#000000'));
    this.highlight = new THREE.Color('#ffffff');
    this.guideMat?.color.set(cssColor('--ink-3', '#7a8590'));
  }

  _computeFit() {
    const b0 = new THREE.Box3(); // assembled
    const b1 = new THREE.Box3(); // fully exploded
    for (const p of this.parts.values()) {
      if (p.def.onlyIn) continue;
      for (const m of p.meshes) {
        const bb = m.geometry.boundingBox;
        b0.union(bb);
        const lifted = bb.clone();
        lifted.min.y += p.def.group * this.gap;
        lifted.max.y += p.def.group * this.gap;
        b1.union(lifted);
      }
    }
    const s = new THREE.Sphere();
    this.fit = {
      b0,
      b1,
      c0: b0.getCenter(new THREE.Vector3()),
      c1: b1.getCenter(new THREE.Vector3()),
      r0: b0.getBoundingSphere(s).radius,
      r1: b1.getBoundingSphere(s).radius,
    };
    this._updateGuides();
  }

  _center(e) {
    return this.fit.c0.clone().lerp(this.fit.c1, e);
  }

  _fitDistance(e) {
    const r = lerp(this.fit.r0, this.fit.r1, e);
    const vf = THREE.MathUtils.degToRad(this.camera.fov);
    const room = this._offsetActive ? 0.8 : 1; // leave space for the label column
    const hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect * room);
    return (r / Math.sin(Math.min(vf, hf) / 2)) * 1.02;
  }

  _resize() {
    const w = this.viewport.clientWidth;
    const h = this.viewport.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this._applyViewOffset();
  }

  // Shift the model left of center when the label column is shown.
  _applyViewOffset() {
    const w = this.viewport.clientWidth;
    const h = this.viewport.clientHeight;
    this._offsetActive = this.showLabels && w > 720;
    if (this._offsetActive) this.camera.setViewOffset(w, h, w * 0.1, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  _bindPointer() {
    const el = this.canvas;
    el.addEventListener('pointermove', (e) => {
      if (e.buttons) return; // dragging the view
      this.setHover(this._pick(e));
    });
    el.addEventListener('pointerleave', () => this.setHover(null));
    el.addEventListener('pointerdown', (e) => {
      this._down = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', (e) => {
      const d = this._down;
      this._down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return; // it was a drag
      const id = this._pick(e);
      this.select(id);
      this.onSelect?.(id);
    });
  }

  _pick(e) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = [];
    for (const p of this.parts.values()) {
      if (!p.group.visible) continue;
      for (const m of p.meshes) if (m.visible) targets.push(m);
    }
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    return hit ? hit.object.userData.partId : null;
  }

  // Dashed "explosion lines" at the four vertical corners of the stack.
  _buildGuides() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(8 * 3), 3));
    this.guideMat = new THREE.LineDashedMaterial({
      color: 0x7a8590,
      dashSize: 0.16,
      gapSize: 0.14,
      transparent: true,
      opacity: 0,
    });
    this.guides = new THREE.LineSegments(geo, this.guideMat);
    this.guides.frustumCulled = false;
    this.scene.add(this.guides);
  }

  _updateGuides() {
    if (!this.fit) return;
    const { b0, b1 } = this.fit;
    const y0 = b0.min.y - 0.4;
    const y1 = lerp(b0.max.y, b1.max.y, this.explode) + 0.4;
    const pos = this.guides.geometry.attributes.position;
    let i = 0;
    for (const x of [b0.min.x - 0.18, b0.max.x + 0.18]) {
      for (const z of [b0.min.z - 0.18, b0.max.z + 0.18]) {
        pos.setXYZ(i++, x, y0, z);
        pos.setXYZ(i++, x, y1, z);
      }
    }
    pos.needsUpdate = true;
    this.guides.computeLineDistances();
    this.guideMat.opacity = 0.5 * this.explode;
    this.guides.visible = this.look().explode === 'user' && this.explode > 0.02;
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const prevE = this.explode;
    if (this.explode !== this.explodeTarget) {
      const k = reducedMotion() ? 1 : 1 - Math.exp(-dt * 6);
      this.explode += (this.explodeTarget - this.explode) * k;
      if (Math.abs(this.explodeTarget - this.explode) < 5e-4) this.explode = this.explodeTarget;
    }
    if (this.fit && this.explode !== prevE) {
      // Keep the stack centered and keep the user's zoom level as it grows or shrinks.
      const delta = this._center(this.explode).sub(this._center(prevE));
      this.controls.target.add(delta);
      this.camera.position.add(delta);
      const ratio = this._fitDistance(this.explode) / this._fitDistance(prevE);
      const off = this._v.copy(this.camera.position).sub(this.controls.target).multiplyScalar(ratio);
      this.camera.position.copy(this.controls.target).add(off);
      this._updateGuides();
    }
    for (const p of this.parts.values()) {
      p.group.position.set(0, p.def.group * this.gap * this.explode, 0);
      if (p.spin) {
        // Rotate about the pivot: position = pivot − R·pivot, plus the explode lift.
        p.group.quaternion.setFromAxisAngle(p.spin.axis, p.spin.angle);
        p.group.position.add(p.spin.pivot).sub(this._v.copy(p.spin.pivot).applyQuaternion(p.group.quaternion));
      }
    }
    if (this._fly) {
      const f = this._fly;
      f.t = f.seconds > 0 ? Math.min(1, f.t + dt / f.seconds) : 1;
      const k = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2; // ease in-out
      const radius = lerp(f.zoomFrom, f.zoomTo, k) * this._fitDistance(this.explode);
      this._v.setFromSphericalCoords(radius, lerp(f.from.phi, f.to.phi, k), lerp(f.from.theta, f.to.theta, k));
      this.camera.position.copy(this.controls.target).add(this._v);
      if (f.t >= 1) this._fly = null;
    }
    this.controls.update();
    for (const hook of this.frameHooks) hook(dt, this.explode);
    this.renderer.render(this.scene, this.camera);
    this._updateLabels();
  }

  _updateLabels() {
    const clear = () => {
      this.leaderPath.setAttribute('d', '');
      this.leaderHi.setAttribute('d', '');
      this.leaderDots.setAttribute('d', '');
    };
    if (!this.showLabels || !this.fit) return clear();

    const w = this.viewport.clientWidth;
    const h = this.viewport.clientHeight;
    const { b0, b1 } = this.fit;
    const yTop = lerp(b0.max.y, b1.max.y, this.explode);

    // Horizontal screen extent of the model, to place the label column beside it.
    let minX = Infinity;
    let maxX = -Infinity;
    for (const x of [b0.min.x, b0.max.x]) {
      for (const y of [b0.min.y, yTop]) {
        for (const z of [b0.min.z, b0.max.z]) {
          const v = this._v.set(x, y, z).project(this.camera);
          const sx = (v.x * 0.5 + 0.5) * w;
          minX = Math.min(minX, sx);
          maxX = Math.max(maxX, sx);
        }
      }
    }

    // Anchor on whichever cross-section face points toward the camera.
    const zFace = (this.camera.position.z >= this.controls.target.z ? 1 : -1) * (DEPTH / 2);
    let items = [];
    let maxW = 0;
    for (const p of this.parts.values()) {
      if (!p.labelEl || p.labelEl.hidden) continue;
      if (!p.lw) {
        p.lw = p.labelEl.offsetWidth;
        p.lh = p.labelEl.offsetHeight;
      }
      const z = p.anchor.isVector3 ? p.anchor.z : zFace;
      const lift = p.def.group * this.gap * this.explode; // not group.position: a spinning part's moves
      const v = this._v.set(p.anchor.x, p.anchor.y + lift, z).project(this.camera);
      if (v.z > 1) {
        p.labelEl.style.visibility = 'hidden';
        continue;
      }
      items.push({ p, sx: (v.x * 0.5 + 0.5) * w, sy: (-v.y * 0.5 + 0.5) * h });
      maxW = Math.max(maxW, p.lw);
    }

    // A column right of the model, else left of it; with no room on either
    // side (a phone), a column along the right edge, over the model.
    let side = 'right';
    let colX = maxX + 28;
    if (colX + maxW > w - 8) {
      side = 'left';
      colX = minX - 28;
      if (colX - maxW < 8) {
        side = 'right';
        colX = Math.max(8, w - 8 - maxW);
      }
    }

    // Stack labels in screen order, at least `step` px apart, inside the
    // viewport. If there are more than fit, keep the selected and hovered
    // labels and an even spread of the others.
    items.sort((a, b) => a.sy - b.sy);
    const step = 22;
    const top = 14 + this.reservedTop();
    const bottom = h - 14 - this.reservedBottom();
    const slots = Math.max(1, Math.floor((bottom - top) / step) + 1);
    if (items.length > slots) {
      const isKey = (it) => it.p.def.id === this.selected || it.p.def.id === this.hovered;
      const keep = new Set(items.filter(isKey).slice(0, slots));
      const rest = items.filter((it) => !keep.has(it));
      const n = slots - keep.size;
      for (let i = 0; i < n; i++) keep.add(rest[n === 1 ? rest.length >> 1 : Math.round((i * (rest.length - 1)) / (n - 1))]);
      for (const it of items) if (!keep.has(it)) it.p.labelEl.style.visibility = 'hidden';
      items = items.filter((it) => keep.has(it));
    }
    let prev = -Infinity;
    for (const it of items) {
      it.y = Math.max(it.sy, prev + step, top);
      prev = it.y;
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const cap = i === items.length - 1 ? bottom : items[i + 1].y - step;
      items[i].y = Math.min(items[i].y, cap);
    }

    let d = '';
    let hi = '';
    let dots = '';
    const f = (n) => n.toFixed(1);
    for (const it of items) {
      const { p } = it;
      const x = side === 'right' ? colX : colX - p.lw;
      p.labelEl.style.transform = `translate(${f(x)}px, ${f(it.y - p.lh / 2)}px)`;
      p.labelEl.style.visibility = 'visible';
      const bend = side === 'right' ? colX - 16 : colX + 16;
      const end = side === 'right' ? colX - 3 : colX + 3;
      const seg = `M${f(it.sx)} ${f(it.sy)}L${f(bend)} ${f(it.y)}L${f(end)} ${f(it.y)}`;
      if (p.def.id === this.selected || p.def.id === this.hovered) hi += seg;
      else d += seg;
      dots += `M${f(it.sx - 2)} ${f(it.sy)}a2 2 0 1 0 4 0a2 2 0 1 0 -4 0`;
    }
    this.leaderPath.setAttribute('d', d);
    this.leaderHi.setAttribute('d', hi);
    this.leaderDots.setAttribute('d', dots);
  }
}
