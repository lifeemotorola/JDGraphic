/**
 * BoxCraft parametric packaging engine.
 *
 * A box is described as a "net": a tree of panels connected by fold lines
 * (hinges). The SAME net drives (a) the flat dieline drawing, (b) the artwork
 * artboard/UV mapping and (c) the folded 3D model. Change a dimension and
 * everything downstream updates.
 *
 * Units are millimetres throughout. Flat space is y-down (like a canvas/SVG).
 */

export type Hinge = 'right' | 'left' | 'top' | 'bottom';
export type PanelKind = 'panel' | 'flap' | 'dust' | 'tuck' | 'glue';
export type FaceKey =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'inner';

export interface PanelSpec {
  /** override the assembly layer (negative = tucks inside the panel it meets) */
  layer?: number;
  id: string;
  label: string;
  w: number;
  h: number;
  parent?: string;
  hinge?: Hinge;
  /** Fold angle in degrees when fully closed. */
  angle: number;
  kind: PanelKind;
  face?: FaceKey;
  /** Outline generator name. */
  shape?: 'rect' | 'tuckTop' | 'tuckBottom' | 'dustL' | 'dustR' | 'glueR' | 'glueB' | 'glueT' | 'flapTop' | 'flapBottom' | 'lidTop';
  /** Chamfer / nose size used by some shapes. */
  k?: number;
  /** Panels folded later in the assembly animation (0..1 start offset). */
  seq?: number;
}

export interface Panel extends PanelSpec {
  /** absolute top-left in flat space */
  x: number;
  y: number;
  outline: [number, number][]; // local coords, 0..w / 0..h, y-down
  children: Panel[];
}

export interface Net {
  id: string;
  name: string;
  layFlat: boolean;
  panels: Panel[];      // flat list, root first
  byId: Record<string, Panel>;
  root: Panel;
  bounds: { x: number; y: number; w: number; h: number };
}

export interface BoxParams {
  /** length (width of front panel) */
  L: number;
  /** width (depth) */
  W: number;
  /** height */
  H: number;
  /** board caliper in mm */
  caliper: number;
  /** glue flap width */
  glue: number;
  /** bleed in mm */
  bleed: number;
}

export type BoxTypeId =
  | 'ste'
  | 'rte'
  | 'seal'
  | 'rsc'
  | 'sleeve'
  | 'mailer'
  | 'tray';

export interface BoxType {
  id: BoxTypeId;
  name: string;
  short: string;
  desc: string;
  tags: string[];
  /** Structures whose root panel is the base sit flat instead of standing up. */
  layFlat?: boolean;
  /** default L,W,H */
  defaults: [number, number, number];
  build: (p: BoxParams) => PanelSpec[];
}

/* ------------------------------------------------------------------ */
/* outlines                                                            */
/* ------------------------------------------------------------------ */

const R = (w: number, h: number): [number, number][] => [
  [0, 0],
  [w, 0],
  [w, h],
  [0, h],
];

/** Tuck flap hinged on its BOTTOM edge (points up in flat space). */
function tuckTop(w: number, h: number, k: number): [number, number][] {
  const n = Math.min(k, h * 0.45);
  const s = Math.min(k * 0.8, w * 0.12);
  return [
    [s * 0.35, h],
    [0, h - n * 0.9],
    [0, n],
    [s, 0],
    [w - s, 0],
    [w, n],
    [w, h - n * 0.9],
    [w - s * 0.35, h],
  ];
}

/** Tuck flap hinged on its TOP edge (points down in flat space). */
function tuckBottom(w: number, h: number, k: number): [number, number][] {
  return tuckTop(w, h, k).map(([x, y]) => [x, h - y] as [number, number]);
}

/** Dust flap hinged on bottom edge, chamfer away from the tuck side. */
function dustFlap(w: number, h: number, k: number, dir: 'l' | 'r', up: boolean): [number, number][] {
  const c = Math.min(k, h * 0.8, w * 0.5);
  let pts: [number, number][];
  if (dir === 'r') pts = [[0, h], [0, 0], [w - c, 0], [w, c], [w, h]];
  else pts = [[0, h], [0, c], [c, 0], [w, 0], [w, h]];
  if (!up) pts = pts.map(([x, y]) => [x, h - y] as [number, number]);
  return pts;
}

/** Glue flap tapered on the far (right) side. */
function glueR(w: number, h: number): [number, number][] {
  const c = Math.min(w * 0.9, h * 0.06 + 2);
  return [[0, 0], [w, c], [w, h - c], [0, h]];
}
function glueB(w: number, h: number): [number, number][] {
  const c = Math.min(h * 0.9, w * 0.06 + 2);
  return [[0, 0], [w, 0], [w - c, h], [c, h]];
}
function glueT(w: number, h: number): [number, number][] {
  return glueB(w, h).map(([x, y]) => [x, h - y] as [number, number]);
}

/** Closing flap with small corner relief, hinged bottom (points up). */
function flapTop(w: number, h: number, k: number): [number, number][] {
  const c = Math.min(k * 0.5, w * 0.08, h * 0.25);
  return [[0, h], [0, c], [c, 0], [w - c, 0], [w, c], [w, h]];
}
function flapBottom(w: number, h: number, k: number): [number, number][] {
  return flapTop(w, h, k).map(([x, y]) => [x, h - y] as [number, number]);
}

function outlineFor(s: PanelSpec): [number, number][] {
  const k = s.k ?? 4;
  switch (s.shape) {
    case 'tuckTop': return tuckTop(s.w, s.h, k);
    case 'tuckBottom': return tuckBottom(s.w, s.h, k);
    case 'dustL': return dustFlap(s.w, s.h, k, 'l', s.hinge === 'top');
    case 'dustR': return dustFlap(s.w, s.h, k, 'r', s.hinge === 'top');
    case 'glueR': return glueR(s.w, s.h);
    case 'glueB': return glueB(s.w, s.h);
    case 'glueT': return glueT(s.w, s.h);
    case 'flapTop': return flapTop(s.w, s.h, k);
    case 'flapBottom': return flapBottom(s.w, s.h, k);
    default: return R(s.w, s.h);
  }
}

/* ------------------------------------------------------------------ */
/* box type library                                                    */
/* ------------------------------------------------------------------ */

const tuckLen = (W: number) => clamp(W * 0.72, 10, 34);
const dustLen = (W: number) => clamp(W * 0.82, 8, 40);

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

/** Straight / Reverse tuck end shared builder. */
function tuckEnd(p: BoxParams, reverse: boolean): PanelSpec[] {
  const { L, W, H, glue } = p;
  const t = tuckLen(W);
  const d = dustLen(W);
  const k = clamp(W * 0.25, 2.5, 8);
  const specs: PanelSpec[] = [
    { id: 'front', label: 'Front', w: L, h: H, angle: 0, kind: 'panel', face: 'front', shape: 'rect' },
    { id: 'side-r', label: 'Right', w: W, h: H, parent: 'front', hinge: 'right', angle: 90, kind: 'panel', face: 'right', shape: 'rect', seq: 0 },
    { id: 'back', label: 'Back', w: L, h: H, parent: 'side-r', hinge: 'right', angle: 90, kind: 'panel', face: 'back', shape: 'rect', seq: 0 },
    { id: 'side-l', label: 'Left', w: W, h: H, parent: 'back', hinge: 'right', angle: 90, kind: 'panel', face: 'left', shape: 'rect', seq: 0 },
    { id: 'glue', label: 'Glue', w: glue, h: H, parent: 'side-l', hinge: 'right', angle: 90, kind: 'glue', face: 'inner', shape: 'glueR', seq: 0 },
    // dust flaps
    { id: 'dust-rt', label: 'Dust', w: W, h: d, parent: 'side-r', hinge: 'top', angle: 90, kind: 'dust', face: 'inner', shape: 'dustR', k, seq: 0.35 },
    { id: 'dust-lt', label: 'Dust', w: W, h: d, parent: 'side-l', hinge: 'top', angle: 90, kind: 'dust', face: 'inner', shape: 'dustL', k, seq: 0.35 },
    { id: 'dust-rb', label: 'Dust', w: W, h: d, parent: 'side-r', hinge: 'bottom', angle: 90, kind: 'dust', face: 'inner', shape: 'dustR', k, seq: 0.35 },
    { id: 'dust-lb', label: 'Dust', w: W, h: d, parent: 'side-l', hinge: 'bottom', angle: 90, kind: 'dust', face: 'inner', shape: 'dustL', k, seq: 0.35 },
  ];
  // top closure always hinges off the back panel
  specs.push(
    { id: 'lid-top', label: 'Top', w: L, h: W, parent: 'back', hinge: 'top', angle: 90, kind: 'flap', face: 'top', shape: 'rect', seq: 0.55 },
    { id: 'tuck-top', label: 'Tuck', w: L, h: t, parent: 'lid-top', hinge: 'top', angle: 90, kind: 'tuck', face: 'inner', shape: 'tuckTop', k, seq: 0.78 },
  );
  // bottom closure: STE -> back panel, RTE -> front panel
  const bParent = reverse ? 'front' : 'back';
  specs.push(
    { id: 'lid-bot', label: 'Bottom', w: L, h: W, parent: bParent, hinge: 'bottom', angle: 90, kind: 'flap', face: 'bottom', shape: 'rect', seq: 0.55 },
    { id: 'tuck-bot', label: 'Tuck', w: L, h: t, parent: 'lid-bot', hinge: 'bottom', angle: 90, kind: 'tuck', face: 'inner', shape: 'tuckBottom', k, seq: 0.78 },
  );
  return specs;
}

function sealEnd(p: BoxParams): PanelSpec[] {
  const { L, W, H, glue } = p;
  const k = clamp(W * 0.22, 2, 7);
  const fl = W * 0.5 + 2;
  return [
    { id: 'front', label: 'Front', w: L, h: H, angle: 0, kind: 'panel', face: 'front' },
    { id: 'side-r', label: 'Right', w: W, h: H, parent: 'front', hinge: 'right', angle: 90, kind: 'panel', face: 'right' },
    { id: 'back', label: 'Back', w: L, h: H, parent: 'side-r', hinge: 'right', angle: 90, kind: 'panel', face: 'back' },
    { id: 'side-l', label: 'Left', w: W, h: H, parent: 'back', hinge: 'right', angle: 90, kind: 'panel', face: 'left' },
    { id: 'glue', label: 'Glue', w: glue, h: H, parent: 'side-l', hinge: 'right', angle: 90, kind: 'glue', face: 'inner', shape: 'glueR' },
    { id: 'dust-rt', label: 'Flap', w: W, h: fl, parent: 'side-r', hinge: 'top', angle: 90, kind: 'dust', face: 'inner', shape: 'flapTop', k, seq: 0.3 },
    { id: 'dust-lt', label: 'Flap', w: W, h: fl, parent: 'side-l', hinge: 'top', angle: 90, kind: 'dust', face: 'inner', shape: 'flapTop', k, seq: 0.3 },
    { id: 'dust-rb', label: 'Flap', w: W, h: fl, parent: 'side-r', hinge: 'bottom', angle: 90, kind: 'dust', face: 'inner', shape: 'flapBottom', k, seq: 0.3 },
    { id: 'dust-lb', label: 'Flap', w: W, h: fl, parent: 'side-l', hinge: 'bottom', angle: 90, kind: 'dust', face: 'inner', shape: 'flapBottom', k, seq: 0.3 },
    { id: 'lid-top', label: 'Top', w: L, h: W, parent: 'back', hinge: 'top', angle: 90, kind: 'flap', face: 'top', shape: 'flapTop', k, seq: 0.62 },
    { id: 'lid-topf', label: 'Top', w: L, h: W, parent: 'front', hinge: 'top', angle: 90, kind: 'flap', face: 'top', shape: 'flapTop', k, seq: 0.8 },
    { id: 'lid-bot', label: 'Bottom', w: L, h: W, parent: 'back', hinge: 'bottom', angle: 90, kind: 'flap', face: 'bottom', shape: 'flapBottom', k, seq: 0.62 },
    { id: 'lid-botf', label: 'Bottom', w: L, h: W, parent: 'front', hinge: 'bottom', angle: 90, kind: 'flap', face: 'bottom', shape: 'flapBottom', k, seq: 0.8 },
  ];
}

function rsc(p: BoxParams): PanelSpec[] {
  const { L, W, H, glue } = p;
  const half = W / 2;
  const k = clamp(W * 0.1, 1.5, 5);
  return [
    { id: 'front', label: 'Front', w: L, h: H, angle: 0, kind: 'panel', face: 'front' },
    { id: 'side-r', label: 'Right', w: W, h: H, parent: 'front', hinge: 'right', angle: 90, kind: 'panel', face: 'right' },
    { id: 'back', label: 'Back', w: L, h: H, parent: 'side-r', hinge: 'right', angle: 90, kind: 'panel', face: 'back' },
    { id: 'side-l', label: 'Left', w: W, h: H, parent: 'back', hinge: 'right', angle: 90, kind: 'panel', face: 'left' },
    { id: 'glue', label: 'Joint', w: glue, h: H, parent: 'side-l', hinge: 'right', angle: 90, kind: 'glue', face: 'inner', shape: 'glueR' },
    { id: 'ft', label: 'Flap', w: L, h: half, parent: 'front', hinge: 'top', angle: 90, kind: 'flap', face: 'top', shape: 'flapTop', k, seq: 0.6 },
    { id: 'rt', label: 'Flap', w: W, h: half, parent: 'side-r', hinge: 'top', angle: 90, kind: 'dust', face: 'top', shape: 'flapTop', k, seq: 0.4 },
    { id: 'bt', label: 'Flap', w: L, h: half, parent: 'back', hinge: 'top', angle: 90, kind: 'flap', face: 'top', shape: 'flapTop', k, seq: 0.6 },
    { id: 'lt', label: 'Flap', w: W, h: half, parent: 'side-l', hinge: 'top', angle: 90, kind: 'dust', face: 'top', shape: 'flapTop', k, seq: 0.4 },
    { id: 'fb', label: 'Flap', w: L, h: half, parent: 'front', hinge: 'bottom', angle: 90, kind: 'flap', face: 'bottom', shape: 'flapBottom', k, seq: 0.6 },
    { id: 'rb', label: 'Flap', w: W, h: half, parent: 'side-r', hinge: 'bottom', angle: 90, kind: 'dust', face: 'bottom', shape: 'flapBottom', k, seq: 0.4 },
    { id: 'bb', label: 'Flap', w: L, h: half, parent: 'back', hinge: 'bottom', angle: 90, kind: 'flap', face: 'bottom', shape: 'flapBottom', k, seq: 0.6 },
    { id: 'lb', label: 'Flap', w: W, h: half, parent: 'side-l', hinge: 'bottom', angle: 90, kind: 'dust', face: 'bottom', shape: 'flapBottom', k, seq: 0.4 },
  ];
}

function sleeve(p: BoxParams): PanelSpec[] {
  const { L, W, H, glue } = p;
  return [
    { id: 'front', label: 'Front', w: L, h: H, angle: 0, kind: 'panel', face: 'front' },
    { id: 'side-r', label: 'Right', w: W, h: H, parent: 'front', hinge: 'right', angle: 90, kind: 'panel', face: 'right' },
    { id: 'back', label: 'Back', w: L, h: H, parent: 'side-r', hinge: 'right', angle: 90, kind: 'panel', face: 'back' },
    { id: 'side-l', label: 'Left', w: W, h: H, parent: 'back', hinge: 'right', angle: 90, kind: 'panel', face: 'left' },
    { id: 'glue', label: 'Glue', w: glue, h: H, parent: 'side-l', hinge: 'right', angle: 90, kind: 'glue', face: 'inner', shape: 'glueR' },
  ];
}

/** Roll-end tuck-front style mailer (simplified but structurally honest). */
function mailer(p: BoxParams): PanelSpec[] {
  const { L, W, H } = p;
  const wing = clamp(H * 0.85, 8, 60);
  const k = clamp(H * 0.2, 2, 7);
  return [
    { id: 'base', label: 'Base', w: L, h: W, angle: 0, kind: 'panel', face: 'bottom' },
    { id: 'front', label: 'Front', w: L, h: H, parent: 'base', hinge: 'bottom', angle: 90, kind: 'panel', face: 'front', seq: 0.15 },
    { id: 'back', label: 'Back', w: L, h: H, parent: 'base', hinge: 'top', angle: 90, kind: 'panel', face: 'back', seq: 0.15 },
    { id: 'side-l', label: 'Left', w: H, h: W, parent: 'base', hinge: 'left', angle: 90, kind: 'panel', face: 'left', seq: 0.15 },
    { id: 'side-r', label: 'Right', w: H, h: W, parent: 'base', hinge: 'right', angle: 90, kind: 'panel', face: 'right', seq: 0.15 },
    { id: 'wing-lf', label: 'Wing', layer: -3, w: H, h: wing, parent: 'side-l', hinge: 'bottom', angle: 90, kind: 'dust', face: 'inner', shape: 'flapBottom', k, seq: 0.42 },
    { id: 'wing-lb', label: 'Wing', layer: -3, w: H, h: wing, parent: 'side-l', hinge: 'top', angle: 90, kind: 'dust', face: 'inner', shape: 'flapTop', k, seq: 0.42 },
    { id: 'wing-rf', label: 'Wing', layer: -3, w: H, h: wing, parent: 'side-r', hinge: 'bottom', angle: 90, kind: 'dust', face: 'inner', shape: 'flapBottom', k, seq: 0.42 },
    { id: 'wing-rb', label: 'Wing', layer: -3, w: H, h: wing, parent: 'side-r', hinge: 'top', angle: 90, kind: 'dust', face: 'inner', shape: 'flapTop', k, seq: 0.42 },
    { id: 'lid', label: 'Lid', w: L, h: W, parent: 'back', hinge: 'top', angle: 90, kind: 'panel', face: 'top', seq: 0.6 },
    { id: 'lip', label: 'Lip', w: L, h: H, parent: 'lid', hinge: 'top', angle: 90, kind: 'flap', face: 'inner', seq: 0.78 },
    { id: 'lidtuck', label: 'Tuck', w: L, h: clamp(H * 0.7, 8, 40), parent: 'lip', hinge: 'top', angle: 90, kind: 'tuck', face: 'inner', shape: 'tuckTop', k, seq: 0.9 },
  ];
}

/** Open tray with corner glue tabs. */
function tray(p: BoxParams): PanelSpec[] {
  const { L, W, H, glue } = p;
  const g = clamp(glue, 8, 30);
  return [
    { id: 'base', label: 'Base', w: L, h: W, angle: 0, kind: 'panel', face: 'bottom' },
    { id: 'front', label: 'Front', w: L, h: H, parent: 'base', hinge: 'bottom', angle: 90, kind: 'panel', face: 'front', seq: 0.15 },
    { id: 'back', label: 'Back', w: L, h: H, parent: 'base', hinge: 'top', angle: 90, kind: 'panel', face: 'back', seq: 0.15 },
    { id: 'side-l', label: 'Left', w: H, h: W, parent: 'base', hinge: 'left', angle: 90, kind: 'panel', face: 'left', seq: 0.15 },
    { id: 'side-r', label: 'Right', w: H, h: W, parent: 'base', hinge: 'right', angle: 90, kind: 'panel', face: 'right', seq: 0.15 },
    { id: 'tab-lf', label: 'Tab', w: H, h: g, parent: 'side-l', hinge: 'bottom', angle: 90, kind: 'glue', face: 'inner', shape: 'glueB', seq: 0.5 },
    { id: 'tab-lb', label: 'Tab', w: H, h: g, parent: 'side-l', hinge: 'top', angle: 90, kind: 'glue', face: 'inner', shape: 'glueT', seq: 0.5 },
    { id: 'tab-rf', label: 'Tab', w: H, h: g, parent: 'side-r', hinge: 'bottom', angle: 90, kind: 'glue', face: 'inner', shape: 'glueB', seq: 0.5 },
    { id: 'tab-rb', label: 'Tab', w: H, h: g, parent: 'side-r', hinge: 'top', angle: 90, kind: 'glue', face: 'inner', shape: 'glueT', seq: 0.5 },
  ];
}

export const BOX_TYPES: BoxType[] = [
  {
    id: 'ste', name: 'Straight Tuck End', short: 'STE',
    desc: 'Both tuck flaps fold from the back panel — cleanest front face. The default retail folding carton.',
    tags: ['Retail', 'Cosmetics', 'Folding carton'], defaults: [80, 40, 140], build: (p) => tuckEnd(p, false),
  },
  {
    id: 'rte', name: 'Reverse Tuck End', short: 'RTE',
    desc: 'Top tucks from the back, bottom from the front. Most material-efficient — the cheapest to run.',
    tags: ['Retail', 'Pharma', 'Economy'], defaults: [70, 35, 120], build: (p) => tuckEnd(p, true),
  },
  {
    id: 'seal', name: 'Seal End Carton', short: 'SE',
    desc: 'Glue-sealed top and bottom flaps for tamper evidence and high-speed automatic filling.',
    tags: ['Food', 'Automated line'], defaults: [90, 45, 160], build: sealEnd,
  },
  {
    id: 'rsc', name: 'Regular Slotted Carton', short: 'RSC',
    desc: 'The classic corrugated shipper. Four equal flaps meet at the centre on both ends.',
    tags: ['Shipping', 'Corrugated'], defaults: [300, 200, 200], build: rsc,
  },
  {
    id: 'mailer', name: 'Roll End Mailer', short: 'REM',
    desc: 'E-commerce mailer with a front tuck lid and double-thickness side walls.',
    tags: ['E-commerce', 'Subscription'], defaults: [240, 180, 70], build: mailer, layFlat: true,
  },
  {
    id: 'sleeve', name: 'Sleeve', short: 'SLV',
    desc: 'Open-ended wrap that slides over a tray or product. Maximum print area, minimum board.',
    tags: ['Premium', 'Wrap'], defaults: [100, 50, 90], build: sleeve,
  },
  {
    id: 'tray', name: 'Open Tray', short: 'TRY',
    desc: 'Glued corner tray — pairs with a sleeve or lid for two-piece rigid style packaging.',
    tags: ['Two-piece', 'Gift'], defaults: [160, 110, 45], build: tray, layFlat: true,
  },
];

export const boxTypeById = (id: BoxTypeId) => BOX_TYPES.find((b) => b.id === id) ?? BOX_TYPES[0];

/* ------------------------------------------------------------------ */
/* net assembly                                                        */
/* ------------------------------------------------------------------ */

export function buildNet(typeId: BoxTypeId, params: BoxParams): Net {
  const type = boxTypeById(typeId);
  const specs = type.build(params);
  const byId: Record<string, Panel> = {};
  const panels: Panel[] = [];

  for (const s of specs) {
    const p: Panel = { ...s, x: 0, y: 0, outline: outlineFor(s), children: [] };
    byId[p.id] = p;
    panels.push(p);
  }
  for (const p of panels) {
    if (p.parent && byId[p.parent]) byId[p.parent].children.push(p);
  }
  const root = panels[0];

  // flat layout (y-down)
  const place = (p: Panel) => {
    for (const c of p.children) {
      switch (c.hinge) {
        case 'right': c.x = p.x + p.w; c.y = p.y; break;
        case 'left': c.x = p.x - c.w; c.y = p.y; break;
        case 'top': c.x = p.x; c.y = p.y - c.h; break;
        default: c.x = p.x; c.y = p.y + p.h; break;
      }
      place(c);
    }
  };
  place(root);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of panels) {
    for (const [ox, oy] of p.outline) {
      minX = Math.min(minX, p.x + ox); maxX = Math.max(maxX, p.x + ox);
      minY = Math.min(minY, p.y + oy); maxY = Math.max(maxY, p.y + oy);
    }
  }
  return {
    id: typeId, name: type.name, layFlat: !!type.layFlat, panels, byId, root,
    bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
  };
}

/** Absolute flat polygon for a panel. */
export function panelPoly(p: Panel): [number, number][] {
  return p.outline.map(([x, y]) => [p.x + x, p.y + y] as [number, number]);
}

/** Fold (crease) segment between a panel and its parent, in flat coords. */
export function creaseSegment(p: Panel, parent: Panel): [number, number, number, number] | null {
  switch (p.hinge) {
    case 'right': return [p.x, Math.max(p.y, parent.y), p.x, Math.min(p.y + p.h, parent.y + parent.h)];
    case 'left': return [p.x + p.w, Math.max(p.y, parent.y), p.x + p.w, Math.min(p.y + p.h, parent.y + parent.h)];
    case 'top': return [Math.max(p.x, parent.x), p.y + p.h, Math.min(p.x + p.w, parent.x + parent.w), p.y + p.h];
    case 'bottom': return [Math.max(p.x, parent.x), p.y, Math.min(p.x + p.w, parent.x + parent.w), p.y];
    default: return null;
  }
}

/** Board consumption + quick manufacturing metrics. */
export function netMetrics(net: Net, params: BoxParams, gsm: number) {
  const b = net.bounds;
  const sheet = (b.w * b.h) / 100; // cm²
  let used = 0;
  for (const p of net.panels) {
    const poly = p.outline;
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      a += x1 * y2 - x2 * y1;
    }
    used += Math.abs(a) / 2;
  }
  const usedCm = used / 100;
  const volumeL = (params.L * params.W * params.H) / 1e6;
  const weight = (usedCm / 10000) * gsm; // grams
  return {
    sheetW: b.w, sheetH: b.h,
    sheetArea: sheet, boardArea: usedCm,
    waste: sheet > 0 ? 1 - usedCm / sheet : 0,
    volumeL, weight,
    panels: net.panels.length,
  };
}
