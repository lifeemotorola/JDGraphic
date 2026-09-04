import { create } from 'zustand';
import { nanoid } from 'nanoid';
import {
  buildNet, boxTypeById, type BoxParams, type BoxTypeId, type Net,
} from './geometry';

export type ObjType = 'rect' | 'ellipse' | 'text' | 'image' | 'line';

/** Align uses the selection's shared bounding box; distribute spaces the
 *  selected objects evenly along an axis (edges of the first/last kept). */
export type ArrangeMode =
  | 'align-l' | 'align-c' | 'align-r'
  | 'align-t' | 'align-m' | 'align-b'
  | 'dist-h' | 'dist-v';

export interface DesignObject {
  id: string;
  name: string;
  type: ObjType;
  /** artboard coords in mm (flat space, y-down) */
  x: number; y: number; w: number; h: number;
  rot: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  fill: string;
  stroke: string;
  strokeW: number;
  radius: number;
  // text
  text: string;
  font: string;
  size: number;      // mm cap height-ish (font px size in mm)
  weight: number;
  align: CanvasTextAlign;
  tracking: number;
  lineHeight: number;
  // image
  src: string;
  fit: 'cover' | 'contain' | 'stretch';
}

export interface MaterialDef {
  id: string; name: string; color: string; inner: string;
  roughness: number; grain: number; gsm: number; caliper: number; note: string;
}

export const MATERIALS: MaterialDef[] = [
  { id: 'sbs', name: 'SBS White 350gsm', color: '#ffffff', inner: '#f4f1ea', roughness: 0.62, grain: 0.05, gsm: 350, caliper: 0.45, note: 'Bright coated one side — best for vivid CMYK.' },
  { id: 'kraft', name: 'Natural Kraft 300gsm', color: '#c8a074', inner: '#bb8f60', roughness: 0.86, grain: 0.28, gsm: 300, caliper: 0.42, note: 'Uncoated recycled look, warm brown fibre.' },
  { id: 'black', name: 'Black Board 400gsm', color: '#1b1b1e', inner: '#141416', roughness: 0.7, grain: 0.1, gsm: 400, caliper: 0.52, note: 'Dyed-through board for luxury and foil work.' },
  { id: 'grey', name: 'Recycled Grey 320gsm', color: '#b9b6ad', inner: '#a9a69c', roughness: 0.9, grain: 0.22, gsm: 320, caliper: 0.44, note: '100% post-consumer waste, visible fibre.' },
  { id: 'eflute', name: 'E-Flute Corrugated', color: '#d8c3a1', inner: '#c9b189', roughness: 0.88, grain: 0.35, gsm: 480, caliper: 1.5, note: 'Thin corrugate for durable retail and mailers.' },
  { id: 'bflute', name: 'B-Flute Corrugated', color: '#cbb08a', inner: '#bda07a', roughness: 0.9, grain: 0.4, gsm: 620, caliper: 3.0, note: 'Shipping strength — for RSC and heavy mailers.' },
];

export interface SceneState {
  fold: number;          // 0 flat .. 1 assembled
  autoRotate: boolean;
  bg: string;
  studio: 'softbox' | 'contrast' | 'warm' | 'cool';
  finish: 'matte' | 'gloss' | 'softTouch';
  shadow: boolean;
  showInner: boolean;
}

export interface Design {
  name: string;
  boxType: BoxTypeId;
  params: BoxParams;
  materialId: string;
  boardColor: string;
  innerColor: string;
  panelFills: Record<string, string>;
  objects: DesignObject[];
  scene: SceneState;
}

export interface ViewState {
  units: 'mm' | 'in';
  showDieline: boolean;
  showBleed: boolean;
  showSafe: boolean;
  showLabels: boolean;
  tab: 'structure' | 'design' | 'material' | 'scene' | 'export';
}

const defaultParams = (t: BoxTypeId): BoxParams => {
  const [L, W, H] = boxTypeById(t).defaults;
  return { L, W, H, caliper: 0.45, glue: Math.max(10, Math.min(20, W * 0.4)), bleed: 3 };
};

export const newObject = (type: ObjType, patch: Partial<DesignObject> = {}): DesignObject => ({
  id: nanoid(6),
  name: type === 'text' ? 'Text' : type === 'image' ? 'Image' : type === 'ellipse' ? 'Ellipse' : type === 'line' ? 'Line' : 'Rectangle',
  type,
  x: 0, y: 0, w: 40, h: type === 'text' ? 12 : type === 'line' ? 1 : 40,
  rot: 0, opacity: 1, locked: false, hidden: false,
  fill: type === 'text' ? '#111111' : '#e4572e',
  stroke: 'none', strokeW: 0.5, radius: 0,
  text: 'Your brand', font: 'Inter, system-ui, sans-serif', size: 9, weight: 700,
  align: 'center', tracking: 0, lineHeight: 1.2,
  src: '', fit: 'cover',
  ...patch,
});

interface Store {
  design: Design;
  view: ViewState;
  selection: string[];
  net: Net;
  past: Design[];
  future: Design[];
  dirty: number;

  commit: (fn: (d: Design) => void, coalesceKey?: string) => void;
  setView: (patch: Partial<ViewState>) => void;
  select: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  addObject: (o: DesignObject) => void;
  updateObject: (id: string, patch: Partial<DesignObject>, key?: string) => void;
  removeObjects: (ids: string[]) => void;
  duplicate: (ids: string[]) => void;
  reorder: (id: string, dir: 1 | -1 | 'front' | 'back') => void;
  arrange: (ids: string[], mode: ArrangeMode) => void;
  loadDesign: (d: Design) => void;
}

const clone = (d: Design): Design => JSON.parse(JSON.stringify(d));

export const startDesign = (): Design => ({
  name: 'Untitled carton',
  boxType: 'ste',
  params: defaultParams('ste'),
  materialId: 'sbs',
  boardColor: '#ffffff',
  innerColor: '#efe9dd',
  panelFills: { front: '#12343b', back: '#12343b', 'side-r': '#0d272c', 'side-l': '#0d272c', 'lid-top': '#e8c547', 'lid-bot': '#e8c547' },
  objects: [],
  scene: { fold: 1, autoRotate: true, bg: '#eceff3', studio: 'softbox', finish: 'matte', shadow: true, showInner: true },
});

let coalesce: { key: string; t: number } | null = null;

export const useStore = create<Store>((set, get) => ({
  design: startDesign(),
  view: { units: 'mm', showDieline: true, showBleed: true, showSafe: true, showLabels: true, tab: 'structure' },
  selection: [],
  net: buildNet('ste', defaultParams('ste')),
  past: [],
  future: [],
  dirty: 0,

  commit: (fn, key) => {
    const s = get();
    const prev = s.design;
    const next = clone(prev);
    fn(next);
    const now = Date.now();
    let past = s.past;
    const canCoalesce = key && coalesce && coalesce.key === key && now - coalesce.t < 700;
    if (!canCoalesce) past = [...s.past, prev].slice(-60);
    coalesce = key ? { key, t: now } : null;
    set({
      design: next,
      past,
      future: [],
      net: buildNet(next.boxType, next.params),
      dirty: s.dirty + 1,
    });
  },

  setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
  select: (ids) => set({ selection: ids }),

  undo: () => {
    const s = get();
    if (!s.past.length) return;
    const prev = s.past[s.past.length - 1];
    set({
      design: prev, past: s.past.slice(0, -1), future: [s.design, ...s.future].slice(0, 60),
      net: buildNet(prev.boxType, prev.params), dirty: s.dirty + 1, selection: [],
    });
  },
  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const nx = s.future[0];
    set({
      design: nx, past: [...s.past, s.design], future: s.future.slice(1),
      net: buildNet(nx.boxType, nx.params), dirty: s.dirty + 1, selection: [],
    });
  },

  addObject: (o) => {
    get().commit((d) => { d.objects.push(o); });
    set({ selection: [o.id] });
  },
  updateObject: (id, patch, key) => {
    get().commit((d) => {
      const o = d.objects.find((x) => x.id === id);
      if (o) Object.assign(o, patch);
    }, key ? `${key}:${id}` : undefined);
  },
  removeObjects: (ids) => {
    get().commit((d) => { d.objects = d.objects.filter((o) => !ids.includes(o.id)); });
    set({ selection: [] });
  },
  duplicate: (ids) => {
    const copies: string[] = [];
    get().commit((d) => {
      for (const id of ids) {
        const o = d.objects.find((x) => x.id === id);
        if (!o) continue;
        const c = { ...o, id: nanoid(6), x: o.x + 5, y: o.y + 5 };
        copies.push(c.id);
        d.objects.push(c);
      }
    });
    set({ selection: copies });
  },
  reorder: (id, dir) => {
    get().commit((d) => {
      const i = d.objects.findIndex((o) => o.id === id);
      if (i < 0) return;
      const [o] = d.objects.splice(i, 1);
      if (dir === 'front') d.objects.push(o);
      else if (dir === 'back') d.objects.unshift(o);
      else d.objects.splice(Math.max(0, Math.min(d.objects.length, i + dir)), 0, o);
    });
  },

  /** Align or distribute selected artwork (single undo entry, locked skipped). */
  arrange: (ids, mode) => {
    get().commit((d) => {
      const os = d.objects.filter((o) => ids.includes(o.id) && !o.locked);
      if (os.length < 2) return;
      const min = (k: (o: DesignObject) => number) => Math.min(...os.map(k));
      const max = (k: (o: DesignObject) => number) => Math.max(...os.map(k));
      const left = min((o) => o.x);
      const top = min((o) => o.y);
      const right = max((o) => o.x + o.w);
      const bottom = max((o) => o.y + o.h);
      const midX = (left + right) / 2;
      const midY = (top + bottom) / 2;
      switch (mode) {
        case 'align-l': os.forEach((o) => { o.x = left; }); break;
        case 'align-c': os.forEach((o) => { o.x = midX - o.w / 2; }); break;
        case 'align-r': os.forEach((o) => { o.x = right - o.w; }); break;
        case 'align-t': os.forEach((o) => { o.y = top; }); break;
        case 'align-m': os.forEach((o) => { o.y = midY - o.h / 2; }); break;
        case 'align-b': os.forEach((o) => { o.y = bottom - o.h; }); break;
        case 'dist-h': {
          const s = [...os].sort((a, b) => a.x - b.x);
          const span = (s[s.length - 1].x + s[s.length - 1].w) - s[0].x - s.reduce((n, o) => n + o.w, 0);
          const gap = Math.max(0, span / (s.length - 1));
          let cx = s[0].x;
          for (const o of s) { o.x = cx; cx += o.w + gap; }
          break;
        }
        case 'dist-v': {
          const s = [...os].sort((a, b) => a.y - b.y);
          const span = (s[s.length - 1].y + s[s.length - 1].h) - s[0].y - s.reduce((n, o) => n + o.h, 0);
          const gap = Math.max(0, span / (s.length - 1));
          let cy = s[0].y;
          for (const o of s) { o.y = cy; cy += o.h + gap; }
          break;
        }
      }
    }, 'arrange');
  },
  loadDesign: (d) => set((s) => ({
    design: d, past: [...s.past, s.design], future: [],
    net: buildNet(d.boxType, d.params), dirty: s.dirty + 1, selection: [],
  })),
}));

export const materialById = (id: string) => MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
export const setBoxType = (t: BoxTypeId) => {
  useStore.getState().commit((d) => {
    d.boxType = t;
    const base = defaultParams(t);
    d.params = { ...base, caliper: d.params.caliper, bleed: d.params.bleed };
  });
};
