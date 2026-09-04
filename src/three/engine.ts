import * as THREE from 'three';
import type { Net, Panel } from '../lib/geometry';

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

interface PanelNode {
  panel: Panel;
  group: THREE.Group;      // hinge transform
  meshes: THREE.Mesh[];
  depth: number;
  layer: number;
  outSign: number;
  axis: 'x' | 'y' | null;
  sign: number;
  target: number;          // radians
  seq: number;
}

export interface EngineOpts {
  onReady?: () => void;
}

export class BoxEngine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root = new THREE.Group();
  model = new THREE.Group();
  nodes: PanelNode[] = [];
  ground: THREE.Mesh;
  private raf = 0;
  private container: HTMLElement;
  private tex: THREE.CanvasTexture | null = null;
  private outerMat: THREE.MeshPhysicalMaterial;
  private innerMat: THREE.MeshStandardMaterial;
  private edgeMat: THREE.MeshStandardMaterial;
  private caliper = 0.45;
  private layFlat = false;
  private fold = 1;
  private targetFold = 1;
  private autoRotate = true;
  private spherical = new THREE.Spherical(400, Math.PI * 0.42, Math.PI * 0.22);
  private targetSph = new THREE.Spherical(400, Math.PI * 0.42, Math.PI * 0.22);
  private center = new THREE.Vector3();
  private modelRadius = 100;
  private zoomFactor = 1.22;
  private fit = { c: new THREE.Vector3(), size: new THREE.Vector3(1, 1, 1), r: 100 };
  private key: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private rim: THREE.DirectionalLight;
  private amb: THREE.HemisphereLight;
  private pmrem: THREE.PMREMGenerator;
  private disposed = false;
  private clock = new THREE.Clock();
  private smooth = 0.12;

  constructor(container: HTMLElement, _opts: EngineOpts = {}) {
    this.container = container;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, w / h, 1, 8000);

    this.amb = new THREE.HemisphereLight(0xffffff, 0x9aa3b0, 1.1);
    this.scene.add(this.amb);
    this.key = new THREE.DirectionalLight(0xffffff, 2.1);
    this.key.position.set(220, 420, 300);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0012;
    this.key.shadow.normalBias = 0.6;
    this.scene.add(this.key);
    this.fill = new THREE.DirectionalLight(0xdfe8ff, 0.75);
    this.fill.position.set(-320, 180, 260);
    this.scene.add(this.fill);
    this.rim = new THREE.DirectionalLight(0xffffff, 1.0);
    this.rim.position.set(-140, 220, -380);
    this.scene.add(this.rim);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromEquirectangular(makeEnvTexture()).texture;

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.outerMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.62, metalness: 0, side: THREE.FrontSide,
      clearcoat: 0, clearcoatRoughness: 0.25,
    });
    this.innerMat = new THREE.MeshStandardMaterial({ color: 0xefe9dd, roughness: 0.95, side: THREE.BackSide });
    this.edgeMat = new THREE.MeshStandardMaterial({ color: 0xdad2c4, roughness: 1, side: THREE.DoubleSide });

    this.root.add(this.model);
    this.scene.add(this.root);

    this.bindControls();
    // handy for debugging folds from the console; dev builds only
    if (import.meta.env.DEV) (window as unknown as { __box?: BoxEngine }).__box = this;
    this.resize();
    this.loop();
  }

  /* ---------------- controls ---------------- */
  private bindControls() {
    const el = this.renderer.domElement;
    let dragging = false, lx = 0, ly = 0;
    const down = (e: PointerEvent) => {
      dragging = true; lx = e.clientX; ly = e.clientY;
      el.setPointerCapture(e.pointerId);
      this.autoRotate = false;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      this.targetSph.theta -= dx * 0.0075;
      this.targetSph.phi = Math.max(0.12, Math.min(Math.PI - 0.12, this.targetSph.phi - dy * 0.0065));
    };
    const up = (e: PointerEvent) => { dragging = false; try { el.releasePointerCapture(e.pointerId); } catch { /* */ } };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomFactor = THREE.MathUtils.clamp(this.zoomFactor * (1 + Math.sign(e.deltaY) * 0.09), 0.32, 3.2);
    }, { passive: false });
  }

  setAutoRotate(v: boolean) { this.autoRotate = v; }
  resetView() {
    this.targetSph.theta = Math.PI * 0.22;
    this.targetSph.phi = Math.PI * 0.42;
    this.zoomFactor = 1.22;
  }
  setViewAngle(name: 'front' | 'threeq' | 'top' | 'side') {
    const map: Record<string, [number, number]> = {
      front: [0, Math.PI / 2],
      threeq: [Math.PI * 0.22, Math.PI * 0.42],
      top: [Math.PI * 0.2, 0.42],
      side: [Math.PI / 2, Math.PI * 0.48],
    };
    const [t, p] = map[name];
    this.targetSph.theta = t; this.targetSph.phi = p;
    this.autoRotate = false;
  }

  /* ---------------- build ---------------- */
  buildFromNet(net: Net, caliper: number) {
    this.caliper = caliper;
    this.layFlat = net.layFlat;
    for (const n of this.nodes) {
      for (const m of n.meshes) m.geometry.dispose();
    }
    this.model.clear();
    this.nodes = [];

    const b = net.bounds;
    const groups: Record<string, THREE.Group> = {};
    /**
     * Every panel lives in its parent's frame, so its local origin has to be
     * expressed relative to the parent's own offset — otherwise a flap hanging
     * off a left-hinged wall lands mirrored on the far side of the box.
     * local X = flatX + xOff, local Y = yOff - flatY
     */
    const frame: Record<string, { xOff: number; yOff: number }> = {};

    const visit = (p: Panel, parent: Panel | null, depth: number) => {
      const g = new THREE.Group();
      let axis: 'x' | 'y' | null = null;
      let sign = 1;
      let xOff = 0;
      let yOff = 0;

      if (parent) {
        const pf = frame[parent.id];
        switch (p.hinge) {
          case 'right':
            g.position.x = parent.w + pf.xOff; axis = 'y'; sign = 1;
            xOff = 0; yOff = pf.yOff; break;
          case 'left':
            g.position.x = pf.xOff; axis = 'y'; sign = -1;
            xOff = -p.w; yOff = pf.yOff; break;
          case 'top':
            g.position.y = pf.yOff; axis = 'x'; sign = -1;
            xOff = pf.xOff; yOff = p.h; break;
          default:
            g.position.y = pf.yOff - parent.h; axis = 'x'; sign = 1;
            xOff = pf.xOff; yOff = 0; break;
        }
        groups[parent.id].add(g);
      } else {
        this.model.add(g);
      }
      groups[p.id] = g;
      frame[p.id] = { xOff, yOff };

      const shape = new THREE.Shape();
      p.outline.forEach(([lx, ly], i) => {
        const X = lx + xOff;
        const Y = yOff - ly;
        if (i === 0) shape.moveTo(X, Y); else shape.lineTo(X, Y);
      });

      const geo = new THREE.ShapeGeometry(shape);
      // remap UVs from local plane coords -> artboard space
      const pos = geo.attributes.position;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i) - xOff;
        const ly = yOff - pos.getY(i);
        uv[i * 2] = (p.x + lx - b.x) / b.w;
        uv[i * 2 + 1] = 1 - (p.y + ly - b.y) / b.h;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeVertexNormals();

      const meshes: THREE.Mesh[] = [];
      const outer = new THREE.Mesh(geo, this.outerMat);
      outer.castShadow = true;
      outer.receiveShadow = true;
      outer.userData.side = 'outer';
      g.add(outer); meshes.push(outer);

      const inner = new THREE.Mesh(geo, this.innerMat);
      inner.userData.side = 'inner';
      inner.receiveShadow = true;
      g.add(inner); meshes.push(inner);

      if (caliper >= 1.0) {
        // Board thickness: an open band around the outline only. An extruded
        // solid would cap both faces and bury the printed artwork under the
        // edge colour, which is exactly what corrugated boards used to do.
        const ring = p.outline.map(([lx, ly]) => [lx + xOff, yOff - ly] as [number, number]);
        const h = caliper / 2;
        const pos: number[] = [];
        for (let i = 0; i < ring.length; i++) {
          const [ax, ay] = ring[i];
          const [bx, by] = ring[(i + 1) % ring.length];
          pos.push(ax, ay, -h, bx, by, -h, bx, by, h);
          pos.push(ax, ay, -h, bx, by, h, ax, ay, h);
        }
        const band = new THREE.BufferGeometry();
        band.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
        band.computeVertexNormals();
        const edge = new THREE.Mesh(band, this.edgeMat);
        edge.userData.side = 'edge';
        edge.castShadow = true;
        g.add(edge); meshes.push(edge);
      }

      this.nodes.push({
        panel: p, group: g, meshes, depth, layer: layerOf(p), outSign: 1, axis, sign,
        target: (p.angle * Math.PI) / 180, seq: p.seq ?? 0,
      });

      for (const c of p.children) visit(c, p, depth + 1);
    };
    visit(net.root, null, 0);

    this.computeLayerSigns();
    this.applyFold(this.fold, true);
    this.frameModel();
  }

  /**
   * Work out, for every panel, which way "outwards" is once the box is shut.
   * Flaps that fold roughly 180 degrees end up facing into the carton, so a
   * naive local offset would push tucks through the wall they slide behind.
   */
  private computeLayerSigns() {
    const keep = this.fold;
    this.fold = 1;
    this.model.rotation.x = 0;
    for (const n of this.nodes) {
      if (n.axis) {
        const a = n.target * n.sign;
        if (n.axis === 'y') n.group.rotation.y = a; else n.group.rotation.x = a;
      }
      for (const m of n.meshes) m.position.z = 0;
    }
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const c = new THREE.Vector3();
    box.getCenter(c);
    const nrm = new THREE.Vector3();
    const pos = new THREE.Vector3();
    for (const n of this.nodes) {
      const m = n.meshes[0];
      m.geometry.computeBoundingSphere();
      pos.copy(m.geometry.boundingSphere!.center).applyMatrix4(m.matrixWorld);
      nrm.set(0, 0, 1).transformDirection(m.matrixWorld);
      const d = nrm.dot(pos.sub(c));
      n.outSign = d < 0 ? -1 : 1;
    }
    this.fold = keep;
  }

  /** Measure the model in its current fold state. */
  private measure() {
    this.model.position.set(0, 0, 0);
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    const c = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(c);
    c.sub(this.root.position); // measured in world space — bring back into the root frame
    const radius = Math.max(size.length() * 0.5, 20);
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(0.5, this.camera.aspect));
    return { c, size, r: radius / Math.sin(Math.min(vFov, hFov) / 2) };
  }

  /** Keep the blank framed whether it is flat, half erected or shut. */
  private applyFraming(snap = false) {
    const m = this.measure();
    const k = snap ? 1 : this.smooth;
    this.fit.c.lerp(m.c, k);
    this.fit.size.lerp(m.size, k);
    this.fit.r += (m.r - this.fit.r) * k;
    this.model.position.set(-this.fit.c.x, -this.fit.c.y, -this.fit.c.z);
    this.root.position.y = this.fit.size.y / 2 + 0.5;
    this.center.set(0, this.fit.size.y / 2, 0);
    this.targetSph.radius = this.fit.r * this.zoomFactor;
    if (snap) this.spherical.radius = this.targetSph.radius;
  }

  private frameModel() {
    this.applyFold(1, true);
    const a = this.measure();
    this.modelRadius = Math.max(a.size.length() * 0.5, 20);
    this.key.shadow.camera.left = -this.modelRadius * 2.5;
    this.key.shadow.camera.right = this.modelRadius * 2.5;
    this.key.shadow.camera.top = this.modelRadius * 2.5;
    this.key.shadow.camera.bottom = -this.modelRadius * 2.5;
    this.key.shadow.camera.far = this.modelRadius * 14;
    // texel size grows with the box, so the depth bias has to grow with it —
    // otherwise big cartons (shippers, mailers) self-shadow into moire stripes
    this.key.shadow.normalBias = Math.max(0.5, this.modelRadius * 0.02);
    this.key.shadow.bias = -0.0006 - this.modelRadius * 0.000006;
    this.key.shadow.camera.updateProjectionMatrix();
    this.applyFold(this.fold, true);
    this.applyFraming(true);
  }

  /* ---------------- state ---------------- */
  setFold(v: number, instant = false) {
    this.targetFold = clamp01(v);
    if (instant) { this.fold = this.targetFold; this.applyFold(this.fold, true); }
  }

  private applyFold(t: number, _force = false) {
    this.model.rotation.x = this.layFlat ? (Math.PI / 2) * ease(clamp01(t)) : 0;
    for (const n of this.nodes) {
      if (n.axis) {
        const start = n.seq * 0.82;
        const local = ease(clamp01((t - start) / Math.max(0.001, 1 - start)));
        const a = n.target * local * n.sign;
        if (n.axis === 'y') n.group.rotation.y = a;
        else n.group.rotation.x = a;
      }
      const u = Math.max(0.3, Math.min(1.5, this.caliper)) * 1.1;
      const z = t * n.layer * u * n.outSign;
      for (const m of n.meshes) {
        if (m.userData.side === 'outer') m.position.z = z + this.caliper * 0.5;
        else if (m.userData.side === 'inner') m.position.z = z - this.caliper * 0.5;
        else m.position.z = z - this.caliper * 0.5;
      }
    }
  }

  setTexture(canvas: HTMLCanvasElement) {
    const old = this.tex;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true;
    this.tex = t;
    this.outerMat.map = t;
    this.outerMat.needsUpdate = true;
    old?.dispose();
  }

  setMaterial(opts: { roughness: number; inner: string; edge: string; finish: 'matte' | 'gloss' | 'softTouch' }) {
    this.outerMat.roughness = opts.finish === 'gloss' ? Math.min(0.22, opts.roughness * 0.4)
      : opts.finish === 'softTouch' ? Math.min(1, opts.roughness * 1.25) : opts.roughness;
    this.outerMat.clearcoat = opts.finish === 'gloss' ? 0.85 : 0;
    this.outerMat.clearcoatRoughness = opts.finish === 'gloss' ? 0.08 : 0.4;
    this.outerMat.sheen = opts.finish === 'softTouch' ? 0.5 : 0;
    this.outerMat.needsUpdate = true;
    this.innerMat.color.set(opts.inner);
    this.edgeMat.color.set(opts.edge);
  }

  setScene(opts: { bg: string; studio: string; shadow: boolean; showInner: boolean }) {
    this.container.style.background = opts.bg;
    this.ground.visible = opts.shadow;
    this.innerMat.visible = opts.showInner;
    const s = opts.studio;
    if (s === 'contrast') {
      this.key.intensity = 3.0; this.fill.intensity = 0.25; this.rim.intensity = 1.5; this.amb.intensity = 0.5;
      (this.ground.material as THREE.ShadowMaterial).opacity = 0.42;
    } else if (s === 'warm') {
      this.key.intensity = 2.0; this.key.color.set(0xffe6c4); this.fill.intensity = 0.8;
      this.fill.color.set(0xffd9b0); this.rim.intensity = 0.9; this.amb.intensity = 1.0;
      (this.ground.material as THREE.ShadowMaterial).opacity = 0.24;
    } else if (s === 'cool') {
      this.key.intensity = 2.0; this.key.color.set(0xdfeaff); this.fill.intensity = 0.9;
      this.fill.color.set(0xcfe0ff); this.rim.intensity = 1.2; this.amb.intensity = 1.1;
      (this.ground.material as THREE.ShadowMaterial).opacity = 0.2;
    } else {
      this.key.intensity = 2.1; this.key.color.set(0xffffff); this.fill.intensity = 0.75;
      this.fill.color.set(0xdfe8ff); this.rim.intensity = 1.0; this.amb.intensity = 1.1;
      (this.ground.material as THREE.ShadowMaterial).opacity = 0.22;
    }
    this.key.shadow.camera.left = -this.modelRadius * 2.5;
    this.key.shadow.camera.right = this.modelRadius * 2.5;
    this.key.shadow.camera.top = this.modelRadius * 2.5;
    this.key.shadow.camera.bottom = -this.modelRadius * 2.5;
    this.key.shadow.camera.far = this.modelRadius * 12;
    this.key.shadow.camera.updateProjectionMatrix();
  }

  /* ---------------- loop ---------------- */
  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.nodes.length) this.frameModel();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, this.clock.getDelta());
    const k = 1 - Math.exp(-9 * dt);
    this.smooth = k;
    if (this.autoRotate) this.targetSph.theta += dt * 0.21;
    this.spherical.theta += (this.targetSph.theta - this.spherical.theta) * k;
    this.spherical.phi += (this.targetSph.phi - this.spherical.phi) * k;
    this.spherical.radius += (this.targetSph.radius - this.spherical.radius) * k;
    const p = new THREE.Vector3().setFromSpherical(this.spherical).add(this.center);
    this.camera.position.copy(p);
    this.camera.lookAt(this.center);
    if (Math.abs(this.fold - this.targetFold) > 0.0005) {
      this.fold += (this.targetFold - this.fold) * (1 - Math.exp(-6 * dt));
    } else this.fold = this.targetFold;
    this.applyFold(this.fold);
    this.applyFraming();
    this.key.target.position.copy(this.center);
    this.key.target.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
  };

  /** High-res still. */
  snapshot(scale = 2, transparent = false): string {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    const oldBg = this.scene.background;
    if (!transparent) {
      this.renderer.setClearColor(new THREE.Color(getComputedStyle(this.container).backgroundColor || '#ffffff'), 1);
    } else this.renderer.setClearAlpha(0);
    this.renderer.setSize(w * scale, h * scale, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.scene.background = oldBg;
    this.renderer.setClearAlpha(0);
    this.renderer.setSize(w, h, false);
    this.camera.updateProjectionMatrix();
    return url;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.tex?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/**
 * Assembly layer: how far a panel sits from the base plane once folded.
 * Negative = tucked inside the wall it meets, positive = lapped over the
 * panels that folded before it. Sequence adds a sub-layer so flaps that close
 * later always rest on top of the ones already down.
 */
function layerOf(p: Panel): number {
  const seq = p.seq ?? 0;
  if (p.layer !== undefined) return p.layer + seq;
  switch (p.kind) {
    case 'tuck': return -5 + seq;
    case 'glue': return -3 + seq;
    case 'dust': return 1 + seq;
    case 'flap': return 2 + seq;
    default: return 0;
  }
}

/** Procedural studio environment (no external HDR needed). */
function makeEnvTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.42, '#e8edf5');
  g.addColorStop(0.55, '#b9c2d0');
  g.addColorStop(1, '#5c6472');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  // soft box highlights
  const blobs: [number, number, number, string][] = [
    [140, 60, 90, 'rgba(255,255,255,0.95)'],
    [370, 48, 70, 'rgba(255,255,255,0.8)'],
    [255, 150, 120, 'rgba(255,255,255,0.25)'],
  ];
  for (const [x, y, r, col] of blobs) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
